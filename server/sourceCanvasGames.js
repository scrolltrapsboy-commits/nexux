'use strict';

const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');

const ROOT=path.join(__dirname,'..','third_party','source-games','canvas-games');
const cache=new Map();

function resolveFile(from,request){
  if(!request.startsWith('.')) return null;
  let p=path.resolve(path.dirname(from),request);
  if(!path.extname(p)) p+='.ts';
  if(!fs.existsSync(p) && !p.endsWith('.ts')) p+='.ts';
  return p;
}
function loadTS(file){
  const abs=path.isAbsolute(file)?file:path.resolve(ROOT,file);
  if(cache.has(abs))return cache.get(abs).exports;
  const src=fs.readFileSync(abs,'utf8');
  const js=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true,sourceMap:false},fileName:abs}).outputText;
  const mod={exports:{}};
  cache.set(abs,mod);
  const localRequire=req=>{
    const resolved=resolveFile(abs,req);
    if(resolved && resolved.startsWith(ROOT))return loadTS(resolved);
    if(req.startsWith('@shared/'))return {};
    return require(req);
  };
  const fn=new Function('require','module','exports',js);
  fn(localRequire,mod,mod.exports);
  return mod.exports;
}
function load(rel){return loadTS(path.join(ROOT,rel));}

const breakoutTypes=load('breakout/types.ts');
const {PhysicsSystem:BreakoutPhysics}=load('breakout/systems/PhysicsSystem.ts');
const {CollisionSystem:BreakoutCollision}=load('breakout/systems/CollisionSystem.ts');
const {PowerupSystem:BreakoutPowerup}=load('breakout/systems/PowerupSystem.ts');
const {LevelSystem:BreakoutLevel}=load('breakout/systems/LevelSystem.ts');

function breakoutPlayer(){
  const s={
    phase:'playing',balls:[],
    paddle:{x:400,y:550,w:breakoutTypes.PADDLE_BASE_W,h:breakoutTypes.PADDLE_H,baseW:breakoutTypes.PADDLE_BASE_W},
    bricks:[],powerups:[],effects:[],score:0,highScore:0,lives:breakoutTypes.MAX_LIVES,
    level:1,canvasW:900,canvasH:600,baseBallSpeed:breakoutTypes.BALL_BASE_SPEED,mouseX:450
  };
  new BreakoutLevel().loadLevel(s);
  Object.defineProperty(s,'__systems',{value:{
    physics:new BreakoutPhysics(),collision:new BreakoutCollision(),powerup:new BreakoutPowerup(),level:new BreakoutLevel()
  },enumerable:false});
  return s;
}
function breakoutTickOne(s,dt=1/60){
  const x=s.__systems||{physics:new BreakoutPhysics(),collision:new BreakoutCollision(),powerup:new BreakoutPowerup(),level:new BreakoutLevel()};
  x.physics.update(s,dt);x.collision.update(s,dt);x.powerup.update(s,dt);x.level.update(s,dt);
}
function breakoutInit(players=[]){
  const ps=players.length?players:[{id:'p0',name:'Player 1'},{id:'p1',name:'Player 2'}];
  return {players:ps.map(()=>breakoutPlayer()),source:'forinda/canvas-games/breakout',phase:'playing'};
}
function breakoutMove(s,i,m={}){
  const p=s.players?.[i];if(!p)return'Player not found';
  if(p.phase==='gameover'||p.phase==='win')return'Game over';
  const x=Number(m.x);
  if(Number.isFinite(x))p.mouseX=Math.max(0,Math.min(p.canvasW,x>1?x:x*p.canvasW));
  return;
}
function breakoutTick(s){
  for(const p of s.players)breakoutTickOne(p);
  const winner=s.players.findIndex(p=>p.phase==='win');
  if(winner>=0){s.phase='finished';return{winner,reason:'cleared source Breakout levels'};}
  const dead=s.players.findIndex(p=>p.phase==='gameover');
  if(dead>=0&&s.players.every((p,idx)=>idx===dead||p.phase!=='playing')){const other=dead===0?1:0;s.phase='finished';return{winner:other,reason:'opponent lost all Breakout lives'};}
}
function breakoutView(s,i){
  const p=s.players[i],o=s.players[1-i];
  const clean=x=>({phase:x.phase,score:x.score,lives:x.lives,level:x.level,paddle:x.paddle,balls:x.balls,bricks:x.bricks,powerups:x.powerups,effects:x.effects});
  return{you:clean(p),opponent:{score:o.score,lives:o.lives,level:o.level,phase:o.phase},source:s.source};
}

