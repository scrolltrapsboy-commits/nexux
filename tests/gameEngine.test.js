const test=require('node:test');
const assert=require('node:assert/strict');
const {GAMES,chessFromFen,legalChessMoves}=require('../server/gameEngine');

test('all game engines expose two-player lifecycle',()=>{
  assert.equal(Object.keys(GAMES).length,14);
  for(const [id,g] of Object.entries(GAMES)){assert.equal(g.players,2,`${id} players`);assert.ok(g.init);assert.ok(g.move)}
});
test('tic tac toe detects a row',()=>{const s=GAMES.tictactoe.init();GAMES.tictactoe.move(s,0,{cell:0});GAMES.tictactoe.move(s,1,{cell:3});GAMES.tictactoe.move(s,0,{cell:1});GAMES.tictactoe.move(s,1,{cell:4});const out=GAMES.tictactoe.move(s,0,{cell:2});assert.deepEqual(out.winner,0)});
test('connect four detects four',()=>{const s=GAMES.connect4.init();for(const c of [0,1,0,1,0,1,0]){const i=s.turn;const out=GAMES.connect4.move(s,i,{col:c});if(out)assert.equal(out.winner,0)}assert.equal(s.board[2][0],0)});
test('chess initial position has 20 legal moves',()=>{const s=chessFromFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');assert.equal(legalChessMoves(s).length,20)});
test('checkers requires capture',()=>{const s=GAMES.checkers.init();s.board=Array.from({length:8},()=>Array(8).fill(null));s.board[5][0]=0;s.board[4][1]=1;s.turn=0;assert.equal(GAMES.checkers.move(s,0,{fx:0,fy:5,tx:1,ty:4}),'A capture is mandatory');const out=GAMES.checkers.move(s,0,{fx:0,fy:5,tx:2,ty:3});assert.equal(out.winner,0);assert.equal(s.board[3][2],0)});
test('battleship accepts a shot and alternates',()=>{const s=GAMES.battleship.init();const out=GAMES.battleship.move(s,0,{x:0,y:0});assert.equal(out,undefined);assert.equal(s.turn,1)});

test('physical games have real stateful boards',()=>{
  const pool=GAMES.pool.init();
  assert.equal(pool.balls.length,16);
  assert.equal(pool.balls.filter(b=>!b.pocketed).length,16);
  const carrom=GAMES.carrom.init();
  assert.equal(carrom.coins.length,19);
  const golf=GAMES.minigolf.init();
  assert.ok(golf.walls.length>=4);
  const race=GAMES.racing.init();
  assert.equal(race.players.length,2);
  assert.ok(race.players.every(p=>typeof p.angle==='number'));
});

test('pool rejects an invalid zero-power shot',()=>{
  const pool=GAMES.pool.init();
  assert.equal(GAMES.pool.move(pool,0,{dx:1,dy:0,power:0}),'Shot power is too low');
});


test('source-backed chess engine enforces legal moves and checkmate',()=>{
  let s=GAMES.chess.init();
  GAMES.chess.move(s,0,{from:'f2',to:'f3'});
  GAMES.chess.move(s,1,{from:'e7',to:'e5'});
  GAMES.chess.move(s,0,{from:'g2',to:'g4'});
  const out=GAMES.chess.move(s,1,{from:'d8',to:'h4'});
  assert.equal(out.winner,1);
  assert.equal(out.reason,'checkmate');
});

test('source-backed checkers engine starts with 12 pieces each',()=>{
  const s=GAMES.checkers.init();
  assert.equal(s.board.flat().filter(v=>v===0||v===2).length,12);
  assert.equal(s.board.flat().filter(v=>v===1||v===3).length,12);
  const moves=GAMES.checkers.move(s,0,{from:21,to:17,captures:[]});
  assert.notEqual(moves,'Illegal checkers move');
});
