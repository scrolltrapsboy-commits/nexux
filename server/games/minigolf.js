// Mini Golf: 2-4 players take turns on the same hole, 3 holes, lowest total strokes wins.
// The server owns the physics. A client only sends {angle, power}; we simulate the whole shot with a fixed
// timestep (deterministic), store the final rest position and a compact 30 fps replay the clients animate.
const D = require('../../shared/golf-holes.json');
const DT = 1 / 240, SUB = 8, MAX_STEPS = 8 * 240;          // 240 Hz physics, sampled every 8 steps = 30 fps, 8 s cap
const VMAX = 170, ROLL = 26, SAND = 120, REST = 2.5, E_WALL = 0.78, CAP_V = 95; // units/s, units/s^2
const REPLAY_KEEP_MS = 12000;                              // late joiners / reconnects get no replay frames
const q = v => Math.round(v * 10) / 10;

// walls as segments: outer frame + every block edge. Circles are separate bumpers.
const geo = D.holes.map(h => {
  const seg = [[0, 0, D.W, 0], [D.W, 0, D.W, D.H], [D.W, D.H, 0, D.H], [0, D.H, 0, 0]];
  for (const [a, b, c, d] of h.blocks) seg.push([a, b, c, b], [c, b, c, d], [c, d, a, d], [a, d, a, b]);
  return seg;
});

