'use strict';
const express=require('express');
const http=require('http');
const path=require('path');
const crypto=require('crypto');
const {DatabaseSync}=require('node:sqlite');
const {Server}=require('socket.io');
const {GAMES}=require('./server/gameEngine');
const { Chess } = require('chess.js');

const PORT=Number(process.env.PORT||3000);
const DB_PATH=process.env.DB_PATH||path.join(__dirname,'nexus-play.sqlite');
const app=express();
const server=http.createServer(app);
const io=new Server(server,{maxHttpBufferSize:1e6,cors:{origin:process.env.CLIENT_URL||true,credentials:true}});
const DEFAULT_ICE_SERVERS=[{urls:['stun:stun.l.google.com:19302']}];
function rtcServers(){try{const x=JSON.parse(process.env.ICE_SERVERS_JSON||'');return Array.isArray(x)&&x.length?x:DEFAULT_ICE_SERVERS}catch{return DEFAULT_ICE_SERVERS}}

app.use(express.json({limit:'100kb'}));
app.use(express.static(path.join(__dirname,'public')));

const db=new DatabaseSync(DB_PATH);
db.exec(`
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE COLLATE NOCASE,password_hash TEXT,avatar TEXT,created_at INTEGER NOT NULL,played INTEGER DEFAULT 0,wins INTEGER DEFAULT 0,losses INTEGER DEFAULT 0,draws INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS tokens(token TEXT PRIMARY KEY,user_id TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS friends(a TEXT NOT NULL,b TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(a,b));
CREATE TABLE IF NOT EXISTS friend_requests(sender TEXT NOT NULL,receiver TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(sender,receiver));
CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,from_id TEXT NOT NULL,to_id TEXT NOT NULL,text TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,type TEXT,text TEXT,created_at INTEGER NOT NULL,read INTEGER DEFAULT 0);
`);
const q={userById:db.prepare('SELECT * FROM users WHERE id=?'),userByName:db.prepare('SELECT * FROM users WHERE name=?'),insertUser:db.prepare('INSERT INTO users(id,name,password_hash,created_at) VALUES(?,?,?,?)'),token:db.prepare('SELECT user_id FROM tokens WHERE token=?'),insertToken:db.prepare('INSERT INTO tokens(token,user_id,created_at) VALUES(?,?,?)'),updateUser:db.prepare('UPDATE users SET name=?,avatar=? WHERE id=?'),leader:db.prepare('SELECT id,name,avatar,played,wins,losses,draws FROM users ORDER BY wins DESC, played DESC LIMIT 100'),message:db.prepare('INSERT INTO messages(id,from_id,to_id,text,created_at) VALUES(?,?,?,?,?)')};
const sockets=new Map();
const rooms=new Map();
const raceTimers=new Map();
const REALTIME_GAMES=new Set(['racing','pong','snake','tetris','breakout','spaceinvaders','pacman','frogger','flappy']);
const clean=s=>String(s??'').replace(/[<>]/g,'').trim().slice(0,500);
const uid=()=>crypto.randomBytes(9).toString('hex');
const roomCode=()=>{let x;do{x=crypto.randomBytes(3).toString('hex').toUpperCase()}while(rooms.has(x));return x};
const other=i=>i===0?1:0;
function hashPassword(password,salt=crypto.randomBytes(16).toString('hex')){const hash=crypto.scryptSync(password,salt,64).toString('hex');return `${salt}:${hash}`}
function verifyPassword(password,stored){if(!stored)return false;const [salt,hex]=stored.split(':');try{const got=crypto.scryptSync(password,salt,64);return crypto.timingSafeEqual(got,Buffer.from(hex,'hex'))}catch{return false}}
function publicUser(id){const u=q.userById.get(id);if(!u)return null;return{id:u.id,name:u.name,avatar:u.avatar||null,online:(sockets.get(id)||0)>0,played:u.played,wins:u.wins,losses:u.losses,draws:u.draws}}
function tokenUser(token){const r=q.token.get(token);return r?.user_id||null}
function notify(userId,type,text,data={}){const n={id:uid(),type,text,time:Date.now(),...data};db.prepare('INSERT INTO notifications(id,user_id,type,text,created_at,read) VALUES(?,?,?,?,?,0)').run(n.id,userId,type,text,n.time);io.to('u:'+userId).emit('notification',n)}
function friendSet(id){return new Set(db.prepare('SELECT b FROM friends WHERE a=?').all(id).map(x=>x.b))}
function areFriends(a,b){return !!db.prepare('SELECT 1 FROM friends WHERE a=? AND b=?').get(a,b)}
function roomOf(id){for(const r of rooms.values())if(r.players.includes(id))return r;return null}
function clone(x){return JSON.parse(JSON.stringify(x))}
function sanitizeState(r,viewer){
 const eng=GAMES[r.game];
 if(eng?.getStateForPlayer){
  try{return clone(eng.getStateForPlayer(r.state,viewer))}
  catch{}
 }
 const s=clone(r.state);if(!s)return null;
 if(r.game==='battleship'&&s.boards&&s.shots){
  const me=r.players.indexOf(viewer),opp=other(me);
  if(Array.isArray(s.boards))s.boards[opp]=null;
  if(Array.isArray(s.shots?.[me])&&r.state.boards?.[opp]){
   for(const shot of s.shots[me]){
    const [x,y]=shot;const v=r.state.boards[opp][y][x];
    const at=s.shots[me].findIndex(p=>p[0]===x&&p[1]===y);
    if(at>=0)s.shots[me][at]=[x,y,v<0?'hit':'miss'];
   }
  }
 }
 if(r.game==='minesweeper'){
  const me=r.players.indexOf(viewer);
  if(Array.isArray(s.board)&&Array.isArray(s.revealed?.[me]))s.board=s.board.map((v,idx)=>s.revealed[me].includes(idx)?v:null);
  if(Array.isArray(s.revealed))s.revealed=s.revealed.map((arr,idx)=>idx===me?arr:[]);
 }
 if(r.game==='memory'&&Array.isArray(s.cards)){s.cards=s.cards.map(c=>c.done||c.up?c:{v:null,up:false,done:false});delete s.pendingMismatch}
 if(r.game==='dominoes'&&Array.isArray(s.hands)){const me=r.players.indexOf(viewer),opp=other(me);s.hands[opp]=(s.hands[opp]||[]).map(()=>({hidden:true}))}
 if(r.game==='chess'&&s.fen){try{s.legalMoves=new Chess(s.fen).moves({verbose:true}).map(m=>({from:m.from,to:m.to,flags:m.flags}))}catch{s.legalMoves=[]}}
 return s}
