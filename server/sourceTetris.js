'use strict';

const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {performance}=require('node:perf_hooks');

const ROOT=path.join(__dirname,'..','third_party','source-games','tetris-modern');
let sourceRuntime;

function loadSource(){
  if(sourceRuntime)return sourceRuntime;
  const source=fs.readFileSync(path.join(ROOT,'engine.js'),'utf8')
    .replace(/^export const /gm,'const ')
    .replace(/^export class /gm,'class ')
    +'\nthis.__NEXUS_TETRIS={Engine,PIECES};';
  const context=vm.createContext({console,Math,Date,performance});
  vm.runInContext(source,context,{filename:'tetris-modern/engine.js'});
  sourceRuntime=context.__NEXUS_TETRIS;
  return sourceRuntime;
}
const keys=['I','O','T','S','Z','J','L'];
const keyIndex=Object.fromEntries(keys.map((k,i)=>[k,i]));

function snapshot(e){
  const visible=e.board.slice(2).map(row=>row.slice());
  return {
    board:visible,
    current:e.current?{
      type:e.current.type,
      matrix:e.current.matrix.map(row=>row.slice()),
      x:e.current.x,
      y:e.current.y-2,
      rot:e.current.rot
    }:null,
    hold:e.hold,
    next:e.queue.slice(0,5),
    score:e.score,
    lines:e.lines,
    level:e.level,
    gameOver:!!e.gameOver
  };
}
function sync(s){
  s.players=s.__engines.map(snapshot);
  return s;
}

const TETRIS_SOURCE={
  name:'Tetris Duel',
  category:'Puzzle',
  players:2,
  sourceName:'paulfxyz/tetris',
  sourceLicense:'MIT',
  init(players=[]){
    const {Engine}=loadSource();
    const ps=players.length?players:[{id:'p0',name:'Player 1'},{id:'p1',name:'Player 2'}];
    const engines=ps.map(()=>new Engine());
    const s={players:engines.map(snapshot)};
    Object.defineProperty(s,'__engines',{value:engines,enumerable:false,writable:true});
    return s;
  },
  move(s,i,m={}){
    const e=s.__engines?.[i];
    if(!e)return'Source Tetris runtime unavailable';
    if(e.gameOver)return'Game over';
    const a=String(m.action||'');
    let ok=false;
    if(a==='left')ok=e.move(-1);
    else if(a==='right')ok=e.move(1);
    else if(a==='rotate')ok=e.rotate(1);
    else if(a==='rotateCCW')ok=e.rotate(-1);
    else if(a==='down')ok=e.softDrop();
    else if(a==='drop')ok=!!e.hardDrop();
    else if(a==='hold')ok=e.holdPiece();
    else return'Invalid Tetris action';
    sync(s);
    if(e.gameOver)return{winner:i===0?1:0,reason:'top out'};
    if(!ok)return'Input could not be applied';
    return;
  },
  tick(s){
    const engines=s.__engines||[];
    for(const e of engines)e.tick(33);
    sync(s);
    const dead=engines.filter(e=>e.gameOver).length;
    if(dead===2)return{draw:true,reason:'both topped out'};
    if(dead===1)return{winner:engines[0].gameOver?1:0,reason:'top out'};
    return;
  },
  getStateForPlayer:s=>s
};

module.exports={TETRIS_SOURCE,keyIndex};