const invTypes=load('space-invaders/types.ts');
const {buildFormation}=load('space-invaders/data/formations.ts');
const {PlayerSystem:InvPlayer}=load('space-invaders/systems/PlayerSystem.ts');
const {AlienSystem:InvAlien}=load('space-invaders/systems/AlienSystem.ts');
const {CollisionSystem:InvCollision}=load('space-invaders/systems/CollisionSystem.ts');
const {UFOSystem:InvUFO,resetUfoTimer}=load('space-invaders/systems/UFOSystem.ts');

function buildInvShields(canvasW){
  const shields=[],gap=canvasW/(invTypes.SHIELD_COLS+1);
  const cols=Math.floor(invTypes.SHIELD_W/invTypes.SHIELD_BLOCK_SIZE),rows=Math.floor(invTypes.SHIELD_H/invTypes.SHIELD_BLOCK_SIZE);
  for(let i=0;i<invTypes.SHIELD_COLS;i++){
    const grid=[];
    for(let r=0;r<rows;r++){grid[r]=[];for(let c=0;c<cols;c++){
      const notch=r>=rows-3&&c>=Math.floor(cols/2)-2&&c<=Math.floor(cols/2)+1;
      const corner=r===0&&(c===0||c===cols-1);
      grid[r][c]=!notch&&!corner;
    }}
    shields.push({x:gap*(i+1)-invTypes.SHIELD_W/2,y:invTypes.SHIELD_Y,grid,rows,cols,blockSize:invTypes.SHIELD_BLOCK_SIZE});
  }
  return shields;
}
function invPlayer(){
  const W=800,H=600,s={
    phase:'playing',
    player:{x:W/2-invTypes.PLAYER_W/2,y:H-40,w:invTypes.PLAYER_W,h:invTypes.PLAYER_H,speed:invTypes.PLAYER_SPEED,
      shootCooldown:invTypes.PLAYER_SHOOT_COOLDOWN,cooldownLeft:0,alive:true,respawnTimer:0},
    aliens:buildFormation(1,W),bullets:[],shields:buildInvShields(W),ufo:null,ufoTimer:resetUfoTimer(),
    alienDir:1,alienSpeedMultiplier:1,alienShootTimer:1,score:0,highScore:0,lives:invTypes.PLAYER_START_LIVES,
    level:1,levelClearTimer:0,input:{left:false,right:false,shoot:false,pause:false},canvasW:W,canvasH:H
  };
  Object.defineProperty(s,'__systems',{value:{player:new InvPlayer(),alien:new InvAlien(),ufo:new InvUFO(),collision:new InvCollision()},enumerable:false});
  return s;
}
function resetInvLevel(s){
  const score=s.score,lives=s.lives,level=s.level;
  const n=invPlayer();n.score=score;n.lives=lives;n.level=level;
  Object.assign(s,n);
}
function invInit(players=[]){
  const ps=players.length?players:[{id:'p0',name:'Player 1'},{id:'p1',name:'Player 2'}];
  return{players:ps.map(()=>invPlayer()),phase:'playing',source:'forinda/canvas-games/space-invaders'};
}
function invMove(s,i,m={}){
  const p=s.players?.[i];if(!p)return'Player not found';if(p.phase==='gameover')return'Game over';
  if('left' in m)p.input.left=!!m.left;if('right' in m)p.input.right=!!m.right;
  if(m.shoot)p.input.shoot=true;
}
function invTickOne(s){
  const dt=1/60;
  if(s.phase==='levelclear'){
    s.levelClearTimer-=dt;
    if(s.levelClearTimer<=0){
      if(s.level>=3)s.phase='win';
      else{ s.level++; resetInvLevel(s); }
    }
    return;
  }
  if(s.phase!=='playing')return;
  const x=s.__systems;
  x.player.update(s,dt);x.alien.update(s,dt);x.ufo.update(s,dt);x.collision.update(s,dt);
  s.input.shoot=false;
}
function invTick(s){
  for(const p of s.players)invTickOne(p);
  const win=s.players.findIndex(p=>p.phase==='win');
  if(win>=0){s.phase='finished';return{winner:win,reason:'cleared source Space Invaders levels'};}
  const dead=s.players.findIndex(p=>p.phase==='gameover');
  if(dead>=0){const other=dead===0?1:0;s.phase='finished';return{winner:other,reason:'opponent lost all source Space Invaders lives'};}
}
function invView(s,i){
  const own=JSON.parse(JSON.stringify(s.players[i])),opp=s.players[1-i];
  return{you:own,opponent:{score:opp.score,lives:opp.lives,level:opp.level,phase:opp.phase},source:s.source};
}

