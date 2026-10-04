'use strict';

const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.join(__dirname,'..','third_party','source-games');
const LUDO_ROOT=path.join(ROOT,'ludo');

let ludoPathRuntime=null;
function loadLudoPathSource(){
  if(ludoPathRuntime)return ludoPathRuntime;
  const src=fs.readFileSync(path.join(LUDO_ROOT,'src','utils','seedPath.js'),'utf8')
    .replace(/^export /gm,'');
  const ctx=vm.createContext({console});
  vm.runInContext(src+'\nglobalThis.__NEXUS_LUDO_PATH={startPoint,newSeedPosition};',ctx,{filename:'ludo-seedPath.js'});
  ludoPathRuntime=ctx.__NEXUS_LUDO_PATH;
  return ludoPathRuntime;
}

function other(i){return i===0?1:0}
function clone(v){return JSON.parse(JSON.stringify(v))}
function shuffle(a){const x=a.slice();for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x}

function ludoPath(player){
  const h=player===0?'H1':'H2';
  const src=loadLudoPathSource();
  const out=[],seen=new Set(),seed=h+'-C1';
  let pos=src.startPoint(seed);
  out.push(pos);
  for(let i=0;i<56;i++){
    if(pos==='home')break;
    pos=src.newSeedPosition(seed,pos);
    out.push(pos);
    if(seen.has(pos)&&pos!=='home')break;
    seen.add(pos);
  }
  return out;
}

function ludoInit(players=[]){
  const ps=players.length?players:[{id:'p0',name:'Player 1'},{id:'p1',name:'Player 2'}];
  const tokens=[];
  for(let i=0;i<2;i++)for(let n=1;n<=4;n++)tokens.push({id:'H'+(i+1)+'-C'+n,player:i,position:'still',movesLeft:56});
  return {
    players:ps.map((p,i)=>({id:p.id,name:p.name})),
    turn:0,dice:null,phase:'roll',winner:null,wins:[0,0],sixStreak:0,
    tokens,paths:[ludoPath(0),ludoPath(1)]
  };
}
function getTokens(s,i){return s.tokens.filter(t=>t.player===i)}
function canMoveToken(s,token,die){
  if(!Number.isInteger(die)||die<1||die>6)return false;
  if(token.position==='home')return false;
  if(token.position==='still')return die===6;
  return die<=token.movesLeft;
}
function destinationFor(s,token,steps){
  const src=loadLudoPathSource();
  if(token.position==='still')return steps===6?src.startPoint(token.id):'still';
  let pos=token.position;
  let remaining=token.movesLeft;
  for(let n=0;n<steps;n++){
    pos=src.newSeedPosition(token.id,pos);
    if(pos==='home'){remaining=0;break}
    remaining--;
  }
  return {position:pos,movesLeft:remaining};
}
function legalLudoMoves(s,i){
  if(s.phase!=='move'||s.turn!==i||!Number.isInteger(s.dice))return[];
  return getTokens(s,i).filter(t=>canMoveToken(s,t,s.dice)).map(t=>t.id);
}
function captureLudo(s,moving){
  if(moving.position==='still'||moving.position==='home')return;
  for(const t of s.tokens){
    if(t.id===moving.id||t.player===moving.player||t.position==='still'||t.position==='home')continue;
    if(t.position===moving.position){
      t.position='still';t.movesLeft=56;
      return t.id;
    }
  }
  return null;
}
function sourceLudoMove(s,i,m={}){
  if(s.winner!=null)return'Game over';
  if(i!==s.turn)return'Not your turn';
  if(m.action==='roll'){
    if(s.phase!=='roll')return'Finish the current move first';
    s.dice=1+Math.floor(Math.random()*6);
    s.phase='move';s.sixStreak=s.dice===6?s.sixStreak+1:0;
    if(s.sixStreak>=3){s.dice=null;s.phase='roll';s.sixStreak=0;s.turn=other(i);return{rolled:6,skipped:true,reason:'three consecutive sixes'}}
    if(!legalLudoMoves(s,i).length){const rolled=s.dice;s.dice=null;s.phase='roll';if(rolled!==6)s.turn=other(i);return{rolled,pass:true}}
    return{rolled:s.dice};
  }
  if(m.action!=='move')return'Use roll or move';
  if(s.phase!=='move'||!Number.isInteger(s.dice))return'Roll first';
  const token=s.tokens.find(t=>t.id===String(m.tokenId));
  if(!token||token.player!==i||!canMoveToken(s,token,s.dice))return'Illegal Ludo move';
  const die=s.dice;
  const dest=destinationFor(s,token,die);
  if(token.position==='still'){
    token.position=dest;token.movesLeft=56;
  }else{
    token.position=dest.position;token.movesLeft=dest.movesLeft;
  }
  const captured=captureLudo(s,token);
  const done=getTokens(s,i).every(t=>t.position==='home');
  if(done){s.winner=i;s.phase='finished';s.dice=null;return{winner:i,reason:'all four tokens home'}}
  const extra=die===6||!!captured;
  s.dice=null;s.phase='roll';
  if(!extra)s.turn=other(i);
  return{moved:token.id,captured,extraTurn:extra};
}

