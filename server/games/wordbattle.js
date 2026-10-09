const { rnd } = require('./util');
// Needs a dictionary: if the word list package is missing the game is left out of the catalog instead of faking it.
let DICT = null;
try { DICT = new Set(require('an-array-of-english-words').filter(w => w.length >= 3 && w.length <= 10)); } catch {}
const BAG = 'EEEEEEEEEEEEAAAAAAAAAIIIIIIIIIOOOOOOOONNNNNNRRRRRRTTTTTTLLLLSSSSUUUUDDDDGGGBBCCMMPPFFHHVVWWYYKJXQZ';
const cnt = w => { const c = {}; for (const ch of w) c[ch] = (c[ch] || 0) + 1; return c; };
const canMake = (w, have) => { const c = cnt(w); for (const k in c) if (!have[k] || have[k] < c[k]) return false; return true; };
const pts = n => ({ 3: 1, 4: 2, 5: 4, 6: 6, 7: 9 }[n] || 12);
function newLetters() {
  for (;;) {
    const L = Array.from({ length: 10 }, () => BAG[rnd(BAG.length)]).join(''), v = (L.match(/[AEIOU]/g) || []).length;
    if (v < 3 || v > 5) continue;
    const have = cnt(L.toLowerCase()); let n = 0;
    for (const w of DICT) if (canMake(w, have) && ++n >= 25) return { letters: L, have };
  }
}
const RT = 45000;
module.exports = !DICT ? null : {
  id: 'wordbattle', title: 'Word Battle', category: 'casual', difficulty: 'Medium', min: 2, max: 2, watch: true,
  desc: 'Build words from ten shared letters. Each word can be claimed once. Three rounds.',
  init: () => ({ gen: Date.now(), turn: -1, round: 0, rounds: 3, phase: 'play', letters: '', have: null, endsAt: 0, words: [[], []], claimed: new Set(), scores: [0, 0], roundScores: [0, 0], last: null }),
  onStart(s, ctx) {
    const play = () => {
      const nl = newLetters(); s.round++; s.letters = nl.letters; s.have = nl.have; s.phase = 'play'; s.words = [[], []]; s.claimed = new Set(); s.roundScores = [0, 0]; s.endsAt = Date.now() + RT; ctx.push();
      ctx.after(RT, () => {
        s.phase = 'between'; s.last = [...s.roundScores]; ctx.push();
        if (s.round >= s.rounds) ctx.after(2500, () => ctx.end(s.scores[0] === s.scores[1] ? { draw: true, scores: s.scores } : (w => ({ winner: w, scores: s.scores, flags: { perfect: s.scores[1 - w] === 0 } }))(s.scores[0] > s.scores[1] ? 0 : 1)));
        else ctx.after(4000, play);
      });
    };
    play();
  },
  move(s, i, m) {
    if (s.phase !== 'play') return 'This round is over.';
    const w = String(m.w || '').toLowerCase().trim();
    if (w.length < 3) return 'Words need at least 3 letters.';
    if (!/^[a-z]+$/.test(w) || !canMake(w, s.have)) return 'That word cannot be made from these letters.';
    if (s.claimed.has(w)) return s.words[i].includes(w) ? 'You already found that word.' : 'Your opponent already claimed that word.';
    if (!DICT.has(w)) return 'That word is not in the dictionary.';
    s.claimed.add(w); s.words[i].push(w); const p = pts(w.length); s.scores[i] += p; s.roundScores[i] += p;
  },
  redact: s => { const { have, claimed, ...rest } = s; return rest; },
};