const pacTypes=load('pacman/types.ts');
const {MAZE_DATA}=load('pacman/data/maze.ts');
const {PlayerSystem:PacPlayer}=load('pacman/systems/PlayerSystem.ts');
const {GhostSystem:PacGhost}=load('pacman/systems/GhostSystem.ts');
const {CollisionSystem:PacCollision}=load('pacman/systems/CollisionSystem.ts');

function makePacPlayer(){
  const grid=[];let totalDots=0,playerStart={x:13.5,y:23},ghostStarts=[];
  for(let y=0;y<pacTypes.MAZE_ROWS;y++){
    const row=[];const line=MAZE_DATA[y]||'';
    for(let x=0;x<pacTypes.MAZE_COLS;x++){
      const ch=line[x]||' ';let type='empty';
      if(ch==='#')type='wall';else if(ch==='.')type='dot';else if(ch==='o')type='power';else if(ch==='-')type='door';
      else if(ch==='P'){playerStart={x,y};type='empty'}else if(ch==='G'){ghostStarts.push({x,y});type='empty'}
      if(type==='dot'||type==='power')totalDots++;
      row.push({type});
    }
    grid.push(row);
  }
  const W=840,H=720,cs=Math.floor(Math.min(W/pacTypes.MAZE_COLS,H/pacTypes.MAZE_ROWS));
  const s={
    grid,gridWidth:pacTypes.MAZE_COLS,gridHeight:pacTypes.MAZE_ROWS,
    pacman:{pos:{...playerStart},dir:'none',nextDir:'none',mouthAngle:.4,mouthOpening:true},
    ghosts:[
      {name:'blinky',pos:{x:13.5,y:11},dir:'left',mode:'scatter',scatterTarget:{x:pacTypes.MAZE_COLS-3,y:-3},homePos:ghostStarts[0]||{x:13,y:14},color:'#f33',active:true,releaseTimer:0,eaten:false},
      {name:'pinky',pos:{...(ghostStarts[1]||{x:13,y:14})},dir:'up',mode:'scatter',scatterTarget:{x:2,y:-3},homePos:ghostStarts[1]||{x:13,y:14},color:'#faa',active:false,releaseTimer:3,eaten:false},
      {name:'inky',pos:{...(ghostStarts[2]||{x:11,y:14})},dir:'up',mode:'scatter',scatterTarget:{x:pacTypes.MAZE_COLS-1,y:pacTypes.MAZE_ROWS+1},homePos:ghostStarts[2]||{x:11,y:14},color:'#6ff',active:false,releaseTimer:7,eaten:false},
      {name:'clyde',pos:{...(ghostStarts[3]||{x:15,y:14})},dir:'up',mode:'scatter',scatterTarget:{x:0,y:pacTypes.MAZE_ROWS+1},homePos:ghostStarts[3]||{x:15,y:14},color:'#fa5',active:false,releaseTimer:12,eaten:false}
    ],
    score:0,highScore:0,lives:pacTypes.INITIAL_LIVES,level:1,totalDots,dotsEaten:0,frightenedTimer:0,frightenedGhostsEaten:0,
    modeTimer:0,modeIndex:0,globalMode:'scatter',gameOver:false,paused:false,started:true,won:false,time:0,cellSize:cs,
    offsetX:(W-pacTypes.MAZE_COLS*cs)/2,offsetY:(H-pacTypes.MAZE_ROWS*cs)/2+10,canvasW:W,canvasH:H
  };
  Object.defineProperty(s,'__systems',{value:{player:new PacPlayer(),ghost:new PacGhost()},enumerable:false});
  return s;
}
function pacDeath(s){
  s.lives--;
  if(s.lives<=0){s.gameOver=true;return;}
  const p=s.pacman;p.pos={x:13.5,y:23};p.dir='none';p.nextDir='none';
  const starts=s.ghosts.map(g=>g.homePos);
  s.ghosts[0].pos={x:13.5,y:11};s.ghosts[0].dir='left';s.ghosts[0].active=true;s.ghosts[0].eaten=false;s.ghosts[0].mode='scatter';
  for(let i=1;i<s.ghosts.length;i++){const g=s.ghosts[i];g.pos={...starts[i]};g.dir='up';g.active=false;g.eaten=false;g.releaseTimer=3+i*3;g.mode='scatter'}
  s.frightenedTimer=0;s.modeTimer=0;s.modeIndex=0;s.globalMode='scatter';
}
function pacInit(players=[]){
  const ps=players.length?players:[{id:'p0',name:'Player 1'},{id:'p1',name:'Player 2'}];
  return{players:ps.map(()=>makePacPlayer()),phase:'playing',source:'forinda/canvas-games/pacman'};
}
function pacMove(s,i,m={}){
  const p=s.players?.[i];if(!p)return'Player not found';if(p.gameOver||p.won)return'Game over';
  const d=String(m.dir||'');if(!['up','down','left','right'].includes(d))return'Invalid direction';
  p.pacman.nextDir=d;return;
}
function pacTickOne(s){
  if(s.gameOver||s.won)return;
  const x=s.__systems;x.player.update(s,1/60);x.ghost.update(s,1/60);new PacCollision(()=>pacDeath(s)).update(s,1/60);
}
function pacTick(s){
  for(const p of s.players)pacTickOne(p);
  const win=s.players.findIndex(p=>p.won);
  if(win>=0){s.phase='finished';return{winner:win,reason:'cleared source Pac-Man maze'};}
  const dead=s.players.findIndex(p=>p.gameOver);
  if(dead>=0){const other=dead===0?1:0;s.phase='finished';return{winner:other,reason:'opponent lost all source Pac-Man lives'};}
}
function pacView(s,i){
  const own=JSON.parse(JSON.stringify(s.players[i])),opp=s.players[1-i];
  return{you:own,opponent:{score:opp.score,lives:opp.lives,dotsEaten:opp.dotsEaten,won:opp.won,gameOver:opp.gameOver},source:s.source};
}

