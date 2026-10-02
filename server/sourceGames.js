'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function readThirdParty(...parts){
  return fs.readFileSync(path.join(__dirname,'..','third_party','source-games',...parts),'utf8');
}


/* Connect Four: exact upstream board/drop and win/draw helpers from MIT source. */
let connectFourContext;
function loadConnectFour(){
  if(connectFourContext)return connectFourContext;
  connectFourContext=vm.createContext({});
  vm.runInContext(readThirdParty('connect-four','vars.js')+'\n'+readThirdParty('connect-four','functions.js'),connectFourContext,{filename:'connect-four-source.js'});
  return connectFourContext;
}
function connectFourState(ctx){return{board:ctx.Game.board.map(row=>row.slice()),turn:ctx.Game.currentPlayer==='black'?0:1}}
function sourceConnectFourInit(){const ctx=loadConnectFour();vm.runInContext('Game.board=[[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]];Game.currentPlayer=Game.config.startingPlayer;',ctx);return connectFourState(ctx)}
function sourceConnectFourMove(s,i,m){
  if(i!==s.turn)return'Not your turn';
  const ctx=loadConnectFour();ctx.Game.board=s.board.map(row=>row.slice());ctx.Game.currentPlayer=i===0?'black':'red';
  const x=Number(m?.col);if(!Number.isInteger(x)||x<0||x>6)return'Invalid column';
  if(ctx.Game.check.isPositionTaken(x,0))return'Column full';
  const y=ctx.Game.do.dropToBottom(x,0);if(ctx.Game.check.isPositionTaken(x,y))return'Column full';
  ctx.Game.do.addDiscToBoard(x,y);
  s.board=ctx.Game.board.map(row=>row.slice());
  if(ctx.Game.check.isVerticalWin()||ctx.Game.check.isHorizontalWin()||ctx.Game.check.isDiagonalWin())return{winner:i,reason:'four in a row'};
  if(ctx.Game.check.isGameADraw())return{draw:true,reason:'board full'};
  ctx.Game.currentPlayer=ctx.Game.currentPlayer==='black'?'red':'black';s.turn=ctx.Game.currentPlayer==='black'?0:1;
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

function bgState(game,target){
  const st=game.state;
  const out=target||{};
  out.points=st.points.map(point=>point.map(p=>({id:p.id,type:p.type})));
  out.bar=st.bar.map(arr=>arr.map(p=>p.id));
  out.outside=st.outside.map(arr=>arr.map(p=>p.id));
  out.pieces=st.pieces.map(arr=>arr.map(p=>({id:p.id,type:p.type})));
  out.turn=game.turnPlayer?.currentPieceType===BackgammonModel.PieceType.BLACK?1:0;
  out.dice=game.turnDice?{values:[...game.turnDice.values],moves:[...game.turnDice.moves],movesLeft:[...game.turnDice.movesLeft],movesPlayed:[...game.turnDice.movesPlayed]}:null;
  const weights=game.turnDice?BackgammonRule.calculateMoveWeights(st,game.turnDice.movesLeft,game.turnPlayer.currentPieceType,null,true):{playableMoves:[]};
  out.legalMoves=[];
  for(const [pieceId,data] of Object.entries(weights||{})){
    if(pieceId==='max'||!data?.moves)continue;
    for(const steps of data.moves)out.legalMoves.push({pieceId:Number(pieceId),steps:Number(steps)});
  }
  out.started=!!game.hasStarted;
  out.over=!!game.isOver;
  out.moveSequence=game.moveSequence;
  if(!Object.prototype.hasOwnProperty.call(out,'__game')){
    Object.defineProperty(out,'__game',{value:game,writable:true,enumerable:false,configurable:true});
  }else out.__game=game;
  return out;
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
  return game;
}
function bgGame(s){return s?.__game||null}
function sourceBackgammonInit(){return bgState(bgNewGame(),{})}
function sourceBackgammonMove(s,i,m){
  const game=bgGame(s);
  if(!game)return'Backgammon state unavailable';
  const player=game.turnPlayer;
  if((player.currentPieceType===BackgammonModel.PieceType.WHITE?0:1)!==i)return'Not your turn';
  if(game.isOver)return'Game over';
  if(m?.action==='roll'){
    if(game.turnDice)return'Dice already rolled';
    game.turnDice=BackgammonRule.rollDice(game);
    while(!game.turnDice.movesLeft.length&&!game.isOver){
      BackgammonRule.nextTurn(game.__match);
      game.turnDice=BackgammonRule.rollDice(game);
    }
    return bgState(game,s);
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
  const won=BackgammonRule.hasWon(game.state,player);
  if(won){game.isOver=true;game.hasStarted=false;bgState(game,s);return{winner:i,reason:'all checkers borne off'}}
  if(!BackgammonModel.Game.hasMoreMoves(game)){
    BackgammonRule.nextTurn(game.__match);
    game.turnDice=BackgammonRule.rollDice(game);
    while(!game.turnDice.movesLeft.length&&!game.isOver){
      BackgammonRule.nextTurn(game.__match);
      game.turnDice=BackgammonRule.rollDice(game);
    }
  }
  return bgState(game,s);
}

/* Exact controller adapter for the vendored Carrom-Game source.
   The upstream CarromGame prototype is used directly; only DOM/audio/AI
   dependencies are stubbed because NEXUS supplies its own synchronized UI. */
let exactCarromContext;
function loadExactCarromController(){
  if(exactCarromContext)return exactCarromContext;
  const ctx=vm.createContext({
    console,
    Math,
    Date,
    setTimeout(){return 0},
    clearTimeout(){},
    requestAnimationFrame(){return 0},
    cancelAnimationFrame(){},
    document:{getElementById(){return null}},
    window:{devicePixelRatio:1},
    performance:{now:()=>0}
  });
  const physics=readThirdParty('carrom','carrom-physics.js');
  const controller=readThirdParty('carrom','carrom-game.js');
  vm.runInContext(physics+'\n'+controller+'\nglobalThis.__NEXUS_CARROM_EXACT={CarromGame,CarromPhysicsEngine,Vector2,Disc};',ctx,{filename:'carrom-exact-source.js'});
  return exactCarromContext=ctx;
}
function carromDomStub(){
  const el=()=>({style:{display:'',color:''},value:'50',innerText:'',textContent:'',className:'',classList:{add(){},remove(){},toggle(){}}});
  return {
    p1PosSlider:el(),p2PosSlider:el(),p1Score:el(),p2Score:el(),p1Name:el(),p2Name:el(),
    bannerText:el(),queenStatusText:el(),gameoverModal:el(),winnerTitle:el(),winnerSubtitle:el(),
    finalP1Score:el(),finalP2Score:el(),finalP1Name:el(),finalP2Name:el(),
    p1Card:el(),p2Card:el(),p1TurnBadge:el(),p2TurnBadge:el(),p1SliderBox:el(),p2SliderBox:el()
  };
}
function exactCarromRuntimeNew(){
  const ctx=loadExactCarromController(), C=ctx.__NEXUS_CARROM_EXACT;
  const g=Object.create(C.CarromGame.prototype);
  g.canvas={parentElement:{},getContext(){return{}}};g.ctx=g.canvas.getContext();
  g.width=800;g.height=800;g.boardConfig=CARROM_CFG;
  g.audio={playStrike(){},playCoinHit(){},playWallBounce(){},playPocketSink(){},playQueenCovered(){},playFoul(){},toggleSound(){return true}};
  g.physics=new C.CarromPhysicsEngine(g.boardConfig,g.audio);
  g.ai={calculateBestShot(){return null},startSession(){}};
  g.dom=carromDomStub();g.mode='2p';g.gameState='PLACEMENT';g.currentPlayer=1;
  g.scores={1:0,2:0};g.pocketedCoins={1:[],2:[]};g.foulPenaltiesDue={1:0,2:0};
  g.queenStatus='CENTER';g.queenAwaitingPlayer=null;g.coinsPocketedThisTurn=[];g.strikerPocketedThisTurn=false;g.hasFoulThisTurn=false;
  g.aimAngle=-Math.PI/2;g.shotPower=60;g.isDraggingAim=false;g.dragStartPos=null;g.showAimGuide=true;
  g.coins=[];g.striker=null;g.pockets=[];
  g.updateUI=()=>{};g.setAnnouncement=()=>{};g.triggerAITurn=()=>{};
  g.initPockets();g.arrangeCoins();g.createStriker();
  return {ctx,g};
}
function exactCarromState(runtime,target={}){
  const g=runtime.g;
  target.source='carrom-game-exact';target.turn=g.currentPlayer-1;target.scores=[g.scores[1],g.scores[2]];
  target.pocketed=[g.pocketedCoins[1].slice(),g.pocketedCoins[2].slice()];target.foulPenaltiesDue=[g.foulPenaltiesDue[1],g.foulPenaltiesDue[2]];
  target.queenStatus=g.queenStatus;target.queenAwaitingPlayer=g.queenAwaitingPlayer==null?null:g.queenAwaitingPlayer-1;
  target.phase=g.gameState;target.foul=!!g.hasFoulThisTurn;target.status=g.gameState==='GAME_OVER'?'finished':'playing';
  target.coins=g.coins.map((c,id)=>({id,type:c.type,x:c.pos.x/800,y:c.pos.y/800,vx:c.vel.x,vy:c.vel.y,pocketed:!!c.pocketed,isSinking:!!c.isSinking,sinkScale:Number(c.sinkScale??1)}));
  target.striker={id:19,type:'striker',x:g.striker.pos.x/800,y:g.striker.pos.y/800,vx:g.striker.vel.x,vy:g.striker.vel.y,pocketed:!!g.striker.pocketed,isSinking:!!g.striker.isSinking,sinkScale:Number(g.striker.sinkScale??1)};
  target.animation=target.animation||[];
  Object.defineProperty(target,'__carromRuntime',{value:runtime,writable:true,configurable:true});
  return target;
}
function exactCarromInit(){return exactCarromState(exactCarromRuntimeNew(),{animation:[]})}
function restoreCarromRuntime(s){
  if(s.__carromRuntime)return s.__carromRuntime;
  const runtime=exactCarromRuntimeNew(),g=runtime.g;
  g.currentPlayer=Number(s.turn||0)+1;g.scores={1:Number(s.scores?.[0]||0),2:Number(s.scores?.[1]||0)};
  g.pocketedCoins={1:[...(s.pocketed?.[0]||[])],2:[...(s.pocketed?.[1]||[])]};
  g.foulPenaltiesDue={1:Number(s.foulPenaltiesDue?.[0]||0),2:Number(s.foulPenaltiesDue?.[1]||0)};
  g.queenStatus=s.queenStatus||'CENTER';g.queenAwaitingPlayer=s.queenAwaitingPlayer==null?null:Number(s.queenAwaitingPlayer)+1;
  if(Array.isArray(s.coins))s.coins.forEach((c,id)=>{const q=g.coins[id];if(!q)return;q.pos.x=Number(c.x||0)*800;q.pos.y=Number(c.y||0)*800;q.vel.x=Number(c.vx||0);q.vel.y=Number(c.vy||0);q.pocketed=!!c.pocketed;q.isSinking=!!c.isSinking;q.sinkScale=Number(c.sinkScale??1)});
  if(s.striker){g.striker.pos.x=Number(s.striker.x||.5)*800;g.striker.pos.y=Number(s.striker.y||.5)*800;g.striker.vel.x=Number(s.striker.vx||0);g.striker.vel.y=Number(s.striker.vy||0);g.striker.pocketed=!!s.striker.pocketed;g.striker.isSinking=!!s.striker.isSinking;g.striker.sinkScale=Number(s.striker.sinkScale??1)}
  g.physics.setDiscs([...g.coins,g.striker]);s.__carromRuntime=runtime;return runtime;
}
function exactCarromMove(s,i,m){
  const runtime=restoreCarromRuntime(s),g=runtime.g;
  if(g.gameState==='GAME_OVER')return'Game over';if(i!==g.currentPlayer-1)return'Not your turn';
  const x=clamp(Number(m?.x??(g.striker.pos.x/800)),180/800,620/800)*800,y=g.currentPlayer===1?700:100;
  g.striker.pos.set(x,y);g.striker.vel.set(0,0);g.striker.pocketed=false;g.striker.isSinking=false;g.striker.sinkScale=1;
  try{g.adjustStrikerOverlap()}catch{}
  const dx=Number(m?.dx),dy=Number(m?.dy),mag=Math.hypot(dx,dy),power=Number(m?.power);
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||mag<.01)return'Aim before shooting';if(!Number.isFinite(power)||power<=.02)return'Shot power is too low';
  g.aimAngle=Math.atan2(dy,dx);g.shotPower=15+85*Math.max(0,Math.min(1,power));g.executeStrike();
  const frame=()=>({striker:{x:g.striker.pos.x/800,y:g.striker.pos.y/800,pocketed:!!g.striker.pocketed},coins:g.coins.map((c,id)=>({id,type:c.type,x:c.pos.x/800,y:c.pos.y/800,pocketed:!!c.pocketed}))});
  const frames=[frame()];let steps=0;while(!g.physics.areAllDiscsStopped()&&steps++<6000){g.physics.update();if(steps%6===0)frames.push(frame())}frames.push(frame());
  g.processTurnEnd();const out=exactCarromState(runtime,s);s.animation=frames.slice(-180);out.animation=s.animation;
  if(g.gameState==='GAME_OVER'){if(g.scores[1]===g.scores[2])return{draw:true,reason:'source carrom score tie'};return{winner:g.scores[1]>g.scores[2]?0:1,reason:'source carrom game over'}}
  return{animation:true};
}

/* Exact MIT Classic-Pool-Game runtime adapter.
   The source files under third_party/source-games/pool are executed unchanged
   inside an isolated VM. NEXUS only supplies browser-global stubs and
   serializes the source runtime for Socket.IO. */
let poolSourceContext;
function loadExactPoolRuntime(){
  if(poolSourceContext)return poolSourceContext;
  const ctx=vm.createContext({
    console,
    Math,
    Date,
    JSON,
    setTimeout(fn){ctx.__poolTimers.push(fn);return 0},
    clearTimeout(){},
    __poolTimers:[],
    Color:{red:'red',yellow:'yellow',black:'black',white:'white'},
    sprites:{background:{},redBall:{},yellowBall:{},blackBall:{},ball:{},stick:{}},
    sounds:{
      strike:{cloneNode(){return {volume:0,play(){return Promise.resolve()}}}},
      hole:{cloneNode(){return {volume:0,play(){return Promise.resolve()}}}},
      ballsCollide:{cloneNode(){return {volume:0,play(){return Promise.resolve()}}}}
    },
    Canvas2D:{drawImage(){},drawText(){}},
    Keyboard:{down(){return false},reset(){}},
    Keys:{W:'w',S:'s'},
    Mouse:{left:{down:false},position:{x:413,y:413},reset(){}},
    Game:{size:{x:1500,y:825},sound:false,gameWorld:null,policy:null},
    AI:{finishedSession:false,startSession(){}}
  });
  const files=['Global.js','Vector2.js','Score.js','Player.js','Ball.js','Stick.js','GamePolicy.js','GameWorld.js'];
  for(const file of files)vm.runInContext(readThirdParty('pool',file),ctx,{filename:'pool/'+file});
  vm.runInContext("AI_ON=false; SOUND_ON=false; AI.finishedSession=false; GAME_STOPPED=false; DISPLAY=false;",ctx);
  ctx.__poolDelta=vm.runInContext("DELTA",ctx);
  return poolSourceContext=ctx;
}
function poolRunTimers(ctx){while(ctx.__poolTimers.length){const fn=ctx.__poolTimers.shift();try{fn()}catch{}}}
function poolSourceState(game,target={}){
  const policy=game.policy,world=game.world;
  const srcBalls=world.balls||[];
  const mapBall=(b,id)=>({
    id,type:b===world.whiteBall?'cue':'object',
    group:b.color==='red'?'solid':b.color==='yellow'?'stripe':b.color==='black'?'eight':'cue',
    number:id,
    x:(b.position?.x||0)/1500,y:(b.position?.y||0)/825,
    vx:(b.velocity?.x||0)/1500,vy:(b.velocity?.y||0)/825,
    pocketed:!!b.inHole,visible:b.visible!==false
  });
  let solidNo=1,stripeNo=9;
  const objects=srcBalls.filter(b=>b!==world.whiteBall).map(b=>{
    let n=8;if(b.color==='red')n=solidNo++;else if(b.color==='yellow')n=stripeNo++;
    return mapBall(b,n);
  });
  const cue=mapBall(world.whiteBall,0);
  cue.x=Number(cue.x)||0;cue.y=Number(cue.y)||0;
  target.source='classic-pool-game';
  target.turn=policy.turn;
  target.phase=policy.won?'gameover':(policy.turnPlayed?'simulating':'playing');
  target.ballInHand=!!policy.foul;
  target.foul=!!policy.foul;
  target.firstCollision=!!policy.firstCollision;
  target.groups=policy.players.map(p=>p.color==='red'?'solid':p.color==='yellow'?'stripe':null);
  target.players=policy.players.map(p=>({color:p.color||null,score:p.matchScore.value,totalScore:p.totalScore.value}));
  target.balls=[cue,...objects];
  target.animation=target.animation||[];
  target.winner=policy.won?(policy.foul?other(policy.turn):policy.turn):null;
  target.sourceDimensions={width:1500,height:825};
  if(!Object.prototype.hasOwnProperty.call(target,'__poolRuntime')){
    Object.defineProperty(target,'__poolRuntime',{value:{ctx:game.ctx,policy,world,game},writable:true,configurable:true});
  }else target.__poolRuntime={ctx:game.ctx,policy,world,game};
  return target;
}
function poolSourceNewGame(){
  const ctx=loadExactPoolRuntime();
  ctx.Game.size={x:1500,y:825};ctx.Game.sound=false;ctx.AI.finishedSession=false;ctx.AI_ON=false;
  ctx.Mouse.position={x:413,y:413};ctx.Mouse.left.down=false;ctx.__poolTimers.length=0;
  const policy=new ctx.GamePolicy();
  const world=new ctx.GameWorld();
  ctx.Game.policy=policy;ctx.Game.gameWorld=world;
  world.stick.position=world.whiteBall.position.copy();
  const game={ctx,policy,world};
  return game;
}
function sourcePoolInit(){
  const game=poolSourceNewGame();
  const s=poolSourceState(game,{});
  s.animation=[];
  return s;
}
function poolSourceFrame(runtime){
  const {world}=runtime;
  let solidNo=1,stripeNo=9;
  const out=[];
  const objectBalls=(world.balls||[]).filter(b=>b!==world.whiteBall);
  out.push({id:0,x:(world.whiteBall.position?.x||0)/1500,y:(world.whiteBall.position?.y||0)/825,pocketed:!!world.whiteBall.inHole,group:'cue',number:0});
  for(const b of objectBalls){
    let n=8;if(b.color==='red')n=solidNo++;else if(b.color==='yellow')n=stripeNo++;
    out.push({id:out.length,x:(b.position?.x||0)/1500,y:(b.position?.y||0)/825,pocketed:!!b.inHole,group:b.color==='red'?'solid':b.color==='yellow'?'stripe':'eight',number:n});
  }
  return out;
}
function sourcePoolMove(s,i,m){
  const runtime=s.__poolRuntime;
  if(!runtime)return'Pool source runtime unavailable';
  const {ctx,policy,world}=runtime;
  if(policy.won)return'Game over';
  if(policy.turn!==i)return'Not your turn';
  const ball=world.whiteBall;
  if(s.ballInHand){
    const cueX=clamp(Number(m?.cueX??(ball.position.x/1500)),.06,.94)*1500;
    const cueY=(i===0?413:413);
    const candidate=new ctx.Vector2(cueX,cueY);
    let overlap=false;
    for(const b of world.balls){if(b===ball||b.inHole)continue;if(candidate.distanceFrom(b.position)<38){overlap=true;break}}
    if(overlap)return'Place the cue ball in an open position';
    ball.position=candidate;ball.inHole=false;ball.visible=true;policy.foul=false;s.ballInHand=false;world.stick.position=ball.position.copy();
    if(m?.placeOnly){poolRunTimers(ctx);poolSourceState({ctx,policy,world},s);return}
  }
  const dx=Number(m?.dx),dy=Number(m?.dy),mag=Math.hypot(dx,dy),power=Number(m?.power);
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||mag<.01)return'Choose an aim direction';
  if(!Number.isFinite(power)||power<=.02)return'Shot power is too low';
  const sourcePower=clamp(.048+.272*clamp(power,0,1),.048,.32);
  const angle=Math.atan2(dy,dx);
  world.stick.position=ball.position.copy();
  world.stick.shooting=false;world.stick.visible=true;
  world.stick.shoot(sourcePower,angle);
  const frames=[poolSourceFrame(runtime)];
  let steps=0;
  while(world.ballsMoving()&&steps++<7000){
    world.update(ctx.__poolDelta||.01);
    if(steps%6===0)frames.push(poolSourceFrame(runtime));
  }
  poolRunTimers(ctx);
  frames.push(poolSourceFrame(runtime));
  policy.updateTurnOutcome();
  poolRunTimers(ctx);
  if(policy.foul&&!policy.won){
    ball.inHole=false;ball.visible=true;ball.moving=false;ball.velocity=ctx.Vector2.zero;
    const baselineY=policy.turn===0?413:413;
    ball.position=new ctx.Vector2(clamp(ball.position.x,120,1380),baselineY);
    world.stick.position=ball.position.copy();
  }
  s.animation=frames.slice(-180);
  const out=poolSourceState({ctx,policy,world},s);
  out.animation=s.animation;
  if(policy.won){
    return policy.foul
      ? {winner:other(policy.turn),reason:'source 8-ball foul'}
      : {winner:policy.turn,reason:'source 8-ball'};
  }
  return{animation:true};
}

module.exports={sourceConnectFourInit,sourceConnectFourMove,sourceCarromInit,sourceCarromMove,sourceCarromExactInit:exactCarromInit,sourceCarromExactMove:exactCarromMove,sourceDotsBoxesInit,sourceDotsBoxesMove,sourceGomokuInit,sourceGomokuMove,sourceBackgammonInit,sourceBackgammonMove,sourcePoolInit,sourcePoolMove};
