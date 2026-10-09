// American checkers: forced captures, multi-jumps, kings. Board cells: 'a'/'A' = seat 0 man/king, 'b'/'B' = seat 1.
const same = (x, y) => x.toLowerCase() === y.toLowerCase();
const dirsOf = c => c === 'a' ? [[-1, -1], [-1, 1]] : c === 'b' ? [[1, -1], [1, 1]] : [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const inb = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
function caps(b, i) { const out = []; for (const [dr, dc] of dirsOf(b[i])) { const r = (i >> 3) + dr, c = (i & 7) + dc, r2 = r + dr, c2 = c + dc; if (inb(r2, c2) && b[r * 8 + c] && !same(b[r * 8 + c], b[i]) && !b[r2 * 8 + c2]) out.push([i, r2 * 8 + c2, r * 8 + c]); } return out; }
function legal(b, p, chain) {
  const mine = chain != null ? [chain] : b.map((c, i) => (c && same(c, p === 0 ? 'a' : 'b') ? i : -1)).filter(i => i >= 0);
  const cs = mine.flatMap(i => caps(b, i)); if (cs.length || chain != null) return cs;
  return mine.flatMap(i => dirsOf(b[i]).map(([dr, dc]) => [i, ((i >> 3) + dr) * 8 + (i & 7) + dc, null, (i >> 3) + dr, (i & 7) + dc]).filter(m => inb(m[3], m[4]) && !b[m[1]]).map(m => [m[0], m[1]]));
}
module.exports = {
  id: 'checkers', title: 'Checkers', category: 'board', difficulty: 'Medium', min: 2, max: 2, resign: true, watch: true,
  desc: 'Forced captures, multi-jumps and kings. Clear the board or block your rival.',
  init: () => ({ board: Array.from({ length: 64 }, (_, i) => ((i >> 3) + (i & 7)) % 2 ? ((i >> 3) < 3 ? 'b' : (i >> 3) > 4 ? 'a' : null) : null), turn: 0, chain: null, last: null, noCap: 0 }),
  move(s, i, m) {
    if (!Number.isInteger(m.from) || !Number.isInteger(m.to)) return 'Illegal move.';
    const mv = legal(s.board, i, s.chain).find(x => x[0] === m.from && x[1] === m.to);
    if (!mv) return 'Illegal move. A capture is mandatory when one is available.';
    const b = s.board; let c = b[mv[0]]; b[mv[0]] = null; const jumped = mv.length > 2; if (jumped) b[mv[2]] = null;
    const promo = (c === 'a' && mv[1] < 8) || (c === 'b' && mv[1] >= 56); if (promo) c = c.toUpperCase();
    b[mv[1]] = c; s.last = [mv[0], mv[1]];
    if (jumped && !promo && caps(b, mv[1]).length) { s.chain = mv[1]; return; } // the same piece must keep jumping
    s.chain = null; s.turn = 1 - i; s.noCap = jumped ? 0 : s.noCap + 1;
    if (!legal(b, 1 - i, null).length) return { winner: i };
    if (s.noCap >= 80) return { draw: true };
  },
  redact: s => ({ ...s, targets: legal(s.board, s.turn, s.chain).map(m => [m[0], m[1]]) }),
};
