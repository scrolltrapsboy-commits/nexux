'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function readThirdParty(...parts){
  return fs.readFileSync(path.join(__dirname,'..','third_party','source-games',...parts),'utf8');
}

/* Dots & Boxes: execute vendored MIT DotBox engine source. */
let dotBoxContext;
function loadDotBox(){
  if(dotBoxContext)return dotBoxContext;
  dotBoxContext=vm.createContext({});
  ['dotBox.utility.js','dotBox.utility.line.js','dotBox.lineState.js','dotBox.boxState.js','dotBox.gameEngine.js']
    .forEach(file=>vm.runInContext(readThirdParty('dots-and-boxes',file),dotBoxContext,{filename:file}));
  return dotBoxContext;
}
function makeDotBoxEngine(history){
  const ctx=loadDotBox();
  const code='(function(){var g=dotBox.gameEngine({dotCountLength:10,dotCountWidth:10,playerCount:2,startPlayer:0});var h='+
    JSON.stringify(history||[])+';for(var i=0;i<h.length;i++){g.connectLine({d1:{x:h[i].x1,y:h[i].y1},d2:{x:h[i].x2,y:h[i].y2}});}return {current:g.getCurrentPlayer(),scores:g.getCurrentScores(),gameOver:g.isGameOver(),p0:g.getPlayerBoxes(0),p1:g.getPlayerBoxes(1)};})()';
  return vm.runInContext(code,ctx);
}
function sourceDotsBoxesInit(){
  const g=makeDotBoxEngine([]);
  return {cols:10,rows:10,turn:g.current,scores:g.scores,boxes:{0:g.p0,1:g.p1},hLines:[],vLines:[],history:[],status:g.gameOver?'finished':'playing'};
}
function sourceDotsBoxesMove(s,i,m){
  if(i!==s.turn)return'Not your turn';
  const x1=Number(m?.x1),y1=Number(m?.y1),x2=Number(m?.x2),y2=Number(m?.y2);
  if(![x1,y1,x2,y2].every(Number.isInteger))return'Invalid line';
  if(Math.abs(x1-x2)+Math.abs(y1-y2)!==1||x1<0||x1>=s.cols||x2<0||x2>=s.cols||y1<0||y1>=s.rows||y2<0||y2>=s.rows)return'Invalid line';
  const same=(l)=>(l.x1===x1&&l.y1===y1&&l.x2===x2&&l.y2===y2)||(l.x1===x2&&l.y1===y2&&l.x2===x1&&l.y2===y1);
  if(s.history.some(same))return'Line already connected';
  const line={x1,y1,x2,y2};
  const history=s.history.concat([line]);
  const g=makeDotBoxEngine(history);
  s.history=history;s.turn=g.current;s.scores=g.scores;s.boxes={0:g.p0,1:g.p1};s.status=g.gameOver?'finished':'playing';
  if(x1===x2)s.vLines.push({x:x1,y:Math.min(y1,y2)});else s.hLines.push({x:Math.min(x1,x2),y:y1});
  if(g.gameOver){
    if(g.scores[0]===g.scores[1])return{draw:true,reason:'all boxes claimed'};
    return{winner:g.scores[0]>g.scores[1]?0:1,reason:'most boxes'};
  }
}

/* Carrom: execute exact vendored MIT physics class; turn/queen/foul flow is
   adapted from the same source controller. */
