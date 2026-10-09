// In-process test harness: boots an isolated server (memory database, random port) and gives tiny socket clients.
const { io } = require('socket.io-client');
const { createServer } = require('../server/server');
const w = ms => new Promise(r => setTimeout(r, ms));
const E = (s, ev, d) => new Promise(r => s.emit(ev, d, r));
async function boot(over = {}) {
  const srv = createServer({ databaseUrl: 'sqlite::memory:', legacyJson: '', test: true, rateScale: 50, ...over });
  const port = await srv.listen(0), url = 'http://127.0.0.1:' + port;
  const clients = [];
  const client = async (name, token) => {
    const s = io(url, { forceNew: true, transports: ['websocket'] }); clients.push(s);
    s.ev = {}; s.log = [];
    s.on('room', r => { s.room = r && r.room !== undefined ? r.room : r; });
    for (const k of ['friends', 'notes', 'unread', 'dm', 'dm:seen', 'typing', 'invite', 'rtc:list', 'rtc:signal', 'chat', 'notify']) s.on(k, d => { s.ev[k] = d; s.log.push([k, d]); });
    const h = await E(s, 'hello', { name, token }); s.me = h.me; s.token = h.token; s.hello = h; if (h.room) s.room = h.room; return s;
  };
  const rest = async (path, body, token) => {
    const r = await fetch(url + '/api' + path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  const close = async () => { clients.forEach(c => c.close()); await srv.close(); };
  // two (or more) players in a started room; returns { by(seatIdx), room(), seat(client) }
  async function match(game, names, opts = {}) {
    const cs = []; for (const n of names) cs.push(await client(n));
    const r = await E(cs[0], 'create', { game, priv: true, ...opts }); if (r.error) throw new Error(r.error);
    for (const c of cs.slice(1)) { const j = await E(c, 'join', { code: r.code }); if (j.error) throw new Error(j.error); }
    await w(60); cs.slice(1).forEach(c => c.emit('ready')); await w(60);
    const st = await E(cs[0], 'start'); if (st.error) throw new Error(st.error); await w(120);
    const room = () => cs[0].room, by = i => cs.find(c => c.me.id === room().players[i].id);
    return { cs, by, room, code: r.code, A: cs[0], B: cs[1], move: async (i, m) => { const e = await E(by(i), 'move', m); await w(35); return e; } };
  }
  return { srv, url, client, rest, close, match, app: srv.app };
}
module.exports = { boot, w, E };
