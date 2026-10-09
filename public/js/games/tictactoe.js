import { h } from '../core.js';
const X = '<svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" fill="none"/></svg>';
const O = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5" stroke="currentColor" stroke-width="2.6" fill="none"/></svg>';
export default {
  seat: (R, i) => ({ sub: i === 0 ? 'Plays X' : 'Plays O' }),
  mount(el, api) {
    const cells = Array.from({ length: 9 }, (_, i) => h('button', { class: 'ttt-c', 'aria-label': 'Square ' + (i + 1), onclick: () => api.move({ cell: i }) }));
    const board = h('div', { class: 'board ttt' }, cells); el.append(board);
    let lastN = 0, rendered = Array(9).fill(undefined);
    return {
      update(R) {
        const s = R.state, my = api.myTurn(), n = s.board.filter(x => x !== null).length;
        cells.forEach((c, i) => {
          const v = s.board[i], changed = rendered[i] !== v;
          if (changed) {
            c.innerHTML = v === null ? '' : (v === 0 ? X : O);
            c.classList.toggle('placed', v !== null && rendered[i] === null);
            rendered[i] = v;
          }
          c.classList.toggle('f', v !== null);
          c.classList.toggle('win', !!(s.line && s.line.includes(i)));
          c.disabled = v !== null || !my; c.setAttribute('aria-label', 'Square ' + (i + 1) + (v === null ? ', empty' : v === 0 ? ', X' : ', O'));
        });
        if (n > lastN) api.sfx('move'); lastN = n;
      }, destroy() {},
    };
  },
};
