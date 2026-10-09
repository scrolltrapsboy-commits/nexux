// Room lifecycle: create, join, matchmaking, start, finish, leave, spectate. Rooms live in memory; results are persisted by the stats service.
const crypto = require('crypto');
const { games } = require('./games');
const FILL_MS = 8000;       // quick match for 3+ player games starts this long after the minimum is reached
const GRACE_MS = 20000;     // how long a disconnected player may come back

module.exports = function rooms(app) {
  const { io, users, presence, notes, stats, friends, cfg } = app;
  const all = new Map(), mine = new Map(), watching = new Map();
  const newCode = () => { let c; do c = Array.from({ length: 6 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[crypto.randomInt(31)]).join(''); while (all.has(c)); return c; };
  const seatOf = (r, uid) => r.players.findIndex(p => p.id === uid);
  const active = r => r.players.filter(p => !p.left);
  const api = {
    all, FILL_MS, GRACE_MS,
    roomOf: uid => all.get(mine.get(uid)),
    watchOf: uid => all.get(watching.get(uid)),
    anyOf(uid) { return api.roomOf(uid) || api.watchOf(uid); },
    get: code => all.get(String(code || '').toUpperCase().trim()),

    // ---- views ----
    stateFor(r, uid) {
      if (!r.state) return null;
      const g = games[r.game], k = seatOf(r, uid);
      return g.redact ? g.redact(r.state, k) : r.state;
    },
    view(r, uid) {
      const seat = seatOf(r, uid);
      return {
        code: r.code, game: r.game, now: Date.now(), opts: r.opts, status: r.status, visibility: r.visibility, priv: r.visibility !== 'public', host: r.host, min: r.min, max: r.max,
        youIdx: seat, watching: seat < 0, spectators: r.spectators.size, fillAt: r.fillAt || null, drawOffer: r.drawOffer || null,
        players: r.players.map(p => { const c = users.card(p.id), gs = app.db.get('SELECT rating FROM game_stats WHERE user_id = ? AND game = ?', p.id, r.game); return { id: p.id, name: c.name, av: c.av, ready: p.ready, left: !!p.left, connected: presence.isOnline(p.id), rating: gs ? gs.rating : 1000 }; }),
        state: api.stateFor(r, uid), result: r.result, rematch: [...r.rematch],
      };
    },
    push(r) { for (const p of r.players) io.to('u:' + p.id).emit('room', api.view(r, p.id)); for (const s of r.spectators) io.to('u:' + s).emit('room', api.view(r, s)); },
    gcount() { const o = {}; all.forEach(r => { if (r.status === 'playing') o[r.game] = (o[r.game] || 0) + active(r).length; }); return o; },
    stats() { clearTimeout(api._gt); api._gt = setTimeout(() => io.emit('gstats', api.gcount()), 200); },
    live() { return [...all.values()].filter(r => r.visibility === 'public' && r.status === 'playing' && games[r.game].watch).map(r => ({ code: r.code, game: r.game, players: r.players.map(p => users.name(p.id)), spectators: r.spectators.size, since: r.startedAt })).slice(0, 20); },
    open() { return [...all.values()].filter(r => r.visibility === 'public' && r.status === 'lobby' && r.players.length < r.max && r.players.length).map(r => ({ code: r.code, game: r.game, host: users.name(r.host), players: r.players.length, max: r.max })).slice(0, 20); },

    // ---- lifecycle ----
    create(uid, { game, visibility = 'public', max, opts = {} }) {
      const g = games[game]; if (!g) return { error: 'That game is not available.' };
      api.leave(uid);
      const mx = g.min === g.max ? g.max : Math.min(g.max, Math.max(g.min, +max || g.max));
      const r = { code: newCode(), game, spec: g, opts: g.sanitizeOpts ? g.sanitizeOpts(opts, cfg.test) : {}, visibility: ['public', 'private', 'friends'].includes(visibility) ? visibility : 'public',
        host: uid, min: g.min, max: mx, status: 'lobby', players: [], spectators: new Set(), state: null, result: null, rematch: new Set(), timers: {}, gt: [], createdAt: Date.now() };
      all.set(r.code, r); app.db.run('INSERT INTO rooms(code,game,host_id,visibility,opts,created_at) VALUES (?,?,?,?,?,?)', r.code, game, uid, r.visibility, JSON.stringify(r.opts), Date.now());
      api.add(r, uid); return { room: r };
    },
    add(r, uid) { r.players.push({ id: uid, ready: false }); mine.set(uid, r.code); io.in('u:' + uid).socketsJoin(r.code); presence.touch(uid); },
    join(uid, r) {
      if (!r) return 'That room does not exist or has expired.';
      if (api.roomOf(uid) === r) { io.in('u:' + uid).socketsJoin(r.code); return null; }
      if (r.status !== 'lobby') return 'That match has already started. You can watch it instead.';
      if (r.players.length >= r.max) return 'That room is full.';
      if (friends.isBlocked(uid, r.host)) return 'You cannot join this room.';
      if (r.visibility === 'friends' && !friends.isFriend(uid, r.host)) return 'This room is for the host\'s friends only.';
      api.leave(uid); api.add(r, uid); return null;
    },
    // quick match: join a compatible public room or open a new one
    quick(uid, { game, opts = {} }) {
      const g = games[game]; if (!g) return { error: 'That game is not available.' };
      api.leave(uid);
      const want = g.sanitizeOpts ? g.sanitizeOpts(opts, cfg.test) : {};
      // Only pair users who explicitly entered Quick Match; never auto-start a manually created public room.
      // This queue is global to the running server, not limited to friends or room invites.
      let r = [...all.values()].find(x => x.quick && x.visibility === 'public' && x.game === game && x.status === 'lobby' && x.players.length < x.max && x.players.every(p => presence.isOnline(p.id)) && !friends.isBlocked(uid, x.host) && (!g.options || JSON.stringify(x.opts) === JSON.stringify(want)));
      if (!r) { r = api.create(uid, { game, visibility: 'public', opts }).room; r.quick = true; } else api.add(r, uid);
      api.afterJoin(r); return { room: r };
    },
    // starts a quick-match room when it is ready
    afterJoin(r) {
      if (!r.quick) { api.push(r); return; }
      if (r.players.length >= r.max) { api.matchFound(r); api.begin(r); return; }
      if (r.players.length >= r.min && !r.fillAt) { r.fillAt = Date.now() + FILL_MS; r.fillT = setTimeout(() => { r.fillAt = null; if (r.status === 'lobby' && r.players.length >= r.min) { api.matchFound(r); api.begin(r); } }, FILL_MS); }
      api.push(r);
    },
    matchFound(r) { r.players.forEach(p => notes.add(p.id, 'Match found: ' + games[r.game].title, 'room', { quiet: true })); },
    begin(r) {
      const g = games[r.game];
      clearTimeout(r.fillT); r.fillAt = null; r.gt.forEach(t => { clearTimeout(t); clearInterval(t); }); r.gt = [];
      r.players = r.players.filter(p => !p.left);
      for (let i = r.players.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [r.players[i], r.players[j]] = [r.players[j], r.players[i]]; } // random seats and first move
      r.state = g.init(r.opts, r.players.length); r.drawOffer = null; r.status = 'playing'; r.result = null; r.rematch.clear(); r.startedAt = Date.now();
      r.players.forEach(p => { p.ready = true; presence.touch(p.id); });
      api.armClock(r); api.push(r); api.stats();
      if (g.onStart) g.onStart(r.state, api.ctx(r));
    },
    ctx(r) {
      const timer = (kind, ms, fn) => { const st = r.state; const run = () => { if (r.status === 'playing' && r.state === st) fn(); else if (kind === 'i') clearInterval(t); }; const t = kind === 'i' ? setInterval(run, ms) : setTimeout(run, ms); r.gt.push(t); return t; };
      return {
        room: r, push: () => api.push(r), after: (ms, fn) => timer('t', ms, fn), every: (ms, fn) => timer('i', ms, fn),
        end: out => { if (r.status === 'playing') api.finish(r, out); },
        emit: (ev, d) => io.to(r.code).emit(ev, d), emitTo: (seat, ev, d) => r.players[seat] && io.to('u:' + r.players[seat].id).emit(ev, d),
        n: r.players.length, ids: () => r.players.map(p => p.id), alive: seat => r.players[seat] && !r.players[seat].left,
      };
    },
    armClock(r) { // chess flag-fall is enforced here, not in the browser
      clearTimeout(r.ct); const g = games[r.game]; if (!g.clockLeft || r.status !== 'playing') return;
      const s = r.state, i = s.turn;
      r.ct = setTimeout(() => { if (r.status === 'playing' && r.state === s && s.turn === i) { api.finish(r, { winner: 1 - i, reason: 'timeout' }); } }, Math.max(0, g.clockLeft(s)) + 30);
    },
    // out: { winner } | { draw } | { ranking:[seat...] }, plus optional reason, scores, flags
    finish(r, out) {
      if (r.status === 'finished') return;
      clearTimeout(r.ct); clearTimeout(r.fillT); r.gt.forEach(t => { clearTimeout(t); clearInterval(t); }); r.gt = []; r.status = 'finished'; r.drawOffer = null;
      const seatsN = r.players.length, ranking = out.draw ? [] : out.ranking ? out.ranking.slice() : [out.winner, ...r.players.map((_, i) => i).filter(i => i !== out.winner)];
      if (!out.draw) for (let i = 0; i < seatsN; i++) if (!ranking.includes(i)) ranking.push(i);
      const awards = stats.record({ room: r.code, game: r.game, startedAt: r.startedAt, seats: r.players, ranking, draw: !!out.draw, reason: out.reason, scores: out.scores, flags: out.flags });
      r.result = { draw: !!out.draw, winnerId: out.draw ? null : r.players[ranking[0]].id, ranking: ranking.map(i => r.players[i].id), reason: out.reason || (out.draw ? 'draw' : 'win'), scores: out.scores || null, awards };
      app.db.run('UPDATE rooms SET closed_at = ? WHERE code = ?', Date.now(), r.code);
      for (const p of r.players) {
        const a = awards[p.id];
        notes.add(p.id, 'Match finished: ' + (r.result.draw ? 'draw' : r.result.winnerId === p.id ? 'you won' : 'you lost') + ' (' + games[r.game].title + ')', 'profile', { quiet: true });
        stats.checkSocial(p.id); presence.touch(p.id);
      }
      for (const p of r.players.filter(x => x.left)) { mine.delete(p.id); clearTimeout(r.timers[p.id]); }
      r.players = r.players.filter(p => !p.left);
      api.push(r); api.stats();
    },
    move(uid, m, ctxExtra) {
      const r = api.roomOf(uid); if (!r || r.status !== 'playing') return null;
      const i = seatOf(r, uid), g = games[r.game], s = r.state;
      if (r.players[i].left) return null;
      if (s.turn !== i && s.turn !== -1) return 'It is not your turn.';
      const out = g.move(s, i, m && typeof m === 'object' ? m : {}, api.ctx(r));
      if (typeof out === 'string') return out;
      if (out && out.defer) { setTimeout(() => { if (r.state === s && r.status === 'playing') { out.defer(); api.push(r); } }, out.ms || 1000); }
      else if (out) { api.finish(r, out); return null; }
      r.drawOffer = null; api.armClock(r); api.push(r); return null;
    },
    draw(uid, op) {
      const r = api.roomOf(uid); if (!r || r.status !== 'playing' || !games[r.game].draws) return;
      if (op === 'offer' && !r.drawOffer) { r.drawOffer = uid; r.players.filter(p => p.id !== uid).forEach(p => notes.add(p.id, users.name(uid) + ' offers a draw', 'room')); }
      else if (op === 'accept' && r.drawOffer && r.drawOffer !== uid) return api.finish(r, { draw: true, reason: 'agreed' });
      else if (op === 'decline' && r.drawOffer && r.drawOffer !== uid) r.drawOffer = null;
      else return;
      api.push(r);
    },
    resign(uid) {
      const r = api.roomOf(uid); if (!r || r.status !== 'playing' || !games[r.game].resign || r.players.length !== 2) return;
      api.finish(r, { winner: 1 - seatOf(r, uid), reason: 'resign' });
    },
    ready(uid) { const r = api.roomOf(uid); if (!r || r.status !== 'lobby') return; const p = r.players.find(x => x.id === uid); p.ready = !p.ready; api.push(r); },
    start(uid) {
      const r = api.roomOf(uid);
      if (!r || r.host !== uid || r.status !== 'lobby') return 'Only the host can start the game.';
      if (r.players.length < r.min) return `This game needs at least ${r.min} players.`;
      if (!r.players.every(p => p.ready || p.id === r.host)) return 'Everyone needs to press Ready first.';
      api.begin(r); return null;
    },
    rematch(uid) {
      const r = api.roomOf(uid); if (!r || r.status !== 'finished') return;
      r.rematch.add(uid);
      if (r.players.length >= r.min && r.players.every(p => r.rematch.has(p.id))) api.begin(r); else api.push(r);
    },
    watch(uid, code) {
      const r = api.get(code); if (!r) return 'That room does not exist or has expired.';
      if (!games[r.game].watch) return 'Spectating is not available for this game.';
      if (r.visibility === 'private') return 'This room is private.';
      if (r.visibility === 'friends' && !friends.isFriend(uid, r.host)) return 'This room is for the host\'s friends only.';
      if (r.players.some(p => p.id === uid)) return null;
      api.leave(uid); r.spectators.add(uid); watching.set(uid, r.code); io.in('u:' + uid).socketsJoin(r.code);
      api.push(r); return null;
    },
    leave(uid) {
      const w = api.watchOf(uid);
      if (w) { w.spectators.delete(uid); watching.delete(uid); io.in('u:' + uid).socketsLeave(w.code); io.to('u:' + uid).emit('room', null); api.push(w); return; }
      const r = api.roomOf(uid); if (!r) return;
      app.webrtc && app.webrtc.drop(uid);
      const i = seatOf(r, uid), g = games[r.game];
      clearTimeout(r.timers[uid]); r.rematch.delete(uid);
      if (r.status === 'playing') {
        r.players[i].left = true;
        const left = active(r);
        if (left.length < 2 || !g.onLeave) {
          // a 2 player game, or the last opponent walked away: the remaining player wins
          if (left.length) api.finish(r, { winner: seatOf(r, left[0].id), reason: 'forfeit' }); else api.finish(r, { draw: true, reason: 'abandoned' });
        } else { const out = g.onLeave(r.state, i, api.ctx(r)); if (out) api.finish(r, out); else api.push(r); }
      } else { r.players.splice(i, 1); }
      mine.delete(uid); io.in('u:' + uid).socketsLeave(r.code); io.to('u:' + uid).emit('room', null); presence.touch(uid);
      if (!r.players.some(p => !p.left)) { api.destroy(r); return; }
      if (r.host === uid) r.host = (r.players.find(p => !p.left && presence.isOnline(p.id)) || r.players.find(p => !p.left)).id; // host migration
      if (r.status === 'lobby' && r.quick && r.players.length < r.min) { clearTimeout(r.fillT); r.fillAt = null; }
      api.push(r);
    },
    destroy(r) {
      clearTimeout(r.ct); clearTimeout(r.fillT); r.gt.forEach(t => { clearTimeout(t); clearInterval(t); });
      for (const s of r.spectators) { watching.delete(s); io.to('u:' + s).emit('room', null); io.in('u:' + s).socketsLeave(r.code); }
      all.delete(r.code); app.db.run('UPDATE rooms SET closed_at = COALESCE(closed_at, ?) WHERE code = ?', Date.now(), r.code); api.stats();
    },
    // socket lifecycle
    reattach(uid) { const r = api.anyOf(uid); if (r) { clearTimeout(r.timers[uid]); io.in('u:' + uid).socketsJoin(r.code); api.push(r); } return r; },
    disconnected(uid) {
      const r = api.roomOf(uid); if (!r) { const w = api.watchOf(uid); if (w) api.leave(uid); return; }
      api.push(r); r.timers[uid] = setTimeout(() => { if (!presence.isOnline(uid)) api.leave(uid); }, GRACE_MS);
    },
    // housekeeping: drop rooms nobody has touched for a long time
    sweep() { const now = Date.now(); for (const r of all.values()) if (!r.players.some(p => presence.isOnline(p.id)) && now - r.createdAt > 3600e3) api.destroy(r); },
  };
  setInterval(api.sweep, 600e3).unref();
  return api;
};
