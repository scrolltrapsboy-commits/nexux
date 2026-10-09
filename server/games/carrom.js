// Carrom (simplified): 2 players, 9 white + 9 black coins + queen, four corner pockets.
// Seat 0 = white coins and the bottom baseline, seat 1 = black coins and the top baseline.
// The client sends {x, angle, power}; the server places the striker, simulates the shot with a fixed 240 Hz step
// (deterministic circle physics) and stores final positions plus a compact per-coin replay for the clients to animate.
const SIZE = 100, R_COIN = 2.15, R_STR = 2.9, M_STR = 2.6, POCKET_R = 5, POCKET_C = 4;
const DT = 1 / 240, SUB = 8, MAX_STEPS = 8 * 240;           // sampled at 30 fps, 8 s cap
const VMAX = 240, DRAG = 0.55, FRICTION = 36, REST = 1.2, E_WALL = 0.72, E_COIN = 0.9;
const BASE_Y = [83, 17], X_MIN = 16, X_MAX = 84, SHOT_CAP = 100, REPLAY_KEEP_MS = 12000;
const POCKETS = [[POCKET_C, POCKET_C], [SIZE - POCKET_C, POCKET_C], [POCKET_C, SIZE - POCKET_C], [SIZE - POCKET_C, SIZE - POCKET_C]];
const QUEEN = 18, q1 = v => Math.round(v * 10) / 10;
const colorOf = i => (i < 9 ? 0 : i < 18 ? 1 : 2);

// start layout: queen in the middle, inner ring of 6 and outer ring of 12, colours alternating so each side gets 9
function layout() {
  const pos = Array(19), w = [], b = [], c = SIZE / 2;
  pos[QUEEN] = [c, c];
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; (k % 2 ? b : w).push([c + 4.5 * Math.cos(a), c + 4.5 * Math.sin(a)]); }
  for (let j = 0; j < 12; j++) { const a = j * Math.PI / 6, p = [c + 9 * Math.cos(a), c + 9 * Math.sin(a)]; ((j >> 1) % 2 ? b : w).push(p); }
  w.forEach((p, i) => (pos[i] = p)); b.forEach((p, i) => (pos[9 + i] = p));
  return pos.map(p => [q1(p[0]), q1(p[1])]);
}
const free = (c, x, y) => !c.some(p => p && Math.hypot(p[0] - x, p[1] - y) < R_STR + R_COIN + 0.05);
// nearest legal striker x to the requested one (no overlap with a resting coin)
function placeX(c, want, y) {
  want = Math.max(X_MIN, Math.min(X_MAX, want));
  for (let d = 0; d <= X_MAX - X_MIN; d += 0.5) for (const x of d ? [want - d, want + d] : [want]) if (x >= X_MIN && x <= X_MAX && free(c, x, y)) return x;
  return want;
}

function simulate(coins, sx, sy, angle, power) {
  const B = coins.map((p, i) => (p ? { x: p[0], y: p[1], vx: 0, vy: 0, r: R_COIN, m: 1, alive: true } : { alive: false, out: true }));
  B.push({ x: sx, y: sy, vx: Math.cos(angle) * VMAX * power, vy: Math.sin(angle) * VMAX * power, r: R_STR, m: M_STR, alive: true });
  const N = B.length, snap = () => B.map(b => (b.alive ? [Math.round(b.x * 10), Math.round(b.y * 10)] : null)), frames = [snap()], pocketed = [];
  for (let n = 1; n <= MAX_STEPS; n++) {
    let moving = false;
    for (const b of B) {
      if (!b.alive) continue;
      b.x += b.vx * DT; b.y += b.vy * DT;
      if (b.x < b.r) { b.x = b.r; if (b.vx < 0) b.vx = -b.vx * E_WALL; } else if (b.x > SIZE - b.r) { b.x = SIZE - b.r; if (b.vx > 0) b.vx = -b.vx * E_WALL; }
      if (b.y < b.r) { b.y = b.r; if (b.vy < 0) b.vy = -b.vy * E_WALL; } else if (b.y > SIZE - b.r) { b.y = SIZE - b.r; if (b.vy > 0) b.vy = -b.vy * E_WALL; }
    }
    for (let i = 0; i < N; i++) { const a = B[i]; if (!a.alive) continue;
      for (let j = i + 1; j < N; j++) { const c = B[j]; if (!c.alive) continue;
        const dx = c.x - a.x, dy = c.y - a.y, min = a.r + c.r, d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 1e-6, nx = d2 ? dx / d : 1, ny = d2 ? dy / d : 0, im = 1 / a.m + 1 / c.m, over = (min - d) / im;
        a.x -= nx * over / a.m; a.y -= ny * over / a.m; c.x += nx * over / c.m; c.y += ny * over / c.m;   // separate by inverse mass
        const vn = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
        if (vn < 0) { const J = -(1 + E_COIN) * vn / im; a.vx -= J * nx / a.m; a.vy -= J * ny / a.m; c.vx += J * nx / c.m; c.vy += J * ny / c.m; }
      } }
    for (let i = 0; i < N; i++) { const b = B[i]; if (!b.alive) continue;
      if (POCKETS.some(([px, py]) => Math.hypot(b.x - px, b.y - py) < POCKET_R)) { b.alive = false; b.vx = b.vy = 0; pocketed.push(i); continue; }
      const sp = Math.hypot(b.vx, b.vy); if (!sp) continue;
      const ns = Math.max(0, sp * Math.exp(-DRAG * DT) - FRICTION * DT);
      if (ns < REST) { b.vx = b.vy = 0; } else { b.vx *= ns / sp; b.vy *= ns / sp; moving = true; }
    }
    if (n % SUB === 0) frames.push(snap());
    if (!moving) break;
  }
  for (const b of B) if (b.alive) { b.vx = b.vy = 0; }
  // the last replay frame must equal the stored (quantised) final state
  const fin = B.map(b => (b.alive ? [q1(b.x), q1(b.y)] : null)), last = fin.map(p => (p ? [Math.round(p[0] * 10), Math.round(p[1] * 10)] : null));
  if (JSON.stringify(frames[frames.length - 1]) !== JSON.stringify(last)) frames.push(last);
  return { frames, fin, pocketed };
}
// one track per body that moved: [index, firstFrame, pocketed?, x0, y0, dx, dy, ...] (tenths of a unit, deltas)
function tracks(frames) {
  const out = [];
  for (let b = 0; b < frames[0].length; b++) {
    const P = frames.map(f => f[b]); if (!P[0]) continue;
    let fs = -1, fe = -1, pk = 0;
    for (let f = 1; f < P.length; f++) {
      if (!P[f]) { pk = 1; if (fs < 0) fs = f - 1; fe = f - 1; break; }
      if (P[f][0] !== P[f - 1][0] || P[f][1] !== P[f - 1][1]) { if (fs < 0) fs = f - 1; fe = f; }
    }
    if (fs < 0) continue;
    const t = [b, fs, pk, P[fs][0], P[fs][1]];
    for (let f = fs + 1; f <= fe; f++) t.push(P[f][0] - P[f - 1][0], P[f][1] - P[f - 1][1]);
    out.push(t);
  }
  return out;
}

