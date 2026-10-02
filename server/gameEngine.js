'use strict';

// Open-source rule/physics engines used by NEXUS PLAY.
// chess.js: BSD-2-Clause — https://github.com/jhlywa/chess.js
// rapid-draughts: MIT — https://github.com/loks0n/rapid-draughts
// matter-js: MIT — https://github.com/liabru/matter-js
const { Chess } = require('chess.js');
const { EnglishDraughts } = require('rapid-draughts/english');
const { Vector } = require('matter-js');

const GAMES = {};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const other=i=>i===0?1:0;

function winLines(board,n=3,w=3,h=3){
 const dirs=[[1,0],[0,1],[1,1],[1,-1]]; for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(const[dX,dY]of dirs){let line=[];for(let k=0;k<n;k++){const xx=x+dX*k,yy=y+dY*k;if(xx<0||xx>=w||yy<0||yy>=h){line=[];break}line.push(yy*w+xx)}if(line.length&&line.every(i=>board[i]!==null&&board[i]!==undefined&&board[i]===board[line[0]]))return line} return null;
}
GAMES.tictactoe={name:'Tic Tac Toe',category:'Board',players:2,init:()=>({board:Array(9).fill(null),turn:0}),move:(s,i,m)=>{if(i!==s.turn)return'Not your turn';const c=+m.cell;if(!Number.isInteger(c)||c<0||c>8||s.board[c]!=null)return'Invalid cell';s.board[c]=i;const line=winLines(s.board);if(line)return{winner:i,line};if(s.board.every(v=>v!==null))return{draw:true};s.turn=other(i)}};
GAMES.connect4={name:'Connect Four',category:'Board',players:2,init:()=>({board:Array.from({length:6},()=>Array(7).fill(null)),turn:0}),move:(s,i,m)=>{if(i!==s.turn)return'Not your turn';const c=+m.col;if(c<0||c>6)return'Invalid column';let r=5;while(r>=0&&s.board[r][c]!==null)r--;if(r<0)return'Column full';s.board[r][c]=i;s.last=[r,c];const dirs=[[1,0],[0,1],[1,1],[1,-1]];for(const[dX,dY]of dirs){let n=1;for(const sign of[-1,1]){let x=c+dX*sign,y=r+dY*sign;while(x>=0&&x<7&&y>=0&&y<6&&s.board[y][x]===i){n++;x+=dX*sign;y+=dY*sign}}if(n>=4)return{winner:i}}if(s.board[0].every(v=>v!==null))return{draw:true};s.turn=other(i)}};
GAMES.rps={name:'Rock Paper Scissors',category:'Party',players:2,init:()=>({choices:[null,null],score:[0,0],round:1,turn:0}),move:(s,i,m)=>{if(s.choices[i])return'Choice already submitted';if(!['rock','paper','scissors'].includes(m.choice))return'Invalid choice';s.choices[i]=m.choice;if(!s.choices[0]||!s.choices[1])return;const[a,b]=s.choices;let w=null;if(a!==b)w=['rock','paper','scissors'].indexOf(a)===(['rock','paper','scissors'].indexOf(b)+1)%3?0:1;if(w!==null)s.score[w]++;s.lastRound={choices:[a,b],winner:w};if(s.score.some(x=>x>=3))return w===null?{draw:true}:{winner:w};s.round++;s.choices=[null,null];s.turn=other(i)}};

