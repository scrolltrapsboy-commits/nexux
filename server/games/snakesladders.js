const JUMPS = Object.freeze({
  4: 14, 9: 31, 20: 38, 28: 84, 40: 59, 51: 67, 63: 81, 71: 91,
  17: 7, 54: 34, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 99: 78,
});
module.exports = {
  id: 'snakesladders', title: 'Snakes & Ladders', category: 'board', difficulty: 'Easy', min: 2, max: 4, watch: true,
  desc: 'Roll the die, climb ladders, avoid snakes, and reach square 100 first. For 2–4 players.',
  init: (opts, n) => ({ positions: Array(n).fill(0), turn: 0, die: null, last: null, jumps: JUMPS }),
  move(s, i, m) {
    if (m.action !== 'roll') return 'Roll the die to move.';
    const die = 1 + Math.floor(Math.random() * 6);
    const from = s.positions[i];
    const target = from + die;
    let to = target <= 100 ? target : from;
    let jump = null;
    if (to !== from && s.jumps[to]) { jump = { from: to, to: s.jumps[to], type: s.jumps[to] > to ? 'ladder' : 'snake' }; to = jump.to; }
    s.positions[i] = to;
    s.die = die;
    s.last = { seat: i, die, from, landed: target <= 100 ? target : from, to, jump, overshoot: target > 100 };
    if (to === 100) return { winner: i };
    s.turn = (die === 6) ? i : (i + 1) % s.positions.length;
  },
};
