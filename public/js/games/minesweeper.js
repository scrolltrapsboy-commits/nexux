import { h, loadCss, mmss } from '../core.js';
loadCss('/css/g-arcade.css');
const FLAG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4M6 4h12l-3.5 4.5L18 13H6"/></svg>';
const MINE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>';
const SH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l9-9M13 11l3-3 4 4-3 3zM14 5l1-2M19 8l2-1M9 4l1 3"/></svg>';
const W = 9;
export default {
  seat: (R, i) => ({ sub: i === 0 ? 'Filled markers' : 'Outlined markers', badge: R.state.scores[i], low: R.state.scores[i] < 0, active: true }),
  status(R) { return R.watching ? 'Watching live' : { t: 'Dig safe cells · mines cost 5', turn: true }; },
  mount(el, api) {
    let mode = 'dig', R = null, cur = 0;
    const cell = Array.from({ length: W * W }, (_, k) => { const b = h('button', { class: 'ms-c', tabindex: k === 0 ? 0 : -1, 'data-k': k, 'aria-label': 'Cell ' + (((k / W) | 0) + 1) + ',' + (k % W + 1) + ', closed' }); b._s = ''; return b; });
    const time = h('span', { class: 'ms-time', role: 'timer', 'aria-label': 'Time left' }, '--:--'), safe = h('b', null, '--'), mines = h('b', null, '--');
    const dig = h('button', { 'aria-pressed': 'true', 'aria-label': 'Dig mode', onclick: () => setMode('dig') }, h('span', { html: SH }), 'Dig');
    const flg = h('button', { 'aria-pressed': 'false', 'aria-label': 'Flag mode', onclick: () => setMode('flag') }, h('span', { html: FLAG }), 'Flag');
    const setMode = m => { mode = m; dig.setAttribute('aria-pressed', m === 'dig'); flg.setAttribute('aria-pressed', m === 'flag'); };
    const k0 = h('span'), k1 = h('span');
    const grid = h('div', { class: 'ms-grid', role: 'grid', 'aria-label': 'Minefield, 9 by 9' }, cell);
    const hud = h('div', { class: 'ms-hud' }, h('div', { class: 'ms-info' }, time, h('div', { class: 'ms-stats' }, h('span', null, 'Safe left ', safe), h('span', null, 'Mines ', mines))),
      h('div', { class: 'ms-mode', role: 'group', 'aria-label': 'Tap mode' }, dig, flg),
      h('div', { class: 'ms-key' }, h('span', null, h('i', { class: 'f' }), k0), h('span', null, h('i'), k1)));
    el.append(h('div', { class: 'ms' }, hud, grid));
    const act = (k, t) => {
      if (!R || R.status !== 'playing' || R.youIdx < 0) return; const s = R.state, v = s.cells[k];
      if (v !== -1) return; if (t === 'rev' && s.flag[k] >= 0) { api.toast('Flagged. Switch to Flag mode to remove the flag.'); return; }
      api.move({ t, c: k });
    };
    grid.addEventListener('click', e => { const b = e.target.closest('.ms-c'); if (!b) return; cur = +b.dataset.k; act(cur, mode === 'flag' || e.shiftKey ? 'flag' : 'rev'); });
    grid.addEventListener('contextmenu', e => { e.preventDefault(); const b = e.target.closest('.ms-c'); if (b) act(+b.dataset.k, 'flag'); });
    grid.addEventListener('keydown', e => {
      const b = e.target.closest('.ms-c'); if (!b) return; let k = +b.dataset.k, x = k % W, y = (k / W) | 0;
      if (e.key === 'ArrowLeft') x--; else if (e.key === 'ArrowRight') x++; else if (e.key === 'ArrowUp') y--; else if (e.key === 'ArrowDown') y++;
      else if (e.key === 'f' || e.key === 'F') { act(k, 'flag'); return; } else return;
      e.preventDefault(); x = Math.max(0, Math.min(W - 1, x)); y = Math.max(0, Math.min(W - 1, y)); cell[cur].tabIndex = -1; cur = y * W + x; cell[cur].tabIndex = 0; cell[cur].focus();
    });
    const tick = () => { if (!R) return; const left = R.state.endsAt - api.now(); time.textContent = R.status === 'playing' ? mmss(left) : '0:00'; time.classList.toggle('low', R.status === 'playing' && left < 15000); };
    const iv = setInterval(tick, 250);
    let prevOpen = 0, prevBoom = 0, gen = null, initialized = false;
    return {
      update(r) {
        R = r; const s = r.state, ok = r.status === 'playing' && r.youIdx >= 0;
        if (gen !== s.gen) { gen = s.gen; prevOpen = 0; prevBoom = 0; initialized = false; }
        const animateChanges = initialized;
        let open = 0, boom = 0;
        cell.forEach((b, k) => {
          const v = s.cells[k], f = s.flag[k], o = s.boom[k], key = v + '|' + f + '|' + o;
          if (v >= 0) open++; if (v === 9) boom++;
          if (key !== b._s) {
            const wasClosed = b._s === '' || b._s.startsWith('-1'); b._s = key;
            let cls = 'ms-c', html = '', lab = 'closed';
            if (v === 9) { cls += ' open boom o' + o; html = MINE; lab = 'mine exploded by ' + api.name(o); }
            else if (v >= 0) { cls += ' open' + (v ? ' n' + v : ''); html = v ? String(v) : ''; lab = v ? v + ' adjacent' : 'empty'; }
            else if (f >= 0) { cls += ' o' + f; html = FLAG; lab = 'flagged by ' + api.name(f); }
            if (v >= 0 && wasClosed && animateChanges) cls += ' fresh';
            b.className = cls; b.innerHTML = html; b.setAttribute('aria-label', 'Cell ' + (((k / W) | 0) + 1) + ',' + (k % W + 1) + ', ' + lab);
          }
          b.disabled = !ok;
        });
        k0.textContent = api.name(0); k1.textContent = api.name(1);
        safe.textContent = s.safeLeft; mines.textContent = s.total; dig.disabled = flg.disabled = !ok; tick();
        if (boom > prevBoom) api.sfx('err'); else if (open > prevOpen && prevOpen >= 0 && gen === s.gen && open - prevOpen > 0) api.sfx('tick');
        prevOpen = open; prevBoom = boom; initialized = true;
      }, destroy() { clearInterval(iv); },
    };
  },
};
