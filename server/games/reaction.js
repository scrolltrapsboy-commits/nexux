// The server stamps "GO" and judges every tap by its own arrival time, so a fast connection cannot cheat.
module.exports = {
  id: 'reaction', title: 'Reaction Race', category: 'arcade', difficulty: 'Easy', min: 2, max: 2, watch: true,
  desc: 'Wait for the screen to change, then tap first. Best of five points.',
  init: () => ({ gen: Date.now(), turn: -1, phase: 'count', cdAt: 0, round: 1, scores: [0, 0], fs: [false, false], goAt: null, last: null, target: 3, worst: [0, 0] }),
  onStart(s, ctx) {
    const next = ms => {
      s.phase = 'count'; s.cdAt = Date.now() + ms; s.fs = [false, false]; s.goAt = null; ctx.push();
      ctx.after(ms, () => {
        s.phase = 'wait'; ctx.push();
        ctx.after(1500 + Math.random() * 3000, () => {
          s.phase = 'go'; s.goAt = Date.now(); ctx.push();
          ctx.after(5000, () => { if (s.phase === 'go') { s.last = { void: true }; s.phase = 'result'; ctx.push(); ctx.after(1500, () => next(1500)); } });
        });
      });
    };
    s.next = next; next(3500);
  },
  move(s, i, m, ctx) {
    if (s.phase === 'wait') {
      if (s.fs[i]) return 'You already jumped the gun.';
      s.fs[i] = true;
      if (s.fs[0] && s.fs[1]) { s.phase = 'result'; s.last = { void: true, both: true }; ctx.after(1500, () => s.next(1500)); }
      return;
    }
    if (s.phase !== 'go') return;
    if (s.fs[i]) return 'You jumped the gun this round.';
    const ms = Date.now() - s.goAt; s.scores[i]++; s.last = { w: i, ms }; s.phase = 'result'; s.round++;
    s.worst[0] = Math.min(s.worst[0], s.scores[0] - s.scores[1]); s.worst[1] = Math.min(s.worst[1], s.scores[1] - s.scores[0]);
    if (s.scores[i] >= s.target) return { winner: i, scores: s.scores, flags: { perfect: s.scores[1 - i] === 0, comeback: s.worst[i] <= -2 ? i : -1 } };
    ctx.after(2200, () => s.next(1500));
  },
  redact: s => { const { next, worst, ...rest } = s; return rest; },
};
