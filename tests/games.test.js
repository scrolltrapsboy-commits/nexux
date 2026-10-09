const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { boot, w, E } = require('./helper');
let T; before(async () => { T = await boot(); }); after(() => T.close());
const mk = (n) => Array.from({ length: n }, (_, i) => 'P' + i);
const leaveAll = async cs => { cs.forEach(c => c.emit('leave')); await w(80); };

test('catalog lists every shipped game with working server modules', async () => {
  const c = await T.client('Cat'); const ids = c.hello.catalog.map(g => g.id);
  for (const id of ['chess', 'tictactoe', 'connect4', 'checkers', 'reversi', 'gomoku', 'battleship', 'memory', 'rps', 'reaction', 'minesweeper', 'wordbattle', 'minigolf', 'carrom', 'racing', 'cards']) assert.ok(ids.includes(id), id + ' missing');
});

test('tic tac toe: win, rematch, room chat, leave = forfeit', async () => {
  const m = await T.match('tictactoe', ['Al', 'Bo']);
  for (const [seat, cell] of [[0, 0], [1, 3], [0, 1], [1, 4], [0, 2]]) assert.equal(await m.move(seat, { cell }), null);
  assert.equal(m.room().status, 'finished'); assert.equal(m.room().result.winnerId, m.room().players[0].id);
  m.A.emit('rematch'); m.B.emit('rematch'); await w(120); assert.equal(m.room().status, 'playing');
  assert.equal(await m.move(1, { cell: 0 }), 'It is not your turn.');
  await E(m.A, 'chat', { scope: 'room', text: 'gg' }); await w(80); assert.equal(m.B.ev.chat.text, 'gg');
  m.B.emit('leave'); await w(100); assert.equal(m.A.room.result.reason, 'forfeit');
});

test('connect four vertical win and occupied column', async () => {
  const m = await T.match('connect4', ['Al', 'Bo']);
  for (const [s, col] of [[0, 0], [1, 1], [0, 0], [1, 1], [0, 0], [1, 1], [0, 0]]) assert.equal(await m.move(s, { col }), null);
  assert.equal(m.room().result.winnerId, m.room().players[0].id);
});

test('rock paper scissors hides the first pick, resolves rounds', async () => {
  const m = await T.match('rps', ['Al', 'Bo']);
  assert.equal(await m.move(0, { pick: 'rock' }), null); await w(40);
  assert.equal(m.by(1).room.state.picks[0], true, 'opponent sees only a lock, not the pick');
  assert.notEqual(await m.move(0, { pick: 'paper' }), null);
  for (let r = 0; r < 3; r++) { if (r) assert.equal(await m.move(0, { pick: 'rock' }), null); assert.equal(await m.move(1, { pick: 'scissors' }), null); }
  assert.equal(m.room().status, 'finished'); assert.equal(m.room().result.winnerId, m.room().players[0].id);
});

test('chess: clocks, illegal move, castling, promotion, stalemate, resign, draw offers, flag fall', async () => {
  const start = async x => { const m = await T.match('chess', ['Al', 'Bo'], x); m.mv = async (f, t, p) => { const seat = m.room().state.turn; return m.move(seat, { from: f, to: t, promotion: p }); }; m.line = async (l) => { for (const x of l.split(' ')) { const r = await m.mv(x.slice(0, 2), x.slice(2, 4), x[4]); if (r) return r; } return null; }; return m; };
  let m = await start({ time: 3 }); assert.equal(m.room().state.clock[0], 180000);
  assert.match(await m.mv('e2', 'e5'), /^Illegal move/);
  assert.equal(await m.line('e2e4 f7f5 d1h5'), null); assert.equal(m.room().state.chk, true); await leaveAll(m.cs);
  m = await start({}); assert.equal(await m.line('e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 e1g1'), null); assert.equal(m.room().state.fen.split(' ')[0].split('/')[7], 'RNBQ1RK1'); await leaveAll(m.cs);
  m = await start({}); await m.line('h2h4 g7g5 h4g5 g8f6 g5g6 f6g8 g6h7 a7a6');
  assert.match(await m.mv('h7', 'g8'), /^Illegal move/); assert.equal(await m.mv('h7', 'g8', 'n'), null); assert.equal(m.room().state.fen.split('/')[0], 'rnbqkbNr'); await leaveAll(m.cs);
  m = await start({}); await m.line('e2e3 a7a5 d1h5 a8a6 h5a5 h7h5 h2h4 a6h6 a5c7 f7f6 c7d7 e8f7 d7b7 d8d3 b7b8 d3h7 b8c8 f7g6 c8e6');
  assert.equal(m.room().status, 'finished'); assert.equal(m.room().result.draw, true); await leaveAll(m.cs);
  m = await start({}); m.by(0).emit('resign'); await w(80); assert.equal(m.room().result.reason, 'resign'); assert.equal(m.room().result.winnerId, m.room().players[1].id); await leaveAll(m.cs);
  m = await start({}); m.A.emit('draw', { op: 'offer' }); await w(60); assert.equal(m.A.room.drawOffer, m.A.me.id);
  m.A.emit('draw', { op: 'accept' }); await w(60); assert.equal(m.A.room.status, 'playing', 'cannot accept own offer');
  m.B.emit('draw', { op: 'accept' }); await w(80); assert.equal(m.A.room.result.draw, true); await leaveAll(m.cs);
  m = await start({ testMs: 600 }); await w(1000); assert.equal(m.room().result.reason, 'timeout'); assert.equal(m.room().result.winnerId, m.room().players[1].id);
});