const frogTypes=load('frogger/types.ts');
const {buildLanes}=load('frogger/data/levels.ts');
const {TrafficSystem}=load('frogger/systems/TrafficSystem.ts');
const {RiverSystem}=load('frogger/systems/RiverSystem.ts');
const {CollisionSystem:FrogCollision}=load('frogger/systems/CollisionSystem.ts');

function makeFrogPlayer(){
  const W=900,H=650,lanes=buildLanes(1);
  const s={frog:{col:Math.floor(frogTypes.COLS/2),row:frogTypes.ROWS-1,offsetX:0,offsetY:0,hopping:false,hopTimer:0},
    vehicles:[],logs:[],lilyPads:[],lanes,lives:3,score:0,highScore:0,level:1,goalsReached:0,
    cellW:W/frogTypes.COLS,cellH:H/frogTypes.ROWS,canvasW:W,canvasH:H,paused:false,started:true,gameOver:false,dying:false,deathTimer:0,levelComplete:false,levelCompleteTimer:0};
  const spacing=Math.floor(frogTypes.COLS/(frogTypes.GOAL_SLOTS+1));for(let i=1;i<=frogTypes.GOAL_SLOTS;i++)s.lilyPads.push({col:i*spacing,occupied:false});
  Object.defineProperty(s,'__systems',{value:{traffic:new TrafficSystem(),river:new RiverSystem()},enumerable:false});
  s.__systems.traffic.populate(s);s.__systems.river.populate(s);
  return s;
}
function frogInit(players=[]){
  const ps=players.length?players:[{id:'p0',name:'Player 1'},{id:'p1',name:'Player 2'}];
  return{players:ps.map(()=>makeFrogPlayer()),phase:'playing',source:'forinda/canvas-games/frogger'};
}
function frogMove(s,i,m={}){
  const p=s.players?.[i];if(!p)return'Player not found';
  if(p.gameOver||p.levelComplete||p.frog.hopping)return;
  const d=String(m.dir||'');const map={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};if(!map[d])return'Invalid direction';
  const [dc,dr]=map[d],nc=p.frog.col+dc,nr=p.frog.row+dr;
  if(nc<0||nc>=frogTypes.COLS||nr<0||nr>=frogTypes.ROWS)return'Edge of board';
  p.frog.col=nc;p.frog.row=nr;p.frog.offsetX=-dc*p.cellW;p.frog.offsetY=-dr*p.cellH;p.frog.hopping=true;p.frog.hopTimer=.1;
}
function frogTickOne(s){
  if(s.gameOver)return;
  const dt=1/60;
  if(s.levelComplete){s.levelCompleteTimer-=dt;if(s.levelCompleteTimer<=0){s.phase='finished';s.levelComplete=false}return;}
  if(s.frog.hopping){s.frog.hopTimer-=dt;if(s.frog.hopTimer<=0){s.frog.hopping=false;s.frog.hopTimer=0;s.frog.offsetX=0;s.frog.offsetY=0}else{const ratio=s.frog.hopTimer/.1;s.frog.offsetX=s.frog.offsetX>0?Math.max(0,s.frog.offsetX*ratio):Math.min(0,s.frog.offsetX*ratio);s.frog.offsetY=s.frog.offsetY>0?Math.max(0,s.frog.offsetY*ratio):Math.min(0,s.frog.offsetY*ratio);}}
  s.__systems.traffic.update(s,dt);s.__systems.river.update(s,dt);new FrogCollision().update(s,dt);
}
function frogTick(s){
  for(const p of s.players)frogTickOne(p);
  const win=s.players.findIndex(p=>p.levelComplete||p.phase==='finished');
  if(win>=0){s.phase='finished';return{winner:win,reason:'completed source Frogger level'};}
  const dead=s.players.findIndex(p=>p.gameOver);
  if(dead>=0){const other=dead===0?1:0;s.phase='finished';return{winner:other,reason:'opponent lost all source Frogger lives'};}
}
function frogView(s,i){
  const own=JSON.parse(JSON.stringify(s.players[i])),opp=s.players[1-i];
  return{you:own,opponent:{score:opp.score,lives:opp.lives,goalsReached:opp.goalsReached,levelComplete:opp.levelComplete,gameOver:opp.gameOver},source:s.source};
}

