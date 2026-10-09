const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { boot, w, E } = require('./helper');
let T; before(async () => { T = await boot(); }); after(() => T.close());

test('friends: search, request, accept, presence, block', async () => {
  const A = await T.client('Alice'), B = await T.client('Bobby');
  const sr = await E(B, 'search', { q: 'Ali' }); assert.ok(sr.length && sr[0].id === A.me.id);
  await E(B, 'friend', { op: 'add', id: A.me.id }); await w(100); assert.equal(A.ev.friends.incoming.length, 1);
  await E(A, 'friend', { op: 'accept', id: B.me.id }); await w(120); assert.equal(A.ev.friends.friends.length, 1); assert.equal(B.ev.friends.friends[0].p, 'online');
  await E(A, 'friend', { op: 'block', id: B.me.id }); await w(100); assert.equal(A.ev.friends.friends.length, 0); assert.equal(A.ev.friends.blocked.length, 1);
  assert.ok((await E(B, 'dm:send', { id: A.me.id, text: 'hi' })).error, 'blocked users cannot DM');
});
test('invites: send, accept, presence shows in-game', async () => {
  const A = await T.client('Inv1'), B = await T.client('Inv2');
  await E(A, 'friend', { op: 'add', id: B.me.id }); await w(60); await E(B, 'friend', { op: 'accept', id: A.me.id }); await w(80);
  assert.ok(!(await E(A, 'invite', { id: B.me.id, game: 'chess' })).error); await w(100); assert.equal(B.ev.invite.game, 'chess');
  assert.ok(!(await E(B, 'invite:accept', { code: B.ev.invite.code })).error); await w(100); B.emit('ready'); await w(60); await E(A, 'start'); await w(150);
  assert.equal(B.ev.friends.friends[0].p, 'ingame'); assert.equal(B.ev.friends.friends[0].game, 'chess');
  assert.ok((await E(A, 'invite', { id: 'nobody', game: 'chess' })).error);
});
test('direct messages: friends only, live, unread, typing, seen, rate limit, persistence', async () => {
  const A = await T.client('DmA'), B = await T.client('DmB');
  assert.ok((await E(A, 'dm:send', { id: B.me.id, text: 'hi' })).error, 'not friends yet');
  await E(A, 'friend', { op: 'add', id: B.me.id }); await w(60); await E(B, 'friend', { op: 'accept', id: A.me.id }); await w(80);
  await E(A, 'dm:send', { id: B.me.id, text: 'hello <b>there</b>' }); await w(100);
  assert.equal(B.ev.dm.text, 'hello <b>there</b>', 'stored verbatim; the client escapes on render'); assert.equal(B.ev.unread[A.me.id], 1);
  assert.ok(B.ev.notes.some(n => n.go === 'dm:' + A.me.id && !n.read));
  A.emit('typing', { scope: 'dm', id: B.me.id }); await w(80); assert.equal(B.ev.typing.from, 'DmA');
  const o = await E(B, 'dm:open', { id: A.me.id }); await w(80); assert.equal(o.msgs.length, 1); assert.ok(!(B.ev.unread || {})[A.me.id]); assert.equal(A.ev['dm:seen'].id, B.me.id);
  let limited = false; for (let i = 0; i < 12; i++) if ((await E(A, 'dm:send', { id: B.me.id, text: 'x' + i })).error) limited = true; assert.ok(limited, 'rate limit kicks in');
  assert.ok((await E(A, 'dm:send', { id: B.me.id, text: '' })).error, 'empty rejected');
  const again = await T.client('', B.token); const o2 = await E(again, 'dm:open', { id: A.me.id }); assert.ok(o2.msgs && o2.msgs.length >= 1 && o2.msgs[0].text.startsWith('hello'), JSON.stringify(o2).slice(0, 200));
});
test('global chat: one channel for everybody, history on hello, rate limited, length capped', async () => {
  const A = await T.client('Gc1'), B = await T.client('Gc2');
  await E(A, 'chat', { scope: 'global', text: 'hello world' }); await w(100); assert.equal(B.ev.chat.text, 'hello world');
  const C = await T.client('Gc3'); assert.ok(C.hello.chat.some(m => m.text === 'hello world'));
  await E(A, 'chat', { scope: 'global', text: 'y'.repeat(900) }); await w(80); assert.ok(B.ev.chat.text.length <= 300);
  let limited = false; for (let i = 0; i < 15; i++) { const r = await E(A, 'chat', { scope: 'global', text: 'spam' + i }); if (r && r.error) limited = true; } assert.ok(limited);
});
test('room chat does not leak outside the room', async () => {
  const m = await T.match('tictactoe', ['Rc1', 'Rc2']), out = await T.client('Outsider');
  await E(m.A, 'chat', { scope: 'room', text: 'secret' }); await w(100); assert.equal(m.B.ev.chat.text, 'secret'); assert.equal(out.ev.chat, undefined);
});
test('profile edits: name, bio, avatar validation', async () => {
  const A = await T.client('Prof1'); await T.client('Taken1');
  assert.ok((await E(A, 'profile:update', { name: 'Taken1' })).error); assert.ok((await E(A, 'profile:update', { name: 'a' })).error);
  const r = await E(A, 'profile:update', { name: 'Prof_One', bio: 'I play chess' }); assert.equal(r.me.name, 'Prof_One');
  assert.ok(!(await E(A, 'avatar', { a: 7 })).error); assert.ok((await E(A, 'avatar', { a: 99 })).error);
  assert.equal((await E(A, 'profile', {})).bio, 'I play chess');
});
test('call signaling: room only, ICE config, relay, state, leave, outsiders blocked', async () => {
  const A = await T.client('CallA'), B = await T.client('CallB'), C = await T.client('CallC');
  assert.ok((await E(A, 'rtc:join', {})).error, 'a call needs a room');
  const r = await E(A, 'create', { game: 'tictactoe', priv: true }); await E(B, 'join', { code: r.code }); await w(60);
  const ja = await E(A, 'rtc:join', {}); assert.equal(ja.peers.length, 0); assert.ok(ja.ice[0].urls.startsWith('stun:'));
  const jb = await E(B, 'rtc:join', { cam: true }); await w(80); assert.deepEqual(jb.peers, [A.me.id]); assert.equal(A.ev['rtc:list'].find(x => x.id === B.me.id).cam, true);
  B.emit('rtc:signal', { to: A.me.id, data: { d: { type: 'offer', sdp: 'x' } } }); await w(80); assert.equal(A.ev['rtc:signal'].from, B.me.id);
  A.ev['rtc:signal'] = null; C.emit('rtc:signal', { to: A.me.id, data: { c: {} } }); await w(80); assert.equal(A.ev['rtc:signal'], null);
  A.emit('rtc:state', { mic: false, cam: false }); await w(80); assert.equal(B.ev['rtc:list'].find(x => x.id === A.me.id).mic, false);
  B.emit('rtc:leave'); await w(80); assert.equal(A.ev['rtc:list'].length, 1);
});
test('reconnect within the grace period returns you to your room', async () => {
  const m = await T.match('tictactoe', ['Re1', 'Re2']); const p = m.by(0), tok = p.token; p.disconnect(); await w(300);
  const back = await T.client('', tok); assert.ok(back.hello.room && back.hello.room.code === m.code); assert.equal(back.hello.room.status, 'playing');
});