let carromPhysicsContext;
function loadCarromPhysics(){
  if(carromPhysicsContext)return carromPhysicsContext;
  carromPhysicsContext=vm.createContext({});
  vm.runInContext(readThirdParty('carrom','carrom-physics.js')+'\nglobalThis.__NEXUS_CARROM={Vector2,Disc,CarromPhysicsEngine};',carromPhysicsContext,{filename:'carrom-physics.js'});
  return carromPhysicsContext;
}
const CARROM_CFG={boardWidth:800,boardHeight:800,boardMargin:55,pocketRadius:32,strikerRadius:24,coinRadius:18,queenRadius:18,strikerMass:3.5,coinMass:1,bottomBaselineY:700,topBaselineY:100,baselineMinX:180,baselineMaxX:620,centerCircleRadius:55,queenRingRadius:28};
const CARROM_POCKETS=(()=>{const inset=CARROM_CFG.boardMargin+CARROM_CFG.pocketRadius*.9;return[{x:inset,y:inset},{x:800-inset,y:inset},{x:inset,y:800-inset},{x:800-inset,y:800-inset}]})();
function exactCarromInitial(){
  const out=[];let id=0;out.push({id:id++,type:'queen',x:400,y:400});
  for(let k=0;k<6;k++){const a=k*Math.PI/3;out.push({id:id++,type:k%2===0?'white':'black',x:400+2.05*18*Math.cos(a),y:400+2.05*18*Math.sin(a)})}
  for(let k=0;k<12;k++){const a=k*Math.PI/6+Math.PI/12;out.push({id:id++,type:k%2===0?'white':'black',x:400+4.08*18*Math.cos(a),y:400+4.08*18*Math.sin(a)})}
  return out;
}
function sourceCarromInit(){
  return{turn:0,scores:[0,0],pocketed:[[],[]],foulPenaltiesDue:[0,0],queenStatus:'CENTER',queenAwaitingPlayer:null,
    coins:exactCarromInitial().map(c=>({...c,vx:0,vy:0,pocketed:false,isSinking:false,sinkScale:1})),
    striker:{id:19,type:'striker',x:400,y:700,vx:0,vy:0,pocketed:false,isSinking:false,sinkScale:1},
    animation:[],phase:'playing',foul:false,status:'playing'};
}
function carromDiscState(ctx,rec){
  const {Vector2,Disc}=ctx.__NEXUS_CARROM,isStriker=rec.type==='striker',radius=isStriker?24:(rec.type==='queen'?18:18),mass=isStriker?3.5:1;
  const color=rec.type==='white'?'#fff':rec.type==='black'?'#111':rec.type==='queen'?'#d00':'#fff';
  const d=new Disc(rec.x,rec.y,radius,mass,rec.type,color);d.pos=new Vector2(rec.x,rec.y);d.vel=new Vector2(rec.vx||0,rec.vy||0);
  d.pocketed=!!rec.pocketed;d.isSinking=!!rec.isSinking;d.sinkScale=Number(rec.sinkScale??1);d.isQueen=rec.type==='queen';d.__nexusId=rec.id;return d;
}
function carromFrame(discs){
  const striker=discs.find(d=>d.__nexusId===19);
  return{striker:striker?{x:striker.pos.x/800,y:striker.pos.y/800,pocketed:striker.pocketed}:null,coins:discs.filter(d=>d.__nexusId!==19).map(d=>({id:d.__nexusId,type:d.type,x:d.pos.x/800,y:d.pos.y/800,pocketed:d.pocketed}))};
}
function simulateCarromShot(s,i,m){
  const ctx=loadCarromPhysics(),{CarromPhysicsEngine}=ctx.__NEXUS_CARROM;
  const strikerX=clamp(Number(m.x??.5),180/800,620/800)*800,sideY=i===0?700:100,dx=Number(m.dx),dy=Number(m.dy),mag=Math.hypot(dx,dy);
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||mag<.01)return{error:'Aim before shooting'};
  const power=clamp01(m.power),speed=.32*(15+85*power);
  const discs=s.coins.map(c=>carromDiscState(ctx,c));
  const striker=carromDiscState(ctx,{...s.striker,x:strikerX,y:sideY,vx:dx/mag*speed,vy:dy/mag*speed,pocketed:false,isSinking:false,sinkScale:1});
  const engine=new CarromPhysicsEngine(CARROM_CFG,null);
  engine.initPockets(CARROM_POCKETS.map(p=>({pos:new ctx.__NEXUS_CARROM.Vector2(p.x,p.y),radius:32})));engine.setDiscs([...discs,striker]);
  const pocketedIds=[];engine.onPocketedCallback=d=>{if(!pocketedIds.includes(d.__nexusId))pocketedIds.push(d.__nexusId)};
  const frames=[];let steps=0,snap=()=>frames.push(carromFrame(engine.discs));snap();
  while(!engine.areAllDiscsStopped()&&steps++<2400){engine.update();if(steps%4===0)snap()}snap();
  return{engine,frames,pocketedIds,steps};
}
function returnQueen(s){const q=s.coins.find(c=>c.type==='queen');if(!q)return;q.pocketed=false;q.isSinking=false;q.sinkScale=1;q.x=400;q.y=400;q.vx=q.vy=0}
function applyCarromFoul(s,i){
  const color=i===0?'white':'black',idx=s.pocketed[i].indexOf(color);
  if(idx>=0){s.pocketed[i].splice(idx,1);s.scores[i]=Math.max(0,s.scores[i]-1);const c=s.coins.find(c=>c.type===color&&c.pocketed);if(c){c.pocketed=false;c.isSinking=false;c.sinkScale=1;c.x=400+(i===0?-30:30);c.y=400;c.vx=c.vy=0}}else s.foulPenaltiesDue[i]++;
}
function carromGameOver(s){
  const rw=s.coins.filter(c=>c.type==='white'&&!c.pocketed).length,rb=s.coins.filter(c=>c.type==='black'&&!c.pocketed).length,qp=s.coins.find(c=>c.type==='queen')?.pocketed;
  return(rw===0&&qp)||(rb===0&&qp)||(rw===0&&rb===0);
}
function sourceCarromMove(s,i,m){
  if(s.status!=='playing')return'Game over';if(i!==s.turn)return'Not your turn';
  const sim=simulateCarromShot(s,i,m);if(sim.error)return sim.error;
  const newly=[];for(const id of sim.pocketedIds){if(id===19)continue;const c=s.coins.find(c=>c.id===id);if(c&&!c.pocketed){c.pocketed=true;newly.push(c)}}
  const byId=new Map(sim.engine.discs.map(d=>[d.__nexusId,d]));for(const c of s.coins){const d=byId.get(c.id);if(d){c.x=d.pos.x;c.y=d.pos.y;c.vx=d.vel.x;c.vy=d.vel.y;c.pocketed=d.pocketed;c.isSinking=d.isSinking;c.sinkScale=d.sinkScale}}
  const sd=byId.get(19);s.striker={...s.striker,x:sd.pos.x,y:sd.pos.y,vx:sd.vel.x,vy:sd.vel.y,pocketed:sd.pocketed,isSinking:sd.isSinking,sinkScale:sd.sinkScale};
  s.animation=sim.frames.slice(-160);s.foul=sim.pocketedIds.includes(19);
  const my=i===0?'white':'black',opp=i===0?'black':'white',op=other(i);let own=0,oppCoins=0,queen=false;
  for(const c of newly){if(c.type==='queen'){queen=true;continue}if(c.type===my){own++;s.scores[i]++;s.pocketed[i].push(c.type)}else if(c.type===opp){oppCoins++;s.scores[op]++;s.pocketed[op].push(c.type)}}
  let extra=false;
  if(queen&&s.queenStatus==='CENTER'){s.queenStatus='PENDING_COVER';s.queenAwaitingPlayer=i;if(own>0){s.queenStatus='COVERED';s.scores[i]+=3;s.pocketed[i].push('queen')}extra=true}
  else if(!queen&&s.queenStatus==='PENDING_COVER'&&s.queenAwaitingPlayer===i){if(own>0&&!s.foul){s.queenStatus='COVERED';s.scores[i]+=3;s.pocketed[i].push('queen');extra=true}else{returnQueen(s),s.queenStatus='CENTER',s.queenAwaitingPlayer=null}}
  if(s.foul){applyCarromFoul(s,i);extra=false}
  else if(!queen&&s.queenStatus!=='PENDING_COVER')extra=own>0;
  if(carromGameOver(s)){s.status='finished';s.phase='finished';if(s.scores[0]===s.scores[1])return{draw:true,reason:'carrom score tie'};return{winner:s.scores[0]>s.scores[1]?0:1,reason:'all coins resolved'}}
  if(!extra)s.turn=other(i);
  const y=s.turn===0?700:100;s.striker={id:19,type:'striker',x:400,y,vx:0,vy:0,pocketed:false,isSinking:false,sinkScale:1};return{animation:true};
}