function roomView(r,viewer){let actions=[];const eng=GAMES[r.game];if(eng?.getActionDescriptors&&r.state){try{actions=eng.getActionDescriptors(r.state,viewer)||[]}catch{actions=[]}}else if(eng?.getValidActions&&r.state){try{actions=(eng.getValidActions(r.state,viewer)||[]).map(a=>({action:String(a).split(':')[0],label:String(a),enabled:true}))}catch{actions=[]}}return{code:r.code,game:r.game,private:r.private,status:r.status,host:r.host,players:r.players.map((id,slot)=>({...publicUser(id),slot,connected:(sockets.get(id)||0)>0})),state:sanitizeState(r,viewer),actions,result:r.result,rematch:[...r.rematch],chat:r.chat.slice(-50),created:r.created}}
function broadcastRoom(r){for(const id of r.players)io.to('u:'+id).emit('room',roomView(r,id));io.to(r.code).emit('roomPresence',{players:r.players.map(publicUser)})}
function stopRace(r){const t=raceTimers.get(r.code);if(t){clearInterval(t);raceTimers.delete(r.code)}}
function finish(r,out){if(r.status==='finished')return;stopRace(r);r.status='finished';r.result=out;for(const id of r.players){const u=q.userById.get(id);if(!u)continue;const won=out.winnerId===id;const loss=!!out.winnerId&&!won;db.prepare('UPDATE users SET played=played+1,wins=wins+?,losses=losses+?,draws=draws+? WHERE id=?').run(won?1:0,loss?1:0,out.draw?1:0,id);notify(id,'game',out.draw?'Match drawn':won?'You won the match':'You lost the match')}}
function advanceRealtime(r){
 if(r.status!=='playing')return;
 const eng=GAMES[r.game];
 if(eng&&typeof eng.tick==='function'){
  const out=eng.tick(r.state);
  if(out?.winner!==undefined)finish(r,{winnerId:r.players[out.winner],reason:out.reason||'win'});
  else if(out?.draw)finish(r,{draw:true,reason:out.reason||'draw'});
  broadcastRoom(r);
 }
}
function startRoom(r){
 const roomPlayers=r.players.map(id=>({id,name:q.userById.get(id)?.name||'Guest'}));
 const sourceContext={broadcast:()=>{
   if(r.status==='playing'&&r.state?.status==='finished'){
     const scores=(r.state.players||[]).map(p=>Number(p.score)||0);
     const win=scores.length===2?(scores[0]===scores[1]?null:(scores[0]>scores[1]?0:1)):null;
     finish(r,win===null?{draw:true,reason:'source engine game over'}:{winnerId:r.players[win],reason:'source engine game over'});
   }
   broadcastRoom(r);
 }};
 r.status='playing';r.result=null;r.rematch=new Set();
 r.state=GAMES[r.game].init(roomPlayers,sourceContext);
 broadcastRoom(r);
 if(REALTIME_GAMES.has(r.game)){stopRace(r);raceTimers.set(r.code,setInterval(()=>advanceRealtime(r),33))}
}
function leaveRoom(id,reason='leave'){const r=roomOf(id);if(!r)return;if(r.status==='playing'&&r.players.length===2){const o=r.players.find(x=>x!==id);if(o)finish(r,{winnerId:o,reason})}else stopRace(r);r.players=r.players.filter(x=>x!==id);if(!r.players.length){stopRace(r);rooms.delete(r.code);return}if(r.host===id)r.host=r.players[0];broadcastRoom(r)}

