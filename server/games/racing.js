// Top-down racing. Every browser simulates its own car and reports it ~20x/s over the `g` channel; the server never trusts the
// claim: it checks plausibility (speed + a leaky distance budget), derives progress / checkpoints / laps from the REPORTED POSITION
// only, teleports cheaters back to their last good spot and relays the validated cars to everybody in batches.
const T = require('../../shared/racing-track');
const { VMAX, GATE, REJECT } = T.PHYS, { N, K, HALF } = T;
const WIN = 40;               // progress search window (samples) around the last known position: no cutting across the infield
const BANK_MAX = 140;         // max distance a car may "save up" (network jitter) before it has to be moving for real
const TICK = 55;              // relay interval (ms) ~ 18 Hz
const RACE_MAX = 8 * 60000;   // hard stop so a race can never hang

const num = (v, lim = 1e5) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < lim;

module.exports = {
  id: 'racing', title: 'Nexus Grand Prix', category: 'racing', difficulty: 'Medium', min: 2, max: 4, watch: true,
  desc: 'Three laps around a night circuit. Steer with the arrows or on-screen pads, brake into the corners and beat up to three rivals.',
  // test mode lets suites shorten the race; production always uses 3 laps, a 5 s lights sequence and a 20 s finish window
  sanitizeOpts: (d, test) => ({ laps: test && [1, 2, 3].includes(+d.laps) ? +d.laps : 3, cd: test && +d.cdMs >= 0 && +d.cdMs <= 5000 ? +d.cdMs : 5000, fin: test && +d.finMs > 0 ? +d.finMs : 20000 }),

  init(o, n) {
    const grid = T.grid(n), now = Date.now();
    return {
      gen: now, turn: -1, n, laps: o.laps || 3, K, goAt: now + (o.cd == null ? 5000 : o.cd), finMs: o.fin || 20000, fin: [], seq: 0, dirty: false,
      cars: grid.map(g => ({ sx: g.x, sy: g.y, x: g.x, y: g.y, a: g.a, v: 0, prog: g.p, pm: ((g.p % N) + N) % N, passed: 0, bank: 0, t: now, epoch: 0, fixAt: 0, place: 0, ms: 0, left: false, rep: 0 })),
    };
  },

  onStart(s, ctx) {
    ctx.every(TICK, () => relay(s, ctx));
    ctx.after(RACE_MAX, () => ctx.end(result(s, 'time')));
  },

  move: () => 'Racing is driven in real time.',

  onEvent(s, seat, m, ctx) {
    const c = s.cars[seat]; if (!c || c.left || m.t !== 'car') return;
    const now = Date.now();
    if (!num(m.x) || !num(m.y) || !num(m.a, 1e3) || !num(m.v, 1e4)) return;      // garbage: ignore, the next valid report will do
    if ((m.e | 0) < c.epoch) return;                                            // sent before the client applied our last correction
    const el = Math.max(0, Math.min(2, (now - c.t) / 1000)); c.t = now;
    c.bank = Math.min(BANK_MAX, c.bank + VMAX * 1.3 * el);
    const d = Math.hypot(m.x - c.x, m.y - c.y);
    // locked on the grid until GO (small allowance for clock skew between the lights and the client's own clock)
    if (now < s.goAt - 300) { if (Math.hypot(m.x - c.sx, m.y - c.sy) > 4) return fix(s, seat, c, ctx, now); c.rep++; return; }
    if (d > c.bank + 6 || Math.abs(m.v) > VMAX * 1.2) return fix(s, seat, c, ctx, now);
    const loc = T.locate(m.x, m.y, Math.round(c.pm), WIN);
    if (Math.abs(loc.d) > REJECT) return fix(s, seat, c, ctx, now);
    c.bank = Math.max(0, c.bank - d);
    c.x = m.x; c.y = m.y; c.a = m.a; c.v = m.v; c.rep++; s.dirty = true;
    // progress only counts while the car is on (or right next to) the tarmac, so a run across the grass gains nothing
    if (!c.place && Math.abs(loc.d) <= GATE) {    // a finished car may keep rolling but earns no more progress

      const dp = T.wrap(loc.p - c.pm);
      c.prog += dp; c.pm = loc.p;
      // checkpoints must be passed in order: checkpoint number `passed+1` sits at progress (passed+1)*N/K; the last one of a lap is the finish line
      while (c.passed < s.laps * K && c.prog >= (c.passed + 1) * N / K) c.passed++;
      if (c.passed >= s.laps * K) finish(s, seat, c, now, ctx);
    }
  },

  onLeave(s, seat, ctx) {
    const c = s.cars[seat]; if (!c) return;
    c.left = true; s.dirty = true;
    if (allDone(s)) return result(s, 'finished');   // otherwise the race (and its finish window, if running) simply carries on without them
  },

  // only what clients need before the green light; live car data travels over `g`
  redact: s => ({ gen: s.gen, turn: -1, n: s.n, laps: s.laps, K: s.K, goAt: s.goAt, fin: s.fin, grid: s.cars.map(c => ({ x: c.sx, y: c.sy, a: c.a })) }),
};

function fix(s, seat, c, ctx, now) {
  if (now - c.fixAt < 120) return;       // don't flood a client that is still catching up
  c.fixAt = now; c.bank = 0; c.epoch++;
  ctx.emitTo(seat, 'g', { t: 'fix', x: c.x, y: c.y, a: c.a, e: c.epoch });
}

function finish(s, seat, c, now, ctx) {
  c.place = s.fin.push(seat); c.ms = now - s.goAt;
  ctx.emit('g', { t: 'fin', i: seat, place: c.place, ms: c.ms });
  ctx.push();                            // so late joiners and the HUD see the finish order
  if (allDone(s)) return ctx.end(result(s, 'finished'));
  if (s.fin.length === 1) ctx.after(s.finMs, () => ctx.end(result(s, 'time')));
}

const allDone = s => s.cars.every(c => c.left || c.place);

// finishers by place, then unfinished by progress, then players who left (also by progress)
function result(s, reason) {
  const idx = s.cars.map((_, i) => i);
  const key = i => { const c = s.cars[i]; return c.place ? [0, c.place] : c.left ? [2, -c.prog] : [1, -c.prog]; };
  idx.sort((a, b) => { const A = key(a), B = key(b); return A[0] - B[0] || A[1] - B[1] || a - b; });
  return { ranking: idx, reason, scores: s.cars.map(c => Math.round((c.passed / K) * 10) / 10) };
}

function relay(s, ctx) {
  if (!s.dirty) return; s.dirty = false;
  ctx.emit('g', { t: 'cars', now: Date.now(), cars: s.cars.map((c, i) => ({ i, x: Math.round(c.x * 10) / 10, y: Math.round(c.y * 10) / 10, a: Math.round(c.a * 1000) / 1000, v: Math.round(c.v), p: Math.round(c.prog * 100) / 100, c: c.passed, f: c.place, l: c.left ? 1 : 0 })) });
}