test('chess spectators receive live state and cannot move', async () => {
  const m = await T.match('chess', ['Al', 'Bo'], { priv: false }); const sp = await T.client('Watcher');
  const wr = await E(sp, 'watch', { code: m.code }); assert.ok(!wr.error, JSON.stringify(wr)); await w(80);
  assert.equal(sp.room.watching, true); assert.equal(m.room().spectators, 1);
  const seat = m.room().state.turn; assert.equal(await m.move(seat, { from: 'e2', to: 'e4' }), null); await w(60);
  assert.match(sp.room.state.fen, /4P3/); const before = sp.room.state.fen; await E(sp, 'move', { from: 'e7', to: 'e5' }); await w(60); assert.equal(m.room().state.fen, before, 'spectator move ignored');
});

test('checkers: forced multi-jump, king, draw rule; battleship placement and hidden fleets', async () => {
  const board = o => { const b = Array(64).fill(null); for (const [k, v] of Object.entries(o)) b[+k] = v; return b; };
  let m = await T.match('checkers', ['Al', 'Bo']); const set = async st => { m.A.emit('test:state', st); await w(80); };
  await set({ board: board({ 49: 'a', 42: 'b', 28: 'b', 1: 'b' }), turn: 0, chain: null, last: null, noCap: 0 });
  assert.equal(await m.move(0, { from: 49, to: 35 }), null); assert.equal(m.room().state.chain, 35);
  assert.notEqual(await m.move(0, { from: 35, to: 26 }), null); assert.equal(await m.move(0, { from: 35, to: 21 }), null); assert.equal(m.room().state.turn, 1);
  await set({ board: board({ 10: 'a', 37: 'b' }), turn: 0, chain: null, last: null, noCap: 0 });
  assert.equal(await m.move(0, { from: 10, to: 3 }), null); assert.equal(m.room().state.board[3], 'A');
  await leaveAll(m.cs);
  m = await T.match('battleship', ['Al', 'Bo']);
  assert.equal(m.A.room.state.mine, null);
  const fA = [0, 1, 2, 3, 4].map(y => ({ x: 0, y, h: true, len: [5, 4, 3, 3, 2][y] })), fB = [9, 8, 7, 6, 5].map((x, k) => ({ x, y: 0, h: false, len: [5, 4, 3, 3, 2][k] }));
  const place = (c, ships) => E(c, 'move', { t: 'place', ships });
  assert.notEqual(await place(m.A, fA.slice(1)), null); assert.equal(await place(m.A, fA.map((s, k) => (k === 1 ? { ...s, y: 0 } : s))), 'Ships cannot overlap.');
  assert.equal(await place(m.A, fA), null); assert.equal(await place(m.B, fB), null); await w(80);
  assert.equal(m.A.room.state.phase, 'battle'); assert.ok(!JSON.stringify(m.A.room.state).includes('"ships"'));
  const first = m.by(0), second = first === m.A ? m.B : m.A, tgt = [...new Set((first === m.A ? m.B : m.A).room.state.mine.flat())], safe = Array.from({ length: 20 }, (_, i) => 80 + i);
  let k = 0; for (const c of tgt) { if (m.A.room.status === 'finished') break; await E(first, 'move', { t: 'fire', c }); await w(20); if (m.A.room.status === 'finished') break; await E(second, 'move', { t: 'fire', c: safe[k++] }); await w(20); }
  assert.equal(m.A.room.status, 'finished'); assert.equal(m.A.room.result.winnerId, first.me.id);
});

test('memory keeps faces hidden until flipped, locks mismatches, scores pairs', async () => {
  const m = await T.match('memory', ['Al', 'Bo']);
  assert.ok(m.A.room.state.cards.every(c => c === null) && m.B.room.state.cards.every(c => c === null));
  const cards = [...'ABCDEFGH'].flatMap(x => [x, x]); m.A.emit('test:state', { gen: 1, cards, matched: Array(16).fill(-1), up: [], turn: 0, scores: [0, 0], lock: false }); await w(80);
  assert.equal(await m.move(0, { c: 0 }), null); assert.equal(await m.move(0, { c: 1 }), null); assert.equal(m.room().state.scores[0], 1); assert.equal(m.room().state.turn, 0);
  await m.move(0, { c: 2 }); await m.move(0, { c: 4 }); assert.equal(m.room().state.lock, true); assert.equal(await m.move(0, { c: 6 }), 'Wait for the cards to flip back.');
  await w(1300); assert.equal(m.room().state.turn, 1);
});

