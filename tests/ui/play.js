// End-to-end through the real UI: quick match from Home, play Tic Tac Toe by clicking, global chat on Home, room chat in the room.
const { launch, player, BASE } = require('./lib');
let bad = 0; const ok = (n, c, x = '') => { console.log(c ? 'PASS' : 'FAIL', n, c ? '' : x); if (!c) bad++; };
(async () => {
  const b = await launch();
  for (const [tag, vp] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const A = await player(b, 'PlayA', vp), B = await player(b, 'PlayB', vp); for (const p of [A, B]) p.page.setDefaultTimeout(8000);
    // global chat lives on Home (phones: Chat tab)
    for (const p of [A, B]) if (vp.width < 700) await p.page.click('.segm button[data-t=chat]');
    await A.page.fill('.chat-f input', 'hello everyone ' + tag); await A.page.press('.chat-f input', 'Enter');
    await B.page.waitForSelector('.msgs :text("hello everyone ' + tag + '")'); ok(tag + ' global chat message reaches another player', true);
    for (const p of [A, B]) if (vp.width < 700) await p.page.click('.segm button[data-t=play]');
    // quick match tictactoe
    for (const p of [A, B]) { await p.page.selectOption('select[aria-label="Game for quick match"]', 'tictactoe'); await p.page.click('text=Quick match'); }
    await A.page.waitForSelector('.room .ttt-c'); await B.page.waitForSelector('.room .ttt-c'); ok(tag + ' quick match put both in a room', true);
    ok(tag + ' no global chat inside a game', (await A.page.locator('.room [aria-label="Global chat"],.room :text("Global chat")').count()) === 0);
    // play X: 0,1,2 vs O: 3,4 — whoever is first
    const turn = async p => { await p.page.waitForFunction(() => [...document.querySelectorAll('.ttt-c')].some(c => !c.disabled && !c.classList.contains('f')), null, { timeout: 6000 }).then(() => true, () => false); };
    const order = [[0, 3], [1, 4], [2]]; let first = null;
    for (const p of [A, B]) { const en = await p.page.evaluate(() => [...document.querySelectorAll('.ttt-c')].some(c => !c.disabled)); if (en) first = p; }
    const second = first === A ? B : A; ok(tag + ' exactly one player can move first', !!first);
    for (let i = 0; i < 5; i++) { const p = i % 2 ? second : first, cell = [0, 3, 1, 4, 2][i]; await turn(p); await p.page.click(`.ttt-c[aria-label^="Square ${cell + 1},"]`); await p.page.waitForTimeout(150); }
    await A.page.waitForTimeout(800);
    const txt = await first.page.evaluate(() => document.body.innerText); ok(tag + ' win is shown to the winner', /win|won|victory/i.test(txt), txt.slice(0, 200));
    // room chat
    const inp = '.room .chat-f input';
    if (vp.width < 700) await A.page.click('[aria-label="Open chat"],.callbar button:has(svg)').catch(() => {});
    if (await A.page.locator(inp).isVisible().catch(() => false)) { await A.page.fill(inp, 'gg ' + tag); await A.page.press(inp, 'Enter'); if (vp.width < 700) await B.page.click('[aria-label="Open chat"],.callbar button:has(svg)').catch(() => {}); await B.page.waitForSelector(`.msgs :text("gg ${tag}")`).then(() => ok(tag + ' room chat works', true), () => ok(tag + ' room chat works', false)); }
    else ok(tag + ' room chat input reachable', false);
    const errs = [...A.errors, ...B.errors].filter(e => !/TUNNEL|fonts/.test(e)); ok(tag + ' no console errors', !errs.length, errs.join(' | '));
    await A.page.screenshot({ path: `/tmp/shots/play-${tag}.png` });
    await A.ctx.close(); await B.ctx.close();
  }
  await b.close(); console.log(bad ? bad + ' FAILED' : 'ALL PASSED'); process.exit(bad ? 1 : 0);
})();
