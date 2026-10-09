// Playwright helpers: real Chromium with fake camera/microphone, one browser context per player.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3111';
exports.BASE = BASE;
exports.launch = () => chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--no-sandbox'] });
exports.player = async (browser, name, vp = { width: 1440, height: 900 }, opts = {}) => {
  const ctx = await browser.newContext({ viewport: vp, permissions: ['camera', 'microphone'], hasTouch: vp.width < 700, isMobile: vp.width < 700, deviceScaleFactor: 1, ...opts });
  const r = await ctx.request.post(BASE + '/api/guest', { data: { name } }); const j = await r.json();
  await ctx.addInitScript(t => { try { if (!localStorage.getItem('np.token')) localStorage.setItem('np.token', t); } catch {} }, j.token);
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(BASE + '/'); await page.waitForSelector('.app,.room', { timeout: 8000 });
  return { ctx, page, token: j.token, me: j.me, errors };
};
