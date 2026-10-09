// Starts every game with real browsers at several widths and checks: it loads, no console errors, the page never scrolls, the game fits the stage.
const { launch, player } = require('./lib');
const GAMES = (process.env.GAMES || 'chess,tictactoe,connect4,checkers,reversi,gomoku,battleship,memory,rps,reaction,minesweeper,wordbattle,minigolf,carrom,racing,cards').split(',');
const WIDTHS = (process.env.WIDTHS || '320x640,390x844,768x1024,1440x900').split(',').map(s => s.split('x').map(Number));
const emit = (p, ev, d) => p.page.evaluate(async ([ev, d]) => { const m = await import('/js/core.js'); return new Promise(r => m.sock.emit(ev, d, x => r(x))); }, [ev, d]);
const fire = (p, ev, d) => p.page.evaluate(async ([ev, d]) => { const m = await import('/js/core.js'); m.sock.emit(ev, d); }, [ev, d]);
let bad = 0; const ok = (n, c, x = '') => { console.log(c ? 'PASS' : 'FAIL', n, c ? '' : x); if (!c) bad++; };
(async () => {
  const b = await launch();
  for (const g of GAMES) for (const [W, H] of WIDTHS) {
    const n = ['cards', 'racing', 'minigolf'].includes(g) ? 3 : 2, ps = [];
    for (let i = 0; i < n; i++) ps.push(await player(b, 'U' + i + g.slice(0, 4), { width: W, height: H }));
    const c = await emit(ps[0], 'create', { game: g, priv: true, ...(g === 'racing' ? { laps: 1, cdMs: 3000 } : {}) });
    if (c.error) { ok(g + ' create', false, c.error); for (const p of ps) await p.ctx.close(); continue; }
    for (const p of ps.slice(1)) { await emit(p, 'join', { code: c.code }); await fire(p, 'ready'); }
    await ps[0].page.waitForTimeout(300); const st = await emit(ps[0], 'start', {}); if (st.error) ok(g + ' start', false, st.error);
    await ps[0].page.waitForTimeout(1500);
    const tag = `${g}@${W}`, pg = ps[0].page;
    const m = await pg.evaluate(() => {
      const r = el => { if (!el) return null; const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
      const de = document.documentElement; const stage = r(document.querySelector('.stage')), box = r(document.querySelector('.gbox'));
      const small = [...document.querySelectorAll('.room button, .room input, .room [role=button]')].filter(e => { const b = e.getBoundingClientRect(); return b.width && b.height && !e.closest('[hidden]') && (b.width < 30 || b.height < 30) && getComputedStyle(e).visibility !== 'hidden'; }).map(e => (e.getAttribute('aria-label') || e.className || e.tagName) + ':' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height));
      const clipped = [...document.querySelectorAll('.room *')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > innerWidth + 1 || b.left < -1) && !e.closest('.nc-hand,.seats,.tabs-scroll,.chips,.msgs') && getComputedStyle(e).position !== 'fixed'; }).slice(0, 3).map(e => e.className.toString().slice(0, 30));
      return { sw: de.scrollWidth, sh: de.scrollHeight, iw: innerWidth, ih: innerHeight, stage, box, hash: location.hash, small: small.slice(0, 6), clipped, loaded: !document.querySelector('.stage .empty') || !/could not be loaded/i.test(document.querySelector('.stage').textContent) };
    });
    const errs = ps.flatMap(p => p.errors).filter(e => !/TUNNEL|fonts/.test(e));
    ok(tag + ' loaded', m.hash.startsWith('#/room/') && m.loaded);
    ok(tag + ' no page scroll', m.sw <= m.iw && m.sh <= m.ih, JSON.stringify({ sw: m.sw, iw: m.iw, sh: m.sh, ih: m.ih }));
    ok(tag + ' game fits stage', !m.box || !m.stage || (m.box.w <= m.stage.w + 2 && m.box.h <= m.stage.h + 2), JSON.stringify([m.box, m.stage]));
    ok(tag + ' nothing clipped horizontally', !m.clipped.length, m.clipped.join(','));
    if (m.small.length) console.log('WARN small targets', tag, m.small.join(' | '));
    ok(tag + ' no console errors', !errs.length, errs.join(' | ').slice(0, 300));
    if (W === 390 || W === 1440) await pg.screenshot({ path: `/tmp/shots/g-${g}-${W}.png` });
    for (const p of ps) await p.ctx.close();
  }
  await b.close(); console.log(bad ? `${bad} FAILED` : 'ALL PASSED'); process.exit(bad ? 1 : 0);
})();