const flTypes=load('flappy-bird/types.ts');
const {BirdSystem:FlBird}=load('flappy-bird/systems/BirdSystem.ts');
const {PipeSystem:FlPipe}=load('flappy-bird/systems/PipeSystem.ts');
const {CollisionSystem:FlCollision}=load('flappy-bird/systems/CollisionSystem.ts');

function makeFlappyPlayer(){
  const W=800,H=600,groundY=H-flTypes.GROUND_HEIGHT;
  const s={bird:{x:W*flTypes.BIRD_X_RATIO,y:H*.42,velocity:0,rotation:0,radius:flTypes.BIRD_RADIUS,wingAngle:0,wingDir:1},
    pipes:[],phase:'playing',score:0,highScore:0,canvasW:W,canvasH:H,groundY,pipeTimer:0,flashTimer:0,backgroundOffset:0,groundOffset:0};
  Object.defineProperty(s,'__systems',{value:{bird:new FlBird(),pipe:new FlPipe()},enumerable:false});
  return s;
}
function flappyInit(players=[]){
  const ps=players.length?players:[{id:'p0',name:'Player 1'},{id:'p1',name:'Player 2'}];
  return{players:ps.map(()=>makeFlappyPlayer()),phase:'playing',source:'forinda/canvas-games/flappy-bird'};
}
function flappyMove(s,i,m={}){
  const p=s.players?.[i];if(!p)return'Player not found';if(p.phase==='dead')return'Game over';
  if(m.flap){p.bird.velocity=flTypes.FLAP_FORCE;return;}
  return;
}
function flappyTickOne(s){
  if(s.phase==='dead')return;
  const dt=16.6667;
  s.backgroundOffset+=flTypes.PIPE_SPEED*dt*.5;s.groundOffset+=flTypes.PIPE_SPEED*dt;s.flashTimer=Math.max(0,s.flashTimer-dt);
  s.__systems.bird.update(s,dt);s.__systems.pipe.update(s,dt);new FlCollision().update(s,dt);
}
function flappyTick(s){
  for(const p of s.players)flappyTickOne(p);
  const winner=s.players.findIndex(p=>p.score>=10);
  if(winner>=0){s.phase='finished';return{winner,reason:'reached 10 source Flappy Bird points'};}
  const dead=s.players.findIndex(p=>p.phase==='dead');
  if(dead>=0){const other=dead===0?1:0;s.phase='finished';return{winner:other,reason:'opponent crashed in source Flappy Bird'};}
}
function flappyView(s,i){
  const own=JSON.parse(JSON.stringify(s.players[i])),opp=s.players[1-i];
  return{you:own,opponent:{score:opp.score,phase:opp.phase},source:s.source};
}