// Chess: complete legal move generation for normal chess, castling, en-passant, promotion and check/checkmate/stalemate.
function shipBoard(){const b=Array.from({length:10},()=>Array(10).fill(0));const fleet=[5,4,3,3,2];for(const len of fleet){let placed=false;for(let tries=0;tries<500&&!placed;tries++){const hor=Math.random()<.5,x=Math.floor(Math.random()*(hor?11-len:10)),y=Math.floor(Math.random()*(hor?10:11-len));let ok=true;for(let k=0;k<len;k++)if(b[y+(hor?0:k)][x+(hor?k:0)])ok=false;if(ok){for(let k=0;k<len;k++)b[y+(hor?0:k)][x+(hor?k:0)]=len;placed=true}}}return b}
GAMES.battleship={name:'Battleship',category:'Strategy',players:2,init:()=>({boards:[shipBoard(),shipBoard()],shots:[[],[]],turn:0,hits:[0,0]}),move:(s,i,m)=>{if(i!==s.turn)return'Not your turn';const x=+m.x,y=+m.y;if(x<0||x>9||y<0||y>9)return'Invalid target';if(s.shots[i].some(p=>p[0]===x&&p[1]===y))return'Already fired';s.shots[i].push([x,y]);const target=s.boards[other(i)][y][x];if(target>0){s.boards[other(i)][y][x]=-target;s.hits[i]++}const remaining=s.boards[other(i)].flat().some(v=>v>0);if(!remaining)return{winner:i};s.turn=other(i)}};
GAMES.memory={name:'Memory Match',category:'Party',players:2,init:()=>{const vals=shuffle([...Array(8).keys(),...Array(8).keys()]);return{cards:vals.map(v=>({v,up:false,done:false})),turn:0,pick:[],score:[0,0],pendingMismatch:null}},move:(s,i,m)=>{if(i!==s.turn)return'Not your turn';if(s.pendingMismatch)return'Cards are resolving';const c=+m.card;if(c<0||c>=s.cards.length||s.cards[c].up||s.cards[c].done||s.pick.length>=2)return'Invalid card';s.cards[c].up=true;s.pick.push(c);if(s.pick.length<2)return{reveal:true};const[a,b]=s.pick;if(s.cards[a].v===s.cards[b].v){s.cards[a].done=s.cards[b].done=true;s.score[i]++;s.pick=[];if(s.cards.every(c=>c.done))return s.score[0]===s.score[1]?{draw:true}:{winner:s.score[0]>s.score[1]?0:1};return{match:true}}s.pendingMismatch={a,b,player:i};return{mismatch:true,delayMs:900}}};
function generateMines(n, mineCount, safe){
 const excluded=new Set([safe]);const sx=safe%n,sy=Math.floor(safe/n);
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const x=sx+dx,y=sy+dy;if(x>=0&&x<n&&y>=0&&y<n)excluded.add(y*n+x)}
 const mines=new Set();while(mines.size<mineCount){const z=Math.floor(Math.random()*n*n);if(!excluded.has(z))mines.add(z)}
 const board=Array.from({length:n*n},(_,i)=>mines.has(i)?-1:0);
 for(let i=0;i<board.length;i++)if(board[i]>=0){let x=i%n,y=Math.floor(i/n),count=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<n&&yy>=0&&yy<n&&board[yy*n+xx]===-1)count++}board[i]=count}
 return board;
}
function minesInit(){return{size:10,mineCount:12,board:null,revealed:[[],[]],flags:[[],[]],turn:0,started:false}}
GAMES.minesweeper={name:'Minesweeper Duel',category:'Arcade',players:2,init:minesInit,move:(s,i,m)=>{if(i!==s.turn)return'Not your turn';const c=+m.cell;if(c<0||c>=100||s.revealed[i].includes(c))return'Invalid cell';if(!s.started){s.board=generateMines(s.size,s.mineCount,c);s.started=true}if(s.board[c]===-1)return{winner:other(i),reason:'mine'};const flood=[c],seen=new Set([c]);while(flood.length){const q=flood.shift();if(!s.revealed[i].includes(q))s.revealed[i].push(q);if(s.board[q]===0){const x=q%10,y=Math.floor(q/10);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<10&&yy>=0&&yy<10){const z=yy*10+xx;if(!seen.has(z)&&s.board[z]>=0){seen.add(z);flood.push(z)}}}}}if(s.revealed[i].filter(z=>s.board[z]>=0).length>=88)return{winner:i,reason:'cleared'};s.turn=other(i)}};
GAMES.wordbattle={name:'Word Battle',category:'Party',players:2,init:()=>({turn:0,score:[0,0],round:1,target:'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random()*26)],used:[]}),move:(s,i,m)=>{if(i!==s.turn)return'Not your turn';const w=String(m.word||'').toLowerCase().trim();if(!/^[a-z]{3,12}$/.test(w))return'Use 3-12 letters';if(w[0]!==s.target)return'Word must start with '+s.target.toUpperCase();if(s.used.includes(w))return'Word already used';s.used.push(w);s.score[i]+=w.length;s.last={player:i,word:w,points:w.length};s.round++;if(s.round>12)return s.score[0]===s.score[1]?{draw:true}:{winner:s.score[0]>s.score[1]?0:1};s.target='abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random()*26)];s.turn=other(i)}};
GAMES.reaction={name:'Reaction Race',category:'Arcade',players:2,init:()=>({turn:0,scores:[0,0],phase:'ready',goAt:0,round:1}),move:(s,i,m)=>{if(i!==s.turn)return'Wait for your turn';if(s.phase==='ready'){s.phase='armed';s.goAt=Date.now()+1200+Math.floor(Math.random()*2200);return{armed:true}}if(s.phase==='armed'){if(Date.now()<s.goAt)return'False start';s.scores[i]++;if(s.scores[i]>=3)return{winner:i};s.turn=other(i);s.phase='ready';s.round++}}};

function vlen(x,y){return Vector.magnitude({x:Number(x)||0,y:Number(y)||0})||1}
function clamp01(n){return clamp(Number(n)||0,0,1)}

