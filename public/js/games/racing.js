// Nexus Grand Prix client. Your own car is simulated locally (instant steering) and reported ~20x/s; the server validates it,
// corrects cheaters with a `fix` and relays everybody's validated position, which we interpolate for the other cars.
import { h, loadCss } from '../core.js';
import { theme, fullCanvas, clamp } from './kit.js';
loadCss('/css/g-physics.css');

let T = null;
const loadTrack = () => T ? Promise.resolve(T) : import('/shared/racing-track.js').then(() => (T = globalThis.NexusTrack));
const SHADES = ['#f4f4f6', '#9a9aa4', '#d2d2d8', '#6c6c76'];
const live = { gen: 0, cars: [], fin: {} };       // module-level so seat() can read the latest relay

const ord = n => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
const rankOf = (cars, i) => { const me = cars.find(c => c.i === i); if (!me) return 0; return 1 + cars.filter(c => c.i !== i && (c.f && !me.f ? true : me.f && !c.f ? false : c.f && me.f ? c.f < me.f : c.p > me.p)).length; };

export default {
  seat: (R, i) => {
    const c = live.gen === R.state.gen ? live.cars.find(x => x.i === i) : null, s = R.state;
    if (!c) return { sub: 'On the grid', badge: '–' };
    const lap = Math.min(s.laps, Math.floor(c.c / s.K) + 1);
    return { sub: c.f ? 'Finished ' + ord(c.f) : c.l ? 'Left the race' : 'Lap ' + lap + '/' + s.laps, badge: c.f ? ord(c.f) : ord(rankOf(live.cars, i)), active: true };
  },
  status(R, api) {
    const s = R.state, now = api.now();
    if (R.watching) return 'Watching the race';
    if (now < s.goAt) return { t: 'Get ready…', turn: false };
    const c = live.cars.find(x => x.i === R.youIdx);
    if (c && c.f) return 'You finished ' + ord(c.f) + '. Waiting for the rest…';
    return { t: 'Arrows or WASD to drive · Space brakes', turn: true };
  },
  mount(el, api) {
    const wrap = h('div', { class: 'gp-wrap' }); el.append(wrap);
    const hud = h('div', { style: { position: 'absolute', left: '10px', top: '8px', zIndex: 2, pointerEvents: 'none', fontWeight: 700, fontSize: '13px', lineHeight: 1.35, textShadow: '0 1px 6px rgba(0,0,0,.7)' } });
    const banner = h('div', { style: { position: 'absolute', left: 0, right: 0, top: '28%', textAlign: 'center', zIndex: 3, pointerEvents: 'none', fontWeight: 800, letterSpacing: '.04em', textShadow: '0 2px 18px rgba(0,0,0,.7)', fontSize: 'clamp(40px,12vmin,110px)' } });
    wrap.append(hud, banner);
    let R = null, track = null, destroyed = false, raf = 0, last = 0, th = theme(), gen = -1, epoch = 0, sendT = 0, finShown = false, lastLight = -1;
    let me = { x: 0, y: 0, a: 0, v: 0 }, keys = { l: 0, r: 0, g: 0, b: 0 }, touch = { l: 0, r: 0, g: 0, b: 0 };
    const others = new Map();            // seat -> { x, y, a, v, tx, ty, ta, tv, at }
    let path = null;
    const kit = fullCanvas(wrap, 'Racing circuit. Use the arrow keys or the on-screen controls to drive.', () => frame(performance.now(), true));
    const { ctx, cv } = kit;

    /* ---------- input ---------- */
    const KM = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r', ArrowUp: 'g', w: 'g', W: 'g', ArrowDown: 'b', s: 'b', S: 'b', ' ': 'b' };
    const kd = e => { const k = KM[e.key]; if (!k || e.target.closest && e.target.closest('input,textarea,select')) return; keys[k] = 1; e.preventDefault(); };
    const ku = e => { const k = KM[e.key]; if (k) keys[k] = 0; };
    const blur = () => { keys = { l: 0, r: 0, g: 0, b: 0 }; };
    addEventListener('keydown', kd); addEventListener('keyup', ku); addEventListener('blur', blur);
    if (matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window) buildTouch();
    function buildTouch() {
      const svg = d => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); s.append(p); return s; };
      const L = h('div', { class: 'rc-h' }, svg('M15 5l-7 7 7 7')), Rr = h('div', { class: 'rc-h' }, svg('M9 5l7 7-7 7'));
      const pad = h('div', { class: 'rc-pad', role: 'group', 'aria-label': 'Steering' }, L, Rr);
      const upd = (e) => { const b = pad.getBoundingClientRect(), x = e.clientX - b.left; touch.l = x < b.width / 2 ? 1 : 0; touch.r = x >= b.width / 2 ? 1 : 0; L.classList.toggle('on', !!touch.l); Rr.classList.toggle('on', !!touch.r); };
      pad.addEventListener('pointerdown', e => { pad.setPointerCapture(e.pointerId); upd(e); e.preventDefault(); });
      pad.addEventListener('pointermove', e => { if (pad.hasPointerCapture(e.pointerId)) upd(e); });
      const end = () => { touch.l = touch.r = 0; L.classList.remove('on'); Rr.classList.remove('on'); };
      pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end); pad.addEventListener('lostpointercapture', end);
      const pedal = (k, cls, label, d) => { const b = h('button', { class: 'rc-b ' + cls, 'aria-label': label, type: 'button' }, svg(d)); const on = e => { b.setPointerCapture(e.pointerId); touch[k] = 1; b.classList.add('on'); e.preventDefault(); }, off = () => { touch[k] = 0; b.classList.remove('on'); };
        b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off); b.addEventListener('contextmenu', e => e.preventDefault()); return b; };
      const gas = pedal('g', 'gas', 'Accelerate', 'M5 15l7-8 7 8'), brake = pedal('b', '', 'Brake', 'M5 9l7 8 7-8');
      wrap.append(h('div', { class: 'rc-touch' }, pad, h('div', { class: 'rc-pedals' }, brake, gas)));
    }

    /* ---------- network ---------- */
    api.listen('g', d => {
      if (!R || !d) return;
      if (d.t === 'cars') {
        live.gen = R.state.gen; live.cars = d.cars; const now = performance.now();
        for (const c of d.cars) { if (c.i === R.youIdx && !R.watching) continue; const o = others.get(c.i); if (!o) others.set(c.i, { x: c.x, y: c.y, a: c.a, v: c.v, tx: c.x, ty: c.y, ta: c.a, tv: c.v, at: now }); else { o.tx = c.x; o.ty = c.y; o.ta = c.a; o.tv = c.v; o.at = now; } }
        hudDraw();
      } else if (d.t === 'fix') { me.x = d.x; me.y = d.y; me.a = d.a; me.v = 0; epoch = d.e; }
      else if (d.t === 'fin') { live.fin[d.i] = d; if (d.i === R.youIdx) { api.sfx('win'); finShown = true; banner.textContent = ord(d.place); setTimeout(() => { if (finShown) banner.textContent = ''; }, 2600); } }
    });

    /* ---------- simulation of my own car ---------- */
    function step(dt, go) {
      const P = T.PHYS; const steer = (keys.r || touch.r ? 1 : 0) - (keys.l || touch.l ? 1 : 0);
      const gas = (keys.g || touch.g) && go, brake = keys.b || touch.b; const done = live.fin[R.youIdx];
      let acc = (gas && !done ? P.ACC : 0) - (brake || done ? P.BRAKE : 0) * (me.v > 0 ? 1 : 0.4) - P.DRAG * me.v * (done ? 3 : 1);
      if (!go) acc = 0;
      me.v += acc * dt; if (brake && me.v < 0 && !gas) me.v = Math.max(me.v, -40); me.v = clamp(me.v, -60, P.VMAX);
      me.a += steer * P.TURN * dt * clamp(Math.abs(me.v) / 90, 0, 1) * (me.v >= 0 ? 1 : -1) * (1 - 0.25 * Math.abs(me.v) / P.VMAX);
      me.x += Math.cos(me.a) * me.v * dt; me.y += Math.sin(me.a) * me.v * dt;
      const loc = T.locate(me.x, me.y, me.hint == null ? null : me.hint, me.hint == null ? 0 : 30); me.hint = Math.round(loc.p);
      const ad = Math.abs(loc.d);
      if (ad > T.HALF) { const cap = P.VMAX * 0.5; if (me.v > cap) me.v = Math.max(cap, me.v - 500 * dt); }       // grass slows you down
      if (ad > P.WALL) { const k = P.WALL / ad, nx = loc.px + (me.x - loc.px) * k, ny = loc.py + (me.y - loc.py) * k; me.x = nx; me.y = ny; me.v *= 0.55; }  // barrier
    }

    /* ---------- drawing ---------- */
    function buildPath() { path = new Path2D(); for (let i = 0; i <= T.N; i++) { const k = i % T.N; i ? path.lineTo(T.X[k], T.Y[k]) : path.moveTo(T.X[k], T.Y[k]); } path.closePath(); }
    function car(c, x, y, a, tint, isMe, num) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a); const L = T.PHYS.CAR_L, W = T.PHYS.CAR_W;
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.roundRect(-L / 2 + 3, -W / 2 + 4, L, W, 6); ctx.fill();
      ctx.fillStyle = tint; ctx.beginPath(); ctx.roundRect(-L / 2, -W / 2, L, W, 6); ctx.fill();
      ctx.fillStyle = th.dark ? '#0b0b0e' : '#f4f4f6'; ctx.beginPath(); ctx.roundRect(L * 0.02, -W * 0.34, L * 0.3, W * 0.68, 3); ctx.fill();   // windscreen
      ctx.fillRect(-L / 2 + 2, -W / 2 + 2, 3, 4); ctx.fillRect(-L / 2 + 2, W / 2 - 6, 3, 4);
      if (isMe) { ctx.strokeStyle = th.fg; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-L / 2 - 3, -W / 2 - 3, L + 6, W + 6, 8); ctx.stroke(); }
      ctx.restore();
      ctx.fillStyle = th.fg; ctx.font = '700 12px Inter,system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(num, x, y - 24);
    }
    function frame(ts, force) {
      if (destroyed) return; if (!force) raf = requestAnimationFrame(frame); const { w, h: hh } = kit.size(); if (!w || !R || !track) return; const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts; th = theme();
      const s = R.state, now = api.now(), go = now >= s.goAt && R.status === 'playing' && !R.watching;
      if (gen !== s.gen) reset(s);
      if (!R.watching && R.status === 'playing') step(dt, go);
      // report ~20 Hz once the lights are out
      if (!R.watching && R.status === 'playing' && go && ts - sendT > 50) { sendT = ts; api.emit({ t: 'car', x: +me.x.toFixed(1), y: +me.y.toFixed(1), a: +me.a.toFixed(3), v: +me.v.toFixed(1), e: epoch }); }
      for (const [i, o] of others) { const age = Math.min(0.25, (ts - o.at) / 1000), px = o.tx + Math.cos(o.ta) * o.tv * age, py = o.ty + Math.sin(o.ta) * o.tv * age, k = Math.min(1, dt * 12); o.x += (px - o.x) * k; o.y += (py - o.y) * k; let da = o.ta - o.a; da = Math.atan2(Math.sin(da), Math.cos(da)); o.a += da * k; }
      // lights
      const left = s.goAt - now; const n = Math.ceil(left / 1000);
      if (R.status === 'playing') { if (left > 0 && left <= 5000) { banner.textContent = n <= 3 ? String(n) : ''; if (n !== lastLight) { lastLight = n; if (n <= 3) api.sfx('tick'); } } else if (left <= 0 && left > -900) { banner.textContent = 'GO'; if (lastLight !== 0) { lastLight = 0; api.sfx('move'); } } else if (!finShown) banner.textContent = ''; }
      // camera follows me (or the race leader when watching)
      let fx = me.x, fy = me.y, fv = me.v;
      if (R.watching || R.youIdx < 0) { const lead = live.cars.slice().sort((a, b) => (b.f ? 1e6 - b.f : b.p) - (a.f ? 1e6 - a.f : a.p))[0]; const o = lead && others.get(lead.i); if (o) { fx = o.x; fy = o.y; fv = o.v; } else { const g = s.grid && s.grid[0]; if (g) { fx = g.x; fy = g.y; fv = 0; } } }
      const zoomTarget = clamp(Math.min(w, hh) / 440, 0.4, 1.7) * (1 - 0.18 * Math.abs(fv) / T.PHYS.VMAX);
      cam.z += (zoomTarget - cam.z) * Math.min(1, dt * 3) || 0; if (force || !cam.init) { cam.x = fx; cam.y = fy; cam.z = zoomTarget; cam.init = 1; }
      cam.x += (fx - cam.x) * Math.min(1, dt * 8); cam.y += (fy - cam.y) * Math.min(1, dt * 8);
      ctx.clearRect(0, 0, w, hh); ctx.fillStyle = th.dark ? '#0c0c0f' : '#e6e6ea'; ctx.fillRect(0, 0, w, hh);
      ctx.save(); ctx.translate(w / 2, hh / 2); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = th.dark ? '#e8e8ec' : '#2a2a30'; ctx.lineWidth = T.WIDTH + 10; ctx.stroke(path);                 // kerbs
      ctx.strokeStyle = th.dark ? '#26262c' : '#c9c9d0'; ctx.lineWidth = T.WIDTH; ctx.stroke(path);                       // tarmac
      ctx.setLineDash([26, 30]); ctx.strokeStyle = th.dark ? '#4a4a52' : '#9a9aa4'; ctx.lineWidth = 3; ctx.stroke(path); ctx.setLineDash([]);
      // start / finish line (checker)
      const sl = T.at(0), nx = -Math.sin(sl.a), ny = Math.cos(sl.a); ctx.save(); ctx.translate(sl.x, sl.y); ctx.rotate(sl.a);
      for (let r = 0; r < 2; r++) for (let c = -6; c < 6; c++) { ctx.fillStyle = (r + c) % 2 ? '#f4f4f6' : '#101014'; ctx.fillRect(-6 + r * 6, c * 10, 6, 10); } ctx.restore(); void nx; void ny;
      // cars
      const order = []; for (let i = 0; i < s.n; i++) order.push(i); order.sort((a, b) => (a === R.youIdx) - (b === R.youIdx));
      for (const i of order) { const isMe = i === R.youIdx && !R.watching; const o = isMe ? me : others.get(i) || (s.grid && s.grid[i]); if (!o) continue; const c = live.cars.find(x => x.i === i); if (c && c.l) continue; car(c, o.x, o.y, o.a, isMe ? SHADES[0] : SHADES[1 + (i % 3)], isMe, String(R.players[i] ? R.players[i].name.slice(0, 10) : i + 1)); }
      ctx.restore();
      minimap(w, hh); speedo(w, hh);
    }
    const cam = { x: 0, y: 0, z: 1, init: 0 };
    function minimap(w, hh) {
      const B = T.bounds, bw = B.x1 - B.x0, bh = B.y1 - B.y0, size = Math.min(150, w * 0.3), sc = Math.min(size / bw, size * 0.7 / bh), mx = w - size - 10, my = 10 + (size * 0.7 - bh * sc) / 2;
      ctx.save(); ctx.globalAlpha = 0.9; ctx.translate(mx + (size - bw * sc) / 2, my); ctx.scale(sc, sc); ctx.translate(-B.x0, -B.y0);
      ctx.lineJoin = 'round'; ctx.strokeStyle = th.dark ? 'rgba(255,255,255,.28)' : 'rgba(0,0,0,.3)'; ctx.lineWidth = 60; ctx.stroke(path);
      for (let i = 0; i < R.state.n; i++) { const isMe = i === R.youIdx && !R.watching, o = isMe ? me : others.get(i); if (!o) continue; ctx.fillStyle = isMe ? th.fg : th.fg3; ctx.beginPath(); ctx.arc(o.x, o.y, isMe ? 70 : 55, 0, 7); ctx.fill(); }
      ctx.restore();
    }
    function speedo(w, hh) {
      if (R.watching) return; const kmh = Math.round(Math.abs(me.v) * 0.6); ctx.fillStyle = th.fg; ctx.textAlign = 'left'; ctx.font = '800 22px Inter,system-ui,sans-serif';
      const y = hh - ((matchMedia('(pointer:coarse)').matches) ? 150 : 22); ctx.fillText(kmh + '', 14, y); ctx.font = '600 11px Inter,system-ui,sans-serif'; ctx.fillStyle = th.fg3; ctx.fillText('KM/H', 14 + ctx.measureText(kmh + '').width + 22, y);
    }
    function hudDraw() {
      if (!R) return; const s = R.state; const i = R.watching ? -1 : R.youIdx, c = live.cars.find(x => x.i === i);
      if (!c) return hud.replaceChildren(h('div', null, 'Lap 1 of ' + s.laps));
      hud.replaceChildren(h('div', { style: { fontSize: '18px' } }, ord(rankOf(live.cars, i)) + ' / ' + s.n), h('div', { style: { opacity: .85 } }, c.f ? 'Finished' : 'Lap ' + Math.min(s.laps, Math.floor(c.c / s.K) + 1) + ' / ' + s.laps));
    }
    function reset(s) {
      gen = s.gen; epoch = 0; live.gen = s.gen; live.cars = []; live.fin = {}; others.clear(); finShown = false; lastLight = -1; banner.textContent = ''; me.hint = null;
      const g = s.grid && s.grid[R.youIdx]; if (g) { me.x = g.x; me.y = g.y; me.a = g.a; me.v = 0; }
      s.grid && s.grid.forEach((g, i) => others.set(i, { x: g.x, y: g.y, a: g.a, v: 0, tx: g.x, ty: g.y, ta: g.a, tv: 0, at: performance.now() })); cam.init = 0; hudDraw();
    }
    return {
      async update(next) {
        R = next; if (!track) { track = await loadTrack(); buildPath(); } if (destroyed) return;
        if (gen !== R.state.gen) reset(R.state);
        if (!raf) raf = requestAnimationFrame(frame);
        if (R.status !== 'playing') { banner.textContent = ''; }
        hudDraw();
      },
      destroy() { destroyed = true; cancelAnimationFrame(raf); removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('blur', blur); kit.destroy(); },
    };
  },
};