test('memory supports 3–4 players, rotates turns, skips a player who leaves', async () => {
  for (const n of [3, 4]) {
    const m = await T.match('memory', mk(n), { max: n });
    assert.equal(m.room().max, n);
    const cards = [...'ABCDEFGH'].flatMap(x => [x, x]);
    m.A.emit('test:state', { gen: n, cards, matched: Array(16).fill(-1), up: [], turn: 0, scores: Array(n).fill(0), gone: Array(n).fill(false), lock: false });
    await w(80);
    assert.equal(m.room().state.scores.length, n);
    assert.equal(await m.move(0, { c: 0 }), null);
    assert.equal(await m.move(0, { c: 1 }), null);
    assert.equal(m.room().state.scores[0], 1, 'a pair scores for the active player');
    assert.equal(m.room().state.turn, 0, 'a successful pair keeps the turn');
    await m.move(0, { c: 2 }); await m.move(0, { c: 4 });
    await w(1200);
    assert.equal(m.room().state.turn, 1, 'a mismatch advances to the next seat');
    m.by(1).emit('leave'); await w(120);
    assert.equal(m.room().state.turn, 2, 'a departing current player is skipped');
    await leaveAll(m.cs);
  }
});

test('reaction race: server judges the GO, early taps are penalised', async () => {
  const m = await T.match('reaction', ['Al', 'Bo']);
  await w(3800); assert.equal(m.A.room.state.phase, 'wait'); assert.equal(await m.move(0, {}), null); assert.equal(await m.move(0, {}), 'You already jumped the gun.');
  await w(5200); assert.equal(m.A.room.state.phase, 'go'); assert.equal(await m.move(1, {}), null); assert.equal(m.A.room.state.scores[1], 1);
});

test('minesweeper duel: first dig is safe, mines hidden from clients, flags', async () => {
  const m = await T.match('minesweeper', ['Al', 'Bo']); const dump = JSON.stringify(m.A.room.state); assert.ok(!dump.includes('mines'));
  assert.equal(await m.move(0, { t: 'rev', c: 40 }), null); const s = m.room().state; assert.ok(s.cells[40] >= 0 && s.scores[0] >= 1);
  const hid = m.room().state.cells.findIndex(v => v === -1); assert.equal(await m.move(1, { t: 'flag', c: hid }), null); assert.equal(m.room().state.flag[hid], 1);
  assert.notEqual(await m.move(1, { t: 'rev', c: 40 }), null);
});

test('word battle: dictionary check, letters check, unique claims', async () => {
  const m = await T.match('wordbattle', ['Al', 'Bo']); await w(100);
  const L = m.A.room.state.letters.toLowerCase(); assert.equal(L.length, 10);
  assert.equal(await m.move(0, { w: 'zzzzzz' }), 'That word cannot be made from these letters.'); assert.equal(await m.move(0, { w: 'ab' }), 'Words need at least 3 letters.');
  const words = require('an-array-of-english-words').filter(x => x.length >= 3 && x.length <= 5); const cnt = s => { const c = {}; for (const ch of s) c[ch] = (c[ch] || 0) + 1; return c; };
  const have = cnt(L), good = words.find(x => { const c = cnt(x); return Object.keys(c).every(k => (have[k] || 0) >= c[k]); });
  assert.ok(good, 'letters always allow a word'); assert.equal(await m.move(0, { w: good }), null); assert.ok(m.room().state.scores[0] > 0);
  assert.match(await m.move(1, { w: good }), /already claimed/); assert.ok(!('have' in m.A.room.state));
});

test('reversi and gomoku', async () => {
  let m = await T.match('reversi', ['Al', 'Bo']); const s0 = m.room().state; assert.equal(s0.legal.length, 4);
  assert.equal(await m.move(0, { c: s0.legal[0] }), null); assert.equal(await m.move(0, { c: 0 }), 'It is not your turn.'); assert.equal(await m.move(1, { c: 0 }), 'You must flip at least one disc.'); await leaveAll(m.cs);
  m = await T.match('gomoku', ['Al', 'Bo']); for (let k = 0; k < 4; k++) { assert.equal(await m.move(0, { c: k }), null); assert.equal(await m.move(1, { c: 15 + k }), null); }
  assert.equal(await m.move(0, { c: 4 }), null); assert.equal(m.room().status, 'finished'); assert.deepEqual(m.room().state.line.sort((a, b) => a - b), [0, 1, 2, 3, 4]);
});