module.exports = {
  id: 'carrom', title: 'Carrom', category: 'board', difficulty: 'Medium', min: 2, max: 2, resign: true, watch: true,
  desc: 'Flick the striker, pocket your coins, and clear your colour first.',
  init: () => ({ gen: Date.now(), turn: 0, c: layout(), sc: [0, 0], queen: -1, shot: null, lock: false, nshot: 0, last: null }),
  move(s, i, m, ctx) {
    if (s.lock) return 'The match is ending.';
    const { angle: a, power: p, x } = m;
    if ([a, p, x].some(v => typeof v !== 'number' || !Number.isFinite(v)) || Math.abs(a) > 1e4) return 'Invalid shot.';
    if (p < 0.03 || p > 1.0001) return 'Invalid power.';
    const by = BASE_Y[i], sx = placeX(s.c, x, by);
    const r = simulate(s.c, sx, by, a, Math.min(1, p));
    s.nshot++;
    let own = 0, foul = false; const gone = [];
    r.pocketed.forEach(k => {
      if (k === 19) { foul = true; return; }
      gone.push(k); s.c[k] = null;
      if (k === QUEEN) { s.sc[i] += 3; s.queen = i; own++; }
      else { s.sc[colorOf(k)]++; if (colorOf(k) === i) own++; }
    });
    for (let k = 0; k < 19; k++) if (s.c[k]) s.c[k] = r.fin[k];
    if (foul) s.sc[i] = Math.max(0, s.sc[i] - 1);
    s.last = { who: i, foul, gone };
    s.shot = { id: s.nshot, who: i, x: sx, n: r.frames.length, t: Date.now(), k: tracks(r.frames) };
    if (foul || !own) s.turn = 1 - i;   // pocketing an own coin (or the queen) earns another turn
    const left = [0, 1].map(c => s.c.slice(c * 9, c * 9 + 9).filter(Boolean).length);
    let out = null;
    if (left[0] === 0 || left[1] === 0 || s.nshot >= SHOT_CAP) {
      const byScore = s.sc[0] === s.sc[1] ? -1 : s.sc[0] > s.sc[1] ? 0 : 1, cleared = left[0] === 0 || left[1] === 0;
      // first side to clear its colour wins (both gone at once, or the shot cap: higher score)
      const w = cleared && (left[0] === 0) !== (left[1] === 0) ? (left[0] === 0 ? 0 : 1) : byScore;
      out = w < 0 ? { draw: true, scores: s.sc, reason: cleared ? 'cleared' : 'time' } : { winner: w, scores: s.sc, reason: cleared ? 'cleared' : 'time', flags: { perfect: s.sc[1 - w] === 0 } };
    }
    if (out) { s.lock = true; return { defer: () => ctx.end(out), ms: Math.min(9000, r.frames.length * 33 + 1200) }; }
  },
  redact(s) {
    const { lock, nshot, shot, ...rest } = s, sh = shot && { id: shot.id, who: shot.who, x: shot.x, n: shot.n };
    if (sh && Date.now() - shot.t < REPLAY_KEEP_MS) sh.k = shot.k;
    return { ...rest, lock, shot: sh };
  },
};
