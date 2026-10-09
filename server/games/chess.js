const { Chess } = require('chess.js');
module.exports = {
  id: 'chess', title: 'Chess', category: 'board', difficulty: 'Hard', min: 2, max: 2, resign: true, draws: true, watch: true,
  desc: 'Full rules with server-side clocks, promotion choice, draw offers and live spectators.',
  options: { time: [1, 3, 5, 10] },
  sanitizeOpts: (d, test) => ({ time: [1, 3, 5, 10].includes(+d.time) ? +d.time : 5, ms: (test && +d.testMs) || null }),
  init(o) { const ms = o.ms || o.time * 60000; return { fen: new Chess().fen(), turn: 0, last: null, chk: false, clock: [ms, ms], ts: Date.now(), moves: [] }; },
  move(s, i, m) {
    if (!/^[a-h][1-8]$/.test(m.from) || !/^[a-h][1-8]$/.test(m.to)) return 'Illegal move.';
    const c = new Chess(s.fen), mv = { from: m.from, to: m.to };
    if (/^[qrbn]$/.test(m.promotion)) mv.promotion = m.promotion; // the player must choose the promotion piece
    let res; try { res = c.move(mv); } catch { return 'Illegal move.'; }
    const now = Date.now(); s.clock[i] -= now - s.ts; s.ts = now;
    if (s.clock[i] <= 0) { s.clock[i] = 0; return { winner: 1 - i, reason: 'timeout' }; }
    s.fen = c.fen(); s.last = [m.from, m.to]; s.chk = c.inCheck(); s.turn = 1 - i; s.moves.push(res.san); if (s.moves.length > 200) s.moves.shift();
    if (c.isCheckmate()) return { winner: i, reason: 'checkmate' };
    if (c.isStalemate()) return { draw: true, reason: 'stalemate' };
    if (c.isDraw()) return { draw: true, reason: 'draw' };
  },
  // flag-fall is enforced by the room (it re-arms this timer after every move)
  clockLeft: s => s.clock[s.turn] - (Date.now() - s.ts),
};
