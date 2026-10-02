const test=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
const {io}=require('socket.io-client');

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitForHealth(url){for(let i=0;i<60;i++){try{const res=await fetch(url);if(res.ok)return await res.json()}catch{}await sleep(100)}throw new Error('server did not become healthy')}

function onceRoom(sock,predicate,timeout=3000){
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{sock.off('room',handler);reject(new Error('room event timeout'))},timeout);const handler=r=>{if(predicate(r)){clearTimeout(timer);sock.off('room',handler);resolve(r)}};sock.on('room',handler)})
}
function onceEvent(sock,event,predicate=()=>true,timeout=3000){
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{sock.off(event,handler);reject(new Error(event+' timeout'))},timeout);const handler=v=>{if(predicate(v)){clearTimeout(timer);sock.off(event,handler);resolve(v)}};sock.on(event,handler)})
}
function call(sock,event,data){return new Promise((resolve,reject)=>sock.emit(event,data,r=>r?.ok?resolve(r):reject(new Error(r?.error||event+' failed'))))}

test('two clients can connect, chat, friend-DM, relay call signaling and play chess',async()=>{
 const port=3199,base='http://127.0.0.1:'+port;
 const proc=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),DB_PATH:':memory:'},stdio:['ignore','pipe','pipe']});
 try{
  await waitForHealth(base+'/health');
  const a=io(base,{transports:['websocket'],autoConnect:false}),b=io(base,{transports:['websocket'],autoConnect:false});
  a.connect();b.connect();
  await Promise.all([onceEvent(a,'connect'),onceEvent(b,'connect')]);
  const ha=await call(a,'hello',{name:'SmokeA'}),hb=await call(b,'hello',{name:'SmokeB'});
  const roomStartedA=onceRoom(a,r=>r.status==='playing');
  const created=await call(a,'create',{game:'chess'});
  await call(b,'join',{code:created.code});
  const started=await roomStartedA;
  assert.equal(started.game,'chess');
  const globalSeen=onceEvent(b,'chat',m=>m.to==='global'&&m.text==='hello global');
  await call(a,'chatSend',{to:'global',text:'hello global'});
  await globalSeen;
  await new Promise((resolve,reject)=>a.emit('roomChat',{text:'hello room'},r=>r?.error?reject(new Error(r.error)):resolve()));
  const friendReq=onceEvent(b,'notification',n=>n.type==='friend');
  const req=await call(a,'friendRequest',{to:hb.me.id});
  await friendReq;
  await call(b,'friendRespond',{from:ha.me.id,accept:true});
  const friends=await call(b,'friends',{});
  assert.ok(friends.friends.some(x=>x.id===ha.me.id));
  const dmSeen=onceEvent(b,'chat',m=>m.to===hb.me.id&&m.text==='hello friend');
  await call(a,'chatSend',{to:hb.me.id,text:'hello friend'});
  await dmSeen;
  const rtcSeen=onceEvent(b,'webrtc',m=>m.from===ha.me.id&&m.type==='offer');
  a.emit('webrtc',{to:hb.me.id,type:'offer',data:{type:'offer',sdp:'smoke'}});
  await rtcSeen;
  await call(a,'move',{from:'e2',to:'e4',promotion:'q'});
  const bReady=onceRoom(b,r=>r.state?.fen?.includes(' b '));
  await call(b,'move',{from:'e7',to:'e5',promotion:'q'});
  const after=await bReady;
  assert.equal(after.state.turn,0);
  a.disconnect();b.disconnect();
 }finally{proc.kill('SIGTERM');await sleep(250)}
});