// Physical games below use deterministic fixed-step 2D simulation. The rules/geometry are
// deliberately kept server-side so clients cannot decide collisions, pockets or winners.
// The implementation is informed by established open-source browser game engines and
// billiards research; no third-party game repository is copied wholesale.
const POOL={W:1,H:.5,R:.0185,POCKET:.036,RAIL:.045,DT:1/120,MAX_STEPS:2400}
const POCKETS=[[0,0],[.5,0],[1,0],[0,POOL.H],[.5,POOL.H],[1,POOL.H]]
function rackBalls(){
  const balls=[];
  const apexX=.73,cy=.25,gap=POOL.R*2.04;
  const rack=[[1],[2,3],[4,8,5],[6,9,10,11],[12,13,14,15,7]];
  balls.push({id:0,number:0,type:'cue',group:'cue',x:.24,y:cy,vx:0,vy:0,pocketed:false});
  let id=1;
  for(let row=0;row<rack.length;row++){
    const x=apexX+row*gap*Math.cos(Math.PI/6);
    const y0=cy-row*gap/2;
    for(let k=0;k<rack[row].length;k++){
      const number=rack[row][k];
      const group=number===8?'eight':number<=7?'solid':'stripe';
      balls.push({id:number,number,type:group,group,x,y:y0+k*gap,vx:0,vy:0,pocketed:false});
      id++;
    }
  }
  return balls;
}
function poolInit(){return{balls:rackBalls(),turn:0,groups:[null,null],ballInHand:true,phase:'break',foul:false,firstContact:null,lastPocketed:[],shotNo:0,animation:[]}}
function poolPocketedCount(s,group){return s.balls.filter(b=>b.pocketed&&b.group===group).length}
function poolRemaining(s,i){const g=s.groups[i];return g?s.balls.some(b=>!b.pocketed&&b.group===g):true}
function poolCanShoot8(s,i){return s.groups[i]&&poolRemaining(s,i)===false}
function poolPlaceCue(s,x,y){
  const cue=s.balls[0]; x=clamp(Number(x),.09,.42); y=clamp(Number(y),.09,POOL.H-.09)
  const bad=s.balls.some(b=>!b.pocketed&&b.id!==0&&Math.hypot(b.x-x,b.y-y)<POOL.R*2.15)
  if(bad)return false
  cue.x=x;cue.y=y;cue.vx=cue.vy=0;cue.pocketed=false;return true
}
function poolShot(s,i,m){
  if(i!==s.turn)return'Not your turn'
  if(s.phase==='gameover')return'Game over'
  s.animation=[]
  if(s.ballInHand){
    if(!poolPlaceCue(s,m.cueX??.24,m.cueY??.25))return'Place the cue ball in an open position'
    if(m.placeOnly)return
  }
  const dx=Number(m.dx),dy=Number(m.dy),power=clamp01(m.power)
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||Math.hypot(dx,dy)<.01)return'Choose an aim direction'
  if(power<.04)return'Shot power is too low'
  const len=vlen(dx,dy);const cue=s.balls[0];cue.vx=dx/len*(2.4+8.4*power);cue.vy=dy/len*(2.4+8.4*power)
  for(const b of s.balls){b.vx=b.vx||0;b.vy=b.vy||0}
  s.ballInHand=false;s.foul=false;s.firstContact=null;s.lastPocketed=[]
  const frames=[]; let moving=true,steps=0
  const snapshot=()=>frames.push(s.balls.map(b=>({id:b.id,x:b.x,y:b.y,pocketed:b.pocketed})))
  snapshot()
  while(moving&&steps++<POOL.MAX_STEPS){
    moving=false
    for(const b of s.balls){
      if(b.pocketed)continue
      b.x+=b.vx*POOL.DT;b.y+=b.vy*POOL.DT
      const drag=Math.max(0,1-2.15*POOL.DT)
      b.vx*=drag;b.vy*=drag
      if(Math.hypot(b.vx,b.vy)>0.035)moving=true
      // cushion reflection, with pockets removed from the rail path
      if(b.x<POOL.R){b.x=POOL.R;b.vx=Math.abs(b.vx)*.91}
      if(b.x>1-POOL.R){b.x=1-POOL.R;b.vx=-Math.abs(b.vx)*.91}
      if(b.y<POOL.R){b.y=POOL.R;b.vy=Math.abs(b.vy)*.91}
      if(b.y>POOL.H-POOL.R){b.y=POOL.H-POOL.R;b.vy=-Math.abs(b.vy)*.91}
    }
    // Equal-mass elastic ball collision with positional correction.
    for(let a=0;a<s.balls.length;a++)for(let b=a+1;b<s.balls.length;b++){
      const A=s.balls[a],B=s.balls[b];if(A.pocketed||B.pocketed)continue
      let ox=B.x-A.x,oy=B.y-A.y,d=Math.hypot(ox,oy)
      if(d>0&&d<POOL.R*2){const nx=ox/d,ny=oy/d;const rv=(A.vx-B.vx)*nx+(A.vy-B.vy)*ny;if(rv<0){A.vx-=rv*nx;A.vy-=rv*ny;B.vx+=rv*nx;B.vy+=rv*ny}const push=(POOL.R*2-d)/2;A.x-=nx*push;A.y-=ny*push;B.x+=nx*push;B.y+=ny*push;if(!s.firstContact&&A.id===0)s.firstContact=B.id;if(!s.firstContact&&B.id===0)s.firstContact=A.id}
    }
    for(const b of s.balls){if(b.pocketed)continue;for(const [px,py] of POCKETS){if(Math.hypot(b.x-px,b.y-py)<POOL.POCKET){b.pocketed=true;b.vx=b.vy=0;s.lastPocketed.push(b.id);break}}}
    if(steps%10===0)snapshot()
  }
  snapshot()
  if(!s.firstContact)s.foul=true
  if(s.firstContact){const fc=s.balls.find(b=>b.id===s.firstContact);if(s.groups[i]&&fc&&fc.group!==s.groups[i]&&fc.group!=='eight')s.foul=true}
  const cuePocket=s.balls[0].pocketed
  const eightPocket=s.balls[8].pocketed
  const legalObject=s.lastPocketed.filter(id=>id!==0&&id!==8).map(id=>s.balls[id]).filter(Boolean)
  if(s.phase==='break'){
    s.phase='open'
    if(s.lastPocketed.some(id=>id!==0)){s.turn=i}else{s.turn=other(i)}
  }else if(eightPocket){
    if(s.foul||poolRemaining(s,i))return finishPool(s,i,false,'illegal_8')
    return finishPool(s,i,true,'legal_8')
  }else if(cuePocket||s.foul){
    if(cuePocket){s.balls[0].pocketed=false;poolPlaceCue(s,.24,.25)}
    s.ballInHand=true;s.turn=other(i)
  }else if(legalObject.length){
    if(s.groups[i]===null){const first=legalObject[0].group;if(first==='solid'||first==='stripe'){s.groups[i]=first;s.groups[other(i)]=first==='solid'?'stripe':'solid'}}
    const ownPocket=legalObject.some(b=>b.group===s.groups[i])
    s.turn=ownPocket?i:other(i)
  }else s.turn=other(i)
  s.shotNo++;s.animation=frames.slice(-90);return {animation:true}
}
function finishPool(s,i,win,reason){s.phase='gameover';s.winner=i;s.winReason=reason;s.animation=[];return win?{winner:i,reason:'8-ball'}:{winner:other(i),reason:'illegal 8-ball'} }
GAMES.pool={name:'8-Ball Pool',category:'Sports',players:2,init:poolInit,move:poolShot}

