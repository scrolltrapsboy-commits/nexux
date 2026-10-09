// Shared by the racing server (validation) and the browser (rendering + physics). Plain script that works both as
// require() and as a dynamic import(): it exports through module.exports, or through globalThis.NexusTrack in the browser.
(function (root, factory) { const T = factory(); if (typeof module === 'object' && module.exports) module.exports = T; else root.NexusTrack = T; })(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // Closed-loop circuit: a long start straight, a fast right-hander, an S-chicane in the middle and a sweeping return leg.
  const CTRL = [[700, 200], [1300, 170], [1900, 230], [2200, 480], [2150, 800], [1800, 1000], [1500, 850], [1250, 1050], [850, 1200], [450, 1100], [250, 800], [350, 500], [450, 300]];
  const WIDTH = 120, HALF = WIDTH / 2, N = 480, K = 12;       // N centerline samples, K checkpoints per lap
  const PHYS = { VMAX: 330, ACC: 210, BRAKE: 460, DRAG: 0.35, GRIP: 7, TURN: 2.5, WALL: HALF * 1.6, GATE: HALF * 1.8, REJECT: HALF * 2.6, CAR_L: 34, CAR_W: 18 };

  // uniform Catmull-Rom through the control points, then re-sampled to N points of equal arc length
  const dense = [], per = 40, M = CTRL.length;
  for (let s = 0; s < M; s++) {
    const p0 = CTRL[(s + M - 1) % M], p1 = CTRL[s], p2 = CTRL[(s + 1) % M], p3 = CTRL[(s + 2) % M];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      dense.push([0, 1].map(c => 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  const cum = [0]; for (let i = 1; i <= dense.length; i++) { const a = dense[i - 1], b = dense[i % dense.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const L = cum[cum.length - 1], ds = L / N, X = new Array(N), Y = new Array(N);
  for (let i = 0, j = 0; i < N; i++) {
    const target = i * ds; while (cum[j + 1] < target) j++;
    const f = (target - cum[j]) / (cum[j + 1] - cum[j] || 1), a = dense[j], b = dense[(j + 1) % dense.length];
    X[i] = a[0] + (b[0] - a[0]) * f; Y[i] = a[1] + (b[1] - a[1]) * f;
  }
  // start the lap in the middle of the top straight: rotate the sample arrays so index 0 is the start/finish line
  let i0 = 0, bd = Infinity; for (let i = 0; i < N; i++) { const d = Math.hypot(X[i] - 1000, Y[i] - 185); if (d < bd) { bd = d; i0 = i; } }
  X.push(...X.splice(0, i0)); Y.push(...Y.splice(0, i0));
  // unit tangent (TX,TY) and the driver's right-hand normal (NX,NY); in screen coordinates (y down) heading east has its right at +y
  const TX = new Array(N), TY = new Array(N), NX = new Array(N), NY = new Array(N);
  for (let i = 0; i < N; i++) {
    const a = (i + N - 1) % N, b = (i + 1) % N, dx = X[b] - X[a], dy = Y[b] - Y[a], m = Math.hypot(dx, dy) || 1;
    TX[i] = dx / m; TY[i] = dy / m; NX[i] = -TY[i]; NY[i] = TX[i];
  }
  // nearest point on the centerline. With a hint it only scans +-win samples, which is what stops shortcuts and parallel-section confusion.
  // Returns progress p (sample index + fraction), signed lateral distance d (right of the line is positive) and the plain distance.
  function locate(x, y, hint, win) {
    const lo = hint == null ? 0 : hint - win, hi = hint == null ? N - 1 : hint + win;
    let best = Infinity, bi = 0, bt = 0;
    for (let k = lo; k <= hi; k++) {
      const i = ((k % N) + N) % N, j = (i + 1) % N, ax = X[i], ay = Y[i], bx = X[j] - ax, by = Y[j] - ay;
      let t = ((x - ax) * bx + (y - ay) * by) / (bx * bx + by * by); t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = x - (ax + bx * t), dy = y - (ay + by * t), d2 = dx * dx + dy * dy;
      if (d2 < best) { best = d2; bi = i; bt = t; }
    }
    const j = (bi + 1) % N, px = X[bi] + (X[j] - X[bi]) * bt, py = Y[bi] + (Y[j] - Y[bi]) * bt;
    return { i: bi, p: bi + bt, d: (x - px) * NX[bi] + (y - py) * NY[bi], dist: Math.sqrt(best), px, py };
  }
  // difference of two progress values on the loop, folded into (-N/2, N/2]
  const wrap = d => { d = ((d % N) + N) % N; return d > N / 2 ? d - N : d; };
  // point on the centerline at fractional sample position p (any real number), plus lateral offset
  function at(p, lat = 0) {
    p = ((p % N) + N) % N; const i = Math.floor(p), f = p - i, j = (i + 1) % N;
    const x = X[i] + (X[j] - X[i]) * f, y = Y[i] + (Y[j] - Y[i]) * f, tx = TX[i] + (TX[j] - TX[i]) * f, ty = TY[i] + (TY[j] - TY[i]) * f, m = Math.hypot(tx, ty) || 1;
    return { x: x - (ty / m) * lat, y: y + (tx / m) * lat, a: Math.atan2(ty, tx) };
  }
  // staggered 2-wide starting grid behind the line; p is the (negative) progress each car starts with
  function grid(n) {
    return Array.from({ length: n }, (_, k) => { const back = 46 + k * 36, p = -back / ds, g = at(p, k % 2 ? 26 : -26); return { x: g.x, y: g.y, a: g.a, p }; });
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < N; i++) { x0 = Math.min(x0, X[i]); y0 = Math.min(y0, Y[i]); x1 = Math.max(x1, X[i]); y1 = Math.max(y1, Y[i]); }
  const bounds = { x0: x0 - WIDTH, y0: y0 - WIDTH, x1: x1 + WIDTH, y1: y1 + WIDTH };
  return { N, K, L, ds, WIDTH, HALF, PHYS, X, Y, TX, TY, NX, NY, locate, wrap, at, grid, bounds };
});
