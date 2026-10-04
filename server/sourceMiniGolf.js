'use strict';

const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');

const ROOT=path.join(__dirname,'..','third_party','source-games','minigolf');
const cache=new Map();

function loadTs(file){
  const key=path.resolve(ROOT,file);
  if(cache.has(key))return cache.get(key).exports;
  const src=fs.readFileSync(key,'utf8');
  const out=ts.transpileModule(src,{
    compilerOptions:{
      target:ts.ScriptTarget.ES2022,
      module:ts.ModuleKind.CommonJS,
      esModuleInterop:false,
      sourceMap:false
    },
    fileName:key
  }).outputText;
  const mod={exports:{}};
  cache.set(key,mod);
  const localRequire=req=>{
    if(req.startsWith('./')){
      let rel=path.join(path.dirname(key),req);
      if(!path.extname(rel))rel+='.ts';
      return loadTs(path.relative(ROOT,rel));
    }
    return require(req);
  };
  new Function('require','module','exports',out)(localRequire,mod,mod.exports);
  return mod.exports;
}

function sourceModules(){
  const geometry=loadTs('geometry.ts');
  const physics=loadTs('physics.ts');
  const holes=loadTs('holes.ts');
  return {geometry,physics,holes};
}

function other(i){return i===0?1:0}
function norm(x,y){const n=Math.hypot(x,y)||1;return{x:x/n,y:y/n}}

function miniInit(players=[]){
  const ps=players.length?players:[{id:'p0',name:'Player 1'},{id:'p1',name:'Player 2'}];
  const {physics,holes}=sourceModules();
  const hole=holes.holes[0];
  const balls=[physics.createBall(hole),physics.createBall(hole)];
  const state={
    players:ps.map((p,i)=>({id:p.id,name:p.name,strokes:0,totalStrokes:0,finished:false})),
    holeIndex:0,holeCount:holes.holes.length,turn:0,phase:'playing',winner:null,
    balls,animation:[],lastPenalty:[false,false],par:hole.par,holeName:hole.name,
    holeScores:ps.map(()=>[])
  };
  Object.defineProperty(state,'__mini',{value:{physics,holes,elapsed:0},enumerable:false,writable:true});
  return state;
}

function resetHole(s){
  const hole=s.__mini.holes.holes[s.holeIndex];
  s.balls=[s.__mini.physics.createBall(hole),s.__mini.physics.createBall(hole)];
  s.turn=0;s.phase='playing';s.par=hole.par;s.holeName=hole.name;
  s.animation=[];s.lastPenalty=[false,false];
}

function miniMove(s,i,m={}){
  if(!s.__mini)return'Source mini golf runtime unavailable';
  if(s.phase!=='playing')return'Game over';
  if(i!==s.turn)return'Not your turn';
  const b=s.balls[i];
  if(b.moving)return'Ball is still moving';
  if(b.captured)return'Ball already holed';
  const dx=Number(m.dx),dy=Number(m.dy),power=Math.max(0,Math.min(1,Number(m.power)));
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||Math.hypot(dx,dy)<0.01)return'Aim before shooting';
  if(power<=0)return'Shot power is too low';

  const dir=norm(dx,dy);
  const speed=180+720*power;
  let ball=s.__mini.physics.launchBall(b,{x:dir.x*speed,y:dir.y*speed});
  const frames=[];
  const snap=x=>frames.push({position:{...x.position},velocity:{...x.velocity},moving:x.moving,captured:x.captured});
  snap(ball);
  const hole=s.__mini.holes.holes[s.holeIndex];
  const maxSteps=4200;
  let result;
  for(let n=0;n<maxSteps;n++){
    const elapsed=s.__mini.elapsed+n/120;
    result=s.__mini.physics.stepBall(hole,ball,1/120,elapsed);
    ball=result.ball;
    if(n%4===0)snap(ball);
    if(result.stopped)break;
  }
  snap(ball);
  s.__mini.elapsed+=Math.min(maxSteps/120,frames.length/30);
  s.balls[i]=ball;
  s.animation=frames.slice(-180);
  s.lastPenalty[i]=!!result?.penalty;

  s.players[i].strokes++;
  s.players[i].totalStrokes++;
  if(ball.captured)s.players[i].finished=true;

  if(result?.penalty){
    ball.moving=false;
  }

  const both=s.balls.every(x=>x.captured);
  if(both){
    const holeScores=s.players.map(p=>p.strokes);
    s.holeScores[0].push(s.players[0].strokes);
    s.holeScores[1].push(s.players[1].strokes);
    if(s.holeIndex>=s.holeCount-1){
      const a=s.players[0].totalStrokes,b2=s.players[1].totalStrokes;
      if(a===b2){s.phase='finished';return{draw:true,reason:'equal total strokes'}}
      const winner=a<b2?0:1;s.winner=winner;s.phase='finished';
      return{winner,reason:'lowest total strokes'};
    }
    s.holeIndex++;
    s.players[0].strokes=0;s.players[1].strokes=0;
    resetHole(s);
    return{holeComplete:true,hole:s.holeIndex+1,par:s.par,animation:true};
  }

  s.turn=other(i);
  return{animation:true,penalty:!!result?.penalty,captured:!!result?.captured};
}

const MINIGOLF_SOURCE={
  name:'Mini Golf',
  category:'Sports',
  players:2,
  sourceName:'freegamestore-online/minigolf',
  sourceLicense:'MIT',
  init:miniInit,
  move:miniMove
};

module.exports={MINIGOLF_SOURCE,sourceModules};
