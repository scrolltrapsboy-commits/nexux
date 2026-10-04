'use strict';

const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.join(__dirname,'..','third_party','source-games','racing');

function loadSource(){
  const car=fs.readFileSync(path.join(ROOT,'car.js'),'utf8');
  const track=fs.readFileSync(path.join(ROOT,'track.js'),'utf8');
  const ctx=vm.createContext({console,setTimeout,clearTimeout,Math});
  vm.runInContext(car+'\ntrackSourceDone=true;',ctx,{filename:'speed-racer/car.js'});
  vm.runInContext(track,ctx,{filename:'speed-racer/track.js'});
  vm.runInContext('globalThis.__NEXUS_SPEED_RACER={Car,Track};',ctx);
  return ctx.__NEXUS_SPEED_RACER;
}

const runtime=loadSource();

function other(i){return i===0?1:0}

function racingInit(players=[]){
  const ps=players.length?players:[{id:'p0',name:'Player 1'},{id:'p1',name:'Player 2'}];
  const W=900,H=600;
  const tracks=[new runtime.Track(W,H),new runtime.Track(W,H)];
  const starts=tracks.map(t=>t.getStartPosition());
  const cars=[
    new runtime.Car(starts[0].x,starts[0].y,starts[0].angle,0),
    new runtime.Car(starts[1].x,starts[1].y+38,starts[1].angle,1)
  ];
  const state={
    players:ps.map((p,i)=>({id:p.id,name:p.name,x:cars[i].x,y:cars[i].y,angle:cars[i].angle,velocity:0,lap:0,finished:false,checkpointMask:[]})),
    inputs:[{up:false,down:false,left:false,right:false},{up:false,down:false,left:false,right:false}],
    totalLaps:3,phase:'playing',winner:null,finishedAt:null
  };
  Object.defineProperty(state,'__race',{value:{cars,tracks,W,H},enumerable:false,writable:false});
  return state;
}

function racingMove(s,i,m={}){
  if(s.phase!=='playing')return'Race is over';
  if(i<0||i>1)return'Invalid player';
  s.inputs[i]={
    up:!!m.up,
    down:!!m.brake||!!m.down,
    left:!!m.left,
    right:!!m.right
  };
}

function syncPlayer(s,i){
  const c=s.__race.cars[i],p=s.players[i];
  p.x=c.x;p.y=c.y;p.angle=c.angle;p.velocity=c.velocity;p.lap=s.__race.tracks[i].lap||p.lap;
  const cp=s.__race.tracks[i].checkpoints||[];
  p.checkpointMask=cp.map(x=>!!x.passed);
}

function racingTick(s){
  if(s.phase!=='playing'||!s.__race)return;
  const finishers=[];
  for(let i=0;i<2;i++){
    const car=s.__race.cars[i],track=s.__race.tracks[i],controls=s.inputs[i];
    car.update(controls);
    car.checkCollision(track.boundaries);
    const progress=track.checkLapProgress(car);
    if(progress.lapCompleted)s.players[i].lap++;
    syncPlayer(s,i);
    if(s.players[i].lap>=s.totalLaps&&!s.players[i].finished){
      s.players[i].finished=true;
      finishers.push(i);
    }
  }
  if(finishers.length){
    if(finishers.length===2&&Math.abs(s.players[0].lap-s.players[1].lap)===0){
      s.phase='finished';
      s.finishedAt=Date.now();
      s.winner=null;
      return{draw:true,reason:'photo finish'};
    }
    s.phase='finished';s.finishedAt=Date.now();s.winner=finishers[0];
    return{winner:finishers[0],reason:'first to complete 3 laps'};
  }
}

const RACING_SOURCE={
  name:'Neon Circuit Racing',
  category:'Racing',
  players:2,
  sourceName:'Steve-IX/Speed_Racer_Game',
  sourceLicense:'MIT',
  init:racingInit,
  move:racingMove,
  tick:racingTick
};

module.exports={RACING_SOURCE};
