// Global chat history and persistent direct messages between friends.
module.exports = function chat(app) {
  const { db, users } = app;
  const pair = (a, b) => [a, b].sort().join(':');
  const clean = (t, max) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, max);
  const api = {
    clean, pair,
    globalHistory(limit = 60) {
      return db.all('SELECT g.id, g.user_id uid, u.username AS "from", u.avatar av, g.body text, g.created_at t FROM global_chat g JOIN users u ON u.id = g.user_id ORDER BY g.id DESC LIMIT ?', limit).reverse().map(m => ({ id: m.uid, from: m.from, av: m.av, text: m.text, t: m.t, scope: 'global' }));
    },
    postGlobal(uid, text) {
      text = clean(text, 200); if (!text) return null;
      db.run('INSERT INTO global_chat(user_id,body,created_at) VALUES (?,?,?)', uid, text, Date.now());
      db.run('DELETE FROM global_chat WHERE id NOT IN (SELECT id FROM global_chat ORDER BY id DESC LIMIT 300)');
      const u = users.get(uid); return { id: uid, from: u.username, av: u.avatar, text, t: Date.now(), scope: 'global' };
    },
    dmHistory(a, b, limit = 60) { return db.all('SELECT sender_id id, body text, created_at t FROM messages WHERE pair = ? ORDER BY messages.id DESC LIMIT ?', pair(a, b), limit).reverse(); },
    dmSend(from, to, text) {
      text = clean(text, 500); if (!text) return null;
      const t = Date.now(); db.run('INSERT INTO messages(pair,sender_id,body,created_at) VALUES (?,?,?,?)', pair(from, to), from, text, t);
      return { id: from, text, t };
    },
    markRead(uid, peer) { const t = Date.now(); db.run('INSERT INTO dm_reads(user_id,peer_id,read_at) VALUES (?,?,?) ON CONFLICT(user_id,peer_id) DO UPDATE SET read_at = excluded.read_at', uid, peer, t); return t; },
    readAt(uid, peer) { const r = db.get('SELECT read_at FROM dm_reads WHERE user_id = ? AND peer_id = ?', uid, peer); return r ? r.read_at : 0; },
    unread(uid) {
      const out = {};
      for (const r of db.all(`SELECT m.sender_id peer, COUNT(*) n FROM messages m JOIN friends f ON f.user_id = ? AND f.friend_id = m.sender_id
        WHERE m.pair LIKE '%' || ? || '%' AND m.sender_id != ? AND m.created_at > COALESCE((SELECT read_at FROM dm_reads WHERE user_id = ? AND peer_id = m.sender_id), 0) GROUP BY m.sender_id`, uid, uid, uid, uid)) out[r.peer] = r.n;
      return out;
    },
    sendUnread(uid) { app.io.to('u:' + uid).emit('unread', api.unread(uid)); },
    // conversations with the latest message, for the friends page list
    threads(uid) {
      const rows = db.all(`SELECT pair, body, created_at t, sender_id FROM messages WHERE id IN (SELECT MAX(id) FROM messages WHERE pair LIKE '%' || ? || '%' GROUP BY pair) ORDER BY id DESC LIMIT 30`, uid);
      return rows.map(r => ({ peer: r.pair.split(':').find(x => x !== uid), body: r.body, t: r.t, mine: r.sender_id === uid })).filter(r => r.peer);
    },
  };
  return api;
};
