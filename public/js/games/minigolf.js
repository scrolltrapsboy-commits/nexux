// Mini Golf client: draws the course on a canvas, lets you pull back and release to putt, and replays the server's simulation.
import { h, loadCss, S } from '../core.js';
import { theme, fullCanvas, clamp, decodeTrack } from './kit.js';
loadCss('/css/g-physics.css');
const W = 160, H = 100, BALL = 2.1, CUP = 4.6, MAXPULL = 38, FRAME_MS = 1000 / 30;
let HOLES = null;
const loadHoles = () => HOLES ? Promise.resolve(HOLES) : fetch('/shared/golf-holes.json').then(r => r.json()).then(j => (HOLES = j));
const SHADE = ['#f4f4f6', '#a9a9b2', '#1b1b20', '#6d6d76'];

export default {
  seat: (R, i) => ({ sub: R.state.done[i] ? 'In the cup' : R.state.strokes[i] + ' stroke' + (R.state.strokes[i] === 1 ? '' : 's') + ' this hole', badge: R.state.totals[i] }),
  status(R, api) {
    const s = R.state; if (s.lock) return 'Watch the putt…';
    if (R.watching) return s.turn >= 0 ? R.players[s.turn].name + '’s putt' : 'Hole finished';
    if (s.done[R.youIdx]) return 'You holed out. Waiting for others…';
    return s.turn === R.youIdx ? { t: 'Your putt: pull back and release', turn: true } : (R.players[s.turn] ? R.players[s.turn].name + '’s putt' : 'Waiting…');
  },
  mount(el, api) {
    const wrap = h('div', { class: 'gp-wrap' }); el.append(wrap);
    const hud = h('div', { class: 'gp-hud', style: { position: 'absolute', left: '10px', top: '8px', zIndex: 2, pointerEvents: 'none', fontSize: '13px', fontWeight: 700, textShadow: '0 1px 6px rgba(0,0,0,.6)' } }); wrap.append(hud);
    let R = null, holes = null, rot = false, sc = 1, ox = 0, oy = 0, th = theme(), raf = 0, destroyed = false;
    let seenShot = null, anim = null, aim = null, shown = null, key = '';
    const kit = fullCanvas(wrap, 'Mini golf course. Pull back from the ball and release to putt.', (w, hh) => { layout(w, hh); draw(); });
    const { ctx, cv } = kit;
    function layout(w, hh) {
      rot = w / hh < 0.95; const bw = rot ? H : W, bh = rot ? W : H, pad = 10;
      sc = Math.min((w - pad * 2) / bw, (hh - pad * 2 - 6) / bh); ox = (w - bw * sc) / 2; oy = (hh - bh * sc) / 2;
    }
    const toS = (x, y) => rot ? [ox + (H - y) * sc, oy + x * sc] : [ox + x * sc, oy + y * sc];
    const toW = (px, py) => rot ? [(py - oy) / sc, H - (px - ox) / sc] : [(px - ox) / sc, (py - oy) / sc];
    const rectPath = (a, b, c, d, r = 0) => { const [x1, y1] = toS(a, b), [x2, y2] = toS(c, d), x = Math.min(x1, x2), y = Math.min(y1, y2), w = Math.abs(x2 - x1), hh = Math.abs(y2 - y1); ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, hh, r * sc); else ctx.rect(x, y, w, hh); };
    function pos(i) {
      if (anim && anim.who === i) return anim.p;
      return shown && shown.balls[i];
    }
    function draw() {
      if (!kit.size().w) return; th = theme(); const { w, h: hh } = kit.size(); ctx.clearRect(0, 0, w, hh);
      if (!R || !holes) return; const s = R.state, hole = holes.holes[s.hole];
      const dark = th.dark, grass = dark ? '#18181c' : '#dcdce2', wall = dark ? '#e8e8ec' : '#26262c', sand = dark ? '#3a3a42' : '#bdbdc6';
      // course floor
      rectPath(0, 0, W, H, 3); ctx.fillStyle = grass; ctx.fill(); ctx.lineWidth = Math.max(2, 1.6 * sc); ctx.strokeStyle = wall; ctx.stroke();
      ctx.save(); rectPath(0, 0, W, H, 3); ctx.clip();
      ctx.strokeStyle = dark ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.05)'; ctx.lineWidth = 6 * sc; for (let x = 10; x < W; x += 20) { const a = toS(x, 0), b = toS(x, H); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); }
      for (const [a, b, c, d] of hole.sand) { rectPath(a, b, c, d, 3); ctx.fillStyle = sand; ctx.fill(); ctx.save(); rectPath(a, b, c, d, 3); ctx.clip(); ctx.strokeStyle = dark ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; for (let k = -H; k < W; k += 3) { const p = toS(a + k, b), q = toS(a + k + (d - b), d); ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q); ctx.stroke(); } ctx.restore(); }
      ctx.restore();
      // tee + cup
      { const [tx, ty] = toS(...hole.tee); ctx.beginPath(); ctx.arc(tx, ty, 3.4 * sc, 0, 7); ctx.strokeStyle = th.fg3; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]); }
      { const [cx, cy] = toS(...hole.cup); ctx.beginPath(); ctx.arc(cx, cy, (CUP + 1.4) * sc, 0, 7); ctx.fillStyle = dark ? '#000' : '#16161a'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = wall; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 15 * sc * 0.9); ctx.strokeStyle = wall; ctx.lineWidth = 1.6; ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx, cy - 15 * sc * .9); ctx.lineTo(cx + 8 * sc, cy - 12 * sc * .9); ctx.lineTo(cx, cy - 9 * sc * .9); ctx.closePath(); ctx.fillStyle = wall; ctx.fill(); }
      // blocks and bumpers
      for (const [a, b, c, d] of hole.blocks) { rectPath(a, b, c, d, 1.2); ctx.fillStyle = wall; ctx.fill(); }
      for (const [x, y, r] of hole.circles) { const [px, py] = toS(x, y); ctx.beginPath(); ctx.arc(px, py, r * sc, 0, 7); ctx.fillStyle = wall; ctx.fill(); ctx.beginPath(); ctx.arc(px, py, r * sc * .55, 0, 7); ctx.strokeStyle = grass; ctx.lineWidth = Math.max(1.5, sc * .8); ctx.stroke(); }
      // balls
      const order = R.players.map((_, i) => i).sort((a, b) => (a === R.youIdx) - (b === R.youIdx));
      for (const i of order) {
        if (s.gone && s.gone[i] && !s.done[i]) continue; let p = pos(i); if (!p) continue;
        const holedNow = (s.done[i] && Math.hypot(p[0] - hole.cup[0], p[1] - hole.cup[1]) < 0.5) && !(anim && anim.who === i);
        if (holedNow) continue;
        const [bx, by] = toS(p[0], p[1]), r = Math.max(4.5, BALL * sc), k = i % 4, mine = i === R.youIdx;
        ctx.beginPath(); ctx.arc(bx + 1, by + 2, r, 0, 7); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill();
        ctx.beginPath(); ctx.arc(bx, by, r, 0, 7); ctx.fillStyle = SHADE[k]; ctx.fill(); ctx.lineWidth = k === 2 ? 2 : 1; ctx.strokeStyle = k === 2 ? '#f4f4f6' : 'rgba(0,0,0,.45)'; ctx.stroke();
        if (k === 3) { ctx.beginPath(); ctx.arc(bx, by, r * .45, 0, 7); ctx.fillStyle = '#f4f4f6'; ctx.fill(); }
        if (s.turn === i && !s.lock) { ctx.beginPath(); ctx.arc(bx, by, r + 4 + Math.sin(performance.now() / 260) * 1.4, 0, 7); ctx.strokeStyle = th.fg; ctx.lineWidth = 1.6; ctx.globalAlpha = .75; ctx.stroke(); ctx.globalAlpha = 1; }
        if (mine) { ctx.fillStyle = th.fg; ctx.font = '700 11px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('YOU', bx, by - r - 8); }
      }
      // aim
      if (aim) {
        const p = pos(R.youIdx); if (p) {
          const [bx, by] = toS(p[0], p[1]), power = aim.power, len = (6 + power * 70) * sc, ex = bx + Math.cos(aim.screenAngle) * len, ey = by + Math.sin(aim.screenAngle) * len;
          ctx.setLineDash([2, 6]); ctx.lineCap = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = th.fg; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
          const px = bx - Math.cos(aim.screenAngle) * Math.min(len * .5, 60), py = by - Math.sin(aim.screenAngle) * Math.min(len * .5, 60);
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(px, py); ctx.lineWidth = 6; ctx.globalAlpha = .55; ctx.stroke(); ctx.globalAlpha = 1;
          ctx.fillStyle = th.fg; ctx.font = '800 12px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(Math.round(power * 100) + '%', bx, by + 26);
        }
      }
    }
    function startAnim(shot) {
      const pts = decodeTrack(shot.f); anim = { who: shot.who, pts, t0: performance.now(), p: pts[0], holed: shot.holed, end: pts.length * FRAME_MS };
      loop();
    }
    function step(now) {
      if (!anim) return false; const t = now - anim.t0, f = t / FRAME_MS, i = Math.min(anim.pts.length - 1, Math.floor(f)), a = anim.pts[i], b = anim.pts[Math.min(anim.pts.length - 1, i + 1)], u = f - i;
      anim.p = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
      if (t >= anim.end) { const last = anim.pts[anim.pts.length - 1]; if (anim.holed) api.sfx('win'); else api.sfx('tick'); anim = null; if (shown) shown.balls[R.state.shot ? R.state.shot.who : 0] = last; return false; }
      return true;
    }
    function loop() { if (raf || destroyed) return; const tick = now => { raf = 0; if (destroyed) return; const more = step(now); draw(); if (more || aim || (R && R.state && R.state.turn >= 0 && !R.state.lock)) raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); }
    // ---- input
    const canAim = () => R && R.status === 'playing' && R.youIdx >= 0 && R.state.turn === R.youIdx && !R.state.lock && !anim && !R.state.done[R.youIdx];
    function compute(e) {
      const rect = cv.getBoundingClientRect(), p = pos(R.youIdx); if (!p) return null; const [bx, by] = toS(p[0], p[1]);
      const px = e.clientX - rect.left, py = e.clientY - rect.top, vx = bx - px, vy = by - py, dist = Math.hypot(vx, vy) / sc;   // pull vector (screen) in world units
      const sa = Math.atan2(vy, vx), power = clamp(dist / MAXPULL, 0, 1);
      // screen angle -> world angle (undo the 90 degree rotation when the board is turned)
      const wa = rot ? sa - Math.PI / 2 : sa; return { screenAngle: sa, angle: wa, power, dist };
    }
    cv.addEventListener('pointerdown', e => { if (!canAim()) return; cv.setPointerCapture(e.pointerId); aim = compute(e); loop(); e.preventDefault(); });
    cv.addEventListener('pointermove', e => { if (!aim) return; aim = compute(e); draw(); });
    const release = e => { if (!aim) return; const a = compute(e) || aim; aim = null; try { cv.releasePointerCapture(e.pointerId); } catch {} if (a.power >= 0.07) { api.sfx('move'); api.move({ angle: a.angle, power: a.power }); } draw(); };
    cv.addEventListener('pointerup', release); cv.addEventListener('pointercancel', () => { aim = null; draw(); });
    cv.addEventListener('keydown', e => { if (!canAim()) return; const p = pos(R.youIdx), hole = holes.holes[R.state.hole]; if (e.key === 'Enter' || e.key === ' ') { const a = Math.atan2(hole.cup[1] - p[1], hole.cup[0] - p[0]), d = Math.hypot(hole.cup[0] - p[0], hole.cup[1] - p[1]); api.move({ angle: a, power: clamp(d / 110, 0.15, 1) }); e.preventDefault(); } });
    return {
      async update(next) {
        R = next; if (!holes) { holes = await loadHoles(); layout(kit.size().w, kit.size().h); } if (destroyed) return; const s = R.state;
        const k = R.code + ':' + s.gen + ':' + s.hole; if (k !== key) { key = k; anim = null; seenShot = s.shot ? s.shot.id : null; shown = { balls: s.balls.map(b => b.slice()) }; }
        if (s.shot && s.shot.id !== seenShot) { seenShot = s.shot.id; const prev = shown ? shown.balls.map(b => b.slice()) : s.balls; shown = { balls: s.balls.map((b, i) => (i === s.shot.who ? prev[i] : b.slice())) }; if (s.shot.f && s.shot.hole === s.hole) startAnim(s.shot); else shown = { balls: s.balls.map(b => b.slice()) }; }
        else if (!anim) shown = { balls: s.balls.map(b => b.slice()) };
        const hole = holes.holes[s.hole]; hud.replaceChildren(h('div', null, 'Hole ' + (s.hole + 1) + ' of ' + holes.holes.length + ' · ' + hole.name), h('div', { style: { fontWeight: 500, opacity: .8 } }, 'Par ' + hole.par + ' · max ' + holes.maxStrokes + ' strokes'));
        draw(); loop();
      },
      destroy() { destroyed = true; cancelAnimationFrame(raf); kit.destroy(); },
    };
  },
};
