'use strict';

const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.join(__dirname,'..','third_party','source-games','mancala');

let Runtime;
function loadSource(){
  if(Runtime)return Runtime;
  const ctx=vm.createContext({});
  const files=['mancala.js','move-stones.js','check-winner.js'];
  let src='';
  for(const file of files)src+=fs.readFileSync(path.join(ROOT,file),'utf8')+'\n';
  Runtime={Mancala:vm.runInContext('(function(){'+src+String.fromCharCode(10)+'return Mancala;})()',ctx,{filename:'mancala-upstream.js'})};
  if(typeof Runtime.Mancala!=='function')throw new Error('Upstream Mancala class failed to load');
  return Runtime;
}

function other(i){return i===0?1:0}

function runtimeFromState(s){
  const current=s.turn===0?'one':'two';
  const game={
    player:current,
    draw_stones(){},
    draw_all_stones(){}
  };
  const source=loadSource();
  const m=new source.Mancala(game);
  m.current_pits=s.pits[s.turn].slice();
  m.other_pits=s.pits[other(s.turn)].slice();
  m.current_store=Number(s.stores[s.turn]||0);
  m.other_store=Number(s.stores[other(s.turn)]||0);
  return {game,m};
}

function syncState(s,game,m){
  const current=s.turn,otherPlayer=other(current);
  s.pits[current]=m.current_pits.slice();
  s.pits[otherPlayer]=m.other_pits.slice();
  s.stores[current]=Number(m.current_store||0);
  s.stores[otherPlayer]=Number(m.other_store||0);
  s.currentStore=s.stores[current];
  s.opponentStore=s.stores[otherPlayer];
}

function sourceMancalaInit(players=[]){
  const ps=players.length?players:[{id:'p0',name:'Player 1'},{id:'p1',name:'Player 2'}];
  return {
    players:ps.map(p=>({id:p.id,name:p.name})),
    pits:[[4,4,4,4,4,4],[4,4,4,4,4,4]],
    stores:[0,0],
    currentStore:0,
    opponentStore:0,
    turn:0,
    phase:'playing',
    winner:null,
    source:'halilayyildiz/mancala-game'
  };
}

function sourceMancalaMove(s,i,m={}){
  if(s.phase!=='playing')return'Game over';
  if(i!==s.turn)return'Not your turn';
  const pit=Number(m.pit);
  if(!Number.isInteger(pit)||pit<0||pit>5)return'Choose one of your six pits';
  if(Number(s.pits[i]?.[pit]||0)<=0)return'That pit is empty';

  const {game,m:mancala}=runtimeFromState(s);
  const turnOver=mancala.move_stones(pit);
  const winner=mancala.check_winner();

  if(winner>=0){
    syncState(s,game,mancala);
    s.phase='finished';
    if(winner===0)return{draw:true,reason:'source Mancala draw'};
    const winnerIndex=winner-1;
    s.winner=winnerIndex;
    return{winner:winnerIndex,reason:'source Mancala game over'};
  }

  if(turnOver){
    mancala.flip_board();
    s.turn=other(s.turn);
  }

  syncState(s,game,mancala);
  return{extraTurn:!turnOver};
}

function getStateForPlayer(s,viewer){
  const i=s.players.findIndex(p=>p.id===viewer);
  const me=i>=0?i:0;
  const opp=other(me);
  return {
    players:s.players,
    myPit:s.pits[me].slice(),
    opponentPit:s.pits[opp].slice(),
    myStore:s.stores[me],
    opponentStore:s.stores[opp],
    turn:s.turn,
    phase:s.phase,
    winner:s.winner,
    source:s.source
  };
}

const MANCALA_SOURCE={
  name:'Mancala',
  category:'Board',
  players:2,
  sourceName:'halilayyildiz/mancala-game',
  sourceLicense:'MIT',
  init:sourceMancalaInit,
  move:sourceMancalaMove,
  getStateForPlayer
};

module.exports={MANCALA_SOURCE,loadSource};
