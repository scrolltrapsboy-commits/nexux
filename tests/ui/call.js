const {launch,player}=require('./lib');
const ok=(n,c,x='')=>{console.log(c?'PASS':'FAIL',n,x);if(!c)process.exitCode=1};
(async()=>{const b=await launch();process.env.PWT=1;
 for(const [tag,vp] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]){
  const A=await player(b,'CallA',vp),B=await player(b,'CallB',vp);A.page.setDefaultTimeout(6000);B.page.setDefaultTimeout(6000);
  const emit=(p,ev,d)=>p.page.evaluate(async([ev,d])=>{const m=await import('/js/core.js');return new Promise(r=>m.sock.emit(ev,d,x=>r(x)))},[ev,d]);
  const c=await emit(A,'create',{game:'tictactoe',priv:true});await emit(B,'join',{code:c.code});B.page.evaluate(async()=>{const m=await import('/js/core.js');m.sock.emit('ready')});await new Promise(r=>setTimeout(r,300));await emit(A,'start',{});
  await A.page.waitForSelector('.room');await B.page.waitForSelector('.room');
  const sel=vp.width<700?'.callbar [aria-label="Join video call"]':'.vids [class*=btn]:has-text("Join with video")';
  await A.page.click(sel);await B.page.click(sel);
  await A.page.waitForSelector('.tile video:not([hidden])',{timeout:10000}).catch(()=>{});
  await A.page.waitForTimeout(3000);
  const st=p=>p.page.evaluate(()=>[...document.querySelectorAll('.tile')].map(t=>{const v=t.querySelector('video');return {id:t.dataset.id,hidden:v.hidden,w:v.videoWidth,playing:!v.paused&&v.readyState>2,mutedIcon:!t.querySelector('.st').hidden}}));
  let sa=await st(A),sb=await st(B);console.log(tag,JSON.stringify(sa));
  ok(tag+' A sees 2 tiles',sa.length===2);ok(tag+' B sees 2 tiles',sb.length===2);
  ok(tag+' A remote video flowing',sa.filter(t=>t.w>0&&t.playing).length===2,JSON.stringify(sa));ok(tag+' B remote video flowing',sb.filter(t=>t.w>0&&t.playing).length===2);
  // mute A
  await A.page.click('[aria-label="Mute microphone"]');await B.page.waitForTimeout(800);
  sb=await st(B);ok(tag+' B sees A muted indicator',sb.some(t=>t.id===A.me.id&&t.mutedIcon));
  ok(tag+' A mic button toggled',await A.page.locator('[aria-label="Unmute microphone"]').count()===1);
  await A.page.click('[aria-label="Unmute microphone"]');await B.page.waitForTimeout(600);sb=await st(B);ok(tag+' unmute clears',!sb.find(t=>t.id===A.me.id).mutedIcon);
  // camera off
  await A.page.click('[aria-label="Turn camera off"]');await B.page.waitForTimeout(1000);sb=await st(B);
  ok(tag+' B sees A camera off',sb.find(t=>t.id===A.me.id).hidden===true,JSON.stringify(sb));
  await A.page.click('[aria-label="Turn camera on"]');await B.page.waitForTimeout(1500);sb=await st(B);
  ok(tag+' camera back on',sb.find(t=>t.id===A.me.id).hidden===false&&sb.find(t=>t.id===A.me.id).w>0,JSON.stringify(sb));
  // actual audio track state
  const tr=await B.page.evaluate(()=>[...document.querySelectorAll('audio')].map(a=>({paused:a.paused,has:!!a.srcObject&&a.srcObject.getAudioTracks().length})));console.log(tag,'audio els',JSON.stringify(tr));
  ok(tag+' remote audio element present and playing',tr.some(a=>a.has>0&&!a.paused));
  await A.page.screenshot({path:`/tmp/shots/call-${tag}.png`});
  // deafen & leave
  await A.page.click('[aria-label^="Deafen"]');ok(tag+' deafen toggles',await A.page.locator('[aria-label="Undeafen"]').count()===1);
  await A.page.click('[aria-label="Leave call"]');await B.page.waitForTimeout(800);sb=await st(B);ok(tag+' leave removes tile for B',sb.length===1);
  ok(tag+' no page errors',[...A.errors,...B.errors].filter(e=>!/TUNNEL/.test(e)).length===0,JSON.stringify([...A.errors,...B.errors].filter(e=>!/TUNNEL/.test(e))));
  await A.ctx.close();await B.ctx.close();}
 await b.close()})();
