'use strict';

/*
 * NEXUS PLAY adapters for exact upstream GameNest source modules.
 * The rule methods themselves are retained in:
 *   third_party/source-games/gamenest/chinesechess.js
 *   third_party/source-games/gamenest/go9.js
 * Source: absswds/GameNest, Apache-2.0.
 */

const chinese = require('../third_party/source-games/gamenest/chinesechess.js');
const go9 = require('../third_party/source-games/gamenest/go9.js');

function xiangqiInit(){
  const s=chinese.createState();
  s.legalMoves=chinese.playerView(s,0).legalMoves||[];
  return s;
}
function xiangqiMove(s,i,m){
  const result=chinese.handleMove(m||{},s,i);
  if(result)return result;
  if(s.winner!==null){
    s.status='finished';
    s.legalMoves=[];
    if(s.winner===-1)return{draw:true,reason:'threefold/quiet rule'};
    return{winner:s.winner,reason:'checkmate or stalemate'};
  }
  s.status='playing';
  s.legalMoves=chinese.playerView(s,s.currentPlayer).legalMoves||[];
}
function xiangqiView(s,viewer){
  const out={
    currentPlayer:s.currentPlayer,
    winner:s.winner,
    board:s.board,
    moveHistory:s.moveHistory,
    legalMoves:s.currentPlayer===viewer&&s.winner===null?(chinese.playerView(s,viewer).legalMoves||[]):[]
  };
  return out;
}

function go9Init(){return go9.createState();}
function go9Move(s,i,m){
  const result=go9.handleMove(m||{},s,i);
  if(result)return result;
  if(s.winner!==null){
    s.status='finished';
    return s.winner===-1?{draw:true,reason:'Chinese-area score tie'}:{winner:s.winner,reason:'Chinese-area score'};
  }
  s.status='playing';
}

module.exports={Xiangqi_SOURCE:{
  name:'Chinese Chess',
  category:'Strategy',
  players:2,
  init:xiangqiInit,
  move:xiangqiMove,
  view:xiangqiView,
  sourceName:'absswds/GameNest',
  sourceLicense:'Apache-2.0'
},Go9_SOURCE:{
  name:'Go 9×9',
  category:'Strategy',
  players:2,
  init:go9Init,
  move:go9Move,
  sourceName:'absswds/GameNest',
  sourceLicense:'Apache-2.0'
}};