/* Gomoku: 15x15 five-in-a-row rules match the vendored MIT browser source. */
const GOMOKU_SIZE=15;
function sourceGomokuInit(){return{size:15,board:Array(225).fill(0),turn:0,moves:0,status:'playing'}}
function sourceGomokuMove(s,i,m){
  if(i!==s.turn)return'Not your turn';const x=Number(m?.x),y=Number(m?.y);
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=15||y<0||y>=15)return'Invalid cell';
  const idx=y*15+x;if(s.board[idx])return'Cell occupied';const who=i+1;s.board[idx]=who;s.moves++;
  for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){
    let n=1;
    for(const sign of [-1,1]){for(let k=1;k<5;k++){const xx=x+dx*k*sign,yy=y+dy*k*sign;if(xx<0||xx>=15||yy<0||yy>=15||s.board[yy*15+xx]!==who)break;n++}}
    if(n>=5){s.status='finished';return{winner:i,reason:'five in a row'}}
  }
  if(s.moves===225){s.status='finished';return{draw:true,reason:'board full'}}s.turn=other(i);
}

/* Shared helpers. */
function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function clamp01(n){return clamp(Number(n)||0,0,1)}
function other(i){return i===0?1:0}

/* Backgammon: use the upstream MIT RuleBgCasual + model directly. The
   multiplayer adapter only serializes state and feeds validated moves into
   the unchanged upstream rule methods. */
