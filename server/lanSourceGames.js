'use strict';

const path=require('node:path');
const ROOT=path.join(__dirname,'..','third_party','source-games','lan-games','server','games');

const SOURCES={
  tictactoe:require(path.join(ROOT,'tic-tac-toe','game-logic.js')),
  battleship:require(path.join(ROOT,'battleship','game-logic.js')),
  yahtzee:require(path.join(ROOT,'yahtzee','game-logic.js')),
  monopoly:require(path.join(ROOT,'monopoly','game-logic.js')),
  risk:require(path.join(ROOT,'risk','game-logic.js')),
  life:require(path.join(ROOT,'life','game-logic.js'))
};

function makePlayers(roomPlayers,mod){
  const config=mod.getConfigCopy();
  const players=[];
  for(const p of roomPlayers){
    players.push(mod.createInitialPlayer({id:p.id,username:p.name},players,config));
  }
  return {config,players};
}
function winnerIndex(state){
  if(state?.winner==null||Array.isArray(state.winner))return null;
  const idx=state.players?.findIndex(p=>p.userId===state.winner);
  return idx>=0?idx:null;
}
function makeAdapter(id,meta){
  const mod=SOURCES[id];
  return {
    name:meta.name,category:meta.category,players:2,
    sourceName:'kbennett2000/lan-games',sourceLicense:'MIT',
    init(roomPlayers=[]){
      const {config,players}=makePlayers(roomPlayers,mod);
      return mod.initGame('nexus-'+id,meta.name,players,config);
    },
    move(state,index,msg={}){
      const userId=state.players?.[index]?.userId;
      if(!userId)return'Player not found';
      const action=String(msg.action||'');
      const payload=msg.payload&&typeof msg.payload==='object'?msg.payload:{};
      if(!action)return'Action required';
      let result;
      try{result=mod.applyAction(state,userId,action,payload)}
      catch(err){return err?.message||'Source engine rejected action'}
      if(result?.error)return result.error;
      if(result?.state&&result.state!==state){
        for(const key of Object.keys(state))delete state[key];
        Object.assign(state,result.state);
      }
      if(state.status==='finished'){
        const idx=winnerIndex(state);
        return idx===null?{draw:true,reason:'source engine game over'}:{winner:idx,reason:'source engine game over'};
      }
      return;
    },
    getStateForPlayer:(state,viewer)=>mod.getStateForPlayer?mod.getStateForPlayer(state,viewer):state,
    getValidActions:(state,userId)=>mod.getValidActions?mod.getValidActions(state,userId):[],
    getActionDescriptors:(state,userId)=>mod.getActionDescriptors?mod.getActionDescriptors(state,userId):(mod.getValidActions?mod.getValidActions(state,userId).map(action=>({action,label:action,enabled:true})):[])
  };
}
const LAN_GAMES={
  tictactoe:makeAdapter('tictactoe',{name:'Tic Tac Toe',category:'Board'}),
  battleship:makeAdapter('battleship',{name:'Battleship',category:'Strategy'}),
  yahtzee:makeAdapter('yahtzee',{name:'Yahtzee',category:'Dice'}),
  monopoly:makeAdapter('monopoly',{name:'Monopoly',category:'Strategy'}),
  risk:makeAdapter('risk',{name:'Risk',category:'Strategy'}),
  life:makeAdapter('life',{name:'The Game of Life',category:'Family'})
};
module.exports={LAN_GAMES,SOURCES};