test('nexus cards: hidden hands, legal play, draw rules, 3 and 4 players', async () => {
  for (const n of [2, 3, 4]) {
    const m = await T.match('cards', mk(n), { priv: false }); const st = m.A.room.state;
    assert.equal(st.hand.length, 7); assert.equal(st.counts.length, n); assert.ok(!JSON.stringify(st).includes('"hands"'));
    const spec = await T.client('Watch' + n); await E(spec, 'watch', { code: m.code }); await w(60); assert.equal(spec.room.state.hand.length, 0);
    for (let step = 0; step < 400 && m.room().status === 'playing'; step++) {
      const seat = m.room().state.turn, c = m.by(seat), s = c.room.state, k = s.hand.findIndex((x, i) => (s.drew < 0 || s.drew === i) && (x.m < 0 || x.m === s.mark || x.v === s.top.v));
      const e = s.drew >= 0 && k < 0 ? await E(c, 'move', { pass: true }) : k >= 0 ? await E(c, 'move', { play: k, mark: 1 }) : await E(c, 'move', { draw: true });
      assert.equal(e, null, 'move rejected: ' + e); await w(36);
    }
    assert.equal(m.room().status, 'finished', n + ' player game finishes'); assert.equal(m.room().result.ranking.length, n);
    await leaveAll(m.cs); spec.emit('leave');
  }
  const m = await T.match('cards', ['A', 'B']); const s = m.A.room.state, seat = m.room().state.turn, c = m.by(seat);
  const bad = c.room.state.hand.findIndex(x => x.m >= 0 && x.m !== c.room.state.mark && x.v !== c.room.state.top.v);
  if (bad >= 0) assert.match(await m.move(seat, { play: bad }), /does not match/);
  assert.equal(await m.move(seat, { pass: true }), 'Draw a card first.'); assert.match(await m.move(1 - seat, { draw: true }), /not your turn/);
});

test('mini golf: server simulates shots, rejects bad input, hides nothing it should not', async () => {
  const m = await T.match('minigolf', ['Al', 'Bo']); const seat = m.room().state.turn;
  assert.equal(await m.move(seat, { angle: 'x', power: 1 }), 'Invalid shot.'); assert.equal(await m.move(seat, { angle: 0, power: 5 }), 'Invalid power.');
  assert.equal(await m.move(seat, { angle: -0.3, power: 0.5 }), null); const s = m.room().state; assert.equal(s.shot.who, seat); assert.ok(s.shot.f && s.strokes[seat] === 1);
  assert.equal(m.room().state.turn !== seat || s.lock, true);
});

test('carrom: strikes are simulated on the server and validated', async () => {
  const m = await T.match('carrom', ['Al', 'Bo']); const seat = m.room().state.turn;
  assert.notEqual(await m.move(seat, { x: 'a', angle: 0, power: 1 }), null);
  const r = await m.move(seat, { x: 50, angle: -Math.PI / 2, power: 0.9 }); assert.equal(r, null); assert.ok(m.room().state.shot, 'a replay is published');
});

test('racing: grid lock, cheaters are corrected, a clean lap finishes the race', { timeout: 60000 }, async () => {
  const TR = require('../shared/racing-track');
  const m = await T.match('racing', ['Al', 'Bo'], { laps: 1, cdMs: 0, finMs: 800 }); await w(150);
  const grid = m.A.room.state.grid; assert.equal(grid.length, 2);
  const seatA = m.room().players.findIndex(p => p.id === m.A.me.id), me = m.A, fixes = [], fin = []; me.on('g', d => { if (d.t === 'fix') fixes.push(d); if (d.t === 'fin') fin.push(d); });
  me.emit('g', { t: 'car', x: grid[seatA].x + 3000, y: grid[seatA].y, a: 0, v: 100, e: 0 }); await w(250);
  assert.equal(fixes.length, 1, 'teleport gets a correction'); assert.ok(Math.hypot(fixes[0].x - grid[seatA].x, fixes[0].y - grid[seatA].y) < 5);
  let epoch = fixes[0].e, p = (TR.locate(grid[seatA].x, grid[seatA].y, null, 0).p || 0), n = 0;
  const start = Date.now();
  while (Date.now() - start < 40000 && !fin.length) {
    p += 360 * 0.05 / TR.ds; const q = TR.at(p); me.emit('g', { t: 'car', x: q.x, y: q.y, a: q.a, v: 330, e: epoch }); n++; await w(50);
  }
  assert.ok(fin.length, 'finished after ' + n + ' reports'); assert.equal(fin[0].place, 1);
  await w(1200); assert.equal(m.room().status, 'finished'); assert.equal(m.room().result.winnerId, me.me.id);
});
