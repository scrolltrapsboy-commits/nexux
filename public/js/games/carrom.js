// Carrom client: choose the striker position with the slider, then pull back on the board and release.
// The server simulates the shot; we replay its per-coin tracks.
import { h, loadCss } from '../core.js';
import { theme, fullCanvas, clamp } from './kit.js';
loadCss('/css/g-physics.css');
const SIZE = 100, R_COIN = 2.15, R_STR = 2.9, POCKET_R = 5, PC = 4, MAXPULL = 34, FRAME_MS = 1000 / 30, BASE_Y = [83, 17], X_MIN = 16, X_MAX = 84;
const POCKETS = [[PC, PC], [SIZE - PC, PC], [PC, SIZE - PC], [SIZE - PC, SIZE - PC]];
const QUEEN = 18;

export default {
  seat: (R, i) => ({ sub: i === 0 ? 'White coins' : 'Black coins', badge: R.state.sc[i] }),
  status(R) {
    const s = R.state; if (s.lock) return 'Match ending…';
    if (R.watching) return R.players[s.turn].name + ' to strike';
    if (s.turn === R.youIdx) return { t: 'Your strike: slide, then pull back and release', turn: true };
    return R.players[s.turn].name + ' is striking…';
  },
  mount(el, api) {
    const root = h('div', { class: 'gp-wrap' }); el.append(root);
    const board = h('div', { style: { position: 'absolute', left: 0, right: 0, top: 0, bottom: '52px' } }), slideRow = h('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '0 14px', zIndex: 2 } });
    root.append(board, slideRow);
    const slider = h('input', { type: 'range', class: 'cr-slide', min: X_MIN, max: X_MAX, step: 0.5, value: 50, 'aria-label': 'Striker position', style: { position: 'relative', width: 'min(420px,86%)' } });
    const note = h('span', { class: 'tiny muted', style: { whiteSpace: 'nowrap' } }); slideRow.append(slider);
    let R = null, th = theme(), raf = 0, destroyed = false, S0 = 1, ox = 0, oy = 0, flip = false, seen = null, anim = null, aim = null, frozen = null, key = '';
    const kit = fullCanvas(board, 'Carrom board. Slide the striker, then pull back from it and release.', (w, hh) => { const b = Math.min(w, hh) - 8; S0 = b / SIZE; ox = (w - b) / 2; oy = (hh - b) / 2; draw(); });
    const { ctx, cv } = kit;
    const toS = (x, y) => flip ? [ox + (SIZE - x) * S0, oy + (SIZE - y) * S0] : [ox + x * S0, oy + y * S0];
    const sx = () => +slider.value;
    const strikerPos = () => { const R_ = R; return [sx(), BASE_Y[R_.youIdx]]; };
    // coin positions: from the replay while animating, otherwise the server state
    function coinsAt(t) {
      const s = R.state, out = s.c.map(p => (p ? p.slice() : null)); let striker = null;
      if (!anim) return { coins: out, striker };
      const f = t / FRAME_MS;
      for (const tr of anim.k) {
        const [b, fs, pk, x0, y0] = tr; let x = x0, y = y0, n = (tr.length - 5) / 2, fe = fs + n; const i = clamp(Math.floor(f - fs), 0, n);
        // cumulative deltas up to frame (fs+i), interpolate to the next
        let cx = x0, cy = y0; for (let k = 0; k < i; k++) { cx += tr[5 + k * 2]; cy += tr[6 + k * 2]; }
        let px = cx, py = cy; if (i < n) { const u = clamp(f - fs - i, 0, 1); px = cx + tr[5 + i * 2] * u; py = cy + tr[6 + i * 2] * u; }
        const done = f >= fe, pos = f < fs ? [x0 / 10, y0 / 10] : [px / 10, py / 10];
        if (b === 19) { striker = (done) ? null : pos; continue; }
        if (pk && done) out[b] = null; else out[b] = pos;
      }
      return { coins: out, striker };
    }
    const coinStyle = (k) => k === QUEEN ? 'q' : k < 9 ? 'w' : 'b';
    function draw() {
      const { w, h: hh } = kit.size(); if (!w) return; th = theme(); ctx.clearRect(0, 0, w, hh); if (!R) return;
      const s = R.state, dark = th.dark; flip = R.youIdx === 1;
      const bd = dark ? '#16161a' : '#e7e7ec', frame = dark ? '#2a2a31' : '#c7c7d0', ink = dark ? '#f4f4f6' : '#16161a';
      // frame + playing surface
      const [fx, fy] = [ox - 5, oy - 5], fsz = SIZE * S0 + 10; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(fx, fy, fsz, fsz, 16) : ctx.rect(fx, fy, fsz, fsz); ctx.fillStyle = frame; ctx.fill();
      ctx.beginPath(); ctx.rect(ox, oy, SIZE * S0, SIZE * S0); ctx.fillStyle = bd; ctx.fill();
      ctx.strokeStyle = dark ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.28)'; ctx.lineWidth = 1.5;
      const [cx, cy] = toS(50, 50); ctx.beginPath(); ctx.arc(cx, cy, 11 * S0, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, 3 * S0, 0, 7); ctx.stroke();
      for (const y of BASE_Y) { const a = toS(X_MIN - 6, y), b = toS(X_MAX + 6, y); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); for (const x of [X_MIN - 6, X_MAX + 6]) { const p = toS(x, y); ctx.beginPath(); ctx.arc(p[0], p[1], 2.2 * S0, 0, 7); ctx.stroke(); } }
      // pockets
      for (const [x, y] of POCKETS) { const [px, py] = toS(x, y); ctx.beginPath(); ctx.arc(px, py, POCKET_R * S0, 0, 7); ctx.fillStyle = dark ? '#000' : '#0c0c10'; ctx.fill(); }
      const t = anim ? performance.now() - anim.t0 : 0, { coins, striker } = coinsAt(t);
      const r = R_COIN * S0;
      coins.forEach((p, k) => {
        if (!p) return; const [px, py] = toS(p[0], p[1]), kind = coinStyle(k);
        ctx.beginPath(); ctx.arc(px + 1, py + 1.6, r, 0, 7); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill();
        ctx.beginPath(); ctx.arc(px, py, r, 0, 7);
        if (kind === 'w') { ctx.fillStyle = '#f4f4f6'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.stroke(); ctx.beginPath(); ctx.arc(px, py, r * .5, 0, 7); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.stroke(); }
        else if (kind === 'b') { ctx.fillStyle = '#0a0a0c'; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = '#f4f4f6'; ctx.stroke(); ctx.beginPath(); ctx.arc(px, py, r * .45, 0, 7); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.stroke(); }
        else { ctx.fillStyle = '#8a8a93'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#f4f4f6'; ctx.stroke(); ctx.beginPath(); ctx.arc(px, py, r * .35, 0, 7); ctx.fillStyle = '#f4f4f6'; ctx.fill(); }
      });
      // striker: live preview for the player to move, the replayed one while animating
      let st = striker; const myTurn = canAim();
      if (!st && myTurn) st = strikerPos();
      if (!st && !anim && R.status === 'playing' && s.turn >= 0 && R.youIdx !== s.turn && !s.lock) st = [shownOpp(), BASE_Y[s.turn]];
      if (st) { const [px, py] = toS(st[0], st[1]), rs = R_STR * S0; ctx.beginPath(); ctx.arc(px + 1, py + 2, rs, 0, 7); ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fill(); ctx.beginPath(); ctx.arc(px, py, rs, 0, 7); ctx.fillStyle = dark ? '#d7d7dd' : '#2a2a31'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = ink; ctx.stroke(); ctx.beginPath(); ctx.arc(px, py, rs * .5, 0, 7); ctx.strokeStyle = dark ? '#111' : '#eee'; ctx.stroke();
        if (aim && myTurn) { const len = (6 + aim.power * 70) * S0, ex = px + Math.cos(aim.sa) * len, ey = py + Math.sin(aim.sa) * len; ctx.setLineDash([2, 6]); ctx.lineCap = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = th.fg; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
          const bx = px - Math.cos(aim.sa) * Math.min(len * .5, 60), by = py - Math.sin(aim.sa) * Math.min(len * .5, 60); ctx.globalAlpha = .55; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx, by); ctx.stroke(); ctx.globalAlpha = 1; ctx.fillStyle = th.fg; ctx.font = '800 12px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(Math.round(aim.power * 100) + '%', px, py + 28); }
      }
    }
    const shownOpp = () => (R.state.shot && R.state.shot.who === R.state.turn ? R.state.shot.x : 50);
    const canAim = () => R && R.status === 'playing' && R.youIdx >= 0 && R.state.turn === R.youIdx && !R.state.lock && !anim;
    function loop() { if (raf || destroyed) return; const tick = now => { raf = 0; if (destroyed) return; if (anim && now - anim.t0 > anim.end) { anim = null; api.sfx('tick'); } draw(); if (anim || aim) raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); }
    function compute(e) {
      const rect = cv.getBoundingClientRect(), [bx, by] = toS(...strikerPos()), px = e.clientX - rect.left, py = e.clientY - rect.top, vx = bx - px, vy = by - py, dist = Math.hypot(vx, vy) / S0;
      const sa = Math.atan2(vy, vx); return { sa, angle: flip ? sa + Math.PI : sa, power: clamp(dist / MAXPULL, 0, 1) };
    }
    cv.addEventListener('pointerdown', e => { if (!canAim()) return; cv.setPointerCapture(e.pointerId); aim = compute(e); loop(); e.preventDefault(); });
    cv.addEventListener('pointermove', e => { if (aim) { aim = compute(e); draw(); } });
    cv.addEventListener('pointerup', e => { if (!aim) return; const a = compute(e); aim = null; try { cv.releasePointerCapture(e.pointerId); } catch {} if (a.power >= 0.08) { api.sfx('move'); api.move({ x: sx(), angle: a.angle, power: a.power }); } draw(); });
    cv.addEventListener('pointercancel', () => { aim = null; draw(); });
    slider.addEventListener('input', () => { if (flip) { /* slider shows the board as the player sees it, so left/right already match the screen */ } draw(); });
    // when the board is flipped (seat 1), the slider's left is the player's left: world x runs the other way
    const syncSlider = () => { slider.style.direction = 'ltr'; };
    return {
      update(next) {
        R = next; flip = R.youIdx === 1; const s = R.state; syncSlider();
        const k = R.code + ':' + s.gen; if (k !== key) { key = k; seen = s.shot ? s.shot.id : null; anim = null; }
        if (s.shot && s.shot.id !== seen) { seen = s.shot.id; if (s.shot.k) { anim = { k: s.shot.k, t0: performance.now(), end: s.shot.n * FRAME_MS + 120 }; api.sfx('move'); } }
        slider.disabled = !canAim(); slider.style.opacity = canAim() ? 1 : .35; slider.style.display = R.youIdx < 0 ? 'none' : '';
        if (flip) slider.style.transform = 'scaleX(-1)'; else slider.style.transform = '';
        draw(); loop();
      },
      destroy() { destroyed = true; cancelAnimationFrame(raf); kit.destroy(); },
    };
  },
};
