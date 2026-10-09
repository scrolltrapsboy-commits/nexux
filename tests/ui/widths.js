// App pages at every target width: no page scroll, nothing overflowing sideways, tap targets, console errors, chat only where it belongs.
const { launch, player, BASE } = require('./lib');
const WIDTHS = [[320, 640], [360, 740], [375, 667], [390, 844], [414, 896], [430, 932], [768, 1024], [1024, 768], [1440, 900], [1920, 1080]];
const PAGES = ['', 'games', 'friends', 'ranks', 'profile', 'settings'];
let bad = 0; const ok = (n, c, x = '') => { if (!c) { bad++; console.log('FAIL', n, x); } else if (process.env.V) console.log('PASS', n); };
(async () => {
  const b = await launch(); let n = 0;
  for (const [W, H] of WIDTHS) {
    const A = await player(b, 'W' + W, { width: W, height: H }); const pg = A.page; pg.setDefaultTimeout(8000);
    for (const p of PAGES) {
      await pg.goto(BASE + '/#/' + p); await pg.waitForTimeout(450);
      const m = await pg.evaluate(() => {
        const de = document.documentElement, vis = e => { const b = e.getBoundingClientRect(), cs = getComputedStyle(e); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.closest('[hidden]') && b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth; };
        const small = [...document.querySelectorAll('button,a[href],input,select,[role=button]')].filter(vis).filter(e => { const b = e.getBoundingClientRect(); return b.height < 32 || b.width < 32; }).map(e => (e.getAttribute('aria-label') || e.textContent.trim().slice(0, 14) || e.className) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height));
        const out = [...document.querySelectorAll('#app *')].filter(vis).filter(e => { const b = e.getBoundingClientRect(); return (b.right > innerWidth + 1 || b.left < -1) && !e.closest('.chips,.row-scroll,.hscroll,.gscroll,.tabs,.rail-h') && getComputedStyle(e).position !== 'fixed'; }).slice(0, 4).map(e => e.tagName + '.' + String(e.className).slice(0, 24));
        return { sw: de.scrollWidth, sh: de.scrollHeight, iw: innerWidth, ih: innerHeight, small, out, chat: !!document.querySelector('.chat-f'), onl: !!document.querySelector('.app') };
      });
      n++; const t = `${p || 'home'}@${W}x${H}`;
      ok(t + ' no scroll', m.sw <= m.iw && m.sh <= m.ih, JSON.stringify({ sw: m.sw, iw: m.iw, sh: m.sh, ih: m.ih }));
      ok(t + ' no sideways overflow', !m.out.length, m.out.join(','));
      ok(t + ' target sizes', m.small.length === 0, m.small.slice(0, 5).join(' | '));
      if (p === '') ok(t + ' global chat on home', m.chat || W < 800); else ok(t + ' no chat outside home/friends', p === 'friends' || !m.chat);
      if (process.env.SHOT && (W === 320 || W === 1920 || W === 768)) await pg.screenshot({ path: `/tmp/shots/w-${p || 'home'}-${W}.png` });
    }
    const errs = A.errors.filter(e => !/TUNNEL|fonts/.test(e)); ok('console errors @' + W, !errs.length, errs.join(' | ').slice(0, 300));
    await A.ctx.close();
  }
  // signed-out screen
  for (const [W, H] of [[320, 640], [390, 844], [1440, 900]]) {
    const ctx = await b.newContext({ viewport: { width: W, height: H } }), pg = await ctx.newPage(); await pg.goto(BASE + '/'); await pg.waitForTimeout(600);
    const m = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight, txt: document.body.innerText.length }));
    ok('auth screen @' + W, m.sw <= m.iw && m.txt > 20, JSON.stringify(m)); if (process.env.SHOT) await pg.screenshot({ path: `/tmp/shots/w-auth-${W}.png` });
    if (m.sh > m.ih) console.log('NOTE auth screen scrolls inside the viewport @', W, m.sh, m.ih); await ctx.close();
  }
  await b.close(); console.log(`${n} page checks;`, bad ? bad + ' FAILED' : 'ALL PASSED'); process.exit(bad ? 1 : 0);
})();