function carromInit(){
  const coins=[];const cx=.5,cy=.5,r=.037
  coins.push({id:0,color:'red',x:cx,y:cy,vx:0,vy:0,pocketed:false})
  let id=1
  for(let ring=1;ring<=2;ring++)for(let k=0;k<ring*6;k++){const a=(Math.PI*2*k)/(ring*6)+(ring===2?.13:0);coins.push({id,color:k%2?'black':'white',x:cx+Math.cos(a)*r*ring*1.65,y:cy+Math.sin(a)*r*ring*1.65,vx:0,vy:0,pocketed:false});id++}
  return{turn:0,coins,scores:[0,0],striker:{x:.5,y:.89,vx:0,vy:0,pocketed:false},animation:[],queenOwner:null,phase:'playing',foul:false}
}
const CARROM={R:.022,STRIKER:.031,DT:1/120,MAX:1800,pockets:[[.07,.07],[.93,.07],[.07,.93],[.93,.93]]}
function carromMove(s,i,m){
  if(i!==s.turn)return'Not your turn';s.animation=[]
  const sideY=i===0?.88:.12;const sx=clamp(Number(m.x??.5),.16,.84),sy=sideY;const dx=Number(m.dx),dy=Number(m.dy),power=clamp01(m.power);if(Math.hypot(dx,dy)<.01)return'Aim before shooting'
  s.striker={x:sx,y:sy,vx:dx/vlen(dx,dy)*(1.4+5.6*power),vy:dy/vlen(dx,dy)*(1.4+5.6*power),pocketed:false};s.foul=false
  const frames=[];const snap=()=>frames.push({striker:{...s.striker},coins:s.coins.map(c=>({id:c.id,x:c.x,y:c.y,pocketed:c.pocketed}))});snap();let moving=true,step=0,scored=0
  while(moving&&step++<CARROM.MAX){moving=false;const pieces=[s.striker,...s.coins]
    for(const b of pieces){if(b.pocketed)continue;b.x+=b.vx*CARROM.DT;b.y+=b.vy*CARROM.DT;b.vx*=.985;b.vy*=.985;if(Math.hypot(b.vx,b.vy)>.02)moving=true;if(b.x<CARROM.R){b.x=CARROM.R;b.vx=Math.abs(b.vx)*.92}if(b.x>1-CARROM.R){b.x=1-CARROM.R;b.vx=-Math.abs(b.vx)*.92}if(b.y<CARROM.R){b.y=CARROM.R;b.vy=Math.abs(b.vy)*.92}if(b.y>1-CARROM.R){b.y=1-CARROM.R;b.vy=-Math.abs(b.vy)*.92}}
    for(let a=0;a<pieces.length;a++)for(let b=a+1;b<pieces.length;b++){const A=pieces[a],B=pieces[b];if(A.pocketed||B.pocketed)continue;let ox=B.x-A.x,oy=B.y-A.y,d=Math.hypot(ox,oy),rad=(A===s.striker?CARROM.STRIKER:CARROM.R)+(B===s.striker?CARROM.STRIKER:CARROM.R);if(d>0&&d<rad){const nx=ox/d,ny=oy/d,rv=(A.vx-B.vx)*nx+(A.vy-B.vy)*ny;if(rv<0){A.vx-=rv*nx;A.vy-=rv*ny;B.vx+=rv*nx;B.vy+=rv*ny}const push=(rad-d)/2;A.x-=nx*push;A.y-=ny*push;B.x+=nx*push;B.y+=ny*push}}
    for(const b of pieces){if(b.pocketed)continue;for(const [px,py] of CARROM.pockets){if(Math.hypot(b.x-px,b.y-py)<.055){b.pocketed=true;b.vx=b.vy=0;if(b===s.striker)s.foul=true;else{scored++;if(b.color==='red')s.queenOwner=i;s.scores[i]+=b.color==='red'?3:1}break}}}
    if(step%12===0)snap()
  }snap();s.animation=frames.slice(-100);if(s.coins.every(c=>c.pocketed)){return s.scores[0]===s.scores[1]?{draw:true}:{winner:s.scores[0]>s.scores[1]?0:1}}
  s.striker.pocketed=false;s.striker.x=.5;s.striker.y=sideY;s.striker.vx=s.striker.vy=0;s.turn=scored&&!s.foul?i:other(i);return{animation:true}
}
GAMES.carrom={name:'Carrom',category:'Sports',players:2,init:carromInit,move:carromMove}

