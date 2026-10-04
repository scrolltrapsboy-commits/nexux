'use strict';

const {clearAllGameTimers}=require('../third_party/source-games/battlebox/utils');
const startReactionRound=require('../third_party/source-games/battlebox/reaction');

const ROOM_KEY='__nexus_reaction__';

function syncFromSource(s,room){
  const g=room.gameState||{};
  s.round=Number(g.round||0);
  s.phase=g.canClick?'armed':g.waiting?'waiting':'ready';
  s.goAt=Number(g.clickTime||0);
  s.clicked=!!g.clicked;
  s.scores=room.players.map(p=>Number(p.score)||0);
  if(room.state==='lobby'&&s.round>=5)s.status='finished';
}
function makeRoom(s,players,context){
  const room={state:'playing',game:'reaction',players:players.map(p=>({name:p.name,score:0,ready:true})),gameState:{round:0,waiting:false,canClick:false,clicked:false},timers:{}};
  const io={to:()=>({emit:()=>{syncFromSource(s,room);context?.broadcast?.()}})};
  const rooms={[ROOM_KEY]:room};
  Object.defineProperty(s,'__reactionRuntime',{value:{room,rooms,io,context},enumerable:false,writable:true,configurable:true});
  return s;
}
function sourceReactionInit(players=[],context){
  const s={round:0,phase:'ready',goAt:0,clicked:false,scores:[0,0],latencies:[[],[]],status:'playing'};
  makeRoom(s,players.length?players:[{name:'Player 1'},{name:'Player 2'}],context);
  startReactionRound(ROOM_KEY,s.__reactionRuntime.io,s.__reactionRuntime.rooms);
  syncFromSource(s,s.__reactionRuntime.room);
  return s;
}
function sourceReactionMove(s,i,m={}){
  const rt=s.__reactionRuntime;
  if(!rt)return'Reaction source runtime unavailable';
  const room=rt.room;
  if(room.state!=='playing')return'Game over';
  if(s.phase==='waiting')return'Wait for GO';
  if(!room.gameState?.canClick||room.gameState.clicked)return'Already clicked';
  room.gameState.clicked=true;
  room.gameState.canClick=false;
  const latency=Math.max(0,Date.now()-Number(room.gameState.clickTime||Date.now()));
  room.players[i].score=(room.players[i].score||0)+1;
  s.latencies[i].push(latency);
  syncFromSource(s,room);
  const round=Number(room.gameState.round||1);
  if(round>=5){
    clearAllGameTimers(room);
    room.state='finished';
    s.phase='finished';
    return s.scores[0]===s.scores[1]?{draw:true,reason:'reaction tie'}:{winner:s.scores[0]>s.scores[1]?0:1,reason:'fastest reaction score'};
  }
  room.timers.reactionNext=setTimeout(()=>{
    const r=rt.rooms[ROOM_KEY];
    if(!r||r.state!=='playing')return;
    startReactionRound(ROOM_KEY,rt.io,rt.rooms);
    syncFromSource(s,r);
    rt.context?.broadcast?.();
  },1500);
  return{latency};
}
const REACTION_SOURCE={name:'Reaction Race',category:'Arcade',players:2,sourceName:'pemmyz/js_gamepadreaction + BattleBox reaction timing',sourceLicense:'MIT',init:sourceReactionInit,move:sourceReactionMove};
module.exports={REACTION_SOURCE};
