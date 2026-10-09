// Runs every tests/*.test.js with the built-in node:test runner (works the same on Windows, macOS and Linux).
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).map(f => path.join(__dirname, f));
const r = spawnSync(process.execPath, ['--test', '--test-reporter=spec', ...files], { stdio: 'inherit', env: { ...process.env, NODE_NO_WARNINGS: '1' } });
process.exit(r.status === null ? 1 : r.status);