function golfInit(){return{turn:0,strokes:[0,0],balls:[{x:.12,y:.86,vx:0,vy:0},{x:.12,y:.86,vx:0,vy:0}],done:[false,false],hole:{x:.86,y:.14,r:.045},walls:[{x1:.28,y1:.18,x2:.28,y2:.62},{x1:.28,y1:.62,x2:.68,y2:.62},{x1:.68,y1:.38,x2:.68,y2:.82},{x1:.40,y1:.38,x2:.68,y2:.38}],animation:[]}}
const GOLF={R:.025,DT:1/120,MAX:1600}
function segBounce(p,v,w){const ax=w.x1,ay=w.y1,bx=w.x2,by=w.y2,dx=bx-ax,dy=by-ay,l=Math.hypot(dx,dy)||1;const t=clamp(((p.x-ax)*dx+(p.y-ay)*dy)/(l*l),0,1),qx=ax+t*dx,qy=ay+t*dy,d=Math.hypot(p.x-qx,p.y-qy);if(d<GOLF.R+.008){const nx=(p.x-qx)/(d||1),ny=(p.y-qy)/(d||1);const vn=v.x*nx+v.y*ny;if(vn<0){v.x-=1.7*vn*nx;v.y-=1.7*vn*ny}p.x=qx+nx*(GOLF.R+.009);p.y=qy+ny*(GOLF.R+.009)}}
function golfMove(s,i,m){if(i!==s.turn)return'Not your turn';s.animation=[];if(s.done[i])return'You already holed out';const dx=Number(m.dx),dy=Number(m.dy),power=clamp01(m.power);if(Math.hypot(dx,dy)<.01)return'Aim before shooting';const b=s.balls[i];b.vx=dx/vlen(dx,dy)*(1.2+5.2*power);b.vy=dy/vlen(dx,dy)*(1.2+5.2*power);s.strokes[i]++;const frames=[];const snap=()=>frames.push({balls:s.balls.map(x=>({x:x.x,y:x.y,vx:x.vx,vy:x.vy,done:s.done[s.balls.indexOf(x)]}))});snap();let step=0,moving=true;while(moving&&step++<GOLF.MAX){moving=false;for(const ball of s.balls){if(ball!==b||s.done[i])continue;ball.x+=ball.vx*GOLF.DT;ball.y+=ball.vy*GOLF.DT;ball.vx*=.988;ball.vy*=.988;for(const w of s.walls)segBounce(ball,ball,w);if(Math.hypot(ball.vx,ball.vy)>.02)moving=true;const d=Math.hypot(ball.x-s.hole.x,ball.y-s.hole.y);if(d<s.hole.r){s.done[i]=true;ball.vx=ball.vy=0;ball.x=s.hole.x;ball.y=s.hole.y;moving=false}}if(step%10===0)snap()}snap();s.animation=frames.slice(-100);if(s.done.every(Boolean))return s.strokes[0]===s.strokes[1]?{draw:true}:{winner:s.strokes[0]<s.strokes[1]?0:1};s.turn=other(i);return{animation:true}}
GAMES.minigolf={name:'Mini Golf',category:'Sports',players:2,init:golfInit,move:golfMove}

function racingInit(){return{players:[{x:.18,y:.78,angle:-Math.PI/2,speed:0,lap:0,progress:0,health:1},{x:.18,y:.86,angle:-Math.PI/2,speed:0,lap:0,progress:0,health:1}],inputs:[{up:false,left:false,right:false,brake:false},{up:false,left:false,right:false,brake:false}],started:Date.now(),winner:null,finished:false}}
GAMES.racing={name:'Neon Circuit Racing',category:'Racing',players:2,init:racingInit,move:(s,i,m)=>{s.inputs[i]={up:!!m.up,left:!!m.left,right:!!m.right,brake:!!m.brake};return}}