app.get('/api/config',(req,res)=>res.json({iceServers:rtcServers()}));
app.get('/health',(req,res)=>res.json({ok:true,service:'NEXUS PLAY',games:Object.keys(GAMES).length,rooms:rooms.size,online:[...sockets.values()].reduce((a,b)=>a+b,0)}));
app.post('/api/register',(req,res)=>{const name=clean(req.body?.name).slice(0,20),password=String(req.body?.password||'');if(!/^[\p{L}\p{N}_ -]{3,20}$/u.test(name)||password.length<6)return res.status(400).json({error:'Name must be 3-20 characters and password at least 6 characters'});if(q.userByName.get(name))return res.status(409).json({error:'Username already exists'});const id=uid();q.insertUser.run(id,name,hashPassword(password),Date.now());const token=crypto.randomBytes(32).toString('hex');q.insertToken.run(token,id,Date.now());res.json({token,user:publicUser(id)})});
app.post('/api/login',(req,res)=>{const name=clean(req.body?.name),password=String(req.body?.password||''),u=q.userByName.get(name);if(!u||!verifyPassword(password,u.password_hash))return res.status(401).json({error:'Invalid username or password'});const token=crypto.randomBytes(32).toString('hex');q.insertToken.run(token,u.id,Date.now());res.json({token,user:publicUser(u.id)})});
app.get('/api/leaderboard',(req,res)=>res.json(q.leader.all().map(u=>({...u,online:(sockets.get(u.id)||0)>0}))));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

