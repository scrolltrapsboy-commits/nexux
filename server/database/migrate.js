#!/usr/bin/env node
// npm run migrate: create/upgrade the schema and import the old data.json if one exists.
const cfg = require('../config');
const { open } = require('./database');
const { migrate, importLegacy } = require('./migrations');
const db = open(cfg.databaseUrl);
migrate(db, m => console.log('[migrate]', m));
const r = importLegacy(db, cfg.legacyJson, cfg.sessionSecret, m => console.log('[migrate]', m));
console.log('[migrate] legacy import:', JSON.stringify(r));
console.log('[migrate] done. users:', db.get('SELECT COUNT(*) c FROM users').c);
db.close();
