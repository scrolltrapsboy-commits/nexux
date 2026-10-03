'use strict';

const path=require('node:path');

const GN_ROOT=path.join(__dirname,'..','third_party','source-games','gamenest');
const BB_ROOT=path.join(__dirname,'..','third_party','source-games','battlebox');

const gn2048=require(path.join(GN_ROOT,'2048.js'));
const gn2048lib=require(path.join(GN_ROOT,'lib','game2048.js'));
const gnMines=require(path.join(GN_ROOT,'minesweeper.js'));
const gnSnake=require(path.join(GN_ROOT,'snakebattle.js'));
const gnReversi=require(path.join(GN_ROOT,'reversi.js'));
const gnUno=require(path.join(GN_ROOT,'uno.js'));

const bbRps=require(path.join(BB_ROOT,'rpsarena.js'));
const bbMemory=require(path.join(BB_ROOT,'memorymatch.js'));
const bbWordChain=require(path.join(BB_ROOT,'wordchain.js'));

function clone(v){return JSON.parse(JSON.stringify(v));}
function other(i){return i===0?1:0;}

function initGameNest(mod,players){
  const s=mod.createState();
  if(typeof mod.initGame==='function')mod.initGame(s,players.length);
  s._playerCount=players.length;
  Object.defineProperty(s,'_playerIds',{value:players.map(p=>p.id),enumerable:false,writable:true});
  return s;
}

function gnAdapter(id,mod,meta,moveAdapter,viewAdapter){
  return {
    name:meta.name,category:meta.category,players:2,
    sourceName:'absswds/GameNest',sourceLicense:'Apache-2.0',
    init(players=[]){const ps=players.length?players:[{id:'p0',name:'Player 1'},{id:'p1',name:'Player 2'}];return initGameNest(mod,ps)},
    move(state,i,msg={}){
      const payload=moveAdapter?moveAdapter(i,msg,state):msg;
      let out;
      try{out=mod.handleMove(payload,state,i)}catch(err){return err?.message||'Source engine rejected move';}
      if(typeof out==='string')return out;
      if(state.winner!==null&&state.winner!==undefined){
        if(state.winner===-1)return{draw:true,reason:'source engine draw'};
        if(typeof state.winner==='number')return{winner:state.winner,reason:'source engine win'};
      }
      return;
    },
    getStateForPlayer(state,viewer){
      const idx=Math.max(0,state._playerIds?state._playerIds.indexOf(viewer):Number(viewer)||0);
      return viewAdapter?viewAdapter(state,idx):clone(state);
    }
  };
}

function view2048(state){
  // GameNest is a simultaneous race: each player owns one board.
  const idx=state._viewerIndex||0;
  const b=state.boards[idx]||[];
  return {board:(b.flat?b.flat():b),score:state.scores?.[idx]||0,highScore:(state.scores||[]).reduce((m,v)=>Math.max(m,v),0),alive:!!state.alive?.[idx],winner:state.winner,currentPlayer:-1,maxTile:gn2048lib.maxTile(b),startTime:state.startTime};
}

function viewMines(state,idx){
  const raw=gnMines.playerBoardView(state,idx);
  const board=raw.map(row=>row.map(cell=>({...cell,mine:!!cell.revealed&&!!cell.mine})));
  return {rows:state.rows,cols:state.cols,mineCount:state.mineCount,board,revealedCount:state.cellsRevealed?.[idx]||0,alive:!!state.alive?.[idx],winner:state.winner,currentPlayer:-1};
}

function viewReversi(state,idx){
  const v=gnReversi.playerView(state,idx);
  return {board:v.board,turn:v.currentPlayer,scores:[v.scores[0],v.scores[1]],passes:v.passCount,lastMove:v.lastMove,legalMoves:v.legalMoves||[],winner:v.winner};
}

function viewUno(state,idx){
  const hands=state.hands||[];
  const hand=hands[idx]||[];
  return {
    hand,
    discard:state.discard?.slice(0,12)||[],
    currentColor:state.currentColor,
    turn:state.currentPlayer,
    direction:state.direction,
    drawStack:state.drawStack,
    pendingChallenge:state.pendingChallenge?{target:state.hands.indexOf(hand)===state.pendingChallenge.target,by:state.pendingChallenge.by,chosenColor:state.pendingChallenge.chosenColor}:null,
    winner:state.winner,
    handCounts:hands.map(h=>h.length),
    unoCalled:state.unoCalled?.[idx]||false
  };
}