// ---------------------------------------------------------------------------
// SOURCE-BACKED RULE ENGINES
// These adapters replace the earlier hand-written chess/checkers rule paths.
// The rest of NEXUS keeps the same Socket.IO protocol and UI state shape.
// ---------------------------------------------------------------------------
function sourceChessInit(){
  const g=new Chess();
  return {fen:g.fen(),history:[],turn:0,pgn:'',status:'playing'};
}
function sourceChessMove(s,i,m){
  const g=new Chess();
  try{for(const san of s.history||[])g.move(san);}catch{return'Invalid chess history'}
  const expected=g.turn()==='w'?0:1;
  if(i!==expected)return'Not your turn';
  if(typeof m?.from!=='string'||typeof m?.to!=='string')return'Invalid square';
  let mv;
  try{mv=g.move({from:m.from,to:m.to,promotion:m.promotion||'q'});}catch{return'Illegal chess move'}
  s.fen=g.fen();
  s.history=g.history();
  s.pgn=g.pgn();
  s.status=g.isGameOver()?'finished':'playing';
  s.turn=g.turn()==='w'?0:1;
  if(g.isCheckmate())return{winner:i,reason:'checkmate'};
  if(g.isStalemate())return{draw:true,reason:'stalemate'};
  if(g.isThreefoldRepetition())return{draw:true,reason:'threefold repetition'};
  if(g.isDrawByFiftyMoves())return{draw:true,reason:'fifty-move rule'};
  if(g.isInsufficientMaterial())return{draw:true,reason:'insufficient material'};
  return{move:mv.san};
}
GAMES.chess={name:'Chess',category:'Strategy',players:2,init:sourceChessInit,move:sourceChessMove};

function checkerBoardFromGame(g){
  const out=Array.from({length:8},()=>Array(8).fill(null));
  const board=g.board;
  for(let idx=0;idx<64;idx++){
    const cell=board[idx];
    if(!cell?.dark)continue;
    const x=idx%8,y=Math.floor(idx/8),p=cell.piece;
    if(p)out[y][x]=p.player==='light'?(p.king?2:0):(p.king?3:1);
  }
  return out;
}
function checkerStateData(g){
  const d=g.engine.data;
  return {player:d.player,board:{light:d.board.light,dark:d.board.dark,king:d.board.king},stats:{...d.stats}};
}
function checkerCoordsFromGame(g){
  const coords=Array.from({length:32},()=>null);
  for(let i=0;i<g.board.length;i++){const c=g.board[i];if(c?.dark&&c.position!=null)coords[c.position]={x:i%8,y:Math.floor(i/8)}}
  return coords;
}
function checkerGameFromState(s){
  // engineData already contains the authoritative current board/player/stats.
  // Replaying history on top of it would apply every move twice and corrupt turn state.
  return EnglishDraughts.setup(s.engineData||undefined);
}
function checkerMovesList(g){return g.moves.map(m=>({from:m.origin,to:m.destination,captures:[...(m.captures||[])]}))}
function sourceCheckersInit(){
  const g=EnglishDraughts.setup();
  return {board:checkerBoardFromGame(g),coords:checkerCoordsFromGame(g),legalMoves:checkerMovesList(g),engineData:checkerStateData(g),history:[],turn:0,status:'playing'};
}
function sourceCheckersMove(s,i,m){
  const g=checkerGameFromState(s);
  const expected=g.player==='dark'?0:1;
  if(i!==expected)return'Not your turn';
  const from=Number(m?.from),to=Number(m?.to);
  if(!Number.isInteger(from)||!Number.isInteger(to))return'Invalid checkers move';
  const move=g.moves.find(x=>x.origin===from&&x.destination===to);
  if(!move)return'Illegal checkers move';
  g.move(move);
  s.engineData=checkerStateData(g);
  s.board=checkerBoardFromGame(g);
  s.coords=checkerCoordsFromGame(g);
  s.legalMoves=checkerMovesList(g);
  s.history.push({origin:from,destination:to,captures:[...(move.captures||[])]});
  s.turn=g.player==='dark'?0:1;
  s.status=String(g.status);
  if(g.status==='light_won')return{winner:0,reason:'no legal moves or pieces'};
  if(g.status==='dark_won')return{winner:1,reason:'no legal moves or pieces'};
  if(g.status==='draw')return{draw:true,reason:'draw'};
  return;
}
GAMES.checkers={name:'Checkers',category:'Strategy',players:2,init:sourceCheckersInit,move:sourceCheckersMove};

