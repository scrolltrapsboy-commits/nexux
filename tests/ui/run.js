// Boots a throw-away in-memory server on a free port and runs every real-browser script against it.
// Needs Playwright + Chromium:  npm i -D playwright && npx playwright install chromium
const { spawn, spawnSync } = require('child_process'), path = require('path'), http = require('http');
const PORT = process.env.UI_PORT || '3111', root = path.join(__dirname, '..', '..');
const srv = spawn(process.execPath, ['server/server.js'], { cwd: root, stdio: 'ignore', env: { ...process.env, PORT, DATABASE_URL: 'sqlite::memory:', NP_TEST: '1', RATE_SCALE: '200', NODE_NO_WARNINGS: '1' } });
const up = () => new Promise(r => http.get(`http://localhost:${PORT}/health`, x => { x.resume(); r(true); }).on('error', () => r(false)));
(async () => {
  for (let i = 0; i < 40 && !(await up()); i++) await new Promise(r => setTimeout(r, 250));
  let code = 0;
  for (const f of ['widths.js', 'call.js', 'play.js', 'games.js']) {
    console.log('\n=== ' + f); const r = spawnSync(process.execPath, [path.join(__dirname, f)], { stdio: 'inherit', env: { ...process.env, BASE: `http://localhost:${PORT}` } });
    if (r.status) code = 1;
  }
  srv.kill(); process.exit(code);
})();
