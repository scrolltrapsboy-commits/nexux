import { h, loadCss } from '../core.js';
loadCss('/css/g-board.css');
export default {
  seat(R, i) { const b = R.state && R.state.board; return { sub: i === 0 ? 'Light discs' : 'Dark discs', badge: b ? b.filter(x => x === i).length : null }; },
  status(R, api) {
    const s = R.state; if (!s || R.status !== 'playing' || s.passed == null) return null;
    const nm = api.name(s.passed); return { t: (R.youIdx === s.passed ? 'You had' : nm + ' had') + ' no move, ' + (R.youIdx === s.passed ? 'you pass' : 'passes'), turn: api.myTurn() };
  },
  mount(el, api) {
    let R = null, prev = null, lastKey = '';
    const cells = Array.from({ length: 64 }, (_, i) => h('button', { class: 'rc', 'aria-label': 'Square ' + 'abcdefgh'[i & 7] + ((i >> 3) + 1), onclick: () => { if (cells[i].classList.contains('lg')) api.move({ c: i }); } }, h('i', { class: 'dk' })));
    el.append(h('div', { class: 'gb rg' }, h('div', { class: 'rg-board gb-frame', role: 'grid', 'aria-label': 'Reversi board' }, cells)));
    return {
      update(r) {
        R = r; const s = r.state; if (!s) return;
        const my = r.status === 'playing' && api.myTurn(), lg = new Set(my ? s.legal : []);
        cells.forEach((e, i) => {
          const v = s.board[i];
          const fresh = prev != null && prev[i] == null && v != null;
          const flipped = prev != null && prev[i] != null && v != null && prev[i] !== v;
          if (fresh || flipped) {
            e.classList.remove('fresh', 'fl');
            void e.offsetWidth;
          }
          e.classList.toggle('fresh', fresh);
          e.classList.toggle('fl', flipped);
          e.classList.toggle('d0', v === 0); e.classList.toggle('d1', v === 1);
          e.classList.toggle('lg', lg.has(i)); e.classList.toggle('last', s.last === i); e.disabled = !lg.has(i);
          e.setAttribute('aria-label', 'Square ' + 'abcdefgh'[i & 7] + ((i >> 3) + 1) + (v === 0 ? ', light disc' : v === 1 ? ', dark disc' : lg.has(i) ? ', legal move' : ', empty'));
        });
        prev = s.board.slice();
        const k = String(s.last) + s.turn; if (k !== lastKey) { if (lastKey) api.sfx('move'); lastKey = k; }
      }, destroy() { },
    };
  },
};
