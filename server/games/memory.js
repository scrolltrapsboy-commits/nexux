const { shuffle } = require('./util');
// Card faces stay on the server until a card is turned up.
const nextSeat = (s, from) => {
  const gone = s.gone || s.scores.map(() => false);
  for (let step = 1; step <= s.scores.length; step++) {
    const seat = (from + step) % s.scores.length;
    if (!gone[seat]) return seat;
  }
  return from;
};
module.exports = {
  id: 'memory', title: 'Memory', category: 'casual', difficulty: 'Easy', min: 2, max: 4, watch: true,
  desc: 'Turn cards and find pairs. Play with 2–4 players; a match keeps your turn.',
  init: (opts, n) => ({ gen: Date.now(), cards: shuffle([...'ABCDEFGHABCDEFGH']), matched: Array(16).fill(-1), up: [], turn: 0, scores: Array(n).fill(0), gone: Array(n).fill(false), lock: false }),
  move(s, i, m) {
    if (s.lock) return 'Wait for the cards to flip back.';
    const c = m.c; if (!Number.isInteger(c) || c < 0 || c > 15 || s.matched[c] >= 0 || s.up.includes(c)) return 'Pick a face-down card.';
    s.up.push(c); if (s.up.length < 2) return;
    const [a, b] = s.up;
    if (s.cards[a] === s.cards[b]) {
      s.matched[a] = s.matched[b] = i; s.scores[i]++; s.up = [];
      if (s.matched.every(x => x >= 0)) {
        const ranking = s.scores.map((score, seat) => seat).sort((a, b) => s.scores[b] - s.scores[a]);
        if (s.scores[ranking[0]] === s.scores[ranking[1]]) return { draw: true, scores: s.scores };
        const winner = ranking[0];
        return { ranking, scores: s.scores, flags: { perfect: s.scores.every((score, seat) => seat === winner || score === 0) } };
      }
      return; // a match keeps the turn
    }
    s.lock = true;
    return { defer: () => { s.up = []; s.lock = false; s.turn = nextSeat(s, i); }, ms: 1100 };
  },
  onLeave(s, i) {
    if (!s.gone) s.gone = s.scores.map(() => false);
    s.gone[i] = true;
    if (s.turn === i) { s.up = []; s.lock = false; s.turn = nextSeat(s, i); }
  },
  redact: s => ({ gen: s.gen, turn: s.turn, scores: s.scores, gone: s.gone || s.scores.map(() => false), lock: s.lock, matched: s.matched, up: s.up, cards: s.cards.map((v, k) => (s.up.includes(k) || s.matched[k] >= 0 ? v : null)) }),
};
