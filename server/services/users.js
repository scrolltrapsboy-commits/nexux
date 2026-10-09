// User records, profiles and the numbers shown on them.
const crypto = require('crypto');
const NAME_RE = /^[A-Za-z0-9_ \-]{3,16}$/;
const level = xp => 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 40));
const xpFor = lv => 40 * (lv - 1) * (lv - 1); // xp needed to reach a level

module.exports = function users(app) {
  const { db } = app;
  const api = {
    NAME_RE, level, xpFor,
    cleanName(s) { return String(s || '').replace(/\s+/g, ' ').trim(); },
    validName(s) { return NAME_RE.test(s) && !/^\s|\s$/.test(s); },
    nameTaken(name, exceptId) { const r = db.get('SELECT id FROM users WHERE username = ? COLLATE NOCASE', name); return !!r && r.id !== exceptId; },
    get(id) { return db.get('SELECT * FROM users WHERE id = ?', id); },
    name(id) { const u = api.get(id); return u ? u.username : '?'; },
    exists(id) { return !!db.get('SELECT 1 x FROM users WHERE id = ?', id); },
    newGuest(hint) {
      const id = crypto.randomBytes(5).toString('hex');
      let name = api.cleanName(hint).replace(/[^A-Za-z0-9_ \-]/g, '').slice(0, 16);
      if (!api.validName(name) || api.nameTaken(name)) { do name = 'Guest' + crypto.randomInt(1000, 99999); while (api.nameTaken(name)); }
      db.run('INSERT INTO users(id,username,is_guest,avatar,created_at,last_seen) VALUES (?,?,1,?,?,?)', id, name, crypto.randomInt(16), Date.now(), Date.now());
      return id;
    },
    // what other players may see
    card(id) { const u = api.get(id); return u ? { id: u.id, name: u.username, av: u.avatar, guest: !!u.is_guest } : null; },
    me(id) { const u = api.get(id); return { id: u.id, name: u.username, avatar: u.avatar, bio: u.bio, guest: !!u.is_guest, rating: u.rating, xp: u.xp, level: level(u.xp) }; },
    setAvatar(id, a) { db.run('UPDATE users SET avatar = ? WHERE id = ?', a, id); },
    setBio(id, bio) { db.run('UPDATE users SET bio = ? WHERE id = ?', String(bio || '').replace(/\s+/g, ' ').trim().slice(0, 140), id); },
    rename(id, name) {
      name = api.cleanName(name);
      if (!api.validName(name)) return 'Usernames are 3 to 16 characters: letters, numbers, spaces, - and _.';
      if (api.nameTaken(name, id)) return 'That username is already taken.';
      db.run('UPDATE users SET username = ? WHERE id = ?', name, id); return null;
    },
    seen(id) { db.run('UPDATE users SET last_seen = ? WHERE id = ?', Date.now(), id); },
    search(q, me, limit = 8) {
      q = String(q || '').trim().slice(0, 16).replace(/[%_]/g, ''); if (q.length < 2) return [];
      return db.all(`SELECT id FROM users WHERE id != ? AND username LIKE ? ESCAPE '\\' COLLATE NOCASE
        AND id NOT IN (SELECT user_id FROM blocked_users WHERE blocked_id = ?) AND id NOT IN (SELECT blocked_id FROM blocked_users WHERE user_id = ?)
        ORDER BY (username LIKE ? COLLATE NOCASE) DESC, username LIMIT ?`, me, '%' + q + '%', me, me, q + '%', limit).map(r => r.id);
    },
    profile(id) {
      const u = api.get(id); if (!u) return null;
      const stats = db.all('SELECT game, wins, losses, draws, rating FROM game_stats WHERE user_id = ? ORDER BY wins + losses + draws DESC', id);
      const tot = stats.reduce((a, s) => ({ wins: a.wins + s.wins, losses: a.losses + s.losses, draws: a.draws + s.draws }), { wins: 0, losses: 0, draws: 0 });
      const games = tot.wins + tot.losses + tot.draws, lv = level(u.xp);
      const recent = db.all(`SELECT m.id, m.game, m.ended_at, m.is_draw, mp.outcome, mp.score,
          (SELECT group_concat(u2.username, ', ') FROM match_players p2 JOIN users u2 ON u2.id = p2.user_id WHERE p2.match_id = m.id AND p2.user_id != mp.user_id) AS vs
        FROM match_players mp JOIN matches m ON m.id = mp.match_id WHERE mp.user_id = ? ORDER BY m.ended_at DESC LIMIT 8`, id);
      return {
        id: u.id, name: u.username, av: u.avatar, bio: u.bio, guest: !!u.is_guest, created: u.created_at, seen: u.last_seen,
        level: lv, xp: u.xp, xpFloor: xpFor(lv), xpNext: xpFor(lv + 1), rating: u.rating,
        games, wins: tot.wins, losses: tot.losses, draws: tot.draws, winRate: games ? Math.round(tot.wins / games * 100) : 0,
        favorite: (stats.filter(s => s.game !== 'legacy')[0] || {}).game || null, perGame: stats,
        friends: db.get('SELECT COUNT(*) c FROM friends WHERE user_id = ?', id).c,
        achievements: db.all('SELECT key, unlocked_at FROM achievements WHERE user_id = ?', id), recent,
      };
    },
  };
  return api;
};
