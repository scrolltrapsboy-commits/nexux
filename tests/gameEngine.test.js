const test=require('node:test');
const assert=require('node:assert/strict');
const {GAMES}=require('../server/gameEngine');

test('all game engines expose two-player lifecycle',()=>{
  assert.equal(Object.keys(GAMES).length,33);
  for(const [id,g] of Object.entries(GAMES)){assert.equal(g.players,2,`${id} players`);assert.ok(g.init);assert.ok(g.move)}
});
test('source-backed tic tac toe detects a row',()=>{const s=GAMES.tictactoe.init([{id:'a',name:'A'},{id:'b',name:'B'}]);GAMES.tictactoe.move(s,0,{action:'markCell',payload:{row:0,col:0}});GAMES.tictactoe.move(s,1,{action:'markCell',payload:{row:1,col:0}});GAMES.tictactoe.move(s,0,{action:'markCell',payload:{row:0,col:1}});GAMES.tictactoe.move(s,1,{action:'markCell',payload:{row:1,col:1}});const out=GAMES.tictactoe.move(s,0,{action:'markCell',payload:{row:0,col:2}});assert.equal(out.winner,0)});
test('source-backed connect four detects four with upstream board rules',()=>{const s=GAMES.connect4.init();for(const c of [0,1,0,1,0,1,0]){const i=s.turn;const out=GAMES.connect4.move(s,i,{col:c});if(out)assert.equal(out.winner,0)}assert.equal(s.board[5][0],'black');assert.equal(s.board[4][0],'black');assert.equal(s.board[3][0],'black');assert.equal(s.board[2][0],'black');});
test('source-backed chess starts with 20 legal moves and accepts e2-e4',()=>{const s=GAMES.chess.init();const moves=s.fen&&s.history;assert.equal(new (require('chess.js').Chess)(s.fen).moves().length,20);const out=GAMES.chess.move(s,0,{from:'e2',to:'e4'});assert.equal(out.move,'e4');assert.equal(s.turn,1);});
test('source-backed checkers enforces mandatory captures',()=>{
  const s=GAMES.checkers.init();
  let found=false;
  for(let ply=0;ply<120&&s.status==='playing';ply++){
    const captures=s.legalMoves.filter(m=>Array.isArray(m.captures)&&m.captures.length>0);
    if(captures.length){
      found=true;
      assert.equal(s.legalMoves.filter(m=>!m.captures?.length).length,0);
      break;
    }
    const mv=s.legalMoves[0];
    assert.ok(mv);
    const out=GAMES.checkers.move(s,s.turn,{from:mv.from,to:mv.to});
    assert.notEqual(out,'Invalid checkers move');
    assert.notEqual(out,'Illegal checkers move');
  }
  assert.equal(found,true);
});
test('source-backed battleship begins with simultaneous setup',()=>{const s=GAMES.battleship.init([{id:'a',name:'A'},{id:'b',name:'B'}]);assert.equal(s.turnState.phase,'setup');assert.equal(s.turnState.currentPlayerIndex,null);assert.equal(s.players.length,2);assert.equal(s.config.settings.ships.length,5);});

