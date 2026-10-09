// Who is online, away or in a game, pushed to friends over Socket.IO the moment it changes.
module.exports = function presence(app) {
  const { users, friends } = app;
  const conn = new Map(), away = new Set(), pending = new Set();
  let timer = null;
  const api = {
    conn,
    count: () => conn.size,
    isOnline: id => conn.has(id),
    add(id) { const first = !conn.has(id); conn.set(id, (conn.get(id) || 0) + 1); return first; },
    remove(id) { const n = (conn.get(id) || 1) - 1; if (n > 0) { conn.set(id, n); return false; } conn.delete(id); away.delete(id); return true; },
    setAway(id, v) { v ? away.add(id) : away.delete(id); },
    state(id) {
      if (!conn.has(id)) return { p: 'offline' };
      const r = app.rooms && app.rooms.roomOf(id);
      if (r && r.status === 'playing') return { p: 'ingame', game: r.game };
      return { p: away.has(id) ? 'away' : 'online' };
    },
    card(id) { const c = users.card(id); if (!c) return null; const u = users.get(id); return { ...c, seen: u.last_seen, ...api.state(id) }; },
    sendFriends(id) {
      app.io.to('u:' + id).emit('friends', { friends: friends.list(id).map(api.card), incoming: friends.incoming(id).map(api.card), blocked: friends.blocked(id).map(api.card), recent: friends.recent(id).map(api.card) });
    },
    // coalesce bursts (a game ending touches both players and all their friends) into one push per user
    touch(id) {
      pending.add(id); for (const f of friends.list(id)) if (conn.has(f)) pending.add(f);
      if (!timer) timer = setTimeout(() => { timer = null; const ids = [...pending]; pending.clear(); for (const u of ids) if (conn.has(u)) api.sendFriends(u); }, 60);
    },
    flush() { clearTimeout(timer); timer = null; const ids = [...pending]; pending.clear(); for (const u of ids) if (conn.has(u)) api.sendFriends(u); },
  };
  return api;
};
