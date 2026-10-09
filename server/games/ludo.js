const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const START = [0, 13, 26, 39];
const FINISH = 58;
const activeSeats = n => Array.from({ length: n }, (_, i) => i);
const globalPos = (seat, step) => (START[seat] + step) % 52;
const canMove = (s, seat, token) => {
  const p = s.pawns[seat][token];
  if (p === FINISH) return false;
  if (p === -1) return s.die === 6;
  return p + s.die <= FINISH;
};
const nextActive = (s, from) => {
  for (let k = 1; k <= s.pawns.length; k++) {
    const i = (from + k) % s.pawns.length;
    if (!s.done[i]) return i;
  }
  return from;
};
module.exports = {
  id: 'ludo', title: 'Ludo', category: 'board', difficulty: 'Easy', min: 2, max: 4, watch: true,
  desc: 'Classic Ludo for 2–4 players. Roll a six to leave home, capture opponents, and race all four pawns to the finish.',
  init: (opts, n) => ({ pawns: Array.from({ length: n }, () => [-1, -1, -1, -1]), turn: 0, phase: 'roll', die: null, rolledBy: null, done: Array(n).fill(false), last: null }),
  move(s, i, m) {
    if (s.phase === 'roll') {
      if (m.action !== 'roll') return 'Roll the die first.';
      s.die = 1 + Math.floor(Math.random() * 6);
      s.rolledBy = i; s.phase = 'move'; s.last = { seat: i, die: s.die, token: null, captured: null };
      if (!s.pawns[i].some((p, t) => canMove(s, i, t))) {
        const rolledSix = s.die === 6;
        s.phase = 'roll'; s.die = null; s.turn = rolledSix ? i : nextActive(s, i);
        s.last = { seat: i, die: s.last.die, token: null, captured: null, note: 'No legal move' };
      }
      return;
    }
    if (s.phase !== 'move' || s.rolledBy !== i || s.turn !== i) return 'Roll before moving a pawn.';
    const t = m.token;
    if (!Number.isInteger(t) || t < 0 || t > 3 || !canMove(s, i, t)) return 'That pawn cannot move with this roll.';
    let p = s.pawns[i][t];
    if (p === -1) p = 0;
    else p += s.die;
    s.pawns[i][t] = p;
    let captured = null;
    if (p < 52) {
      const cell = globalPos(i, p);
      if (!SAFE.has(cell)) {
        for (let j = 0; j < s.pawns.length; j++) if (j !== i) {
          for (let k = 0; k < 4; k++) if (s.pawns[j][k] >= 0 && s.pawns[j][k] < 52 && globalPos(j, s.pawns[j][k]) === cell) {
            s.pawns[j][k] = -1; captured = { seat: j, token: k };
          }
        }
      }
    }
    s.last = { seat: i, die: s.die, token: t, captured };
    if (s.pawns[i].every(x => x === FINISH)) { s.done[i] = true; return { winner: i }; }
    const six = s.die === 6, finishedPawn = p === FINISH;
    s.phase = 'roll'; s.die = null; s.rolledBy = null;
    s.turn = (six || captured || finishedPawn) ? i : nextActive(s, i);
  },
};
