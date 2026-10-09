// Thin database layer over Node's built-in SQLite. Every query goes through run/get/all/tx so a PostgreSQL
// adapter with the same four methods can be dropped in later without touching the services.
const fs = require('fs');
const path = require('path');
let DatabaseSync;
try { ({ DatabaseSync } = require('node:sqlite')); }
catch { throw new Error('NEXUS PLAY needs Node.js 22.5 or newer (built-in node:sqlite). Current: ' + process.version); }

class DB {
  constructor(url) {
    if (/^postgres(ql)?:/.test(url)) throw new Error('PostgreSQL adapter is not bundled. Implement server/database/postgres.js with the run/get/all/tx interface, or use sqlite:<file>.');
    const file = url.replace(/^sqlite:/, '');
    if (file !== ':memory:' && file !== '') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    this.file = file || ':memory:';
    this.h = new DatabaseSync(this.file);
    this.h.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=3000;');
    this.cache = new Map();
  }
  st(sql) { let s = this.cache.get(sql); if (!s) { s = this.h.prepare(sql); this.cache.set(sql, s); } return s; }
  run(sql, ...p) { return this.st(sql).run(...p); }
  get(sql, ...p) { const r = this.st(sql).get(...p); return r ? { ...r } : undefined; }
  all(sql, ...p) { return this.st(sql).all(...p).map(r => ({ ...r })); }
  exec(sql) { this.h.exec(sql); }
  tx(fn) { this.h.exec('BEGIN IMMEDIATE'); try { const r = fn(); this.h.exec('COMMIT'); return r; } catch (e) { try { this.h.exec('ROLLBACK'); } catch {} throw e; } }
  close() { try { this.h.close(); } catch {} }
}
module.exports = { open: url => new DB(url) };