const GAMES={
  game2048:{
    ...gnAdapter('game2048',gn2048,{name:'2048 Duel',category:'Puzzle'},null,(s,idx)=>view2048({...s,_viewerIndex:idx})),
  },
  minesweeper:{
    ...gnAdapter('minesweeper',gnMines,{name:'Minesweeper Duel',category:'Arcade'},(i,m)=>({
      action:m.action||'reveal',
      row:Number.isInteger(m.row)?m.row:Math.floor(Number(m.cell)/10),
      col:Number.isInteger(m.col)?m.col:Number(m.cell)%10
    }),(s,idx)=>viewMines(s,idx)),
  },
  snake:{
    ...gnAdapter('snake',gnSnake,{name:'Snake Arena',category:'Arcade'},(i,m)=>({direction:m.direction||m.dir}),s=>clone(s)),
    tick:s=>gnSnake.tick(s)
  },
  othello:{
    ...gnAdapter('reversi',gnReversi,{name:'Othello',category:'Strategy'},(i,m)=>m.pass?{pass:true}:{row:Math.floor(Number(m.cell)/8),col:Number(m.cell)%8},(s,idx)=>viewReversi(s,idx)),
  },
  uno:{
    ...gnAdapter('uno',gnUno,{name:'UNO',category:'Card',},null,(s,idx)=>viewUno(s,idx)),
  },
};

function bbRoom(initGameState,players){
  const room={state:'playing',players:players.map((p,idx)=>({id:p.id,name:p.name,score:0,ready:true,index:idx})),gameState:{},timers:{}};
  const rooms={NEXUS:room};
  const io={to:()=>({emit:()=>{}})};
  initGameState('NEXUS',io,rooms);
  Object.defineProperty(room,'__io',{value:io,enumerable:false});
  Object.defineProperty(room,'__rooms',{value:rooms,enumerable:false});
  return room;
}

function bbAdapter(id,source,meta,playerPayload,view){
  return {
    name:meta.name,category:meta.category,players:2,
    sourceName:'assishmoncs/battlebox',sourceLicense:'MIT',
    init(players=[]){
      const room=bbRoom(source,players.length?players:[{id:'p0',name:'Player 1'},{id:'p1',name:'Player 2'}]);
      const state={gameState:clone(room.gameState),players:clone(room.players),status:'playing'};
      Object.defineProperty(state,'__bb',{value:room,enumerable:false,writable:true});
      return state;
    },
    move(state,i,msg={}){
      const room=state.__bb;
      if(!room)return'Source room unavailable';
      const move=playerPayload(i,msg,room);
      try{source('NEXUS',room.__io,room.__rooms,move)}catch(err){return err?.message||'Source engine rejected move';}
      if(room.timers){for(const key of Object.keys(room.timers)){if(room.timers[key]){clearTimeout(room.timers[key]);clearInterval(room.timers[key]);}delete room.timers[key];}}
      const before=room.gameState||{};
      state.gameState=clone(before);state.players=clone(room.players);
      if(room.state==='lobby'&&!state.gameState.round&&!state.gameState.chain&&!state.gameState.cards){
        state.status='finished';
        const scores=state.players.map(p=>p.score||0);
        if(scores[0]===scores[1])return{draw:true,reason:'source game tie'};
        return{winner:scores[0]>scores[1]?0:1,reason:'source game over'};
      }
      const round=Number(state.gameState.round||0);
      const max=Number(state.gameState.maxRounds||0);
      if(max&&round>=max&&!Object.keys(state.gameState.choices||{}).length){
        state.status='finished';
        const scores=state.players.map(p=>p.score||0);
        if(scores[0]===scores[1])return{draw:true,reason:'source round tie'};
        return{winner:scores[0]>scores[1]?0:1,reason:'source rounds complete'};
      }
      state.status='playing';
      return;
    },
    getStateForPlayer:(state,idx)=>view?view(state,idx):clone(state.gameState)
  };
}

GAMES.rps=bbAdapter('rps',bbRps,{name:'Rock Paper Scissors',category:'Party'},(i,m)=>({playerId:'p'+i,choice:m.choice}),(state,idx)=>{
  const s=state.gameState||{},choices=s.choices||{};
  const publicChoices=Object.keys(choices).length>=2?choices:{};
  return{round:s.round||1,maxRounds:s.maxRounds||5,choices:publicChoices,score:state.players.map(p=>p.score||0),turn:idx===0?0:1};
});

GAMES.memory=bbAdapter('memory',bbMemory,{name:'Memory Match',category:'Party'},(i,m)=>({playerId:'p'+i,cardIndex:Number(m.card)}),(state,idx)=>{
  const s=state.gameState||{};
  const visible=new Set([...(s.flipped||[]),...(s.matched||[])]);
  return{cards:Array.isArray(s.cards)?s.cards.map((v,k)=>visible.has(k)?v:null):[],flipped:s.flipped||[],matched:s.matched||[],currentPlayer:s.currentPlayer||0,score:state.players.map(p=>p.score||0),lockBoard:!!s.lockBoard};
});

GAMES.wordchain=bbAdapter('wordchain',bbWordChain,{name:'Word Chain',category:'Word'},(i,m)=>({playerId:'p'+i,word:String(m.word||'')}),(state)=>clone(state.gameState));

module.exports={CLASSIC_SOURCE_GAMES:GAMES};
