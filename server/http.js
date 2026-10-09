// HTTP layer: security headers, auth + profile REST endpoints, static client.
const express = require('express');
const path = require('path');

module.exports = function http(app) {
  const { web, cfg, auth, users, stats, presence, rooms, friends } = app;
  const hits = new Map();
  const rl = (req, res, key, max, ms) => { // per-IP sliding window; returns true if the request may proceed
    const k = key + ':' + req.ip, now = Date.now(), a = (hits.get(k) || []).filter(t => now - t < ms);
    if (a.length >= max * (cfg.rateScale || 1)) { res.status(429).json({ error: 'Too many attempts. Wait a minute and try again.' }); hits.set(k, a); return false; }
    a.push(now); hits.set(k, a); return true;
  };
  setInterval(() => { const now = Date.now(); for (const [k, a] of hits) if (!a.length || now - a[a.length - 1] > 120000) hits.delete(k); }, 60000).unref();

  web.set('trust proxy', 1);
  web.disable('x-powered-by');
  web.use((req, res, next) => {
    if (cfg.httpsRedirect && req.headers['x-forwarded-proto'] === 'http') return res.redirect(301, 'https://' + req.headers.host + req.url);
    const origin = cfg.clientUrl ? ' ' + cfg.clientUrl + ' ' + cfg.clientUrl.replace(/^http/, 'ws') : '';
    res.set({
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'SAMEORIGIN',
      'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=()',
      'Content-Security-Policy': `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' ws: wss:${origin}; frame-ancestors 'self'; base-uri 'self'; form-action 'self'`,
    });
    next();
  });
  web.use('/api', express.json({ limit: '4kb' }));
  const bearer = req => { const h = req.headers.authorization || ''; return h.startsWith('Bearer ') ? h.slice(7) : null; };
  const who = req => auth.userForToken(bearer(req));
  const done = (res, r) => (r.error ? res.status(400).json({ error: r.error }) : res.json({ token: r.token, me: users.me(r.id), upgraded: !!r.upgraded }));

  web.post('/api/guest', (req, res) => { if (!rl(req, res, 'guest', 30, 60000)) return; const g = auth.guest(String((req.body || {}).name || '')); res.json({ token: g.token, me: users.me(g.id) }); });
  web.post('/api/register', async (req, res) => {
    if (!rl(req, res, 'auth', 10, 60000)) return; const b = req.body || {};
    try { done(res, await auth.register({ username: String(b.username || ''), password: String(b.password || ''), guestId: who(req) })); } catch (e) { console.error(e); res.status(500).json({ error: 'Could not create the account. Try again.' }); }
  });
  web.post('/api/login', async (req, res) => {
    if (!rl(req, res, 'auth', 10, 60000)) return; const b = req.body || {};
    try { done(res, await auth.login({ username: String(b.username || ''), password: String(b.password || '') })); } catch (e) { console.error(e); res.status(500).json({ error: 'Could not sign in. Try again.' }); }
  });
  web.post('/api/logout', (req, res) => { auth.endSession(bearer(req)); res.json({ ok: true }); });
  web.get('/api/me', (req, res) => { const id = who(req); if (!id) return res.status(401).json({ error: 'Your session has expired. Sign in again.' }); res.json({ me: users.me(id) }); });
  web.post('/api/password', async (req, res) => {
    if (!rl(req, res, 'auth', 10, 60000)) return; const id = who(req); if (!id) return res.status(401).json({ error: 'Your session has expired. Sign in again.' });
    const b = req.body || {}, e = await auth.changePassword(id, b.old, b.new); if (e) return res.status(400).json({ error: e });
    res.json({ token: auth.newSession(id), me: users.me(id) });
  });
  web.post('/api/password/forgot', (req, res) => {
    if (!rl(req, res, 'auth', 5, 60000)) return; const t = auth.requestReset(String((req.body || {}).username || ''));
    res.json({ ok: true, ...(cfg.test && t ? { token: t } : {}) }); // same answer whether or not the account exists
  });
  web.post('/api/password/reset', async (req, res) => {
    if (!rl(req, res, 'auth', 10, 60000)) return; const b = req.body || {}, e = await auth.reset(b.token, b.password); if (e) return res.status(400).json({ error: e }); res.json({ ok: true });
  });
  web.get('/api/leaderboard', (req, res) => {
    const id = who(req) || '', q = req.query, period = ['day', 'week', 'month', 'all'].includes(q.period) ? q.period : 'all';
    res.json({ rows: stats.leaderboard({ me: id, scope: q.scope === 'friends' && id ? 'friends' : 'global', game: String(q.game || 'all').slice(0, 20), period }) });
  });
  web.get('/api/profile/:id', (req, res) => { const p = users.profile(String(req.params.id).slice(0, 20)); if (!p) return res.status(404).json({ error: 'Player not found.' }); res.json(p); });
  const health = (_, res) => res.json({ ok: true, online: presence.count(), rooms: rooms.all.size, uptime: Math.round(process.uptime()) });
  web.get('/health', health); web.get('/api/health', health);
  web.use('/api', (_, res) => res.status(404).json({ error: 'Unknown endpoint.' }));

  web.use('/vendor/chess', express.static(path.join(__dirname, '..', 'node_modules', 'chess.js', 'dist', 'esm'), { maxAge: '7d' }));
  web.use('/shared', express.static(path.join(__dirname, '..', 'shared'), { etag: true, maxAge: 0 }));
  web.use(express.static(path.join(__dirname, '..', 'public'), { etag: true, maxAge: 0, index: 'index.html' }));
};