const sudokuTypes=load('sudoku/types.ts');
const {BoardSystem}=load('sudoku/systems/BoardSystem.ts');

function sudokuPlayer(){
  const s={board:[],solution:[],difficulty:'easy',status:'playing',selectedRow:-1,selectedCol:-1,notesMode:false,timer:0,undoStack:[],offsetX:0,offsetY:0,cellSize:50,hudHeight:44};
  new BoardSystem().initBoard(s);
  return s;
}
function sudokuInit(players=[]){
  const ps=players.length?players:[{id:'p0',name:'Player 1'},{id:'p1',name:'Player 2'}];
  return{players:ps.map(()=>sudokuPlayer()),phase:'playing',source:'forinda/canvas-games/sudoku'};
}
function sudokuMove(s,i,m={}){
  const p=s.players?.[i];if(!p)return'Player not found';if(p.status==='won')return'Game over';
  const row=Number(m.row),col=Number(m.col),num=Number(m.num);
  if(!Number.isInteger(row)||row<0||row>=sudokuTypes.GRID||!Number.isInteger(col)||col<0||col>=sudokuTypes.GRID)return'Invalid cell';
  if(!Number.isInteger(num)||num<0||num>9)return'Invalid number';
  p.selectedRow=row;p.selectedCol=col;
  const system=new BoardSystem();
  system.placeNumber(p,num);
  if(p.status==='won'){s.phase='finished';return{winner:i,reason:'completed source Sudoku'};}
}
function sudokuView(s,i){
  const own=s.players[i],view={board:own.board.map(row=>row.map(c=>({value:c.value,given:c.given,invalid:c.invalid,notes:Array.from(c.notes||[])}))),status:own.status,difficulty:own.difficulty,timer:own.timer};
  const opp=s.players[1-i];
  return{you:view,opponent:{status:opp.status,timer:opp.timer},source:s.source};
}

const CANVAS_SOURCE_GAMES={
  breakout:{name:'Breakout',category:'Arcade',players:2,sourceName:'forinda/canvas-games',sourceLicense:'MIT',init:breakoutInit,move:breakoutMove,tick:breakoutTick,realtime:true,getStateForPlayer:breakoutView},
  spaceinvaders:{name:'Space Invaders',category:'Arcade',players:2,sourceName:'forinda/canvas-games',sourceLicense:'MIT',init:invInit,move:invMove,tick:invTick,realtime:true,getStateForPlayer:invView},
  pacman:{name:'Pac-Man',category:'Arcade',players:2,sourceName:'forinda/canvas-games',sourceLicense:'MIT',init:pacInit,move:pacMove,tick:pacTick,realtime:true,getStateForPlayer:pacView},
  frogger:{name:'Frogger',category:'Arcade',players:2,sourceName:'forinda/canvas-games',sourceLicense:'MIT',init:frogInit,move:frogMove,tick:frogTick,realtime:true,getStateForPlayer:frogView},
  flappy:{name:'Flappy Bird',category:'Arcade',players:2,sourceName:'forinda/canvas-games',sourceLicense:'MIT',init:flappyInit,move:flappyMove,tick:flappyTick,realtime:true,getStateForPlayer:flappyView},
  sudoku:{name:'Sudoku',category:'Puzzle',players:2,sourceName:'forinda/canvas-games',sourceLicense:'MIT',init:sudokuInit,move:sudokuMove,getStateForPlayer:sudokuView}
};

module.exports={CANVAS_SOURCE_GAMES,loadTS};
