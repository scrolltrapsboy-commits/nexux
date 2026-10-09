// Reversi / Othello: flip lines of discs between yours. Passes are automatic when you have no legal move.
const D = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
function flips(b, p, r, c) {
  if (b[r * 8 + c] !== null) return [];
  const out = [];
  for (const [dr, dc] of D) {
    const line = []; let y = r + dr, x = c + dc;
    while (y >= 0 && y < 8 && x >= 0 && x < 8 && b[y * 8 + x] === 1 - p) { line.push(y * 8 + x); y += dr; x += dc; }
    if (line.length && y >= 0 && y < 8 && x >= 0 && x < 8 && b[y * 8 + x] === p) out.push(...line);
  }
  return out;
}
const legal = (b, p) => { const o = []; for (let k = 0; k < 64; k++) if (flips(b, p, k >> 3, k & 7).length) o.push(k); return o; };
const count = (b, p) => b.filter(x => x === p).length;
module.exports = {
  id: 'reversi', title: 'Reversi', category: 'board', difficulty: 'Medium', min: 2, max: 2, resign: true, watch: true,
  desc: 'Outflank your rival and flip their discs. Whoever owns more at the end wins.',
  init() { const b = Array(64).fill(null); b[27] = 1; b[28] = 0; b[35] = 0; b[36] = 1; return { board: b, turn: 0, last: null, passed: null, legal: legal(b, 0) }; },
  move(s, i, m) {
    const c = m.c; if (!Number.isInteger(c) || c < 0 || c > 63) return 'Pick a square.';
    const f = flips(s.board, i, c >> 3, c & 7); if (!f.length) return 'You must flip at least one disc.';
    s.board[c] = i; f.forEach(k => { s.board[k] = i; }); s.last = c; s.passed = null;
    let next = 1 - i, ln = legal(s.board, next);
    if (!ln.length) { const lm = legal(s.board, i); if (!lm.length) { const a = count(s.board, 0), b = count(s.board, 1); s.legal = []; return a === b ? { draw: true, scores: [a, b] } : { winner: a > b ? 0 : 1, scores: [a, b] }; } s.passed = next; next = i; ln = lm; }
    s.turn = next; s.legal = ln;
  },
};
