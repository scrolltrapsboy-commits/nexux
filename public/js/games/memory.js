import { h, loadCss } from '../core.js';
loadCss('/css/g-arcade.css');
const P = {
  A: '<path d="M19 14.5A8 8 0 1 1 9.5 5a6.5 6.5 0 0 0 9.5 9.5z"/>',                                   // moon
  B: '<path d="M12 3l2.8 6 6.2.7-4.6 4.3 1.3 6.5L12 17.2 6.3 20.5l1.3-6.5L3 9.7 9.2 9z"/>',            // star
  C: '<path d="M13 3L5 13.5h6L10 21l9-11h-6z"/>',                                                      // bolt
  D: '<path d="M5 19c0-9 5-14 14-14 0 9-5 14-14 14z"/><path d="M5 19l8-8"/>',                          // leaf
  E: '<path d="M12 3.5c3.5 4.5 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 2.5-6.5 6-11z"/>',                      // drop
  F: '<path d="M12 3c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-9.5z"/>',       // flame
  G: '<path d="M12 3l8 9-8 9-8-9z"/><path d="M4 12h16M9 3.8L12 12l3-8.2"/>',                           // diamond
  H: '<path d="M3 9c3-3 6-3 9 0s6 3 9 0M3 15c3-3 6-3 9 0s6 3 9 0"/>',                                  // wave
};
const NAME = { A: 'moon', B: 'star', C: 'bolt', D: 'leaf', E: 'drop', F: 'flame', G: 'diamond', H: 'wave' };
const svg = k => '<svg viewBox="0 0 24 24" aria-hidden="true">' + P[k] + '</svg>';
export default {
  seat: (R, i) => ({ sub: i === 0 ? 'Filled marker' : 'Ring marker', badge: R.state.scores[i] }),
  status(R, api) {
    const s = R.state;
    if (R.watching) return (R.players[s.turn] ? R.players[s.turn].name + '’s turn' : 'Watching live');
    if (s.turn === R.youIdx) return { t: s.up.length === 1 ? 'Flip a second card' : 'Your turn: flip two cards', turn: true };
    return (R.players[s.turn] ? R.players[s.turn].name : 'Opponent') + '’s turn';
  },
  mount(el, api) {
    const cards = Array.from({ length: 16 }, (_, c) => {
      const back = h('span', { class: 'mem-k' }), front = h('span', { class: 'mem-f' });
      const b = h('button', { class: 'mem-c', 'aria-label': 'Card ' + (c + 1) + ', face down', onclick: () => api.move({ c }) }, h('span', { class: 'mem-i' }, back, front));
      b._f = front; b._v = null; b._m = -2; return b;
    });
    el.append(h('div', { class: 'mem', role: 'group', 'aria-label': 'Memory board, 4 by 4 cards' }, cards));
    let prevMatches = 0, prevUp = 0, gen = null;
    return {
      update(R) {
        const s = R.state, my = api.myTurn() && !s.lock;
        if (gen !== s.gen) { gen = s.gen; prevMatches = 0; prevUp = 0; }
        let matches = 0, up = 0;
        cards.forEach((b, c) => {
          const v = s.cards[c], m = s.matched[c], isUp = v !== null;
          if (v !== null && b._v !== v) { b._v = v; b._f.innerHTML = svg(v); }
          if (m !== b._m) {
            b._m = m; [...b._f.querySelectorAll('.mem-mk')].forEach(x => x.remove());
            if (m >= 0) b._f.append(h('i', { class: 'mem-mk o' + m, title: api.name(m) }));
          }
          if (m >= 0) matches++; else if (isUp) up++;
          const fresh = m >= 0 && !b.classList.contains('m');
          b.classList.toggle('up', isUp); b.classList.toggle('m', m >= 0); b.classList.toggle('fresh', fresh);
          b.disabled = !my || isUp;
          b.setAttribute('aria-label', 'Card ' + (c + 1) + ', ' + (m >= 0 ? NAME[v] + ', matched by ' + api.name(m) : isUp ? NAME[v] + ', face up' : 'face down'));
        });
        if (matches > prevMatches) api.sfx('move'); else if (up > prevUp) api.sfx('tick');
        prevMatches = matches; prevUp = up;
      }, destroy() {},
    };
  },
};
