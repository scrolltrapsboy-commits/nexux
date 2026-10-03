'use strict';

const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.join(__dirname,'..','third_party','source-games','pong-enricolucia');
let runtime;

function loadSource(){
  if(runtime)return runtime;
  const srcBall=fs.readFileSync(path.join(ROOT,'ball.es6.js'),'utf8');
  const srcActor=fs.readFileSync(path.join(ROOT,'actor.es6.js'),'utf8');
  const srcPong=fs.readFileSync(path.join(ROOT,'pong.es6.js'),'utf8')
    .replace(/^import .*$/gm,'')
    .replace(/^export class Pong/, 'class Pong')
    .replace(/var\s+win = window,\s*doc = document;/,'var win = window, doc = document;')
    .replace(/var\s+_ctx = _ctx \|\| null,\s*_io = _io \|\| null,\s*istance = null;/,'var _ctx = null, _io = null, istance = null;');
  const ctx=vm.createContext({
    console,
    window:{innerWidth:1000,innerHeight:560,screen:{width:1000,height:560}},
    document:{querySelector:()=>({classList:{add(){},remove(){}}}),createElement:()=>({className:'',style:{},textContent:'',classList:{add(){},remove(){}}}),body:{appendChild(){}}},
    sessionStorage:{getItem:()=> 'left'},
    requestAnimationFrame:()=>0,
    cancelAnimationFrame:()=>0,
    setTimeout:()=>0,
    clearTimeout:()=>0
  });
  vm.runInContext(srcBall.replace(/^export class Ball/,'class Ball')+'\nglobalThis.Ball=Ball;',ctx,{filename:'pong-source-ball.js'});
  vm.runInContext(srcActor.replace(/^export class Actor/,'class Actor')+'\nglobalThis.Actor=Actor;',ctx,{filename:'pong-source-actor.js'});
  vm.runInContext(srcPong+'\nglobalThis.Pong=Pong;',ctx,{filename:'pong-source.js'});
  runtime=ctx;
  return runtime;
}

const W=1000,H=560;
function sourcePongInit(){
  const ctx=loadSource(), Ball=ctx.Ball, Actor=ctx.Actor;
  const actors=[
    new Actor(10,220,20,120,null,H,W,'left'),
    new Actor(W-30,220,20,120,null,H,W,'right')
  ];
  const ball=new Ball(W/2,H/2,null,W,H,'left');
  ball.x_speed=5;ball.y_speed=5;ball.radius=10;ball.dirPlayer='y';ball.boundaryX='right';ball.boundaryY='bottom';ball.dirX=1;ball.dirY=1;
  const s={paddles:[.5,.5],ball:{x:.5,y:.5,vx:.5,vy:.5},scores:[0,0],inputs:[0,0]};
  Object.defineProperty(s,'__source',{value:{ctx,ball,actors},enumerable:false,writable:true});
  sourcePongSync(s);
  return s;
}
function sourcePongSync(s){
  const q=s.__source;
  s.paddles=q.actors.map(a=>clamp(a.coords.y+a.height/2,0,H)/H);
  s.ball={x:clamp(q.ball.x,0,W)/W,y:clamp(q.ball.y,0,H)/H,vx:q.ball.x_speed*q.ball.dirX/W,vy:q.ball.y_speed*q.ball.dirY/H};
  return s;
}
function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function sourcePongMove(s,i,m={}){
  const axis=Number(m.axis);
  if(!Number.isFinite(axis)||Math.abs(axis)>1)return'Invalid paddle input';
  const q=s.__source;if(!q)return'Source Pong runtime unavailable';
  const a=q.actors[i];
  a.coords.y=clamp(Number(s.paddles[i]??.5)*H-a.height/2,0,H-a.height);
  s.inputs[i]=axis;
  a.coords.y=clamp(a.coords.y+axis*36,0,H-a.height);
  sourcePongSync(s);
}
function sourcePongTick(s){
  const q=s.__source;if(!q)return;
  const {ball,actors,ctx,Pong}=q;
  actors.forEach((a,i)=>{
    const axis=Number(s.inputs[i]||0);
    a.coords.y=clamp(a.coords.y+axis*18,0,H-a.height);
  });
  const beforeX=ball.x;
  let collision=false;
  const pitchForBall=ball.x<W/2?'left':'right';
  const proto=Pong.prototype;
  const test0={ball,actor:actors[0],pitch:'left',dirPlayer:'y'};
  const test1={ball,actor:actors[1],pitch:'right',dirPlayer:'y'};
  if(ball.x<=W+ball.radius&&ball.x>=-ball.radius){
    const hit0=proto.checkCollision.call(test0,'y');
    const hit1=proto.checkCollision.call(test1,'y');
    collision=hit0||hit1||false;
  }
  ball.update(collision||false);
  if(ball.x< -ball.radius){
    s.scores[1]++;ball.reset(W,H);ball.dirX=1;ball.dirY=Math.random()<.5?1:-1;
  }else if(ball.x>W+ball.radius){
    s.scores[0]++;ball.reset(W,H);ball.dirX=-1;ball.dirY=Math.random()<.5?1:-1;
  }
  if(s.scores[0]>=7||s.scores[1]>=7){
    const winner=s.scores[0]>=7?0:1;
    sourcePongSync(s);
    return{winner,reason:'7 points'};
  }
  sourcePongSync(s);
  return;
}

const PONG_SOURCE={name:'Pong',category:'Arcade',players:2,sourceName:'enricolucia/pong',sourceLicense:'MIT',init:sourcePongInit,move:sourcePongMove,tick:sourcePongTick};
module.exports={PONG_SOURCE};
