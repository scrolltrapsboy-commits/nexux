import { h, loadCss } from '../core.js';
loadCss('/css/g-board.css');
const N = 15, STARS = new Set([3 * N + 3, 3 * N + 11, 7 * N + 7, 11 * N + 3, 11 * N + 11]);
export default {
  seat: (R, i) => ({ sub: i === 0 ? 'Light stones' : 'Dark stones', badge: R.state ? R.state.board.filter(x => x === i).length : null }),
  mount(el, api) {
    let lastKey = '';
    const cells = Array.from({ length: N * N }, (_, i) => {
      const r = (i / N) | 0, c = i % N;
      const e = h('button', { class: 'gc' + (c === 0 ? ' l' : '') + (c === N - 1 ? ' r' : '') + (r === 0 ? ' t' : '') + (r === N - 1 ? ' b' : '') + (STARS.has(i) ? ' star' : ''), 'aria-label': 'Row ' + (r + 1) + ', column ' + (c + 1), onclick: () => api.move({ c: i }) },
        STARS.has(i) ? h('i', { class: 'sp' }) : null, h('i', { class: 'gh' }), h('i', { class: 'st' }));
      e._v = undefined; return e;
    });
    el.append(h('div', { class: 'gb mg' }, h('div', { class: 'mg-board gb-frame', role: 'grid', 'aria-label': 'Gomoku board' }, cells)));
    return {
      update(R) {
        const s = R.state; if (!s) return;
        const my = R.status === 'playing' && api.myTurn(), win = new Set(s.line || []);
        cells.forEach((e, i) => {
          const v = s.board[i];
          if (e._v !== v) { e.classList.toggle('new', e._v !== undefined && v !== null); e._v = v; e.setAttribute('aria-label', 'Row ' + (((i / N) | 0) + 1) + ', column ' + (i % N + 1) + (v === null ? ', empty' : v === 0 ? ', light stone' : ', dark stone')); }
          e.classList.toggle('s0', v === 0); e.classList.toggle('s1', v === 1); e.classList.toggle('last', s.last === i);
          e.classList.toggle('win', win.has(i)); e.classList.toggle('me', my && v === null); e.disabled = !my || v !== null;
        });
        const k = String(s.last); if (k !== lastKey) { if (lastKey) api.sfx('move'); lastKey = k; }
      }, destroy() { },
    };
  },
};
