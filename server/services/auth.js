// Accounts: scrypt password hashing, opaque session tokens (only a keyed hash is stored), guest upgrade, resets.
const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);
const { sha } = require('../database/migrations');

module.exports = function auth(app) {
  const { db, cfg, users } = app;
  const hashToken = t => sha(cfg.sessionSecret, t);
  const api = {
    async hashPassword(pw) {
      const salt = crypto.randomBytes(16), key = await scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 });
      return `scrypt$16384$${salt.toString('base64')}$${key.toString('base64')}`;
    },
    async verifyPassword(pw, stored) {
      if (!stored) return false; const [alg, n, salt, key] = stored.split('$'); if (alg !== 'scrypt') return false;
      const k = Buffer.from(key, 'base64'), got = await scrypt(pw, Buffer.from(salt, 'base64'), k.length, { N: +n, r: 8, p: 1 });
      return got.length === k.length && crypto.timingSafeEqual(got, k);
    },
    newSession(userId) {
      const token = crypto.randomBytes(32).toString('hex'), now = Date.now();
      db.run('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)', hashToken(token), userId, now, now + cfg.sessionDays * 864e5);
      return token;
    },
    // returns the user id for a valid token and slides the expiry forward
    userForToken(token) {
      if (typeof token !== 'string' || token.length < 16 || token.length > 128) return null;
      const h = hashToken(token), s = db.get('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?', h);
      if (!s) return null;
      if (s.expires_at < Date.now()) { db.run('DELETE FROM sessions WHERE token_hash = ?', h); return null; }
      if (s.expires_at - Date.now() < (cfg.sessionDays - 1) * 864e5) db.run('UPDATE sessions SET expires_at = ? WHERE token_hash = ?', Date.now() + cfg.sessionDays * 864e5, h);
      return s.user_id;
    },
    endSession(token) { if (typeof token === 'string') db.run('DELETE FROM sessions WHERE token_hash = ?', hashToken(token)); },
    guest(hint) { const id = users.newGuest(hint); return { id, token: api.newSession(id) }; },
    checkPassword(pw) { return typeof pw === 'string' && pw.length >= 8 && pw.length <= 128 ? null : 'Passwords need at least 8 characters.'; },
    // Register a new account. If the caller is a guest, the guest is upgraded in place so its stats, friends and messages are kept.
    async register({ username, password, guestId }) {
      username = users.cleanName(username);
      if (!users.validName(username)) return { error: 'Usernames are 3 to 16 characters: letters, numbers, spaces, - and _.' };
      const pe = api.checkPassword(password); if (pe) return { error: pe };
      const hash = await api.hashPassword(password), g = guestId && users.get(guestId);
      if (g && g.is_guest) {
        if (users.nameTaken(username, g.id)) return { error: 'That username is already taken.' };
        db.run('UPDATE users SET username = ?, pass_hash = ?, is_guest = 0 WHERE id = ?', username, hash, g.id);
        return { id: g.id, token: api.newSession(g.id), upgraded: true };
      }
      if (users.nameTaken(username)) return { error: 'That username is already taken.' };
      const id = crypto.randomBytes(5).toString('hex');
      db.run('INSERT INTO users(id,username,pass_hash,is_guest,avatar,created_at,last_seen) VALUES (?,?,?,0,?,?,?)', id, username, hash, crypto.randomInt(16), Date.now(), Date.now());
      return { id, token: api.newSession(id) };
    },
    async login({ username, password }) {
      const u = db.get('SELECT id, pass_hash FROM users WHERE username = ? COLLATE NOCASE AND is_guest = 0', users.cleanName(username));
      // always spend the hashing time so response timing does not reveal which usernames exist
      const ok = await api.verifyPassword(String(password || ''), u ? u.pass_hash : 'scrypt$16384$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64'));
      if (!u || !ok) return { error: 'Wrong username or password.' };
      return { id: u.id, token: api.newSession(u.id) };
    },
    async changePassword(id, oldPw, newPw) {
      const u = users.get(id); if (!u || u.is_guest) return 'Create an account first to set a password.';
      if (!(await api.verifyPassword(String(oldPw || ''), u.pass_hash))) return 'Your current password is wrong.';
      const pe = api.checkPassword(newPw); if (pe) return pe;
      db.run('UPDATE users SET pass_hash = ? WHERE id = ?', await api.hashPassword(newPw), id);
      db.run('DELETE FROM sessions WHERE user_id = ?', id); // sign out everywhere; the caller gets a new session
      return null;
    },
    // Reset flow structure: a one-hour single-use token. Without an email provider the link is logged on the server
    // (and returned only when NP_TEST is set); plug your mailer in at sendResetLink().
    requestReset(username) {
      const u = db.get('SELECT id, username FROM users WHERE username = ? COLLATE NOCASE AND is_guest = 0', users.cleanName(username));
      if (!u) return null;
      const token = crypto.randomBytes(24).toString('hex');
      db.run('INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES (?,?,?)', hashToken(token), u.id, Date.now() + 36e5);
      api.sendResetLink(u, `${cfg.clientUrl || ''}/#/reset/${token}`);
      return token;
    },
    sendResetLink(u, link) { console.log(`[auth] password reset for ${u.username}: ${link}`); },
    async reset(token, password) {
      const pe = api.checkPassword(password); if (pe) return pe;
      const h = hashToken(String(token || '')), r = db.get('SELECT user_id, expires_at FROM password_resets WHERE token_hash = ?', h);
      if (!r || r.expires_at < Date.now()) return 'This reset link has expired. Request a new one.';
      const hash = await api.hashPassword(password);
      db.tx(() => { db.run('UPDATE users SET pass_hash = ? WHERE id = ?', hash, r.user_id); db.run('DELETE FROM password_resets WHERE user_id = ?', r.user_id); db.run('DELETE FROM sessions WHERE user_id = ?', r.user_id); });
      return null;
    },
  };
  return api;
};