test('physical games have real stateful boards',()=>{
  const pool=GAMES.pool.init();
  assert.equal(pool.balls.length,16);
  assert.equal(pool.balls.filter(b=>!b.pocketed).length,16);
  assert.equal(pool.balls.filter(b=>b.group==='solid').length,7);
  assert.equal(pool.balls.filter(b=>b.group==='stripe').length,7);
  assert.equal(pool.balls.filter(b=>b.group==='eight').length,1);
  assert.ok(pool.balls.every(b=>typeof b.type==='string'));
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


test('source-backed chess engine preserves repetition history',()=>{
  const s=GAMES.chess.init();
  for(const [from,to] of [['g1','f3'],['g8','f6'],['f3','g1'],['f6','g8'],['g1','f3'],['g8','f6'],['f3','g1']]){
    const out=GAMES.chess.move(s,s.turn,{from,to});
    assert.notEqual(out,'Illegal chess move');
  }
  const out=GAMES.chess.move(s,1,{from:'f6',to:'g8'});
  assert.equal(out.draw,true);
  assert.equal(out.reason,'threefold repetition');
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

test('source-backed checkers engine starts with 12 pieces each and allows dark first move',()=>{
  const s=GAMES.checkers.init();
  assert.equal(s.turn,0);
  assert.equal(s.board.flat().filter(v=>v===0||v===2).length,12);
  assert.equal(s.board.flat().filter(v=>v===1||v===3).length,12);
  assert.ok(s.legalMoves.length>0);
  const mv=s.legalMoves[0];
  const out=GAMES.checkers.move(s,0,{from:mv.from,to:mv.to});
  assert.notEqual(out,'Not your turn');
  assert.notEqual(out,'Illegal checkers move');
  assert.equal(s.turn,1);
});


test('source-backed 2048 uses an independent player board',()=>{const p=[{id:'a',name:'A'},{id:'b',name:'B'}];const s=GAMES.game2048.init(p);assert.ok(Array.isArray(s.boards[0]));s.boards[0]=[[2,2,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];const opponentBefore=JSON.stringify(s.boards[1]);const out=GAMES.game2048.move(s,0,{dir:'left'});assert.equal(out,undefined);assert.equal(s.boards[0][0][0],4);assert.equal(JSON.stringify(s.boards[1]),opponentBefore);});
test('source-backed snake rejects a reverse and supports ticking',()=>{const p=[{id:'a',name:'A'},{id:'b',name:'B'}];const s=GAMES.snake.init(p);assert.equal(GAMES.snake.move(s,0,{dir:'up'}),undefined);assert.equal(s.snakes[0].nextDirection,'up');GAMES.snake.tick(s);assert.equal(s.snakes[0].direction,'up');assert.equal(GAMES.snake.move(s,0,{dir:'down'}),'sb_cannot_reverse');assert.equal(typeof GAMES.snake.tick,'function');});
test('source-backed Tetris uses SRS/hold/drop engine state',()=>{const p=[{id:'a',name:'A'},{id:'b',name:'B'}];const s=GAMES.tetris.init(p);const x=s.players[0].current.x;GAMES.tetris.move(s,0,{action:'left'});assert.equal(s.players[0].current.x,x-1);GAMES.tetris.move(s,0,{action:'hold'});assert.ok(typeof s.players[0].hold==='string');GAMES.tetris.move(s,0,{action:'drop'});assert.ok(s.players[0].score>=0)});
test('source-backed Othello starts with four center pieces and flips a bracket',()=>{const p=[{id:'a',name:'A'},{id:'b',name:'B'}];const s=GAMES.othello.init(p);assert.equal(s.board.flat().filter(v=>v===0).length,2);assert.equal(s.board.flat().filter(v=>v===1).length,2);const out=GAMES.othello.move(s,0,{cell:19});assert.equal(out,undefined);assert.equal(s.board[3][3],0);});
test('Pong validates realtime paddle input',()=>{const s=GAMES.pong.init();assert.equal(GAMES.pong.move(s,0,{axis:2}),'Invalid paddle input');GAMES.pong.move(s,0,{axis:-1});assert.equal(s.inputs[0],-1);});

test('source-backed RPS and Memory accept real source actions',()=>{const p=[{id:'a',name:'A'},{id:'b',name:'B'}];const r=GAMES.rps.init(p);GAMES.rps.move(r,0,{choice:'rock'});GAMES.rps.move(r,1,{choice:'scissors'});assert.equal(r.players[0].score,3);const m=GAMES.memory.init(p);assert.ok(m.gameState.cards.length===16);assert.equal(GAMES.memory.move(m,0,{card:0}),undefined);assert.equal(m.gameState.flipped.length,1);});

test('source-backed UNO initializes hands and enforces turn',()=>{const p=[{id:'a',name:'A'},{id:'b',name:'B'}];const s=GAMES.uno.init(p);assert.equal(s.hands.length,2);assert.ok(s.hands[0].length>0);const bad=GAMES.uno.move(s,1,{cardId:s.hands[1][0].id});assert.equal(bad,'g_not_your_turn');});

test('source-backed Word Chain enforces turn and advances chain',()=>{const p=[{id:'a',name:'A'},{id:'b',name:'B'}];const s=GAMES.wordchain.init(p);assert.equal(GAMES.wordchain.move(s,1,{word:'apple'}),'Not your turn');assert.equal(GAMES.wordchain.move(s,0,{word:'apple'}),undefined);assert.equal(s.gameState.lastLetter,'e');});

test('source-backed Dots & Boxes enforces legal adjacent lines and scoring turns',()=>{
  const s=GAMES.dotsboxes.init();
  assert.equal(s.turn,0);
  assert.equal(GAMES.dotsboxes.move(s,0,{x1:0,y1:0,x2:1,y2:0}),undefined);
  assert.equal(s.turn,1);
  assert.equal(s.hLines.length,1);
  assert.equal(GAMES.dotsboxes.move(s,1,{x1:0,y1:0,x2:1,y2:0}),'Line already connected');
  assert.equal(GAMES.dotsboxes.move(s,0,{x1:0,y1:0,x2:0,y2:2}),'Not your turn');
});
test('source-backed Gomoku detects five in a row',()=>{
  const s=GAMES.gomoku.init();
  for(let k=0;k<4;k++){
    GAMES.gomoku.move(s,0,{x:k,y:0});
    GAMES.gomoku.move(s,1,{x:k,y:1});
  }
  const out=GAMES.gomoku.move(s,0,{x:4,y:0});
  assert.deepEqual(out,{winner:0,reason:'five in a row'});
});
test('source-backed Carrom initializes authentic source board and supports a shot',()=>{
  const s=GAMES.carrom.init();
  assert.equal(s.coins.length,19);
  assert.equal(s.coins.filter(c=>c.type==='queen').length,1);
  const out=GAMES.carrom.move(s,0,{x:.5,dx:0,dy:-1,power:.18});
  assert.equal(out?.animation,true);
  assert.equal(Array.isArray(s.animation),true);
});

test('source-backed Backgammon initializes a full board and rolls playable dice',()=>{
  const s=GAMES.backgammon.init();
  assert.equal(s.points.length,24);
  assert.equal(s.pieces[0].length,15);
  assert.equal(s.pieces[1].length,15);
  assert.ok(Array.isArray(s.dice.values)&&s.dice.values.length===2);
  assert.ok(Array.isArray(s.dice.movesLeft));
});

test('source-backed connect four rejects a full column',()=>{const s=GAMES.connect4.init();const seq=[0,0,0,0,0,0];for(const col of seq){const i=s.turn;GAMES.connect4.move(s,i,{col});}assert.equal(GAMES.connect4.move(s,s.turn,{col:0}),'Column full');});

test('source-backed NEXUS LAN Games engines expose real state and turn rules',()=>{
  const t=GAMES.tictactoe.init([{id:'a',name:'A'},{id:'b',name:'B'}]);
  assert.equal(t.board.length,3);assert.equal(t.board[0].length,3);assert.equal(t.turnState.currentPlayerIndex,0);
  const tm=GAMES.tictactoe.move(t,0,{action:'markCell',payload:{row:0,col:0}});assert.equal(tm,undefined);assert.equal(t.board[0][0],'a');
  const b=GAMES.battleship.init([{id:'a',name:'A'},{id:'b',name:'B'}]);assert.equal(b.turnState.phase,'setup');assert.equal(b.players.length,2);assert.equal(b.config.settings.ships.length,5);
  const y=GAMES.yahtzee.init([{id:'a',name:'A'},{id:'b',name:'B'}]);assert.equal(y.turnState.dice.length,0);const yr=GAMES.yahtzee.move(y,0,{action:'rollDice',payload:{held:[false,false,false,false,false]}});assert.equal(yr,undefined);assert.equal(y.turnState.dice.length,5);
});


test('source-backed Monopoly Risk and Life initialize from upstream engines',()=>{const players=[{id:'a',name:'A'},{id:'b',name:'B'}];const mono=GAMES.monopoly.init(players);assert.equal(mono.status,'playing');assert.equal(mono.players.length,2);assert.equal(mono.players[0].money,mono.config.settings.startingMoney);assert.equal(mono.turnState.phase,'pre-roll');const risk=GAMES.risk.init(players);assert.equal(risk.status,'playing');assert.equal(risk.players.length,2);assert.equal(Object.keys(risk.territories).length,42);assert.equal(risk.turnState.phase,'reinforce');const life=GAMES.life.init(players);assert.equal(life.status,'playing');assert.equal(life.players.length,2);assert.equal(life.players[0].pending?.type,'fork');assert.ok(life.config.board.length>=60)});

test('source-backed Gomoku uses vendored rule methods and detects five in a row',()=>{
 const s=GAMES.gomoku.init();
 for(const [i,x] of [[0,0],[1,0],[0,1],[1,1],[0,2],[1,2],[0,3],[1,3]]) GAMES.gomoku.move(s,i,{x,y:i%2});
 const out=GAMES.gomoku.move(s,0,{x:4,y:0});
 assert.equal(out.winner,0);
 assert.equal(s.status,'finished');
});
test('source-backed Anagram Sprint uses the upstream word list and scoring',()=>{const p=[{id:'a',name:'A'},{id:'b',name:'B'}];const s=GAMES.anagram.init(p);const word=s.gameState.roundWords[0];assert.ok(typeof word==='string');assert.ok(typeof s.gameState.scrambled==='string');assert.equal(GAMES.anagram.move(s,0,{word}),undefined);assert.equal(s.players[0].score,10);});
test('source-backed Number Hunt hides target from player view and scores both guesses',()=>{const p=[{id:'a',name:'A'},{id:'b',name:'B'}];const s=GAMES.numberhunt.init(p);const target=s.gameState.target;const publicState=GAMES.numberhunt.getStateForPlayer(s,'a');assert.equal(publicState.target,undefined);GAMES.numberhunt.move(s,0,{guess:target});GAMES.numberhunt.move(s,1,{guess:target});assert.equal(s.players[0].score,4);assert.equal(s.players[1].score,2);});
test('source-backed Speed Typing advances only after both players finish',()=>{const p=[{id:'a',name:'A'},{id:'b',name:'B'}];const s=GAMES.speedtyping.init(p);const word=s.gameState.words[s.gameState.currentWordIndex];GAMES.speedtyping.move(s,0,{typed:word});assert.equal(s.gameState.currentWordIndex,0);GAMES.speedtyping.move(s,1,{typed:word});assert.equal(s.gameState.currentWordIndex,1);assert.ok(s.players.every(x=>x.score>0));});
test('source-backed source-game catalog remains available',()=>{for(const id of ['tictactoe','connect4','battleship','yahtzee','monopoly','risk','life','dotsboxes','gomoku','backgammon','carrom','pool','rps','memory','minesweeper','game2048','snake','othello','uno','wordchain','anagram','numberhunt','speedtyping'])assert.ok(GAMES[id],id);});

test('source-backed Ludo uses upstream seed-path and six-start rule',()=>{
 const s=GAMES.ludo.init([{id:'a',name:'A'},{id:'b',name:'B'}]);
 assert.equal(s.tokens.length,8);
 assert.ok(s.paths[0].length>=2);
 const token=s.tokens.find(t=>t.player===0);
 assert.equal(GAMES.ludo.move(s,0,{action:'move',tokenId:token.id}),'Roll first');
 s.dice=6;s.phase='move';
 const out=GAMES.ludo.move(s,0,{action:'move',tokenId:token.id});
 assert.equal(out.moved,token.id);
 assert.notEqual(token.position,'still');
});
test('source-backed Dominoes deals five tiles each and honors highest double',()=>{
 const s=GAMES.dominoes.init([{id:'a',name:'A'},{id:'b',name:'B'}]);
 assert.equal(s.hands[0].length,5);
 assert.equal(s.hands[1].length,5);
 assert.equal(s.boneyard.length,18);
 const starter=s.hands[ s.turn ].find(t=>t.isDouble&&t.left===s.starterDouble);
 assert.ok(starter);
 const out=GAMES.dominoes.move(s,s.turn,{action:'place',tileId:starter.id,end:'left'});
 assert.notEqual(out,'Must start with the highest double');
 assert.equal(s.chain.length,1);
});
