'use strict';
const {DatabaseSync}=require('node:sqlite');
const path=require('path');
const db=new DatabaseSync(process.env.DB_PATH||path.join(__dirname,'nexus-play.sqlite'));
db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE COLLATE NOCASE,password_hash TEXT,avatar TEXT,created_at INTEGER NOT NULL,played INTEGER DEFAULT 0,wins INTEGER DEFAULT 0,losses INTEGER DEFAULT 0,draws INTEGER DEFAULT 0);CREATE TABLE IF NOT EXISTS tokens(token TEXT PRIMARY KEY,user_id TEXT NOT NULL,created_at INTEGER NOT NULL);CREATE TABLE IF NOT EXISTS friends(a TEXT NOT NULL,b TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(a,b));CREATE TABLE IF NOT EXISTS friend_requests(sender TEXT NOT NULL,receiver TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(sender,receiver));CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,from_id TEXT NOT NULL,to_id TEXT NOT NULL,text TEXT NOT NULL,created_at INTEGER NOT NULL);CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,type TEXT,text TEXT,created_at INTEGER NOT NULL,read INTEGER DEFAULT 0);`);
console.log('NEXUS PLAY database schema is ready.');
