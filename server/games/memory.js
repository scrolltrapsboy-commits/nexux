const { shuffle } = require('./util');
// Card faces stay on the server until a card is turned up.
module.exports = {
  id: 'memory', title: 'Memory', category: 'casual', difficulty: 'Easy', min: 2, max: 2, watch: true,
  desc: 'Turn cards and find pairs. A match keeps your turn.',
  init: () => ({ gen: Date.now(), cards: shuffle([...'ABCDEFGHABCDEFGH']), matched: Array(16).fill(-1), up: [], turn: 0, scores: [0, 0], lock: false }),
  move(s, i, m) {
    if (s.lock) return 'Wait for the cards to flip back.';
    const c = m.c; if (!Number.isInteger(c) || c < 0 || c > 15 || s.matched[c] >= 0 || s.up.includes(c)) return 'Pick a face-down card.';
    s.up.push(c); if (s.up.length < 2) return;
    const [a, b] = s.up;
    if (s.cards[a] === s.cards[b]) {
      s.matched[a] = s.matched[b] = i; s.scores[i]++; s.up = [];
      if (s.matched.every(x => x >= 0)) return s.scores[0] === s.scores[1] ? { draw: true, scores: s.scores } : (w => ({ winner: w, scores: s.scores, flags: { perfect: s.scores[1 - w] === 0 } }))(s.scores[0] > s.scores[1] ? 0 : 1);
      return; // a match keeps the turn
    }
    s.lock = true;
    return { defer: () => { s.up = []; s.lock = false; s.turn = 1 - i; }, ms: 1100 };
  },
  redact: s => ({ gen: s.gen, turn: s.turn, scores: s.scores, lock: s.lock, matched: s.matched, up: s.up, cards: s.cards.map((v, k) => (s.up.includes(k) || s.matched[k] >= 0 ? v : null)) }),
};