io.on('connection',socket=>{
 const reply=(cb,data)=>{if(typeof cb==='function')cb(data)};
 socket.on('hello',(d,cb)=>{let id=tokenUser(String(d?.token||''));if(!id){let name=clean(d?.name).slice(0,20)||'Guest';if(q.userByName.get(name)){name=(name.slice(0,14)+'-'+crypto.randomBytes(3).toString('hex')).slice(0,20)}id=uid();q.insertUser.run(id,name,null,Date.now());const token=crypto.randomBytes(32).toString('hex');q.insertToken.run(token,id,Date.now());socket.data.token=token}else socket.data.token=String(d.token);socket.data.id=id;socket.join('u:'+id);sockets.set(id,(sockets.get(id)||0)+1);io.emit('online',[...sockets.values()].reduce((a,b)=>a+b,0));io.emit('presence',publicUser(id));reply(cb,{ok:true,token:socket.data.token,me:publicUser(id),room:roomOf(id)?roomView(roomOf(id),id):null,games:Object.fromEntries(Object.entries(GAMES).map(([k,v])=>[k,{name:v.name,category:v.category,players:v.players}]))})});
 const me=()=>socket.data.id;
 socket.on('profile',(d,cb)=>{const id=me();if(!id)return reply(cb,{error:'Not connected'});const u=q.userById.get(id);const name=clean(d?.name).slice(0,20),avatar=clean(d?.avatar).slice(0,200);if(name&&name!==u.name&&q.userByName.get(name))return reply(cb,{error:'Username taken'});q.updateUser.run(name||u.name,avatar||null,id);io.emit('presence',publicUser(id));reply(cb,{ok:true,me:publicUser(id)})});
 socket.on('leaderboard',(d,cb)=>reply(cb,q.leader.all().map(u=>({...u,online:(sockets.get(u.id)||0)>0}))));
 socket.on('users',(d,cb)=>{const needle=clean(d?.q).toLowerCase();const rows=db.prepare('SELECT id,name,avatar,played,wins,losses,draws FROM users WHERE lower(name) LIKE ? LIMIT 30').all('%'+needle+'%');reply(cb,rows.filter(u=>u.id!==me()).map(u=>({...u,online:(sockets.get(u.id)||0)>0}))) });
 socket.on('friends',(d,cb)=>{const id=me();const friends=db.prepare('SELECT u.id,u.name,u.avatar,u.played,u.wins,u.losses,u.draws FROM friends f JOIN users u ON u.id=f.b WHERE f.a=?').all(id).map(u=>({...u,online:(sockets.get(u.id)||0)>0}));const requests=db.prepare('SELECT u.id,u.name,u.avatar,u.played,u.wins FROM friend_requests f JOIN users u ON u.id=f.sender WHERE f.receiver=?').all(id);reply(cb,{friends,requests})});
 socket.on('friendRequest',(d,cb)=>{const to=String(d?.to||'');if(!q.userById.get(to)||to===me())return reply(cb,{error:'Invalid user'});if(areFriends(me(),to))return reply(cb,{error:'Already friends'});db.prepare('INSERT OR IGNORE INTO friend_requests(sender,receiver,created_at) VALUES(?,?,?)').run(me(),to,Date.now());notify(to,'friend',q.userById.get(me()).name+' sent you a friend request');reply(cb,{ok:true})});
 socket.on('friendRespond',(d,cb)=>{const from=String(d?.from||''),accept=!!d?.accept;if(!db.prepare('SELECT 1 FROM friend_requests WHERE sender=? AND receiver=?').get(from,me()))return reply(cb,{error:'Request not found'});db.prepare('DELETE FROM friend_requests WHERE sender=? AND receiver=?').run(from,me());if(accept){db.prepare('INSERT OR IGNORE INTO friends(a,b,created_at) VALUES(?,?,?)').run(me(),from,Date.now());db.prepare('INSERT OR IGNORE INTO friends(a,b,created_at) VALUES(?,?,?)').run(from,me(),Date.now());notify(from,'friend',q.userById.get(me()).name+' accepted your friend request')}reply(cb,{ok:true})});
 socket.on('friendRemove',(d,cb)=>{const id=String(d?.id||'');db.prepare('DELETE FROM friends WHERE (a=? AND b=?) OR (a=? AND b=?)').run(me(),id,id,me());reply(cb,{ok:true})});
 socket.on('chatHistory',(d,cb)=>{const to=String(d?.to||'global');let rows;if(to==='global')rows=db.prepare('SELECT m.id,m.from_id as "from",m.to_id as "to",u.name as fromName,m.text,m.created_at as time FROM messages m JOIN users u ON u.id=m.from_id WHERE m.to_id="global" ORDER BY m.created_at DESC LIMIT 100').all().reverse();else rows=db.prepare('SELECT m.id,m.from_id as "from",m.to_id as "to",u.name as fromName,m.text,m.created_at as time FROM messages m JOIN users u ON u.id=m.from_id WHERE (m.from_id=? AND m.to_id=?) OR (m.from_id=? AND m.to_id=?) ORDER BY m.created_at DESC LIMIT 100').all(me(),to,to,me()).reverse();reply(cb,rows)});
 socket.on('chatSend',(d,cb)=>{const to=String(d?.to||'global'),text=clean(d?.text).slice(0,500);if(!text)return;if(to!=='global'&&!areFriends(me(),to)&&!(roomOf(me())?.players.includes(to)))return reply(cb,{error:'Not allowed'});const msg={id:uid(),from:me(),to,text,time:Date.now()};q.message.run(msg.id,msg.from,msg.to,msg.text,msg.time);if(to==='global')io.emit('chat',msg);else{io.to('u:'+to).emit('chat',msg);io.to('u:'+me()).emit('chat',msg);notify(to,'message',q.userById.get(me()).name+': '+text)}reply(cb,{ok:true})});
 socket.on('typing',(d)=>{const to=String(d?.to||'');if(!to||to===me())return;const mine=roomOf(me()),peer=roomOf(to);if(!areFriends(me(),to)&&(!mine||!peer||mine.code!==peer.code))return;io.to('u:'+to).emit('typing',{from:me(),name:q.userById.get(me())?.name})});
 socket.on('notifications',(d,cb)=>reply(cb,db.prepare('SELECT id,type,text,created_at as time,read FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(me())));
 socket.on('readNotifications',()=>db.prepare('UPDATE notifications SET read=1 WHERE user_id=?').run(me()));
 socket.on('create',(d,cb)=>{const game=String(d?.game||'');if(!GAMES[game])return reply(cb,{error:'Unknown game'});leaveRoom(me());const r={code:roomCode(),game,private:!!d.private,host:me(),players:[me()],status:'lobby',state:null,result:null,rematch:new Set(),chat:[],created:Date.now()};rooms.set(r.code,r);socket.join(r.code);broadcastRoom(r);reply(cb,{ok:true,code:r.code,game:r.game,room:roomView(r,me())})});
 socket.on('join',(d,cb)=>{const r=rooms.get(String(d?.code||'').toUpperCase());if(!r)return reply(cb,{error:'Room not found'});if(r.status!=='lobby'||r.players.length>=GAMES[r.game].players)return reply(cb,{error:'Room is full or already started'});leaveRoom(me());r.players.push(me());socket.join(r.code);reply(cb,{ok:true,code:r.code,game:r.game,room:roomView(r,me())});if(r.players.length===GAMES[r.game].players)startRoom(r);else broadcastRoom(r)});
 socket.on('quick',(d,cb)=>{const game=String(d?.game||'');if(!GAMES[game])return reply(cb,{error:'Unknown game'});leaveRoom(me());let r=[...rooms.values()].find(x=>x.game===game&&!x.private&&x.status==='lobby'&&x.players.length<GAMES[game].players);if(!r){r={code:roomCode(),game,private:false,host:me(),players:[],status:'lobby',state:null,result:null,rematch:new Set(),chat:[],created:Date.now()};rooms.set(r.code,r)}r.players.push(me());socket.join(r.code);if(r.players.length===GAMES[game].players)startRoom(r);else broadcastRoom(r);reply(cb,{ok:true,code:r.code,room:roomView(r,me())})});
 socket.on('start',(d,cb)=>{const r=roomOf(me());if(!r||r.host!==me()||r.status!=='lobby'||r.players.length<GAMES[r.game].players)return reply(cb,{error:'Room is not ready to start'});startRoom(r);reply(cb,{ok:true})});
 socket.on('move',(m,cb)=>{const r=roomOf(me());if(!r||r.status!=='playing')return reply(cb,{error:'No active game'});const i=r.players.indexOf(me());if(REALTIME_GAMES.has(r.game))return reply(cb,{error:'Realtime game uses live controls'});const out=GAMES[r.game].move(r.state,i,m||{});if(typeof out==='string')return reply(cb,{error:out});if(out?.winner!==undefined)finish(r,{winnerId:r.players[out.winner],reason:out.reason||'win'});else if(out?.draw)finish(r,{draw:true,reason:out.reason||'draw'});broadcastRoom(r);if(r.game==='memory'&&out?.mismatch){const delay=Math.max(400,Math.min(1600,Number(out.delayMs)||900));setTimeout(()=>{if(r.status!=='playing'||!r.state.pendingMismatch)return;const p=r.state.pendingMismatch;r.state.cards[p.a].up=false;r.state.cards[p.b].up=false;r.state.pick=[];r.state.pendingMismatch=null;r.state.turn=other(p.player);broadcastRoom(r)},delay)}reply(cb,{ok:true,state:roomView(r,me()).state,result:r.result})});
 socket.on('drive',(m,cb)=>{const r=roomOf(me());if(!r||r.status!=='playing'||!REALTIME_GAMES.has(r.game))return reply(cb,{error:'No active realtime game'});const i=r.players.indexOf(me());const out=GAMES[r.game].move(r.state,i,m||{});if(typeof out==='string')return reply(cb,{error:out});if(out?.winner!==undefined)finish(r,{winnerId:r.players[out.winner],reason:out.reason||'win'});else if(out?.draw)finish(r,{draw:true,reason:out.reason||'draw'});broadcastRoom(r);reply(cb,{ok:true})});
 socket.on('roomChat',(d,cb)=>{const r=roomOf(me()),text=clean(d?.text).slice(0,400);if(!r||!text)return reply(cb,{error:'No active room'});const msg={id:uid(),from:me(),name:q.userById.get(me()).name,text,time:Date.now()};r.chat.push(msg);r.chat=r.chat.slice(-60);io.to(r.code).emit('roomChat',msg);reply(cb,{ok:true})});
 socket.on('rematch',()=>{const r=roomOf(me());if(!r||r.status!=='finished')return;r.rematch.add(me());if(r.rematch.size===r.players.length)startRoom(r);else broadcastRoom(r)});
 socket.on('leave',()=>leaveRoom(me()));
 socket.on('invite',(d,cb)=>{const to=String(d?.to||''),r=roomOf(me());if(!r||!areFriends(me(),to))return reply(cb,{error:'Friends only'});notify(to,'invite',q.userById.get(me()).name+' invited you to '+GAMES[r.game].name,{room:r.code,game:r.game});io.to('u:'+to).emit('gameInvite',{room:r.code,game:r.game,from:publicUser(me())});reply(cb,{ok:true})});
 socket.on('resign',(d,cb)=>{const r=roomOf(me());if(!r||r.status!=='playing')return reply(cb,{error:'No active game'});const i=r.players.indexOf(me());finish(r,{winnerId:r.players[other(i)],reason:'resign'});broadcastRoom(r);reply(cb,{ok:true})});
 socket.on('drawOffer',(d,cb)=>{const r=roomOf(me());if(!r||r.status!=='playing')return reply(cb,{error:'No active game'});const to=r.players.find(x=>x!==me());if(to){notify(to,'draw',q.userById.get(me()).name+' offered a draw',{room:r.code});io.to('u:'+to).emit('drawOffer',{from:publicUser(me())})}reply(cb,{ok:true})});
 socket.on('drawRespond',(d,cb)=>{const r=roomOf(me());if(!r||r.status!=='playing')return reply(cb,{error:'No active game'});if(d?.accept){finish(r,{draw:true,reason:'agreement'});broadcastRoom(r)}reply(cb,{ok:true})});
 socket.on('webrtc',(d)=>{const to=String(d?.to||''),type=String(d?.type||'');if(!to||to===me()||!['offer','answer','ice','hangup'].includes(type))return;const mine=roomOf(me()),peer=roomOf(to);if(!areFriends(me(),to)&&(!mine||!peer||mine.code!==peer.code))return;io.to('u:'+to).emit('webrtc',{from:me(),type,data:d.data})});
 socket.on('disconnect',()=>{const id=me();if(!id)return;const n=(sockets.get(id)||1)-1;if(n>0)sockets.set(id,n);else sockets.delete(id);io.emit('online',[...sockets.values()].reduce((a,b)=>a+b,0));io.emit('presence',publicUser(id))});
});
server.listen(PORT,()=>console.log(`NEXUS PLAY running on http://localhost:${PORT}`));
