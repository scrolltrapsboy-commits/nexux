// NEXUS PLAY server entry. createServer() builds an isolated instance (used by npm test); `node server/server.js` starts one.
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const baseCfg = require('./config');
const dbLayer = require('./database/database');
const { migrate, importLegacy } = require('./database/migrations');

function createServer(over = {}) {
  const cfg = { ...baseCfg, ...over };
  const db = dbLayer.open(cfg.databaseUrl);
  migrate(db);
  if (cfg.legacyJson) importLegacy(db, cfg.legacyJson, cfg.sessionSecret, m => console.log('[db]', m));

  const web = express(), srv = http.createServer(web);
  const io = new Server(srv, { maxHttpBufferSize: 1e5, pingInterval: 10000, pingTimeout: 10000, cors: cfg.clientUrl ? { origin: cfg.clientUrl, credentials: true } : undefined });
  const app = { cfg, db, io, web, srv };
  // services are created in dependency order; each one reads the others lazily through `app`
  app.users = require('./services/users')(app);
  app.auth = require('./services/auth')(app);
  app.friends = require('./services/friends')(app);
  app.presence = require('./services/presence')(app);
  app.notes = require('./services/notifications')(app);
  app.chat = require('./services/chat')(app);
  app.stats = require('./services/stats')(app);
  app.rooms = require('./rooms')(app);
  app.webrtc = require('./services/webrtc')(app);
  require('./socket')(app);
  require('./http')(app);
  return {
    app, srv, io, db,
    listen: port => new Promise(res => srv.listen(port, () => res(srv.address().port))),
    close: () => new Promise(res => { for (const r of app.rooms.all.values()) app.rooms.destroy(r); io.close(() => { try { db.close(); } catch {} res(); }); }),
  };
}
module.exports = { createServer };

if (require.main === module) {
  const s = createServer();
  s.listen(baseCfg.port).then(p => console.log(`NEXUS PLAY listening on :${p}  (db: ${baseCfg.databaseUrl.replace(/\/\/.*@/, '//***@')})`));
  const bye = () => s.close().then(() => process.exit(0)); process.on('SIGTERM', bye); process.on('SIGINT', bye);
}
