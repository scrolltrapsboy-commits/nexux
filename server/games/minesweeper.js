const { rnd } = require('./util');
// One shared field, both players dig at once. Opened cells score, a mine costs points. The server owns the mines.
const W = 9, H = 9, N = W * H, MINES = 12, MS = 180000;
const nb = k => { const r = (k / W) | 0, x = k % W, o = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && r + dy >= 0 && r + dy < H && x + dx >= 0 && x + dx < W) o.push((r + dy) * W + x + dx); return o; };
const out = (s, reason) => s.scores[0] === s.scores[1] ? { draw: true, scores: s.scores, reason } : { winner: s.scores[0] > s.scores[1] ? 0 : 1, scores: s.scores, reason };
module.exports = {
  id: 'minesweeper', title: 'Minesweeper Duel', category: 'arcade', difficulty: 'Medium', min: 2, max: 2, watch: true,
  desc: 'Dig the same field at the same time. Safe cells score, mines cost you.',
  init: () => ({ gen: Date.now(), turn: -1, w: W, h: H, total: MINES, mines: null, nums: null, rev: Array(N).fill(false), flag: Array(N).fill(-1), boom: Array(N).fill(-1), scores: [0, 0], safeLeft: N - MINES, endsAt: Date.now() + MS }),
  onStart(s, ctx) { ctx.after(MS, () => ctx.end(out(s, 'time'))); },
  move(s, i, m) {
    const c = m.c; if (!Number.isInteger(c) || c < 0 || c >= N) return 'Pick a cell on the board.';
    if (m.t === 'flag') { if (s.rev[c]) return; s.flag[c] = s.flag[c] === -1 ? i : -1; return; }
    if (m.t !== 'rev') return 'Unknown action.';
    if (s.rev[c] || s.flag[c] >= 0) return 'That cell is already open or flagged.';
    if (!s.mines) { // the first dig is always safe: no mine on it or around it
      const bad = new Set([c, ...nb(c)]), pool = [...Array(N).keys()].filter(k => !bad.has(k)); s.mines = new Set();
      while (s.mines.size < MINES) s.mines.add(pool.splice(rnd(pool.length), 1)[0]);
      s.nums = Array.from({ length: N }, (_, k) => nb(k).filter(n => s.mines.has(n)).length);
    }
    if (s.mines.has(c)) { s.rev[c] = true; s.boom[c] = i; s.scores[i] -= 5; return; }
    const q = [c]; s.rev[c] = true;
    while (q.length) { const k = q.pop(); s.scores[i]++; s.safeLeft--; if (s.nums[k] === 0) nb(k).forEach(n => { if (!s.rev[n] && s.flag[n] < 0 && !s.mines.has(n)) { s.rev[n] = true; q.push(n); } }); }
    if (s.safeLeft <= 0) return out(s, 'cleared');
  },
  redact: s => ({ gen: s.gen, turn: -1, w: W, h: H, scores: s.scores, safeLeft: s.safeLeft, endsAt: s.endsAt, total: s.total, flag: s.flag, boom: s.boom, cells: s.rev.map((r, k) => (r ? (s.boom[k] >= 0 ? 9 : s.nums[k]) : -1)) }),
};