// Additional classic games adapted from the MIT-licensed LittleJS-AI collection:
// https://github.com/rkendel1/ganes
function merge2048Line(line){const a=line.filter(Boolean),out=[];let score=0;for(let i=0;i<a.length;i++){if(a[i]===a[i+1]){out.push(a[i]*2);score+=a[i]*2;i++;}else out.push(a[i])}while(out.length<line.length)out.push(0);return{line:out,score}}
function move2048(b,dir){const out=b.slice();let score=0;const readLine=(idxs)=>{const row=idxs.map(i=>b[i]);const q=merge2048Line(row);idxs.forEach((i,k)=>out[i]=q.line[k]);score+=q.score};for(let y=0;y<4;y++){const ids=[0,1,2,3].map(x=>y*4+x);if(dir==='left')readLine(ids);else if(dir==='right')readLine(ids.reverse())}for(let x=0;x<4;x++){const ids=[0,1,2,3].map(y=>y*4+x);if(dir==='up')readLine(ids);else if(dir==='down')readLine(ids.reverse())}return{board:out,score,changed:b.some((v,i)=>v!==out[i])}}
function spawn2048(b){const free=[];for(let i=0;i<16;i++)if(!b[i])free.push(i);if(!free.length)return b.slice();const o=b.slice();o[free[Math.floor(Math.random()*free.length)]]=Math.random()<.9?2:4;return o}
function can2048(b){for(let y=0;y<4;y++)for(let x=0;x<4;x++){const i=y*4+x;if(!b[i])return true;if(x<3&&b[i]===b[i+1])return true;if(y<3&&b[i]===b[i+4])return true}return false}
GAMES.game2048={name:'2048 Duel',category:'Puzzle',players:2,init:()=>{let b=spawn2048(Array(16).fill(0));b=spawn2048(b);return{board:b,score:[0,0],turn:0,moves:0}},move:(s,i,m)=>{if(i!==s.turn)return'Not your turn';const d=String(m.dir||'');if(!['up','down','left','right'].includes(d))return'Invalid direction';const q=move2048(s.board,d);if(!q.changed)return'No tiles moved';s.board=spawn2048(q.board);s.score[i]+=q.score;s.moves++;if(s.board.includes(2048))return{winner:i,reason:'2048 reached'};if(!can2048(s.board))return s.score[0]===s.score[1]?{draw:true}:{winner:s.score[0]>s.score[1]?0:1};s.turn=other(i)}};
const TET=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],[[1,1,0],[0,1,1]],[[0,1,1],[1,1,0]]];
function tetRot(p){const h=p.length,w=p[0].length,o=Array.from({length:w},()=>Array(h).fill(0));for(let y=0;y<h;y++)for(let x=0;x<w;x++)o[x][h-1-y]=p[y][x];return o}
function tetShape(t,r){let p=TET[t];for(let i=0;i<r;i++)p=tetRot(p);return p}
function tetCan(p,t,r,x,y){const sh=tetShape(t,r);for(let yy=0;yy<sh.length;yy++)for(let xx=0;xx<sh[yy].length;xx++)if(sh[yy][xx]){const X=x+xx,Y=y+yy;if(X<0||X>=10||Y>=20)return false;if(Y>=0&&p.board[Y*10+X])return false}return true}
function tetBag(){return shuffle([0,1,2,3,4,5,6])}
function tetPlayer(){const q=[...tetBag(),...tetBag()];return{board:Array(200).fill(0),type:q.shift(),next:q,x:3,y:0,rot:0,score:0,lines:0,alive:true,lastDrop:Date.now()}}
function tetLock(p){const sh=tetShape(p.type,p.rot);for(let y=0;y<sh.length;y++)for(let x=0;x<sh[y].length;x++)if(sh[y][x])p.board[(p.y+y)*10+p.x+x]=p.type+1;let lines=0;for(let y=19;y>=0;y--){if(p.board.slice(y*10,y*10+10).every(Boolean)){p.board.splice(y*10,10);p.board.unshift(...Array(10).fill(0));lines++;y++}}p.lines+=lines;p.score+=[0,100,300,500,800][lines]||0;p.type=p.next.shift();if(!p.next.length)p.next.push(...tetBag());p.x=3;p.y=0;p.rot=0;p.lastDrop=Date.now();if(!tetCan(p,p.type,p.rot,p.x,p.y))p.alive=false}
GAMES.tetris={name:'Tetris Duel',category:'Puzzle',players:2,init:()=>({players:[tetPlayer(),tetPlayer()]}),move:(s,i,m)=>{const p=s.players[i],a=String(m.action||'');if(!p.alive)return'Game over';if(a==='left'&&tetCan(p,p.type,p.rot,p.x-1,p.y))p.x--;else if(a==='right'&&tetCan(p,p.type,p.rot,p.x+1,p.y))p.x++;else if(a==='rotate'&&tetCan(p,p.type,(p.rot+1)%4,p.x,p.y))p.rot=(p.rot+1)%4;else if(a==='down'&&tetCan(p,p.type,p.rot,p.x,p.y+1))p.y++;else if(a==='drop'){while(tetCan(p,p.type,p.rot,p.x,p.y+1))p.y++;tetLock(p)}},tick:s=>{const now=Date.now();for(const p of s.players)if(p.alive&&now-p.lastDrop>=600){if(tetCan(p,p.type,p.rot,p.x,p.y+1))p.y++;else tetLock(p)}const dead=s.players.filter(p=>!p.alive).length;if(dead===2)return{draw:true};if(dead===1)return{winner:s.players[0].alive?0:1,reason:'top-out'}}};
function snakeState(){return{width:24,height:18,snakes:[{body:[[5,9],[4,9],[3,9]],dir:[1,0],next:[1,0],alive:true,score:0},{body:[[18,9],[19,9],[20,9]],dir:[-1,0],next:[-1,0],alive:true,score:0}],food:[12,9],lastTick:Date.now()}}
function snakeFood(s){const occ=new Set(s.snakes.flatMap(a=>a.body.map(([x,y])=>x+','+y))),free=[];for(let y=0;y<s.height;y++)for(let x=0;x<s.width;x++)if(!occ.has(x+','+y))free.push([x,y]);s.food=free[Math.floor(Math.random()*free.length)]||[12,9]}
GAMES.snake={name:'Snake Arena',category:'Arcade',players:2,init:snakeState,move:(s,i,m)=>{const d=String(m.dir||''),map={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};if(!map[d])return'Invalid direction';const a=s.snakes[i],n=map[d];if(n[0]===-a.next[0]&&n[1]===-a.next[1])return'Cannot reverse';a.next=n.slice()},tick:s=>{const now=Date.now();if(now-s.lastTick<120)return;s.lastTick=now;const heads=s.snakes.map(a=>[a.body[0][0]+a.next[0],a.body[0][1]+a.next[1]]);for(let i=0;i<2;i++){const [x,y]=heads[i];if(x<0||x>=s.width||y<0||y>=s.height||s.snakes[i].body.some((p,j)=>j>0&&p[0]===x&&p[1]===y))s.snakes[i].alive=false;if(heads[0][0]===heads[1][0]&&heads[0][1]===heads[1][1]){s.snakes[0].alive=false;s.snakes[1].alive=false}}for(let i=0;i<2;i++){const a=s.snakes[i];if(!a.alive)continue;a.dir=a.next.slice();a.body.unshift(heads[i]);if(heads[i][0]===s.food[0]&&heads[i][1]===s.food[1]){a.score++;snakeFood(s)}else a.body.pop()}if(s.snakes.every(a=>!a.alive))return{draw:true};if(s.snakes.some(a=>a.score>=10))return{winner:s.snakes[0].score>s.snakes[1].score?0:1,reason:'10 food'};if(s.snakes.filter(a=>!a.alive).length===1)return{winner:s.snakes[0].alive?0:1,reason:'collision'}}};

