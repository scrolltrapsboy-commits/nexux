import { h, loadCss } from '../core.js';
loadCss('/css/g-board.css');
const CROWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18h16l1.5-10-5 4L12 5 7.5 12l-5-4z" fill="currentColor"/></svg>';
export default {
  seat(R, i) {
    const b = R.state && R.state.board; const n = b ? b.filter(c => c && c.toLowerCase() === (i === 0 ? 'a' : 'b')).length : null;
    return { sub: i === 0 ? 'Light discs' : 'Dark discs', badge: n };
  },
  status(R, api) {
    const s = R.state; if (!s || R.status !== 'playing' || R.watching || !api.myTurn()) return null;
    if (s.chain != null) return { t: 'Keep jumping!', turn: true };
    if ((s.targets || []).some(m => Math.abs((m[1] >> 3) - (m[0] >> 3)) === 2)) return { t: 'Your turn · capture is mandatory', turn: true };
    return null;
  },
  mount(el, api) {
    let R = null, sel = -1, flip = null, lastKey = '';
    const cells = Array.from({ length: 64 }, (_, i) => {
      const r = i >> 3, c = i & 7, dark = (r + c) % 2 === 1;
      const e = h(dark ? 'button' : 'div', { class: 'kc' + (dark ? ' d' : ''), 'aria-label': 'Square ' + 'abcdefgh'[c] + (8 - r) }, h('i', { class: 'mk' }));
      if (dark) e.addEventListener('click', () => click(i));
      e._pc = h('i', { class: 'pc', html: CROWN }); e._v = null; return e;
    });
    const board = h('div', { class: 'kg-board gb-frame', role: 'grid', 'aria-label': 'Checkers board' }, cells);
    el.append(h('div', { class: 'gb kg' }, board));
    const moves = () => { const m = new Map(); ((R && R.state.targets) || []).forEach(([f, t]) => { if (!m.has(f)) m.set(f, []); m.get(f).push(t); }); return m; };
    function click(i) {
      if (!R || R.status !== 'playing' || !api.myTurn()) return;
      const m = moves();
      if (sel >= 0 && (m.get(sel) || []).includes(i)) { const from = sel; sel = -1; paint(); api.move({ from, to: i }); return; }
      sel = m.has(i) && i !== sel ? i : -1; paint();
    }
    function paint() {
      const s = R.state, my = R.status === 'playing' && api.myTurn(), m = moves();
      if (my && s.chain != null && sel < 0) sel = s.chain;
      if (sel >= 0 && !m.has(sel)) sel = -1;
      const tg = new Set(m.get(sel) || []);
      cells.forEach((e, i) => {
        const v = s.board[i], dark = e.tagName === 'BUTTON';
        if (e._v !== v) {
          e._v = v; if (e._pc.parentNode) e._pc.remove();
          if (v) { e._pc.className = 'pc ' + (v.toLowerCase() === 'a' ? 'p0' : 'p1') + (v === v.toUpperCase() ? ' k' : ''); e.append(e._pc); }
          e.setAttribute('aria-label', 'Square ' + 'abcdefgh'[i & 7] + (8 - (i >> 3)) + (v ? ', ' + (v.toLowerCase() === 'a' ? 'light' : 'dark') + (v === v.toUpperCase() ? ' king' : ' piece') : ', empty'));
        }
        if (v) e._pc.classList.toggle('can', my && m.has(i) && i !== sel);
        e.classList.toggle('last', !!s.last && s.last.includes(i)); e.classList.toggle('sel', i === sel); e.classList.toggle('tg', tg.has(i));
        if (dark) e.disabled = !my || !(m.has(i) || tg.has(i));
        e.style.gridRow = (flip ? 7 - (i >> 3) : i >> 3) + 1; e.style.gridColumn = (flip ? 7 - (i & 7) : i & 7) + 1;
      });
    }
    return {
      update(r) {
        R = r; if (!r.state) return; flip = r.youIdx === 1;
        const k = r.state.last ? r.state.last.join() + r.state.turn : ''; if (k !== lastKey) { if (lastKey) { api.sfx('move'); sel = -1; } lastKey = k; }
        paint();
      }, destroy() { },
    };
  },
};
