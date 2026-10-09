import { h, icon } from '../core.js';
const ICON = { rock: '<svg viewBox="0 0 64 64"><path d="M20 36c0-8 2-14 8-14 2-4 8-4 10 0 6 0 8 4 8 10 0 12-6 20-14 20s-12-6-12-16z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M28 26v8M36 26v8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  paper: '<svg viewBox="0 0 64 64"><path d="M16 14h26l8 8v28H16z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M42 14v8h8M24 30h20M24 38h20M24 46h12" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  scissors: '<svg viewBox="0 0 64 64"><circle cx="18" cy="46" r="7" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="18" cy="18" r="7" fill="none" stroke="currentColor" stroke-width="3"/><path d="M24 22l30 28M24 42L54 14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>' };
export default {
  seat: (R, i) => ({ sub: 'First to 3', badge: R.state.score[i] }),
  status(R) { const s = R.state; if (R.watching) return 'Round ' + s.round; return s.picks[R.youIdx] ? 'Waiting for opponent…' : 'Choose your move'; },
  mount(el, api) {
    const hand = k => h('span', { class: 'rps-h', html: ICON[k] });
    const reveal = h('div', { class: 'rps-rev' });
    const btns = ['rock', 'paper', 'scissors'].map(k => h('button', { class: 'rps-b', 'aria-label': k, onclick: () => api.move({ pick: k }) }, hand(k), h('span', null, k)));
    const info = h('div', { class: 'rps-info' });
    el.append(h('div', { class: 'rps' }, info, reveal, h('div', { class: 'rps-btns' }, btns)));
    let lastRound = 0;
    return {
      update(R) {
        const s = R.state, me = R.youIdx, mine = me >= 0 ? s.picks[me] : null;
        info.textContent = 'Round ' + s.round + (s.last ? (s.last.w < 0 ? ' · last round tied' : ' · ' + api.name(s.last.w) + ' took the last round') : '');
        btns.forEach(b => { b.disabled = me < 0 || !!mine || R.status !== 'playing'; b.classList.toggle('sel', mine === b.getAttribute('aria-label')); });
        reveal.replaceChildren();
        if (s.last && !mine && s.round !== lastRound) { /* show previous round briefly */ }
        if (s.last) reveal.append(h('div', { class: 'rps-pair' }, ...s.last.picks.map((k, i) => h('div', { class: 'rps-slot' + (s.last.w === i ? ' w' : '') }, hand(k), h('small', null, api.name(i))))));
        else reveal.append(h('div', { class: 'muted' }, 'Both players lock in at the same time.'));
        if (s.round !== lastRound) { if (lastRound) api.sfx('move'); lastRound = s.round; }
      }, destroy() {},
    };
  },
};