function othelloInit(){const b=Array.from({length:8},()=>Array(8).fill(null));b[3][3]=1;b[3][4]=0;b[4][3]=0;b[4][4]=1;return{board:b,turn:0,scores:[2,2],passes:0}}
function othelloMoves(s,i){const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],out=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++){if(s.board[y][x]!=null)continue;let legal=false;for(const[dX,dY]of dirs){let xx=x+dX,yy=y+dY,seen=false;while(xx>=0&&xx<8&&yy>=0&&yy<8&&s.board[yy][xx]===other(i)){seen=true;xx+=dX;yy+=dY}if(seen&&xx>=0&&xx<8&&yy>=0&&yy<8&&s.board[yy][xx]===i){legal=true;break}}if(legal)out.push(y*8+x)}return out}
function othelloMove(s,i,m){if(i!==s.turn)return'Not your turn';const cell=Number(m.cell);if(!Number.isInteger(cell)||cell<0||cell>=64)return'Invalid square';const y=Math.floor(cell/8),x=cell%8,moves=othelloMoves(s,i);if(!moves.includes(cell))return'Illegal Othello move';const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];s.board[y][x]=i;for(const[dX,dY]of dirs){const line=[];let xx=x+dX,yy=y+dY;while(xx>=0&&xx<8&&yy>=0&&yy<8&&s.board[yy][xx]===other(i)){line.push([xx,yy]);xx+=dX;yy+=dY}if(line.length&&xx>=0&&xx<8&&yy>=0&&yy<8&&s.board[yy][xx]===i)for(const[fx,fy]of line)s.board[fy][fx]=i}s.scores=[0,0];for(const row of s.board)for(const v of row)if(v===0||v===1)s.scores[v]++;s.turn=other(i);const next=othelloMoves(s,s.turn);if(!next.length){s.passes++;s.turn=i;const again=othelloMoves(s,i);if(!again.length)return s.scores[0]===s.scores[1]?{draw:true,reason:'no legal moves'}:{winner:s.scores[0]>s.scores[1]?0:1,reason:'board complete'};}else s.passes=0}
GAMES.othello={name:'Othello',category:'Strategy',players:2,init:othelloInit,move:othelloMove};

function pongInit(){return{paddles:[.5,.5],ball:{x:.5,y:.5,vx:.42,vy:.17},scores:[0,0],inputs:[0,0],lastTick:Date.now()}}
GAMES.pong={name:'Pong',category:'Arcade',players:2,init:pongInit,move:(s,i,m)=>{const axis=Number(m.axis);if(!Number.isFinite(axis)||Math.abs(axis)>1)return'Invalid paddle input';s.inputs[i]=clamp(axis,-1,1)}};




/* -------------------------------------------------------------------------- */
/* Source-engine integrations. The complete upstream snapshots live under   */
/* third_party/source-games and their licenses are retained alongside them.  */
/* -------------------------------------------------------------------------- */
const {sourceDotsBoxesInit,sourceDotsBoxesMove,sourceCarromInit,sourceCarromMove,sourceGomokuInit,sourceGomokuMove,sourceBackgammonInit,sourceBackgammonMove}=require('./sourceGames');
GAMES.carrom={name:'Carrom',category:'Sports',players:2,init:sourceCarromInit,move:sourceCarromMove};
GAMES.dotsboxes={name:'Dots & Boxes',category:'Board',players:2,init:sourceDotsBoxesInit,move:sourceDotsBoxesMove};
GAMES.gomoku={name:'Gomoku',category:'Strategy',players:2,init:sourceGomokuInit,move:sourceGomokuMove};
GAMES.backgammon={name:'Backgammon',category:'Strategy',players:2,init:sourceBackgammonInit,move:sourceBackgammonMove};

module.exports={GAMES,poolInit,poolShot,carromInit,carromMove,golfInit,golfMove,racingInit,sourceDotsBoxesInit,sourceDotsBoxesMove,sourceCarromInit,sourceCarromMove,sourceGomokuInit,sourceGomokuMove,sourceBackgammonInit,sourceBackgammonMove};
