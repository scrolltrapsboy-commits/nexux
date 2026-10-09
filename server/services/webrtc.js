// WebRTC signaling. Audio and video travel peer to peer; the server only relays offers, answers and ICE candidates
// between two members of the same room's call, and tells everyone who is in the call and whether they are muted.
module.exports = function webrtc(app) {
  const { io, cfg } = app;
  const list = r => { const l = r.voice ? [...r.voice].map(([id, v]) => ({ id, ...v })) : []; for (const p of r.players) io.to('u:' + p.id).emit('rtc:list', l); };
  const api = {
    list,
    drop(uid) { const r = app.rooms.roomOf(uid); if (r && r.voice && r.voice.delete(uid)) list(r); },
    bind(s, me, limit) {
      const ok = cb => (typeof cb === 'function' ? cb : () => {});
      s.on('rtc:join', (d, cb) => {
        cb = ok(cb); if (!me() || !limit('rtc', 20, 10000)) return cb({ error: 'Slow down.' });
        const r = app.rooms.roomOf(me()); if (!r) return cb({ error: 'Join a room before starting a call.' });
        r.voice = r.voice || new Map(); const peers = [...r.voice.keys()].filter(x => x !== me());
        r.voice.set(me(), { mic: true, cam: !!(d && d.cam) }); list(r); cb({ peers, ice: cfg.iceServers() });
      });
      s.on('rtc:signal', d => { // only relayed between two members of the same call
        if (!me() || !limit('rtcs', 200, 10000)) return;
        const r = app.rooms.roomOf(me()); if (!r || !r.voice || !d || typeof d.to !== 'string' || !d.data || typeof d.data !== 'object' || !r.voice.has(me()) || !r.voice.has(d.to)) return;
        io.to('u:' + d.to).emit('rtc:signal', { from: me(), data: d.data });
      });
      s.on('rtc:state', d => { if (!me() || !d || !limit('rtc', 20, 10000)) return; const r = app.rooms.roomOf(me()); if (r && r.voice && r.voice.has(me())) { r.voice.set(me(), { mic: !!d.mic, cam: !!d.cam }); list(r); } });
      s.on('rtc:leave', () => { if (me()) api.drop(me()); });
    },
  };
  return api;
};
