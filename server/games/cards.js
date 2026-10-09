// Nexus Cards: an original shedding card game for 2-4 players. Empty your hand first.
// Four marks (0 triangle, 1 circle, 2 square, 3 diamond), values 0-9, plus Block (b), Flip (f), Draw Two (d), Wild (w), Wild Draw Four (x).
// Hands are hidden: each player only receives their own cards.
const { shuffle } = require('./util');
const MARKS = 4;
const deck = () => {
  const d = [];
  for (let m = 0; m < MARKS; m++) {
    d.push({ m, v: '0' });
    for (let n = 1; n <= 9; n++) d.push({ m, v: String(n) }, { m, v: String(n) });
    for (const v of ['b', 'f', 'd']) d.push({ m, v }, { m, v });
  }
  for (let k = 0; k < 4; k++) d.push({ m: -1, v: 'w' }, { m: -1, v: 'x' });
  return shuffle(d);
};
const isWild = c => c.m < 0;
const playable = (s, c) => isWild(c) || c.m === s.mark || c.v === s.top.v;
const alive = (s, i) => !s.gone[i];
const nextSeat = (s, from, steps = 1) => { let i = from, n = s.hands.length; for (let k = 0; k < steps; k++) { do { i = (i + s.dir + n) % n; } while (!alive(s, i)); } return i; };
function draw(s, i, n) {
  const got = [];
  for (let k = 0; k < n; k++) {
    if (!s.pile.length) { // reshuffle everything under the top card
      const keep = s.discard.pop(); s.pile = shuffle(s.discard.map(c => (isWild(c) ? c : c))); s.discard = [keep];
      if (!s.pile.length) break;
    }
    const c = s.pile.pop(); s.hands[i].push(c); got.push(c);
  }
  return got.length;
}
const log = (s, t) => { s.log.push({ n: ++s.seq, t }); if (s.log.length > 6) s.log.shift(); };

module.exports = {
  id: 'cards', title: 'Nexus Cards', category: 'card', difficulty: 'Easy', min: 2, max: 4, watch: true,
  desc: 'Match the mark or the value and empty your hand first. Block, flip and draw cards change the table.',
  init(opts, n) {
    const s = { pile: deck(), discard: [], hands: Array.from({ length: n }, () => []), turn: 0, dir: 1, mark: 0, top: null, drew: -1, gone: Array(n).fill(false), log: [], seq: 0, last: null };
    for (let r = 0; r < 7; r++) for (let i = 0; i < n; i++) s.hands[i].push(s.pile.pop());
    let c; do { c = s.pile.pop(); if (c.m < 0 || !/^\d$/.test(c.v)) { s.pile.unshift(c); c = null; } } while (!c); // start on a plain number
    s.discard.push(c); s.top = c; s.mark = c.m;
    return s;
  },
  move(s, i, m) {
    if (m.pass) {
      if (s.drew < 0) return 'Draw a card first.';
      s.drew = -1; s.turn = nextSeat(s, i); log(s, 'passed'); s.last = { who: i, act: 'pass' }; return;
    }
    if (m.draw) {
      if (s.drew >= 0) return 'You already drew. Play it or pass.';
      if (!draw(s, i, 1)) { s.turn = nextSeat(s, i); return; }
      const c = s.hands[i][s.hands[i].length - 1]; s.last = { who: i, act: 'draw' };
      if (playable(s, c)) { s.drew = s.hands[i].length - 1; return; } // may play it, otherwise pass
      s.turn = nextSeat(s, i); return;
    }
    const k = m.play;
    if (!Number.isInteger(k) || k < 0 || k >= s.hands[i].length) return 'Pick one of your cards.';
    if (s.drew >= 0 && k !== s.drew) return 'You can only play the card you just drew, or pass.';
    const c = s.hands[i][k];
    if (!playable(s, c)) return 'That card does not match the mark or value.';
    let mark = c.m;
    if (isWild(c)) { mark = m.mark; if (!Number.isInteger(mark) || mark < 0 || mark >= MARKS) return 'Choose a mark for the wild card.'; }
    s.hands[i].splice(k, 1); s.drew = -1; s.discard.push(c); s.top = c; s.mark = mark; s.last = { who: i, act: 'play', card: c, mark };
    if (!s.hands[i].length) {
      const order = s.hands.map((h, j) => j).sort((a, b) => (a === i ? -1 : b === i ? 1 : s.hands[a].length - s.hands[b].length));
      return { ranking: order, scores: s.hands.map(h => h.length), flags: { perfect: s.hands.every((h, j) => j === i || h.length >= 5) } };
    }
    const n = s.hands.length, active = s.gone.filter(g => !g).length;
    let nx = nextSeat(s, i);
    if (c.v === 'f') { if (active === 2) nx = i; else { s.dir = -s.dir; nx = nextSeat(s, i); } log(s, 'flipped direction'); }
    else if (c.v === 'b') { nx = nextSeat(s, i, 2); log(s, 'blocked ' + 'next player'); }
    else if (c.v === 'd') { const v = nx; draw(s, v, 2); s.last.hit = { who: v, n: 2 }; nx = nextSeat(s, i, 2); }
    else if (c.v === 'x') { const v = nx; draw(s, v, 4); s.last.hit = { who: v, n: 4 }; nx = nextSeat(s, i, 2); }
    if (active === 2 && (c.v === 'b' || c.v === 'd' || c.v === 'x')) nx = i;
    s.turn = nx;
  },
  onLeave(s, i) {
    s.gone[i] = true; s.pile.unshift(...s.hands[i].splice(0)); shuffle(s.pile);
    if (s.turn === i) { s.drew = -1; s.turn = nextSeat(s, i); }
  },
  redact: (s, k) => ({ turn: s.turn, dir: s.dir, mark: s.mark, top: s.top, drew: k === s.turn ? s.drew : -1, pile: s.pile.length, gone: s.gone, last: s.last, seq: s.seq,
    counts: s.hands.map(h => h.length), hand: k >= 0 ? s.hands[k] : [] }),
};
