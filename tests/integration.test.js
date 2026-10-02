const test=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {io}=require('socket.io-client');

function wait(ms){return new Promise(r=>setTimeout(r,ms))}
async function waitHealth(url,tries=40){for(let i=0;i<tries;i++){try{const r=await fetch(url);if(r.ok)return; }catch{} await wait(100)}throw new Error('server health timeout')}

test('socket multiplayer smoke: two clients can join and play chess',async()=>{
  const port=3189;
  const proc=spawn(process.execPath,['server.js'],{cwd:require('node:path').join(__dirname,'..'),env:{...process.env,PORT:String(port),DB_PATH:':memory:'},stdio:['ignore','pipe','pipe']});
  try{
    await waitHealth('http://127.0.0.1:'+port+'/health');
    const a=io('http://127.0.0.1:'+port,{transports:['websocket']});
    const b=io('http://127.0.0.1:'+port,{transports:['websocket']});
    const hello=(sock,name)=>new Promise((resolve,reject)=>{sock.emit('hello',{name},r=>r?.ok?resolve(r):reject(new Error(r?.error||'hello failed')))});
    const roomEvent=(sock,pred)=>new Promise(resolve=>{const h=r=>{if(pred(r)){sock.off('room',h);resolve(r)}};sock.on('room',h)});
    await Promise.all([hello(a,'Test A'),hello(b,'Test B')]);
    const created=await new Promise(resolve=>a.emit('create',{game:'chess'},resolve));
    assert.equal(created.ok,true);
    const roomReady=roomEvent(a,r=>r.status==='playing');
    const joined=await new Promise(resolve=>b.emit('join',{code:created.code},resolve));
    assert.equal(joined.ok,true);
    await roomReady;
    await new Promise((resolve,reject)=>a.emit('move',{from:'e2',to:'e4',promotion:'q'},r=>r?.ok?resolve():reject(new Error(r?.error||'move failed'))));
    const afterB=roomEvent(b,r=>r.status==='playing'&&r.state?.fen?.includes(' b '));
    await new Promise((resolve,reject)=>b.emit('move',{from:'e7',to:'e5',promotion:'q'},r=>r?.ok?resolve():reject(new Error(r?.error||'move failed'))));
    const rb=await afterB;
    assert.match(rb.state.fen,/ eP? /i);
    a.disconnect();b.disconnect();
  }finally{proc.kill('SIGTERM');await wait(200)}
});
