// Match results -> Elo ratings, XP, per-game statistics, achievements and leaderboards. All of it is derived
// from results the server itself decided, so clients cannot submit scores.
const K = 24;
const ACH = {
  first_win:     { title: 'First win',      desc: 'Win any match.' },
  wins_10:       { title: '10 wins',        desc: 'Win 10 matches.' },
  wins_50:       { title: '50 wins',        desc: 'Win 50 matches.' },
  games_100:     { title: '100 games',      desc: 'Play 100 matches.' },
  chess_master:  { title: 'Chess master',   desc: 'Win 10 chess matches.' },
  perfect_game:  { title: 'Perfect game',   desc: 'Win a match without your opponent scoring.' },
  comeback:      { title: 'Comeback',       desc: 'Win after trailing by two or more points.' },
  speed_winner:  { title: 'Speed winner',   desc: 'Win a match in under 45 seconds.' },
  explorer:      { title: 'Explorer',       desc: 'Play 6 different games.' },
  friend_maker:  { title: 'Friend maker',   desc: 'Make 5 friends.' },
};
module.exports = function stats(app) {
  const { db, users, friends } = app;
  const expect = (a, b) => 1 / (1 + Math.pow(10, (b - a) / 400));
  const api = {
    ACH,
    unlock(uid, key) { const r = db.run('INSERT OR IGNORE INTO achievements(user_id,key,unlocked_at) VALUES (?,?,?)', uid, key, Date.now()); if (r.changes) { app.notes.add(uid, 'Achievement unlocked: ' + ACH[key].title, 'profile'); return true; } return false; },
    checkSocial(uid) { const out = []; if (db.get('SELECT COUNT(*) c FROM friends WHERE user_id = ?', uid).c >= 5 && api.unlock(uid, 'friend_maker')) out.push('friend_maker'); return out; },
    /**
     * @param m { room, game, startedAt, seats:[{id}], ranking:[seat,...] (best first; draws use tie:true), draw, reason, scores?:[n], flags?:{perfect,comeback} }
     * @returns awards keyed by user id: { xp, ratingBefore, ratingAfter, outcome, unlocked:[keys] }
     */
    record(m) {
      const ids = m.seats.map(s => s.id), n = ids.length, endedAt = Date.now();
      if (n < 2 || ids.some(id => !users.exists(id))) return {};
      const outcome = ids.map((_, i) => (m.draw ? 'draw' : i === m.ranking[0] ? 'win' : 'loss'));
      const awards = {};
      db.tx(() => {
        const mid = db.run('INSERT INTO matches(room_code,game,started_at,ended_at,reason,is_draw) VALUES (?,?,?,?,?,?)', m.room || null, m.game, m.startedAt || endedAt, endedAt, m.reason || null, m.draw ? 1 : 0).lastInsertRowid;
        const before = ids.map(id => (db.get('SELECT rating FROM game_stats WHERE user_id = ? AND game = ?', id, m.game) || { rating: 1000 }).rating);
        const after = before.slice();
        // pairwise Elo by finishing order (a draw scores every pair 0.5)
        const place = ids.map((_, i) => (m.draw ? 0 : m.ranking.indexOf(i)));
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
          const sI = m.draw || place[i] === place[j] ? .5 : place[i] < place[j] ? 1 : 0, e = expect(before[i], before[j]), d = (K / (n - 1)) * (sI - e);
          after[i] += d; after[j] -= d;
        }
        ids.forEach((id, i) => {
          const r = Math.max(100, Math.round(after[i])), w = outcome[i] === 'win' ? 1 : 0, l = outcome[i] === 'loss' ? 1 : 0, d = outcome[i] === 'draw' ? 1 : 0;
          db.run(`INSERT INTO game_stats(user_id,game,wins,losses,draws,rating) VALUES (?,?,?,?,?,?)
            ON CONFLICT(user_id,game) DO UPDATE SET wins = wins + excluded.wins, losses = losses + excluded.losses, draws = draws + excluded.draws, rating = excluded.rating`, id, m.game, w, l, d, r);
          db.run('INSERT INTO match_players(match_id,user_id,seat,outcome,score,rating_before,rating_after) VALUES (?,?,?,?,?,?,?)', mid, id, i, outcome[i], m.scores ? m.scores[i] : null, before[i], r);
          const xp = 10 + (w ? 25 : d ? 8 : 0);
          db.run("UPDATE users SET xp = xp + ?, rating = COALESCE((SELECT CAST(ROUND(AVG(rating)) AS INTEGER) FROM game_stats WHERE user_id = ? AND game != 'legacy'), 1000) WHERE id = ?", xp, id, id);
          awards[id] = { xp, outcome: outcome[i], ratingBefore: before[i], ratingAfter: r, unlocked: [] };
        });
      });
      const dur = endedAt - (m.startedAt || endedAt);
      ids.forEach((id, i) => {
        const a = awards[id], t = db.get(`SELECT COALESCE(SUM(wins),0) w, COALESCE(SUM(wins+losses+draws),0) g, COUNT(CASE WHEN game != 'legacy' THEN 1 END) kinds FROM game_stats WHERE user_id = ?`, id);
        const chessW = (db.get("SELECT wins FROM game_stats WHERE user_id = ? AND game = 'chess'", id) || { wins: 0 }).wins, won = a.outcome === 'win';
        const tryU = (cond, key) => { if (cond && api.unlock(id, key)) a.unlocked.push(key); };
        tryU(won, 'first_win'); tryU(t.w >= 10, 'wins_10'); tryU(t.w >= 50, 'wins_50'); tryU(t.g >= 100, 'games_100'); tryU(chessW >= 10, 'chess_master');
        tryU(won && m.flags && m.flags.perfect, 'perfect_game'); tryU(won && m.flags && m.flags.comeback === i, 'comeback'); tryU(won && dur < 45000 && dur > 0 && m.game !== 'reaction', 'speed_winner'); tryU(t.kinds >= 6, 'explorer');
      });
      return awards;
    },
    leaderboard({ me, scope = 'global', game = 'all', period = 'all', limit = 50 }) {
      const since = { day: Date.now() - 864e5, week: Date.now() - 7 * 864e5, month: Date.now() - 30 * 864e5 }[period] || 0;
      const only = scope === 'friends' ? [me, ...friends.list(me)] : null, gameF = game !== 'all' ? game : null;
      let rows;
      if (!since) {
        rows = db.all(`SELECT g.user_id id, SUM(g.wins) wins, SUM(g.losses) losses, SUM(g.draws) draws, ${gameF ? 'MAX(g.rating)' : 'MAX(u.rating)'} rating FROM game_stats g JOIN users u ON u.id = g.user_id
          WHERE (? IS NULL OR g.game = ?) GROUP BY g.user_id HAVING SUM(g.wins + g.losses + g.draws) > 0`, gameF, gameF);
      } else {
        rows = db.all(`SELECT mp.user_id id, SUM(mp.outcome = 'win') wins, SUM(mp.outcome = 'loss') losses, SUM(mp.outcome = 'draw') draws, ${gameF ? "COALESCE((SELECT rating FROM game_stats WHERE user_id = mp.user_id AND game = ?), 1000)" : 'u.rating'} rating
          FROM match_players mp JOIN matches m ON m.id = mp.match_id JOIN users u ON u.id = mp.user_id WHERE m.ended_at >= ? AND (? IS NULL OR m.game = ?) GROUP BY mp.user_id`, ...(gameF ? [gameF] : []), since, gameF, gameF);
      }
      if (only) rows = rows.filter(r => only.includes(r.id));
      rows.forEach(r => { r.games = r.wins + r.losses + r.draws; });
      rows.sort(since ? (a, b) => b.wins - a.wins || a.games - b.games || b.rating - a.rating : (a, b) => b.rating - a.rating || b.wins - a.wins);
      return rows.slice(0, limit).map((r, i) => { const c = users.card(r.id); return { rank: i + 1, id: r.id, name: c.name, av: c.av, rating: r.rating, wins: r.wins, losses: r.losses, draws: r.draws, games: r.games, you: r.id === me }; });
    },
  };
  return api;
};
