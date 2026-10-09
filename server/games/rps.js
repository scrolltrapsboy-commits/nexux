module.exports = {
  id: 'rps', title: 'Rock Paper Scissors', category: 'casual', difficulty: 'Easy', min: 2, max: 2, watch: true,
  desc: 'First to three round wins. Both players lock in at the same time.',
  init: () => ({ picks: [null, null], score: [0, 0], round: 1, last: null, turn: -1, worst: [0, 0] }),
  move(s, i, m) {
    if (!['rock', 'paper', 'scissors'].includes(m.pick)) return 'Choose rock, paper or scissors.';
    if (s.picks[i]) return 'You already locked in.';
    s.picks[i] = m.pick;
    if (!s.picks[0] || !s.picks[1]) return;
    const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' }, [a, b] = s.picks;
    const w = a === b ? -1 : beats[a] === b ? 0 : 1;
    if (w >= 0) s.score[w]++;
    s.worst[0] = Math.min(s.worst[0], s.score[0] - s.score[1]); s.worst[1] = Math.min(s.worst[1], s.score[1] - s.score[0]);
    s.last = { picks: [a, b], w }; s.picks = [null, null]; s.round++;
    const win = s.score[0] >= 3 ? 0 : s.score[1] >= 3 ? 1 : -1;
    if (win >= 0) return { winner: win, scores: s.score, flags: { perfect: s.score[1 - win] === 0, comeback: s.worst[win] <= -2 ? win : -1 } };
  },
  redact: (s, k) => ({ ...s, worst: undefined, picks: s.picks.map((x, j) => (x === null ? null : j === k ? x : true)) }),
};