const BACKGAMMON_MODEL_DIR=path.join(__dirname,'..','third_party','source-games','backgammon');
const BackgammonModel=require(path.join(BACKGAMMON_MODEL_DIR,'model.js'));
const BackgammonRule=require(path.join(BACKGAMMON_MODEL_DIR,'rules','RuleBgCasual.js'));

function bgState(game){
  const st=game.state;
  return{
    points:st.points.map(point=>point.map(p=>({id:p.id,type:p.type}))),
    bar:st.bar.map(arr=>arr.map(p=>p.id)),
    outside:st.outside.map(arr=>arr.map(p=>p.id)),
    pieces:st.pieces.map(arr=>arr.map(p=>({id:p.id,type:p.type}))),
    turn:game.turnPlayer?.currentPieceType===BackgammonModel.PieceType.BLACK?1:0,
    dice:game.turnDice?{values:[...game.turnDice.values],moves:[...game.turnDice.moves],movesLeft:[...game.turnDice.movesLeft],movesPlayed:[...game.turnDice.movesPlayed]}:null,
    started:!!game.hasStarted,
    over:!!game.isOver,
    moveSequence:game.moveSequence
  };
}
function bgNewGame(){
  const game=BackgammonModel.Game.createNew(BackgammonRule);
  const host=BackgammonModel.Player.createNew();
  const guest=BackgammonModel.Player.createNew();
  host.currentPieceType=BackgammonModel.PieceType.WHITE;
  guest.currentPieceType=BackgammonModel.PieceType.BLACK;
  game.turnPlayer=host;game.hasStarted=true;game.isOver=false;game.turnNumber=0;
  game.__host=host;game.__guest=guest;
  const match={host,guest,currentGame:game};
  game.__match=match;
  game.turnDice=BackgammonRule.rollDice(game);
  while(!game.turnDice.movesLeft.length){
    BackgammonRule.nextTurn(match);
    game.turnDice=BackgammonRule.rollDice(game);
  }
  Object.defineProperty(game.state,'__game',{value:game,writable:true,enumerable:false,configurable:true});
  Object.defineProperty(game.state,'__players',{value:[host,guest],writable:true,enumerable:false,configurable:true});
  return game;
}
function bgGame(s){
  const game=s?.__game;
  if(game)return game;
  return null;
}
function sourceBackgammonInit(){
  return bgState(bgNewGame());
}
function sourceBackgammonMove(s,i,m){
  const game=bgGame(s);
  if(!game)return'Backgammon state unavailable';
  const player=game.turnPlayer;
  if((player.currentPieceType===BackgammonModel.PieceType.WHITE?0:1)!==i)return'Not your turn';
  if(game.isOver)return'Game over';
  if(m?.action==='roll'){
    if(game.turnDice)return'Dice already rolled';
    game.turnDice=BackgammonRule.rollDice(game);
    return bgState(game);
  }
  if(!game.turnDice)return'Roll the dice first';
  const pieceId=Number(m?.pieceId),steps=Number(m?.steps);
  if(!Number.isInteger(pieceId)||!Number.isInteger(steps))return'Invalid backgammon move';
  const piece=game.state.pieces[i].find(p=>p.id===pieceId);
  if(!piece)return'Piece not available';
  if(!BackgammonRule.validateMove(game,player,piece,steps))return'Illegal backgammon move';
  const actions=BackgammonRule.getMoveActions(game.state,piece,steps);
  if(!actions?.length)return'Illegal backgammon move';
  BackgammonRule.applyMoveActions(game.state,actions);
  try{BackgammonRule.markAsPlayed(game,steps)}catch{return'Invalid dice usage'}
  game.moveSequence++;
  game.state.__game=game;
  const won=BackgammonRule.hasWon(game.state,player);
  if(won){game.isOver=true;game.hasStarted=false;return{winner:i,reason:'all checkers borne off'}}
  if(!BackgammonModel.Game.hasMoreMoves(game)){
    BackgammonRule.nextTurn(game.__match);
    game.turnDice=BackgammonRule.rollDice(game);
    while(!game.turnDice.movesLeft.length&&!game.isOver){
      BackgammonRule.nextTurn(game.__match);
      game.turnDice=BackgammonRule.rollDice(game);
    }
  }
  return bgState(game);
}

module.exports={sourceDotsBoxesInit,sourceDotsBoxesMove,sourceCarromInit,sourceCarromMove,sourceGomokuInit,sourceGomokuMove,sourceBackgammonInit,sourceBackgammonMove};
