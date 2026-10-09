const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const { boot, w, E } = require('./helper');
let T; before(async () => { T = await boot(); }); after(() => T.close());

test('guest -> register upgrades the same account; passwords are hashed', async () => {
  const g = await T.rest('/guest', { name: 'Tester' }); assert.equal(g.status, 200); assert.ok(g.body.token);
  const r = await T.rest('/register', { username: 'Tester', password: 'correct horse 9' }, g.body.token);
  assert.equal(r.status, 200); assert.equal(r.body.me.id, g.body.me.id); assert.equal(r.body.me.guest, false);
  const row = T.app.db.get('SELECT pass_hash FROM users WHERE id=?', g.body.me.id); assert.match(row.pass_hash, /^scrypt\$/); assert.ok(!row.pass_hash.includes('correct'));
  const sess = T.app.db.all('SELECT token_hash FROM sessions'); assert.ok(sess.every(s => s.token_hash !== g.body.token && s.token_hash !== r.body.token), 'raw tokens are never stored');
});
test('duplicate names, weak passwords, bad logins are rejected', async () => {
  assert.equal((await T.rest('/register', { username: 'tester', password: 'whatever123' })).status, 400);
  assert.equal((await T.rest('/register', { username: 'NewOne', password: 'x' })).status, 400);
  assert.equal((await T.rest('/register', { username: '<b>hax</b>', password: 'whatever123' })).status, 400);
  assert.equal((await T.rest('/login', { username: 'Tester', password: 'wrong' })).status, 400);
  const ok = await T.rest('/login', { username: 'tester', password: 'correct horse 9' }); assert.equal(ok.status, 200); assert.ok(ok.body.token);
  assert.equal((await T.rest('/me', null, ok.body.token)).body.me.name, 'Tester'); assert.equal((await T.rest('/me', null, 'bogus')).status, 401);
});
test('logout kills the session; change password rotates it; reset flow works once', async () => {
  const l = (await T.rest('/login', { username: 'Tester', password: 'correct horse 9' })).body.token;
  assert.equal((await T.rest('/logout', {}, l)).status, 200); assert.equal((await T.rest('/me', null, l)).status, 401);
  const l2 = (await T.rest('/login', { username: 'Tester', password: 'correct horse 9' })).body.token;
  assert.equal((await T.rest('/password', { old: 'nope', new: 'another pass 1' }, l2)).status, 400);
  const ch = await T.rest('/password', { old: 'correct horse 9', new: 'another pass 1' }, l2); assert.equal(ch.status, 200);
  assert.equal((await T.rest('/login', { username: 'Tester', password: 'correct horse 9' })).status, 400);
  const f = await T.rest('/password/forgot', { username: 'Tester' }); assert.ok(f.body.token, 'test mode exposes the token; production only logs it');
  assert.equal((await T.rest('/password/reset', { token: f.body.token, password: 'brand new pw 3' })).status, 200);
  assert.equal((await T.rest('/password/reset', { token: f.body.token, password: 'again again 4' })).status, 400, 'reset tokens are single use');
  assert.equal((await T.rest('/login', { username: 'Tester', password: 'brand new pw 3' })).status, 200);
  assert.deepEqual((await T.rest('/password/forgot', { username: 'nobody-here' })).body.token, undefined);
});
test('socket hello with a stored token restores the same player', async () => {
  const a = await T.client('Persist'); const b = await T.client('', a.token); assert.equal(b.me.id, a.me.id);
});
test('wins feed Elo, XP, achievements and the leaderboard filters', async () => {
  const m = await T.match('tictactoe', ['Ranker', 'Loser']);
  for (const [seat, cell] of [[0, 0], [1, 3], [0, 1], [1, 4], [0, 2]]) await m.move(seat, { cell });
  await w(100); const win = m.by(0), lose = m.by(1);
  const prof = await E(win, 'profile', {}); assert.ok(prof.wins >= 1 && prof.perGame.some(s => s.game === 'tictactoe'));
  assert.ok(JSON.stringify(prof.achievements).includes('first_win'), 'first win achievement');
  const g = await E(win, 'leaderboard', { game: 'tictactoe', scope: 'global', period: 'day' }); assert.equal(g.rows[0].id, win.me.id); assert.ok(g.rows[0].rating > 1000);
  const none = await E(win, 'leaderboard', { game: 'chess', scope: 'global', period: 'all' }); assert.equal(none.rows.find(r => r.id === win.me.id), undefined);
  const fr = await E(win, 'leaderboard', { game: 'all', scope: 'friends', period: 'week' }); assert.ok(fr.rows.every(r => r.id === win.me.id));
  const rest = await T.rest('/leaderboard?game=tictactoe&period=month'); assert.equal(rest.status, 200); assert.ok(rest.body.rows.length >= 2);
  assert.ok((await E(lose, 'profile', {})).losses >= 1);
});
test('legacy data.json imports once and is idempotent', async () => {
  const f = path.join(os.tmpdir(), 'np-legacy-' + Date.now() + '.json');
  fs.writeFileSync(f, JSON.stringify({ users: { aa11: { name: 'OldAnn', avatar: 3, wins: 5, played: 9, friends: ['bb22'] }, bb22: { name: 'OldBob', friends: ['aa11'] } }, tokens: { oldtoken0123456789abcdef: 'aa11' }, dms: { 'aa11:bb22': [{ id: 'aa11', text: 'legacy hi', t: 1 }] } }));
  const S = await boot({ legacyJson: f }); try {
    const c = await S.client('', 'oldtoken0123456789abcdef'); assert.equal(c.me.name, 'OldAnn', 'old token still signs in'); assert.equal(c.me.id, 'aa11');
    const again = require('../server/database/migrations').importLegacy(S.app.db, f, S.app.cfg.sessionSecret); assert.equal(again.imported, false);
    assert.equal(S.app.db.all('SELECT * FROM users WHERE id IN (?,?)', 'aa11', 'bb22').length, 2);
  } finally { await S.close(); fs.unlinkSync(f); }
});

test('auth endpoints are rate limited per IP', async () => {
  const S = await boot({ rateScale: 1 }); try {
    let last = 0; for (let i = 0; i < 14; i++) last = (await S.rest('/login', { username: 'nobody', password: 'x' + i })).status;
    assert.equal(last, 429);
  } finally { await S.close(); }
});