function simulate(hi, x, y, angle, power) {
  const h = D.holes[hi], seg = geo[hi], R = D.ballR, [cx, cy] = h.cup;
  let vx = Math.cos(angle) * VMAX * power, vy = Math.sin(angle) * VMAX * power, holed = false;
  const pts = [[Math.round(x * 10), Math.round(y * 10)]];
  for (let n = 1; n <= MAX_STEPS; n++) {
    x += vx * DT; y += vy * DT;
    for (const [x1, y1, x2, y2] of seg) {
      const dx = x2 - x1, dy = y2 - y1, t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
      const px = x1 + dx * t, py = y1 + dy * t; let ex = x - px, ey = y - py; const d = Math.hypot(ex, ey);
      if (d < R) { if (d > 1e-9) { ex /= d; ey /= d; } else { ex = 0; ey = 1; } x = px + ex * R; y = py + ey * R; const vn = vx * ex + vy * ey; if (vn < 0) { vx -= (1 + E_WALL) * vn * ex; vy -= (1 + E_WALL) * vn * ey; } }
    }
    for (const [bx, by, br] of h.circles) {
      let ex = x - bx, ey = y - by; const d = Math.hypot(ex, ey), m = br + R;
      if (d < m) { ex /= d || 1; ey = d ? ey / d : 1; x = bx + ex * m; y = by + ey * m; const vn = vx * ex + vy * ey; if (vn < 0) { vx -= 1.9 * vn * ex; vy -= 1.9 * vn * ey; } } // bumpers are livelier
    }
    const sp = Math.hypot(vx, vy);
    if (Math.hypot(x - cx, y - cy) < D.cupR && sp < CAP_V) { holed = true; x = cx; y = cy; vx = vy = 0; }
    else {
      const sand = h.sand.some(([a, b, c, d]) => x > a && x < c && y > b && y < d), nsp = Math.max(0, sp - (sand ? SAND : ROLL) * DT);
      if (nsp < REST) vx = vy = 0; else { vx *= nsp / sp; vy *= nsp / sp; }
    }
    if (n % SUB === 0 || holed || (vx === 0 && vy === 0)) pts.push([Math.round(x * 10), Math.round(y * 10)]);
    if (holed || (vx === 0 && vy === 0)) break;
  }
  x = q(x); y = q(y); const last = pts[pts.length - 1]; last[0] = Math.round(x * 10); last[1] = Math.round(y * 10);
  return { pts, x, y, holed };
}
// delta-encoded: [x0, y0, dx1, dy1, ...] in tenths of a unit
const encode = pts => { const o = [pts[0][0], pts[0][1]]; for (let i = 1; i < pts.length; i++) o.push(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return o; };

const nextSeat = (s, from) => { for (let k = 1; k <= s.n; k++) { const j = (from + k) % s.n; if (!s.done[j]) return j; } return -1; };
// strokes so far: completed holes plus the hole in progress
const sofar = (s, i) => s.card[i].slice(0, s.hole).reduce((a, b) => a + b, 0) + s.strokes[i];

function startHole(s, h) {
  s.hole = h; s.balls = Array.from({ length: s.n }, () => D.holes[h].tee.slice()); s.strokes = Array(s.n).fill(0);
  s.done = s.gone.slice(); s.turn = -1;
  for (let k = 0; k < s.n; k++) { const j = (h + k) % s.n; if (!s.gone[j]) { s.turn = j; break; } } // starter rotates every hole
  s.lock = false;
}
function results(s) {
  const tot = s.card.map(c => c.reduce((a, b) => a + b, 0)), idx = tot.map((_, i) => i), last = s.card.map(c => c[c.length - 1]);
  idx.sort((a, b) => (s.gone[a] - s.gone[b]) || tot[a] - tot[b] || last[a] - last[b] || a - b); // ties: last hole, then seat order
  const allEqual = tot.every(t => t === tot[0]);
  return { ranking: idx, scores: tot, draw: allEqual, best: Math.min(...tot) };
}
// called once a hole is complete (after the replay had time to play): next hole or the end of the match
function finishHole(s, ctx) {
  for (let i = 0; i < s.n; i++) s.card[i][s.hole] = s.gone[i] ? D.maxStrokes : s.strokes[i];
  if (s.hole + 1 < D.holes.length) { startHole(s, s.hole + 1); ctx.push(); return; }
  const r = results(s);
  ctx.end(r.draw ? { draw: true, scores: r.scores, reason: 'strokes' } : { ranking: r.ranking, scores: r.scores, reason: 'strokes', flags: { perfect: r.scores[r.ranking[0]] <= D.holes.length * 2 } });
}

module.exports = {
  id: 'minigolf', title: 'Mini Golf', category: 'casual', difficulty: 'Easy', min: 2, max: 4, watch: true,
  desc: 'Three hand-made holes, one ball each, take turns. Fewest strokes wins.',
  init: (opts, n) => {
    const s = { gen: Date.now(), n, hole: 0, turn: 0, balls: [], strokes: [], done: [], gone: Array(n).fill(false), card: Array.from({ length: n }, () => []), shot: null, lock: false, nshot: 0 };
    startHole(s, 0); return s;
  },
  move(s, i, m, ctx) {
    if (s.lock || s.done[i]) return 'Wait for the next hole.';
    const a = m.angle, p = m.power;
    if (typeof a !== 'number' || typeof p !== 'number' || !Number.isFinite(a) || !Number.isFinite(p) || Math.abs(a) > 1e4) return 'Invalid shot.';
    if (p < 0.02 || p > 1.0001) return 'Invalid power.';
    const [bx, by] = s.balls[i], r = simulate(s.hole, bx, by, a, Math.min(1, p));
    s.strokes[i]++; s.balls[i] = [r.x, r.y]; s.nshot++;
    s.shot = { id: s.nshot, hole: s.hole, who: i, holed: r.holed, f: encode(r.pts), t: Date.now() };
    if (r.holed || s.strokes[i] >= D.maxStrokes) s.done[i] = true;
    if (s.done.every(Boolean)) {
      s.lock = true; // let every client see the last putt before the board changes
      return { defer: () => finishHole(s, ctx), ms: Math.min(9000, r.pts.length * 33 + 1300) };
    }
    s.turn = nextSeat(s, i);
  },
  // a player walked away: they are out, their remaining holes count as the maximum
  onLeave(s, i, ctx) {
    s.gone[i] = true; s.done[i] = true; s.strokes[i] = D.maxStrokes;
    for (let h = s.hole + 1; h < D.holes.length; h++) s.card[i][h] = D.maxStrokes;
    if (s.done.every(Boolean)) { if (!s.lock) { s.lock = true; ctx.after(600, () => finishHole(s, ctx)); } return; }
    if (s.turn === i) s.turn = nextSeat(s, i);
  },
  redact(s) {
    const { lock, nshot, gone, ...rest } = s, shot = s.shot && { id: s.shot.id, hole: s.shot.hole, who: s.shot.who, holed: s.shot.holed };
    if (shot && Date.now() - s.shot.t < REPLAY_KEEP_MS) shot.f = s.shot.f;
    return { ...rest, shot, lock, gone, totals: s.card.map((_, i) => sofar(s, i)) };
  },
};
