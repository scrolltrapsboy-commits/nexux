// Applies pending schema migrations and (once) imports the legacy data.json from the early prototype.
const fs = require('fs');
const crypto = require('crypto');
const { MIGRATIONS } = require('./schema');

function migrate(db, log = () => {}) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, name TEXT, applied_at INTEGER)');
  const done = new Set(db.all('SELECT version FROM schema_version').map(r => r.version));
  for (const m of MIGRATIONS) {
    if (done.has(m.version)) continue;
    db.tx(() => { db.exec(m.sql); db.run('INSERT INTO schema_version(version,name,applied_at) VALUES (?,?,?)', m.version, m.name, Date.now()); });
    log(`applied migration ${m.version}: ${m.name}`);
  }
}

const sha = (secret, t) => crypto.createHash('sha256').update(secret + ':' + t).digest('hex');

// Imports users, friendships, blocks, DMs, notifications and sessions from the old JSON file. Never deletes the file.
function importLegacy(db, file, secret, log = () => {}) {
  if (!file || !fs.existsSync(file)) return { imported: false, reason: 'no legacy file' };
  if (db.get("SELECT 1 x FROM meta WHERE key='legacy_imported'")) return { imported: false, reason: 'already imported' };
  let j; try { j = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return { imported: false, reason: 'unreadable: ' + e.message }; }
  const users = j.users || {}, now = Date.now(); let n = 0;
  db.tx(() => {
    const used = new Set(db.all('SELECT username FROM users').map(r => r.username.toLowerCase()));
    for (const [id, u] of Object.entries(users)) {
      let name = String(u.name || 'Guest' + id.slice(0, 3)).slice(0, 16), k = 1;
      while (used.has(name.toLowerCase())) name = (String(u.name || 'Guest').slice(0, 12) + (++k));
      used.add(name.toLowerCase());
      db.run('INSERT OR IGNORE INTO users(id,username,is_guest,avatar,created_at,last_seen) VALUES (?,?,1,?,?,?)', id, name, (u.avatar | 0) % 16, now, u.seen || 0);
      const wins = u.wins | 0, played = u.played | 0;
      if (played) db.run('INSERT OR IGNORE INTO game_stats(user_id,game,wins,losses,draws,rating) VALUES (?,?,?,?,0,1000)', id, 'legacy', wins, Math.max(0, played - wins));
      n++;
    }
    for (const [id, u] of Object.entries(users)) {
      for (const f of u.friends || []) if (users[f]) db.run('INSERT OR IGNORE INTO friends(user_id,friend_id,created_at) VALUES (?,?,?)', id, f, now);
      for (const f of u.in || []) if (users[f]) db.run('INSERT OR IGNORE INTO friend_requests(from_id,to_id,created_at) VALUES (?,?,?)', f, id, now);
      for (const f of u.blocked || []) if (users[f]) db.run('INSERT OR IGNORE INTO blocked_users(user_id,blocked_id,created_at) VALUES (?,?,?)', id, f, now);
      for (const [peer, t] of Object.entries(u.read || {})) if (users[peer]) db.run('INSERT OR IGNORE INTO dm_reads(user_id,peer_id,read_at) VALUES (?,?,?)', id, peer, t);
    }
    for (const [tok, id] of Object.entries(j.tokens || {})) if (users[id]) db.run('INSERT OR IGNORE INTO sessions(token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)', sha(secret, tok), id, now, now + 30 * 864e5);
    for (const [pair, list] of Object.entries(j.dms || {})) for (const m of list) if (users[m.id] && pair.split(':').every(p => users[p])) db.run('INSERT INTO messages(pair,sender_id,body,created_at) VALUES (?,?,?,?)', pair, m.id, String(m.text).slice(0, 500), m.t || now);
    for (const [id, list] of Object.entries(j.notes || {})) if (users[id]) for (const x of list) db.run('INSERT OR IGNORE INTO notifications(id,user_id,body,go,read,created_at) VALUES (?,?,?,?,?,?)', x.id || crypto.randomBytes(3).toString('hex'), id, x.text, x.go || 'home', x.read ? 1 : 0, x.t || now);
    db.run("INSERT INTO meta(key,value) VALUES ('legacy_imported',?)", String(now));
  });
  log(`imported ${n} users from ${file}`);
  return { imported: true, users: n };
}
module.exports = { migrate, importLegacy, sha };
