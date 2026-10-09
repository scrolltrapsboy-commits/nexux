const {launch,player,BASE}=require('./lib');
(async()=>{const b=await launch();
 for(const [tag,vp] of [['d',{width:1440,height:900}],['m',{width:390,height:844}]]){
  const A=await player(b,'Alice'+tag,vp);
  for(const p of ['','games','friends','ranks','profile','settings']){await A.page.goto(BASE+'/#/'+p);await A.page.waitForTimeout(500);await A.page.screenshot({path:`/tmp/shots/t-${p||'home'}-${tag}.png`});
   const o=await A.page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,sh:document.documentElement.scrollHeight,ch:innerHeight}));console.log(tag,p||'home',JSON.stringify(o));}
  console.log(A.errors);await A.ctx.close();}
 await b.close()})();
