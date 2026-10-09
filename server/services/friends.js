// Friend graph: requests, acceptance, removal, blocking. Every rule is enforced here, not in the client.
module.exports = function friends(app) {
  const { db, users } = app;
  const now = () => Date.now();
  const api = {
    list: id => db.all('SELECT friend_id id FROM friends WHERE user_id = ? ORDER BY created_at', id).map(r => r.id),
    incoming: id => db.all('SELECT from_id id FROM friend_requests WHERE to_id = ? ORDER BY created_at', id).map(r => r.id),
    blocked: id => db.all('SELECT blocked_id id FROM blocked_users WHERE user_id = ?', id).map(r => r.id),
    isFriend: (a, b) => !!db.get('SELECT 1 x FROM friends WHERE user_id = ? AND friend_id = ?', a, b),
    // blocked in either direction
    isBlocked: (a, b) => !!db.get('SELECT 1 x FROM blocked_users WHERE (user_id = ? AND blocked_id = ?) OR (user_id = ? AND blocked_id = ?)', a, b, b, a),
    relation(me, other) {
      if (api.isFriend(me, other)) return 'friend';
      if (db.get('SELECT 1 x FROM friend_requests WHERE from_id = ? AND to_id = ?', me, other)) return 'sent';
      if (db.get('SELECT 1 x FROM friend_requests WHERE from_id = ? AND to_id = ?', other, me)) return 'incoming';
      return 'none';
    },
    link(a, b) { db.tx(() => { for (const [x, y] of [[a, b], [b, a]]) db.run('INSERT OR IGNORE INTO friends(user_id,friend_id,created_at) VALUES (?,?,?)', x, y, now()); db.run('DELETE FROM friend_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)', a, b, b, a); }); },
    // returns { error } or { status: 'sent' | 'accepted' }
    request(from, to) {
      if (from === to) return { error: 'You cannot add yourself.' };
      if (!users.exists(to)) return { error: 'Player not found.' };
      if (api.isBlocked(from, to)) return { error: 'You cannot add this player.' };
      if (api.isFriend(from, to)) return { error: 'You are already friends.' };
      if (db.get('SELECT 1 x FROM friend_requests WHERE from_id = ? AND to_id = ?', to, from)) { api.link(from, to); return { status: 'accepted' }; }
      if (db.get('SELECT 1 x FROM friend_requests WHERE from_id = ? AND to_id = ?', from, to)) return { error: 'Request already sent.' };
      db.run('INSERT INTO friend_requests(from_id,to_id,created_at) VALUES (?,?,?)', from, to, now()); return { status: 'sent' };
    },
    accept(me, from) { if (!db.get('SELECT 1 x FROM friend_requests WHERE from_id = ? AND to_id = ?', from, me)) return { error: 'This request has expired.' }; api.link(me, from); return { status: 'accepted' }; },
    decline(me, from) { db.run('DELETE FROM friend_requests WHERE from_id = ? AND to_id = ?', from, me); return {}; },
    remove(me, other) { db.run('DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)', me, other, other, me); return {}; },
    block(me, other) {
      db.tx(() => { api.remove(me, other); db.run('DELETE FROM friend_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)', me, other, other, me); db.run('INSERT OR IGNORE INTO blocked_users(user_id,blocked_id,created_at) VALUES (?,?,?)', me, other, now()); });
      return {};
    },
    unblock(me, other) { db.run('DELETE FROM blocked_users WHERE user_id = ? AND blocked_id = ?', me, other); return {}; },
    // people you played against recently who are not yet friends
    recent(me, limit = 8) {
      return db.all(`SELECT p2.user_id id, MAX(m.ended_at) t FROM match_players p1 JOIN match_players p2 ON p2.match_id = p1.match_id AND p2.user_id != p1.user_id
        JOIN matches m ON m.id = p1.match_id WHERE p1.user_id = ? AND p2.user_id NOT IN (SELECT friend_id FROM friends WHERE user_id = ?)
        AND p2.user_id NOT IN (SELECT blocked_id FROM blocked_users WHERE user_id = ?) AND p2.user_id NOT IN (SELECT user_id FROM blocked_users WHERE blocked_id = ?)
        GROUP BY p2.user_id ORDER BY t DESC LIMIT ?`, me, me, me, me, limit).map(r => r.id);
    },
  };
  return api;
};
