const {launch,player,BASE}=require('./lib');
(async()=>{const b=await launch();const game=process.argv[2]||'tictactoe';
 for(const [tag,vp] of [['d',{width:1440,height:900}],['m',{width:390,height:844}]]){
  const A=await player(b,'Ann'+tag,vp),B=await player(b,'Bob'+tag,vp);const C=process.env.N==='3'?await player(b,'Cy'+tag,vp):null;
  await A.page.evaluate(g=>new Promise(r=>window.__np?r():r()),game).catch(()=>{});
  const code=await A.page.evaluate(g=>new Promise(res=>{const s=window.io&&window.__sock;res(null)}),game);
  // create via UI-less route: use socket from page
  const c=await A.page.evaluate(async g=>{const m=await import('/js/core.js');return new Promise(r=>m.sock.emit('create',{game:g,priv:true},x=>r(x)))},game);
  console.log('create',JSON.stringify(c).slice(0,120));
  const rc=c.code||(c.room&&c.room.code);
  await B.page.evaluate(async code=>{const m=await import('/js/core.js');return new Promise(r=>m.sock.emit('join',{code},x=>r(x)))},rc);
  await B.page.evaluate(async()=>{const m=await import('/js/core.js');m.sock.emit('ready')});
  if(C){await C.page.evaluate(async code=>{const m=await import('/js/core.js');return new Promise(r=>m.sock.emit('join',{code},x=>r(x)))},rc);await C.page.evaluate(async()=>{const m=await import('/js/core.js');m.sock.emit('ready')});}
  await A.page.waitForTimeout(400);
  await A.page.evaluate(async()=>{const m=await import('/js/core.js');return new Promise(r=>m.sock.emit('start',{},x=>r(x)))});
  await A.page.waitForTimeout(1200);
  await A.page.screenshot({path:`/tmp/shots/r-${game}-${tag}.png`});
  const o=await A.page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,sh:document.documentElement.scrollHeight,ch:innerHeight,hash:location.hash}));console.log(tag,JSON.stringify(o),A.errors.filter(e=>!/TUNNEL/.test(e)));
  await A.ctx.close();await B.ctx.close();}
 await b.close()})();