const DOM_SYMBOLS=['🁣','🁤','🁥','🁦','🁧','🁨','🁩','🁫','🁬','🁭','🁮','🁯','🁰','🁳','🁴','🁵','🁶','🁷','🁻','🁼','🁽','🁾','🂃','🂄','🂅','🂋','🂌','🂓'];
function dominoSet(){const tiles=[];let n=0;for(let i=0;i<=6;i++)for(let j=i;j<=6;j++){tiles.push({id:`${i}-${j}`,left:i,right:j,isDouble:i===j,symbol:DOM_SYMBOLS[n++]})}return tiles}
function dominoPlayable(tile,left,right){return tile.left===left||tile.right===left||tile.left===right||tile.right===right}
function dominoHighestDouble(hands){let best=-1,who=0;for(let i=0;i<2;i++)for(const t of hands[i])if(t.isDouble&&t.left>best){best=t.left;who=i}return{best,who}}
function dominoInit(players=[]){
  const ps=players.length?players:[{id:'p0',name:'Player 1'},{id:'p1',name:'Player 2'}];
  let tiles=[],hands,boneyard,starter;
  do{tiles=shuffle(dominoSet());hands=[tiles.splice(0,5),tiles.splice(0,5)];boneyard=tiles;starter=dominoHighestDouble(hands)}while(starter.best<0);
  return{players:ps.map((p,i)=>({id:p.id,name:p.name})),hands,boneyard,chain:[],head:null,tail:null,turn:starter.who,starter:starter.who,phase:'playing',passes:0,winner:null};
}
function orientDomino(tile,end,value){
  const t=clone(tile);
  if(end==='left'){
    if(t.right===value)return t;
    if(t.left===value){[t.left,t.right]=[t.right,t.left];return t}
  }else{
    if(t.left===value)return t;
    if(t.right===value){[t.left,t.right]=[t.right,t.left];return t}
  }
  return null;
}
function dominoMove(s,i,m={}){
  if(s.winner!=null)return'Game over';
  if(i!==s.turn)return'Not your turn';
  const action=String(m.action||'');
  if(!s.chain.length){
    if(action!=='place')return'Place the starting highest double';
    const tile=s.hands[i].find(t=>t.isDouble&&t.left===s.starterDouble);
    if(!tile)return'Must start with the highest double';
    s.hands[i]=s.hands[i].filter(t=>t.id!==tile.id);
    s.chain=[tile];s.head=tile.left;s.tail=tile.right;s.passes=0;s.turn=other(i);
    return;
  }
  if(action==='draw'){
    if(s.boneyard.length===0)return'Boneyard is empty';
    s.hands[i].push(s.boneyard.pop());
    const playable=s.hands[i].some(t=>dominoPlayable(t,s.head,s.tail));
    if(playable)return{drawn:true,playAgain:true};
    if(s.boneyard.length===0&&!playable){s.passes++;if(s.passes>=2)return dominoFinishBlocked(s);s.turn=other(i)}
    return{drawn:true};
  }
  if(action!=='place')return'Use place or draw';
  const tile=s.hands[i].find(t=>t.id===String(m.tileId));
  if(!tile)return'You do not have that domino';
  const end=m.end==='left'?'left':m.end==='right'?'right':null;
  if(!end)return'Choose a board end';
  const value=end==='left'?s.head:s.tail;
  const placed=orientDomino(tile,end,value);
  if(!placed)return'Illegal domino placement';
  s.hands[i]=s.hands[i].filter(t=>t.id!==tile.id);
  if(end==='left'){s.chain.unshift(placed);s.head=placed.left}else{s.chain.push(placed);s.tail=placed.right}
  s.passes=0;
  if(!s.hands[i].length){s.winner=i;return{winner:i,reason:'no dominoes left'}}
  s.turn=other(i);
  return;
}
function dominoFinishBlocked(s){
  const counts=s.hands.map(h=>h.reduce((sum,t)=>sum+t.left+t.right,0));
  s.phase='finished';
  if(counts[0]===counts[1]){s.winner=null;return{draw:true,reason:'blocked equal pip count'}}
  s.winner=counts[0]<counts[1]?0:1;
  return{winner:s.winner,reason:'blocked game lower pip count'};
}

function prepareDomino(s){
  if(!s.starterDouble){s.starterDouble=dominoHighestDouble(s.hands).best}
  return s;
}
function dominoAdapterInit(players=[]){
  const s=dominoInit(players);s.starterDouble=dominoHighestDouble(s.hands).best;
  return s;
}
function dominoAdapterMove(s,i,m){
  const out=dominoMove(s,i,m);
  if(typeof out==='string')return out;
  return out;
}

const LUDO_SOURCE={name:'Ludo',category:'Board',players:2,sourceName:'chukwumaijem/ludo-game',sourceLicense:'MIT',init:ludoInit,move:sourceLudoMove};
const DOMINOES_SOURCE={name:'Dominoes',category:'Board',players:2,sourceName:'ppyne/dominoes',sourceLicense:'BSD-3-Clause',init:dominoAdapterInit,move:dominoAdapterMove};

module.exports={LUDO_SOURCE,DOMINOES_SOURCE,loadLudoPathSource};
