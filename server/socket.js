// All Socket.IO events. Each handler validates its input, checks permissions and rate limits, then delegates to a service.
const { games, catalog } = require('./games');

module.exports = function socket(app) {
  const { io, cfg, users, auth, friends, presence, notes, chat, stats, rooms, webrtc } = app;
  const invites = new Map();
  const ok = cb => (typeof cb === 'function' ? cb : () => {});
  const obj = d => (d && typeof d === 'object' && !Array.isArray(d) ? d : {});
  const str = (v, max = 64) => (typeof v === 'string' ? v.slice(0, max) : '');
  const online = () => io.emit('online', presence.count());

  io.on('connection', s => {
    const me = () => s.data.id;
    const buckets = {};
    // sliding window limiter: allow `max` events per `ms` for this socket and bucket
    const limit = (name, max, ms) => { const now = Date.now(), b = (buckets[name] = (buckets[name] || []).filter(t => now - t < ms)); if (b.length >= max) return false; b.push(now); return true; };
    const guard = (name, max, ms, cb) => { if (!me()) { ok(cb)({ error: 'Not signed in.' }); return false; } if (!limit(name, max, ms)) { ok(cb)({ error: 'Too many requests. Slow down for a moment.' }); return false; } return true; };
    const other = d => { const id = str(obj(d).id); return id && id !== me() && users.exists(id) ? id : null; };
    let flood = 0; // drop sockets that spam the server regardless of event type
    s.onAny(() => { if (!limit('all', 400, 10000)) { if (++flood > 50) s.disconnect(true); } });

    s.on('hello', (d, cb) => {
      d = obj(d); cb = ok(cb);
      let uid = auth.userForToken(d.token), token = d.token;
      if (!uid) { const g = auth.guest(str(d.name, 16)); uid = g.id; token = g.token; }
      s.data.id = uid; s.join('u:' + uid);
      const first = presence.add(uid), u = users.get(uid), was = u.last_seen;
      online(); presence.touch(uid); notes.send(uid); chat.sendUnread(uid);
      if (first && Date.now() - was > 600000) for (const f of friends.list(uid)) notes.add(f, u.username + ' is online', 'friends');
      const r = rooms.reattach(uid);
      cb({ token, me: users.me(uid), catalog: catalog(), gstats: rooms.gcount(), chat: chat.globalHistory(), room: r ? rooms.view(r, uid) : null, online: presence.count() });
    });
    s.on('ping', (_, cb) => ok(cb)());

    // ---- rooms and matchmaking ----
    s.on('create', (d, cb) => {
      cb = ok(cb); if (!guard('room', 20, 10000, cb)) return; d = obj(d);
      const res = rooms.create(me(), { game: str(d.game), visibility: str(d.visibility, 10) || (d.priv ? 'private' : 'public'), max: d.max, opts: obj(d.opts || d) });
      if (res.error) return cb(res); rooms.push(res.room); cb({ ok: 1, code: res.room.code });
    });
    s.on('join', (d, cb) => {
      cb = ok(cb); if (!guard('room', 20, 10000, cb)) return; const r = rooms.get(str(obj(d).code, 8));
      const e = rooms.join(me(), r); if (e) return cb({ error: e });
      rooms.push(r); cb({ ok: 1, code: r.code });
    });
    s.on('quick', (d, cb) => {
      cb = ok(cb); if (!guard('room', 20, 10000, cb)) return; d = obj(d);
      const res = rooms.quick(me(), { game: str(d.game), opts: obj(d.opts || d) }); if (res.error) return cb(res); cb({ ok: 1, code: res.room.code });
    });
    s.on('watch', (d, cb) => { cb = ok(cb); if (!guard('room', 20, 10000, cb)) return; const e = rooms.watch(me(), str(obj(d).code, 8)); cb(e ? { error: e } : { ok: 1 }); });
    s.on('rooms:list', (_, cb) => { if (guard('list', 20, 10000, cb)) ok(cb)({ live: rooms.live(), open: rooms.open(), gstats: rooms.gcount() }); });
    s.on('ready', () => { if (me() && limit('room', 30, 10000)) rooms.ready(me()); });
    s.on('start', (_, cb) => { cb = ok(cb); if (!guard('room', 20, 10000, cb)) return; const e = rooms.start(me()); cb(e ? { error: e } : { ok: 1 }); });
    s.on('move', (m, cb) => { cb = ok(cb); if (!me() || !limit('move', 30, 1000)) return cb('Too many actions. Slow down.'); cb(rooms.move(me(), m) || null); });
    s.on('rematch', () => { if (me() && limit('room', 30, 10000)) rooms.rematch(me()); });
    s.on('leave', () => { if (me() && limit('room', 30, 10000)) rooms.leave(me()); });
    s.on('draw', d => { if (me() && limit('room', 30, 10000)) rooms.draw(me(), str(obj(d).op, 10)); });
    s.on('resign', () => { if (me() && limit('room', 30, 10000)) rooms.resign(me()); });
    // realtime game traffic (racing, golf aiming...): routed to the game, never broadcast raw
    s.on('g', m => {
      if (!me() || !limit('g', 60, 1000)) return; const r = rooms.roomOf(me()); if (!r || r.status !== 'playing') return;
      const g = games[r.game]; if (g.onEvent) g.onEvent(r.state, r.players.findIndex(p => p.id === me()), obj(m), rooms.ctx(r));
    });
    s.on('test:state', st => { if (!cfg.test || !me()) return; const r = rooms.roomOf(me()); if (r && r.status === 'playing') { r.state = st; rooms.push(r); } });

    // ---- accounts, profile, ranking ----
    s.on('leaderboard', (d, cb) => { cb = ok(cb); if (!guard('lb', 20, 10000, cb)) return; d = obj(d);
      const game = str(d.game, 20) || 'all', scope = d.scope === 'friends' ? 'friends' : 'global', period = ['day', 'week', 'month', 'all'].includes(d.period) ? d.period : 'all';
      cb({ rows: stats.leaderboard({ me: me(), scope, game: game === 'all' || games[game] ? game : 'all', period }) }); });
    s.on('profile', (d, cb) => { cb = ok(cb); if (!guard('lb', 30, 10000, cb)) return; const id = str(obj(d).id) || me(); const p = users.profile(id); if (!p) return cb({ error: 'Player not found.' });
      cb({ ...p, you: id === me(), relation: id === me() ? 'self' : friends.relation(me(), id), presence: presence.state(id), ach: stats.ACH }); });
    s.on('avatar', (d, cb) => { cb = ok(cb); if (!guard('profile', 10, 10000, cb)) return; const a = obj(d).a; if (!Number.isInteger(a) || a < 0 || a > 15) return cb({ error: 'Pick one of the 16 avatars.' });
      users.setAvatar(me(), a); presence.touch(me()); const r = rooms.anyOf(me()); if (r) rooms.push(r); cb({ ok: 1, me: users.me(me()) }); });
    s.on('profile:update', (d, cb) => { cb = ok(cb); if (!guard('profile', 10, 10000, cb)) return; d = obj(d);
      if (typeof d.name === 'string') { const e = users.rename(me(), d.name); if (e) return cb({ error: e }); }
      if (typeof d.bio === 'string') users.setBio(me(), d.bio);
      presence.touch(me()); cb({ ok: 1, me: users.me(me()) }); });
    s.on('notes:read', d => { if (me() && limit('profile', 30, 10000)) notes.markRead(me(), str(obj(d).id, 12)); });
    s.on('away', v => { if (!me()) return; presence.setAway(me(), !!v); presence.touch(me()); });

    // ---- friends and invitations ----
    s.on('search', (d, cb) => { cb = ok(cb); if (!guard('search', 10, 5000, cb)) return; cb(users.search(str(obj(d).q, 16), me()).map(id => ({ ...presence.card(id), rel: friends.relation(me(), id) }))); });
    s.on('friend', (d, cb) => {
      cb = ok(cb); if (!guard('friend', 30, 10000, cb)) return; const id = other(d), a = me(), op = str(obj(d).op, 10); if (!id) return cb({ error: 'Player not found.' });
      let r = {};
      if (op === 'add') { if (friends.isBlocked(a, id)) return cb({ error: 'You cannot add this player.' }); r = friends.request(a, id); if (r.error) return cb(r);
        notes.add(id, r.status === 'accepted' ? users.name(a) + ' accepted your friend request' : 'Friend request from ' + users.name(a), 'friends'); }
      else if (op === 'accept') { r = friends.accept(a, id); if (r.error) return cb(r); notes.add(id, users.name(a) + ' accepted your friend request', 'friends'); }
      else if (op === 'decline') friends.decline(a, id);
      else if (op === 'remove') friends.remove(a, id);
      else if (op === 'block') friends.block(a, id);
      else if (op === 'unblock') friends.unblock(a, id);
      else return cb({ error: 'Unknown action.' });
      presence.touch(a); presence.touch(id); presence.flush(); stats.checkSocial(a); stats.checkSocial(id); cb({ ok: 1, status: r.status });
    });
    s.on('invite', (d, cb) => {
      cb = ok(cb); if (!guard('invite', 10, 10000, cb)) return; d = obj(d); const id = other(d), m = me();
      if (!id || !games[d.game]) return cb({ error: 'That invitation is not valid.' });
      if (!friends.isFriend(m, id)) return cb({ error: 'You can only invite friends.' });
      if (!presence.isOnline(id)) return cb({ error: users.name(id) + ' is offline right now.' });
      const tr = rooms.roomOf(id); if (tr && tr.status === 'playing') return cb({ error: users.name(id) + ' is in a match right now.' });
      let r = rooms.roomOf(m);
      if (!r || r.status !== 'lobby' || r.game !== d.game) { const res = rooms.create(m, { game: d.game, visibility: 'private', opts: obj(d.opts) }); if (res.error) return cb(res); r = res.room; rooms.push(r); }
      if (r.players.length >= r.max) return cb({ error: 'Your room is full.' });
      if (!invites.has(id)) invites.set(id, new Map());
      invites.get(id).set(r.code, { from: m, exp: Date.now() + 60000 });
      io.to('u:' + id).emit('invite', { code: r.code, game: r.game, from: users.name(m), av: users.get(m).avatar, exp: 60000 });
      notes.add(id, users.name(m) + ' invited you to play ' + games[r.game].title, 'friends'); cb({ ok: 1, code: r.code });
    });
    s.on('invite:accept', (d, cb) => {
      cb = ok(cb); if (!guard('invite', 20, 10000, cb)) return; const m = me(), code = str(obj(d).code, 8), iv = invites.get(m) && invites.get(m).get(code);
      if (!iv || iv.exp < Date.now()) return cb({ error: 'This invitation has expired.' });
      invites.get(m).delete(code); const r = rooms.get(code); if (!r) return cb({ error: 'That room no longer exists.' });
      const e = rooms.join(m, r); if (e) return cb({ error: e });
      rooms.push(r); notes.add(iv.from, users.name(m) + ' joined your room', 'room'); cb({ ok: 1, code });
    });
    s.on('invite:decline', d => { const m = me(), code = str(obj(d).code, 8), iv = m && invites.get(m) && invites.get(m).get(code); if (iv) { invites.get(m).delete(code); notes.add(iv.from, users.name(m) + ' declined your invitation', 'friends'); } });

    // ---- chat ----
    s.on('chat', (d, cb) => {
      cb = ok(cb); if (!me()) return cb({ error: 'Not signed in.' }); d = obj(d);
      if (!limit('chat', 5, 5000)) return cb({ error: 'Slow down: 5 messages per 5 seconds.' });
      if (d.scope === 'room') { const r = rooms.anyOf(me()); if (!r) return cb({ error: 'Join a room first.' }); const text = chat.clean(d.text, 200); if (!text) return cb({ ok: 1 }); const u = users.get(me());
        io.to(r.code).emit('chat', { id: me(), from: u.username, av: u.avatar, text, t: Date.now(), scope: 'room' }); return cb({ ok: 1 }); }
      const m = chat.postGlobal(me(), d.text); if (m) io.emit('chat', m); cb({ ok: 1 });
    });
    s.on('dm:threads', (_, cb) => { cb = ok(cb); if (!guard('dm', 30, 10000, cb)) return; cb({ threads: chat.threads(me()).filter(t => friends.isFriend(me(), t.peer)), unread: chat.unread(me()) }); });
    s.on('dm:open', (d, cb) => {
      cb = ok(cb); if (!guard('dm', 30, 10000, cb)) return; const id = other(d);
      if (!id || !friends.isFriend(me(), id)) return cb({ error: 'You can only message friends.' });
      chat.markRead(me(), id); io.to('u:' + id).emit('dm:seen', { id: me(), t: Date.now() }); chat.sendUnread(me());
      cb({ msgs: chat.dmHistory(me(), id), peerRead: chat.readAt(id, me()), peer: presence.card(id) });
    });
    s.on('dm:read', d => { const id = other(d); if (id && limit('dm', 60, 10000) && friends.isFriend(me(), id)) { chat.markRead(me(), id); io.to('u:' + id).emit('dm:seen', { id: me(), t: Date.now() }); chat.sendUnread(me()); } });
    s.on('dm:send', (d, cb) => {
      cb = ok(cb); const id = other(d); if (!id || typeof obj(d).text !== 'string') return cb({ error: 'That message could not be sent.' });
      if (!friends.isFriend(me(), id) || friends.isBlocked(me(), id)) return cb({ error: 'You can only message friends.' });
      if (!limit('dmsend', 8, 5000)) return cb({ error: 'Slow down: too many messages.' });
      const m = chat.dmSend(me(), id, d.text); if (!m) return cb({ ok: 1 });
      io.to('u:' + id).to('u:' + me()).emit('dm', { ...m, to: id });
      notes.add(id, 'New message from ' + users.name(me()), 'dm:' + me()); chat.sendUnread(id); cb({ ok: 1 });
    });
    s.on('typing', d => { // clients debounce to one event per 2s; the server drops anything faster than 1.5s
      if (!me() || !limit('typing', 1, 1500)) return; d = obj(d);
      if (d.scope === 'dm') { const id = other(d); if (id && friends.isFriend(me(), id)) io.to('u:' + id).emit('typing', { scope: 'dm', id: me(), from: users.name(me()) }); }
      else { const r = rooms.anyOf(me()); if (r) s.to(r.code).emit('typing', { scope: 'room', id: me(), from: users.name(me()) }); }
    });
    webrtc.bind(s, me, limit);

    s.on('disconnect', () => {
      const id = me(); if (!id) return;
      if (presence.remove(id)) { users.seen(id); webrtc.drop(id); rooms.disconnected(id); }
      online(); presence.touch(id);
    });
  });
};
