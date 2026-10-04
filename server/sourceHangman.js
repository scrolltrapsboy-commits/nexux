'use strict';

const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.join(__dirname,'..','third_party','source-games','hangman');

let wordSource;
function loadWordList(){
  if(wordSource)return wordSource;
  const src=fs.readFileSync(path.join(ROOT,'word-list.js'),'utf8');
  const ctx=vm.createContext({console});
  vm.runInContext(src+'\nglobalThis.__NEXUS_WORD_LIST=wordList;',ctx,{filename:'hangman-word-list.js'});
  wordSource=ctx.__NEXUS_WORD_LIST.map(x=>({word:String(x.word).toLowerCase(),hint:String(x.hint)}));
  return wordSource;
}
function randomWord(exclude=new Set()){
  const words=loadWordList().filter(x=>!exclude.has(x.word));
  if(!words.length)return loadWordList()[Math.floor(Math.random()*loadWordList().length)];
  return words[Math.floor(Math.random()*words.length)];
}
function makePlayer(p,used){
  const pick=randomWord(used);used.add(pick.word);
  return {
    id:p.id,name:p.name,
    currentWord:pick.word,hint:pick.hint,
    correctLetters:[],wrongGuessCount:0,usedLetters:[],
    solved:false,lost:false,score:0
  };
}
function displayWord(p){
  return [...p.currentWord].map(ch=>p.correctLetters.includes(ch)?ch:'_').join(' ');
}
function getStateForPlayer(state,viewer){
  const me=state.players.findIndex(p=>p.id===viewer);
  return {
    players:state.players.map((p,i)=>({
      id:p.id,name:p.name,
      wordLength:p.currentWord.length,
      display:displayWord(p),
      hint:i===me?p.hint:'Hidden hint',
      correctLetters:i===me?p.correctLetters.slice():[],
      usedLetters:i===me?p.usedLetters.slice():[],
      wrongGuessCount:i===me?p.wrongGuessCount:0,
      maxGuesses:6,
      solved:p.solved,lost:p.lost,score:p.score
    })),
    turn:null,
    phase:state.phase,
    winner:state.winner
  };
}
function init(players=[]){
  const ps=players.length?players:[{id:'p0',name:'Player 1'},{id:'p1',name:'Player 2'}];
  const used=new Set();
  return {
    players:ps.map(p=>makePlayer(p,used)),
    phase:'playing',winner:null,source:'tmatth11/hangman'
  };
}
function move(state,i,msg={}){
  if(state.phase!=='playing')return'Game over';
  const p=state.players[i];
  if(!p)return'Player not found';
  const letter=String(msg.letter||'').toLowerCase();
  if(!/^[a-z]$/.test(letter))return'Choose one letter';
  if(p.usedLetters.includes(letter))return'Letter already used';
  p.usedLetters.push(letter);
  const before=p.correctLetters.length;
  if(p.currentWord.includes(letter)){
    [...p.currentWord].forEach(ch=>{if(ch===letter)p.correctLetters.push(ch)});
  }else p.wrongGuessCount++;
  if(p.correctLetters.length===p.currentWord.length){
    p.solved=true;p.score=100;
    state.phase='finished';state.winner=i;
    return{winner:i,reason:'word solved'};
  }
  if(p.wrongGuessCount>=6){
    p.lost=true;p.score=0;
    if(state.players.every(x=>x.solved||x.lost)){
      state.phase='finished';
      return state.players[0].score===state.players[1].score?{draw:true,reason:'both players failed'}:{winner:state.players[0].score>state.players[1].score?0:1,reason:'source hangman score'};
    }
  }
  return{progress:true,correct:p.correctLetters.length>before};
}
const HANGMAN_SOURCE={
  name:'Hangman',
  category:'Word',
  players:2,
  sourceName:'tmatth11/hangman',
  sourceLicense:'MIT',
  init,
  move,
  getStateForPlayer
};
module.exports={HANGMAN_SOURCE,loadWordList};
