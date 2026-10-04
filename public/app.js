'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const state={socket:null,token:localStorage.getItem('nexus_token'),me:null,games:{},room:null,view:'home',authMode:'login',selectedChess:null,chessLegal:[],activeDM:null,rtcConfig:{iceServers:[{urls:'stun:stun.l.google.com:19302'}]},call:{peers:new Map(),stream:null,video:false,audio:false,pendingIce:new Map(),started:false,syntheticCleanup:null},mobileChatTarget:'room',mobileFriend:null,typingTimer:null,socialMode:'room',desktopFriend:null,globalChatRevision:0,friendChatRevision:0,globalPending:new Map(),friendPending:new Map()};
const toast=(msg)=>{const e=$('#toast');e.textContent=msg;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),2200)};
const escapeHtml=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const icons={hangman:'⌁',tictactoe:'✕',connect4:'●',rps:'✋',chess:'♞',checkers:'●',battleship:'▦',memory:'◫',minesweeper:'✦',wordbattle:'Aa',wordchain:'↪',anagram:'Aa',numberhunt:'#',speedtyping:'⌨',reaction:'⚡',uno:'▣',pool:'◉',carrom:'◉',minigolf:'⛳',racing:'⌁',othello:'◉',pong:'↔',game2048:'2048',tetris:'▦',snake:'⌁',dotsboxes:'⊞',gomoku:'五',backgammon:'⚂',ludo:'♟',dominoes:'▥',mancala:'●',yahtzee:'🎲',monopoly:'▤',risk:'◈',life:'♙',breakout:'▤',spaceinvaders:'✦',pacman:'◉',frogger:'⌁',flappy:'◌',sudoku:'▦'}
const descriptions={hangman:'Source-backed six-mistake word guessing.',tictactoe:'Source-backed 3×3 strategy.',connect4:'Source-backed gravity drop and four-in-a-row.',rps:'Source-backed round battle.',chess:'Source-backed legal chess rules with promotion, castling and draw detection.',checkers:'Source-backed mandatory captures, multi-jumps and kings.',battleship:'Source-backed hidden fleet setup and combat.',memory:'Source-backed hidden-card matching.',minesweeper:'Source-backed mine race with flood reveal.',wordbattle:'Word-building duel.',wordchain:'Source-backed chained-word duel.',anagram:'Source-backed anagram sprint.',numberhunt:'Source-backed target-number race.',speedtyping:'Source-backed competitive typing.',reaction:'Fast-reaction round battle.',uno:'Source-backed UNO card rules.',pool:'Source-backed 8-ball physics and foul rules.',carrom:'Source-backed striker, coin, queen and foul physics.',minigolf:'Stroke-based obstacle course.',racing:'Realtime circuit racing.',othello:'Source-backed 8×8 disk-flipping strategy.',pong:'Source-backed realtime Pong.',game2048:'Source-backed 4×4 merge-and-double race.',tetris:'Source-backed seven-piece falling-block engine.',snake:'Source-backed realtime snake arena.',dotsboxes:'Source-backed box-closing rules.',gomoku:'Source-backed 15×15 five-in-a-row.',backgammon:'Source-backed race, hit, and bear-off gameplay.',ludo:'Source-backed Ludo movement, six-start, captures and home path.',dominoes:'Source-backed double-six dominoes with boneyard, highest-double start and blocked-game scoring.',mancala:'Source-backed Kalah/Mancala stone-sowing and capture rules.',yahtzee:'Source-backed five-dice score sheet.',monopoly:'Source-backed property board simulation.',risk:'Source-backed territory strategy.',life:'Source-backed life-path board simulation.',breakout:'Exact upstream Breakout physics, bricks and powerups.',spaceinvaders:'Exact upstream Space Invaders systems and collision loop.',pacman:'Exact upstream Pac-Man maze, dots and ghost AI.',frogger:'Exact upstream Frogger traffic, river and goal logic.',flappy:'Exact upstream Flappy Bird pipe and collision physics.',sudoku:'Exact upstream Sudoku generation, validation and completion.'}
function emit(ev,data={}){return new Promise(resolve=>state.socket.emit(ev,data,resolve))}
function setView(v){state.view=v;$$('.view').forEach(x=>x.classList.add('hidden'));$('#view-'+v)?.classList.remove('hidden');$$('.nav').forEach(x=>x.classList.toggle('active',x.dataset.view===v));$('#pageTitle').textContent=v[0].toUpperCase()+v.slice(1);renderView(v)}
function renderView(v){if(v==='home')renderHome();if(v==='games')renderGames();if(v==='friends')renderFriends();if(v==='chat')renderChat();if(v==='leaderboard')renderLeaderboard();if(v==='profile')renderProfile()}
function gameCards(){return Object.entries(state.games).map(([id,g])=>`<article class="game-card"><div><div class="game-icon">${icons[id]||'◈'}</div><h4>${escapeHtml(g.name)}</h4><p>${escapeHtml(descriptions[id]||'Real-time multiplayer game.')}</p></div><div class="row"><span class="eyebrow">${escapeHtml(g.category)}</span><button class="play-btn" data-game="${id}">Play</button></div></article>`).join('')}
function renderHome(){const el=$('#view-home');el.innerHTML=`<div class="hero"><span class="eyebrow">NEXUS PLAY / REAL-TIME</span><h1>Play together.<br>Stay in the room.</h1><p>Board games, sports, arcade and racing with server-authoritative moves, persistent profiles, room chat and an in-game voice/video call overlay.</p><div class="hero-actions"><button class="primary" id="quickPlay">Quick match</button><button class="ghost" id="openRoom">Create or join room</button></div></div><div class="section-head"><h3>Featured games</h3><span>${Object.keys(state.games).length} games</span></div><div class="game-grid">${gameCards().split('</article>').slice(0,6).map(x=>x+'</article>').join('')}</div>`;$('#quickPlay').onclick=()=>quick('chess');$('#openRoom').onclick=()=>openRoomModal();bindGameButtons()}
function renderGames(){const el=$('#view-games');el.innerHTML=`<div class="section-head"><div><h3>Game library</h3><span>Choose a game, then invite or share the room code.</span></div><button class="ghost" id="gamesRoom">Room</button></div><div class="game-grid">${gameCards()}</div>`;$('#gamesRoom').onclick=openRoomModal;bindGameButtons()}
function bindGameButtons(){$$('.play-btn').forEach(b=>b.onclick=()=>quick(b.dataset.game))}
async function quick(game){const r=await emit('quick',{game});if(!r?.ok)return toast(r?.error||'Could not start match');toast('Searching for a player…')}
function openRoomModal(){$('#roomModal').classList.remove('hidden');const list=$('#roomCreateList');list.innerHTML=Object.entries(state.games).map(([id,g])=>`<button class="game-mini" data-create="${id}"><b>${icons[id]||'◈'} ${escapeHtml(g.name)}</b><span>${escapeHtml(g.category)} · ${g.players} players</span></button>`).join('');$$('[data-create]').forEach(b=>b.onclick=async()=>{const game=b.dataset.create;const name=state.games[game]?.name||game;$('#roomModal').classList.add('hidden');openGameModal();$('#gameTitle').textContent='Creating '+name;$('#gameBoard').innerHTML='<div class="lobby-panel"><div class="lobby-icon">'+(icons[game]||'◈')+'</div><span class="eyebrow">ROOM</span><h3>Creating game…</h3><p>Preparing your room. The game shell is ready while the server creates the match.</p></div>';const r=await emit('create',{game});if(!r?.ok){$('#gameModal').classList.add('hidden');document.body.classList.remove('game-active');document.body.style.overflow='';return toast(r?.error||'Could not create room')}const existing=state.room?.code===r.code?state.room:null;state.room=existing||r.room||{code:r.code,game,private:false,host:state.me?.id||null,players:[{id:state.me?.id||'',name:state.me?.name||'Guest',online:true,connected:true}],status:'lobby',state:null,result:null,rematch:[],chat:[],created:Date.now()};openGameModal();renderGame();renderRoomChat();renderMobileSocial();toast('Room '+r.code+' created');syncRoomUntilStarted(r.code).then(started=>{if(started){renderGame();renderRoomChat();renderMobileSocial()}})})}
async function resolveJoinedRoom(code){code=String(code||'').trim().toUpperCase();if(!code)return false;const existing=state.room?.code===code?state.room:null;if(existing){openGameModal();renderGame();renderRoomChat();renderMobileSocial();if(existing.status==='playing')return true}let settled=false;let latest=null;const wait=new Promise(resolve=>{const timer=setTimeout(()=>{if(!settled){settled=true;state.socket.off('room',handler);resolve(false)}},8000);const handler=r=>{if(r?.code!==code)return;latest=r;if(r.status==='playing'||r.status==='lobby'){settled=true;clearTimeout(timer);state.socket.off('room',handler);state.room=r;openGameModal();renderGame();renderRoomChat();renderMobileSocial();resolve(true)}};state.socket.on('room',handler);});const result=await emit('join',{code});if(result?.error){state.socket.off('room',()=>{});return false}if(result?.room?.code===code){latest=result.room;state.room=result.room;openGameModal();renderGame();renderRoomChat();renderMobileSocial();return result.room.status==='playing'||result.room.status==='lobby'}return wait;}
$('#joinBtn').onclick=async()=>{const code=$('#joinCode').value.trim().toUpperCase();if(!code)return;$('#roomModal').classList.add('hidden');openGameModal();$('#gameTitle').textContent='Joining room';$('#gameBoard').innerHTML='<div class="lobby-panel"><div class="lobby-icon">◈</div><span class="eyebrow">ROOM ENTRY</span><h3>Joining…</h3><p>Connecting to room <b>'+escapeHtml(code)+'</b>.</p></div>';const ok=await resolveJoinedRoom(code);if(!ok){toast('Unable to join room');state.room=null;$('#gameModal').classList.add('hidden');document.body.classList.remove('game-active');document.body.style.overflow=''}};function showRoomLobby(){if(!state.room)return;openGameModal();renderGame();}
function openGameModal(){const modal=$('#gameModal');modal.classList.remove('hidden');document.body.classList.add('game-active');document.body.style.overflow='hidden';requestAnimationFrame(()=>{$('#gameModal .game-modal')?.scrollTo({top:0,behavior:'instant'})})}
function closeGameModal(){if(state.room){emit('leave')}if(state.gameCleanup){state.gameCleanup();state.gameCleanup=null}state.room=null;state.realtimeDraw=null;$('#gameModal').classList.add('hidden');document.body.classList.remove('game-active');document.body.style.overflow='';stopCall();state.selectedChess=null;state.chessLegal=[]}
function currentRoomLink(){const r=state.room;if(!r?.code)return null;const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('room',r.code);return u.toString()}
async function copyCurrentRoomLink(){const url=currentRoomLink();if(!url)return toast('No game room to share');try{await navigator.clipboard.writeText(url);toast('Invite link copied')}catch{toast('Copy room code: '+state.room.code)}}
async function shareCurrentRoom(){const r=state.room;if(!r?.code)return toast('No game room to share');const url=currentRoomLink();const game=state.games[r.game]?.name||r.game;const data={title:'NEXUS PLAY',text:'Join my '+game+' game on NEXUS PLAY',url};try{if(navigator.share){await navigator.share(data);toast('Invite ready')}else await copyCurrentRoomLink()}catch(err){if(err?.name==='AbortError')return;await copyCurrentRoomLink()}}
$('#leaveGame').onclick=closeGameModal;$('#fullscreenGame').onclick=()=>{document.body.classList.toggle('game-focus');const focused=document.body.classList.contains('game-focus');$('#fullscreenGame').textContent=focused?'Exit focus':'Focus game'};
$$('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).classList.add('hidden'));
function renderGame(){const r=state.room;if(!r)return;document.body.dataset.nexusRoomStatus=r.status||'';document.body.dataset.nexusRoomPlayers=String(r.players?.length||0);document.body.dataset.nexusRoomCode=r.code||'';if(state.gameCleanup){state.gameCleanup();state.gameCleanup=null}if(!['racing','pong','snake','tetris'].includes(r.game))state.realtimeDraw=null;const g=state.games[r.game]||{};const playerTurn=s=>Number.isInteger(s?.turn)?s.turn:(Number.isInteger(s?.gameState?.currentPlayer)?s.gameState.currentPlayer:null);const currentTurn=playerTurn(r.state);const meIndex=r.players.findIndex(p=>p.id===state.me.id);$('#gameCategory').textContent=g.category||'GAME';$('#gameTitle').textContent=g.name||r.game;$('#gamePlayers').innerHTML=r.players.map((p,i)=>`<div class="player-chip ${r.status==='playing'&&currentTurn===i?'active':''}">${i===0?'●':'○'} ${escapeHtml(p.name)} <span style="color:#666">${p.online?'online':'away'}</span></div>`).join('');$('#turnPill').textContent=r.status==='lobby'?'Waiting for player':r.status==='finished'?(r.result?.draw?'Draw':r.result?.winnerId===state.me.id?'You won':'Match over'):(currentTurn===null?'Live':currentTurn===meIndex?'Your turn':'Opponent turn');$('#gameResult').textContent=r.status==='finished'?(r.result?.draw?'Draw — rematch?':r.result?.winnerId===state.me.id?'You won — rematch?':'Opponent won — rematch?'):(r.state?.foul?'Foul — turn passed':'');if($('#shareGame'))$('#shareGame').onclick=shareCurrentRoom;renderBoard(r);renderActions(r)}
function sendMove(m){state.socket.emit('move',m,res=>{if(res?.error)toast(res.error)})}
function sendDrive(m){state.socket.emit('drive',m,res=>{if(res?.error)toast(res.error)})}
function acceptRoomUpdate(r){
 if(!r?.code)return false;
 const current=state.room;
 // A two-player NEXUS room starts immediately. A lobby snapshot with both slots filled
 // can therefore only be stale and must never roll an already-started game back to lobby.
 const expectedPlayers=Number(state.games?.[r.game]?.players||2);
 if(r.status==='lobby'&&Array.isArray(r.players)&&r.players.length>=expectedPlayers)return false;
 if(current?.code===r.code&&current.status==='playing'&&r.status==='lobby')return false;
 state.room=r;return true;
}
async function syncRoomUntilStarted(code,attempts=20){
 for(let n=0;n<attempts;n++){
   if(state.room?.code===code&&state.room.status==='playing')return true;
   try{
     const fresh=await emit('hello',{token:state.token,name:state.me?.name||'Guest'});
     if(fresh?.room?.code===code&&acceptRoomUpdate(fresh.room)){
       openGameModal();renderGame();renderRoomChat();renderMobileSocial();
       if(fresh.room.status==='playing'||fresh.room.status==='finished')return fresh.room.status==='playing';
     }
   }catch{}
   await new Promise(r=>setTimeout(r,250));
 }
 return state.room?.code===code&&state.room.status==='playing';
}
function renderLanSourceGame(el,r){
 const s=r.state,me=state.room.players.findIndex(p=>p.id===state.me.id);
 if(r.game==='tictactoe'){
  const ids=(s.players||[]).map(p=>p.userId);
  el.innerHTML='<div class="source-board-shell"><div class="source-game-kicker">SOURCE ENGINE · LAN GAMES</div><div class="board-ttt source-ttt">'+s.board.flatMap((row,y)=>row.map((v,x)=>'<button class="cell" data-source-ttt="'+(y*3+x)+'">'+(v?(v===ids[0]?'×':'○'):'')+'</button>')).join('')+'</div><p class="game-note">'+(s.players?.[s.turnState?.currentPlayerIndex]?.userId===state.me.id?'Your move':'Opponent move')+'</p></div>';
  $$('[data-source-ttt]').forEach(b=>b.onclick=()=>{const n=+b.dataset.sourceTtt;sendMove({action:'markCell',payload:{row:Math.floor(n/3),col:n%3}})});
  return true;
 }
 if(r.game==='yahtzee'){
  const p=s.players?.[me],ts=s.turnState||{},cats=['ones','twos','threes','fours','fives','sixes','threeOfAKind','fourOfAKind','fullHouse','smallStraight','largeStraight','yahtzee','chance'],labels={ones:'Ones',twos:'Twos',threes:'Threes',fours:'Fours',fives:'Fives',sixes:'Sixes',threeOfAKind:'Three of a Kind',fourOfAKind:'Four of a Kind',fullHouse:'Full House',smallStraight:'Small Straight',largeStraight:'Large Straight',yahtzee:'Yahtzee',chance:'Chance'};
  state.yahtzeeHeld=Array.isArray(ts.held)?ts.held.slice():Array(5).fill(false);
  el.innerHTML='<div class="yahtzee-wrap"><div class="source-game-kicker">SOURCE ENGINE · LAN GAMES</div><div class="dice-row">'+(ts.dice||[]).map((v,i)=>'<button class="yahtzee-die '+(state.yahtzeeHeld[i]?'held':'')+'" data-yhold="'+i+'">'+v+'</button>').join('')+'</div><div class="yahtzee-toolbar"><span class="status-pill">Roll '+(ts.rollsUsed||0)+'/3</span><button class="primary" id="yRoll" '+(s.turnState?.currentPlayerIndex!==me||ts.rollsUsed>=3?'disabled':'')+'>Roll / Reroll</button></div><div class="score-sheet">'+cats.map(c=>{const used=p?.scoreSheet?.[c]!==null;const preview=ts.dice?.length?scoreLanYahtzee(c,ts.dice):'';return '<button class="score-row '+(used?'used':'')+'" data-yscore="'+c+'" '+(used||s.turnState?.currentPlayerIndex!==me||!ts.dice?.length?'disabled':'')+'><span>'+labels[c]+'</span><b>'+(used?p.scoreSheet[c]:preview)+'</b></button>'}).join('')+'</div></div>';
  $$('[data-yhold]').forEach(b=>b.onclick=()=>{const i=+b.dataset.yhold;if((ts.rollsUsed||0)>0){state.yahtzeeHeld[i]=!state.yahtzeeHeld[i];renderGame()}});
  $('#yRoll')?.addEventListener('click',()=>sendMove({action:'rollDice',payload:{held:state.yahtzeeHeld.slice()}}));
  $$('[data-yscore]').forEach(b=>b.onclick=()=>sendMove({action:'scoreCategory',payload:{category:b.dataset.yscore}}));
  return true;
 }
 if(r.game==='battleship'){
  const p=s.players?.[me],ts=s.turnState||{},ships=s.config?.settings?.ships||[];
  if(ts.phase==='setup'){
   const remaining=ships.filter(sh=>!(p?.ships||[]).some(x=>x.id===sh.id));
   state.battlePick=state.battlePick||{shipId:remaining[0]?.id||ships[0]?.id||'',orientation:'horizontal',origin:{x:0,y:0}};
   el.innerHTML='<div class="battleship-wrap"><div class="source-game-kicker">SOURCE ENGINE · LAN GAMES</div><div class="battle-layout"><div><h4>Your fleet · '+(p?.ships?.length||0)+'/'+ships.length+'</h4><div class="battle-grid own-grid">'+Array.from({length:100},(_,i)=>{const x=i%10,y=Math.floor(i/10),ship=(p?.ships||[]).find(sh=>sh.cells?.some(c=>c.x===x&&c.y===y));return '<button class="battle-cell '+(ship?'ship':'')+'" data-bshipcell="'+x+','+y+'">'+(ship?'■':'')+'</button>'}).join('')+'</div></div><div class="battle-panel"><label>Ship<select id="battleShip">'+ships.map(sh=>'<option value="'+sh.id+'" '+(state.battlePick.shipId===sh.id?'selected':'')+'>'+escapeHtml(sh.name)+' · '+sh.length+'</option>').join('')+'</select></label><label>Orientation<select id="battleOrientation"><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select></label><p>Tap an origin cell, choose orientation, then place the ship. The source engine validates boundaries and overlap.</p><button class="primary" id="placeBattleShip" '+(p?.ready?'disabled':'')+'>Place ship</button><button class="ghost" id="commitBattle" '+(p?.ready?'disabled':'')+'>Ready / Commit Fleet</button></div></div></div>';
   $('#battleShip').onchange=()=>state.battlePick.shipId=$('#battleShip').value;$('#battleOrientation').onchange=()=>state.battlePick.orientation=$('#battleOrientation').value;
   $$('[data-bshipcell]').forEach(b=>b.onclick=()=>{const [x,y]=b.dataset.bshipcell.split(',').map(Number);state.battlePick.origin={x,y};$$('[data-bshipcell]').forEach(q=>q.classList.remove('selected'));b.classList.add('selected')});
   $('#placeBattleShip').onclick=()=>sendMove({action:'placeShip',payload:{shipId:state.battlePick.shipId,orientation:state.battlePick.orientation,origin:state.battlePick.origin}});
   $('#commitBattle').onclick=()=>sendMove({action:'commitPlacement',payload:{}});
  }else{
   const shots=p?.shotsFired||[],sunk=p?.shipsSunk||[];el.innerHTML='<div class="battleship-wrap"><div class="source-game-kicker">SOURCE ENGINE · LAN GAMES</div><div class="battle-layout"><div><h4>Target grid</h4><div class="battle-grid">'+Array.from({length:100},(_,i)=>{const x=i%10,y=Math.floor(i/10),q=shots.find(z=>z.cell?.x===x&&z.cell?.y===y);return '<button class="battle-cell '+(q?.result||'')+'" data-bfire="'+x+','+y+'">'+(q?(q.result==='miss'?'·':'×'):'')+'</button>'}).join('')+'</div></div><div><h4>Your fleet · '+sunk.length+'/'+ships.length+' sunk</h4><div class="battle-grid own-grid">'+Array.from({length:100},(_,i)=>{const x=i%10,y=Math.floor(i/10),ship=(p?.ships||[]).find(sh=>sh.cells?.some(c=>c.x===x&&c.y===y));const hit=ship?.hits?.some(c=>c.x===x&&c.y===y);return '<div class="battle-cell '+(ship?'ship':'')+' '+(hit?'hit':'')+'">'+(hit?'×':ship?'■':'')+'</div>'}).join('')+'</div></div></div><p class="game-note">'+(s.turnState?.currentPlayerIndex===me?'Your turn — fire on the target grid.':'Opponent turn')+'</p></div>';
   $$('[data-bfire]').forEach(b=>b.onclick=()=>{const [x,y]=b.dataset.bfire.split(',').map(Number);sendMove({action:'fireShot',payload:{cell:{x,y}}})});
  }
  return true;
 }
 return false;
}
function scoreLanYahtzee(cat,d){const counts={};for(const v of d)counts[v]=(counts[v]||0)+1;const sum=d.reduce((a,b)=>a+b,0);const upper={ones:1,twos:2,threes:3,fours:4,fives:5,sixes:6};if(upper[cat])return d.filter(v=>v===upper[cat]).reduce((a,b)=>a+b,0);if(cat==='threeOfAKind')return Object.values(counts).some(v=>v>=3)?sum:0;if(cat==='fourOfAKind')return Object.values(counts).some(v=>v>=4)?sum:0;if(cat==='fullHouse')return Object.values(counts).includes(3)&&Object.values(counts).includes(2)?25:0;if(cat==='smallStraight'){const u=new Set(d);return [1,2,3,4].every(v=>u.has(v))||[2,3,4,5].every(v=>u.has(v))||[3,4,5,6].every(v=>u.has(v))?30:0}if(cat==='largeStraight'){const q=d.slice().sort((a,b)=>a-b).join('');return q==='12345'||q==='23456'?40:0}if(cat==='yahtzee')return Object.values(counts).some(v=>v===5)?50:0;if(cat==='chance')return sum;return 0}
function sourceActionButton(a){return '<button class="ghost source-action '+(a.enabled?'':'disabled')+'" data-src-action="'+escapeHtml(a.action||'')+'" '+(a.enabled?'':'disabled')+'>'+escapeHtml(a.label||a.action||'Action')+'</button>'}
function renderMonopolySource(el,r){
 const s=r.state,me=state.me.id,p=s.players?.find(x=>x.userId===me),actions=r.actions||[],board=s.config?.board||[],props=s.properties||{};
 el.innerHTML='<div class="source-economy"><div class="source-game-kicker">SOURCE ENGINE · LAN GAMES · MONOPOLY</div><div class="source-econ-head"><div><b>'+escapeHtml(p?.username||'Player')+'</b><span>$'+Number(p?.money||0).toLocaleString()+' · Square '+Number(p?.position||0)+'</span></div><span class="status-pill">'+escapeHtml(s.turnState?.phase||'playing')+'</span></div><div class="mono-board">'+board.map((sq,i)=>{const q=props[i],owner=s.players?.find(u=>u.userId===q?.ownerId);return '<button class="mono-cell '+(i===p?.position?'here ':'')+(q?.ownerId===me?'mine':'')+'" data-mono-pos="'+i+'"><small>'+i+'</small><b>'+escapeHtml(sq?.name||('Square '+i))+'</b><span>'+(q?.ownerId?escapeHtml(owner?.username||'Owned'):'Available')+'</span><em>'+(q?.houses?'▣'.repeat(Math.min(5,q.houses)):'')+'</em></button>'}).join('')+'</div><div class="source-actionbar">'+actions.map(sourceActionButton).join('')+'</div><div class="source-note">Rules and turn validation stay in the upstream LAN Games engine; this UI only sends its documented actions.</div></div>';
 $$('[data-mono-pos]').forEach(b=>b.onclick=()=>{state.sourceSelectedPosition=Number(b.dataset.monoPos);$$('[data-mono-pos]').forEach(x=>x.classList.toggle('selected',x===b));toast('Selected '+(s.config?.board?.[state.sourceSelectedPosition]?.name||'property'))});
 const get=a=>(actions||[]).find(x=>x.action===a);
 $$('[data-src-action]').forEach(b=>b.onclick=()=>{const a=b.dataset.srcAction,d=get(a);if(!d?.enabled)return;const payload={};if(['buildHouse','sellHouse','mortgageProperty','unmortgageProperty'].includes(a)){const pos=state.sourceSelectedPosition??p?.position;if(pos==null)return toast('Select a property');payload.position=Number(pos)}else if(a==='placeBid'){const n=Number(prompt('Bid amount'));if(!Number.isFinite(n))return;payload.amount=Math.floor(n)}else if(a==='offerTrade'){const other=s.players?.find(x=>x.userId!==me&&!x.isBankrupt);if(!other)return toast('No trade partner');payload.toUserId=other.userId;payload.offerMoney=0;payload.offerProps=[];payload.offerCards=0;payload.requestMoney=0;payload.requestProps=[];payload.requestCards=0}else if(a==='rollDice'||a==='buyProperty'||a==='declinePurchase'||a==='passAuction'||a==='payJailFine'||a==='useJailCard'||a==='endTurn'||a==='acceptTrade'||a==='rejectTrade'||a==='cancelTrade'||a==='declareBankruptcy'){}sendSourceAction(a,payload)});
}
function renderRiskSource(el,r){
 const s=r.state,me=state.me.id,p=s.players?.find(x=>x.userId===me),actions=r.actions||[],phase=s.turnState?.phase||'';
 el.innerHTML='<div class="source-risk"><div class="source-game-kicker">SOURCE ENGINE · LAN GAMES · RISK</div><div class="source-risk-head"><div><b>'+escapeHtml(p?.username||'Commander')+'</b><span>'+escapeHtml(phase)+' · '+Number(s.turnState?.armiesToPlace||0)+' reinforcements</span></div><span class="status-pill">'+(s.status==='playing'?'LIVE':'FINISHED')+'</span></div><div class="risk-territories">'+Object.entries(s.territories||{}).map(([id,q])=>{const t=s.config?.territoryById?.[id]||{},owner=s.players?.find(x=>x.userId===q.ownerId);return '<button class="risk-territory '+(q.ownerId===me?'mine':'enemy')+'" data-risk-id="'+escapeHtml(id)+'"><b>'+escapeHtml(t.name||id)+'</b><span>'+Number(q.armies||0)+' armies</span><small>'+escapeHtml(owner?.username||'Neutral')+'</small></button>'}).join('')+'</div><div class="source-actionbar">'+actions.map(sourceActionButton).join('')+'</div><div class="source-note">Attack and fortify targets are selected from the source territory graph; the server engine validates adjacency, armies and dice.</div></div>';
 let selected=null;const get=a=>(actions||[]).find(x=>x.action===a);
 $$('[data-risk-id]').forEach(b=>b.onclick=()=>{const id=b.dataset.riskId,q=s.territories?.[id];if(phase==='reinforce'&&get('placeReinforcement')?.enabled&&q?.ownerId===me){const n=Number(prompt('Armies to place'));if(Number.isInteger(n)&&n>0)sendSourceAction('placeReinforcement',{territoryId:id,count:n});return}if(!selected){selected=id;b.classList.add('selected');return}const from=selected;$$('[data-risk-id]').forEach(x=>x.classList.remove('selected'));selected=null;if(phase==='attack'&&get('attackTerritory')?.enabled){const dice=Number(prompt('Attacker dice (1-3)'));if(Number.isInteger(dice)&&dice>=1&&dice<=3)sendSourceAction('attackTerritory',{from,to:id,attackerDice:dice})}else if(phase==='fortify'&&get('fortify')?.enabled){const n=Number(prompt('Armies to fortify'));if(Number.isInteger(n)&&n>0)sendSourceAction('fortify',{from,to:id,count:n})}});
 $$('[data-src-action]').forEach(b=>b.onclick=()=>{const a=b.dataset.srcAction,d=get(a);if(!d?.enabled)return;if(a==='tradeCards'){const hand=p?.hand||[];if(hand.length<3)return toast('Need 3 cards');sendSourceAction(a,{cardIds:hand.slice(0,3).map(x=>x.id)});return}sendSourceAction(a,{})});
}
function renderLifeSource(el,r){
 const s=r.state,me=state.me.id,p=s.players?.find(x=>x.userId===me),actions=r.actions||[],board=s.config?.board||[];
 el.innerHTML='<div class="source-life"><div class="source-game-kicker">SOURCE ENGINE · LAN GAMES · THE GAME OF LIFE</div><div class="life-head"><div><b>'+escapeHtml(p?.username||'Player')+'</b><span>$'+Number(p?.cash||0).toLocaleString()+' · '+escapeHtml(p?.career?.name||p?.careerId||'Career')+'</span></div><span class="status-pill">'+escapeHtml(s.turnState?.phase||'playing')+'</span></div><div class="life-track">'+board.map((sq,i)=>'<div class="life-cell '+(i===p?.position?'here':'')+'"><small>'+i+'</small><b>'+escapeHtml(sq?.label||sq?.name||sq?.id||'Tile')+'</b></div>').join('')+'</div><div class="life-state"><span>Position <b>'+Number(p?.position||0)+'</b></span><span>Children <b>'+Number(p?.children||0)+'</b></span><span>Stock <b>'+String(p?.stockNumber??'—')+'</b></span></div><div class="source-actionbar">'+actions.map(sourceActionButton).join('')+'</div><div class="source-note">Spin, insurance, stock and pending career/salary/house/branch choices come directly from the source action descriptors.</div></div>';
 $$('[data-src-action]').forEach(b=>b.onclick=()=>{const a=b.dataset.srcAction,d=actions.find(x=>x.action===a);if(!d?.enabled)return;let payload={...(d.data||{})};if(['chooseBranch','chooseCareer','chooseSalary','chooseHouse'].includes(a)){const id=prompt(d.label+'\nEnter choice id',d.data?.nextSquareId||d.data?.cardId||d.data?.houseId||'');if(!id)return;if(a==='chooseBranch')payload={nextSquareId:id};else if(a==='chooseCareer')payload={cardId:id};else if(a==='chooseSalary')payload={cardId:id};else payload={houseId:id}}sendSourceAction(a,payload)});
}
function renderXiangqi(el,r){
 const s=r.state||{},me=r.players.findIndex(p=>p.id===state.me.id),turn=s.currentPlayer===me,legal=Array.isArray(s.legalMoves)?s.legalMoves:[];
 const glyph={K:'♚',A:'♛',E:'♝',H:'♞',R:'♜',C:'◉',P:'♟'};
 const board=s.board||[];
 const moveKey=(m)=>m.fromRow+','+m.fromCol+'>'+m.toRow+','+m.toCol;
 let selected=null;
 const legalSet=new Set(legal.map(moveKey));
 el.innerHTML='<div class="xiangqi-shell source-board-shell"><div class="source-game-kicker">SOURCE ENGINE · GAMENEST · CHINESE CHESS</div><div class="xiangqi-status"><span>'+(turn?'Your move':'Opponent move')+'</span><span>Red '+(s.currentPlayer===0?'':'')+' · Moves '+(s.moveHistory?.length||0)+'</span></div><div class="xiangqi-board-wrap"><div class="xiangqi-board">'+board.map((row,y)=>row.map((p,x)=>{const key=y+','+x;const cls=(p?.side===me?'mine ':'')+(selected===key?'selected ':'');return '<button class="xiangqi-cell '+cls+'" data-xq="'+key+'">'+(p?glyph[p.type]:'')+'</button>'}).join('')).join('')+'</div></div><div class="game-note">Select a piece, then a highlighted legal destination. Palace, cannon screens, horse legs, river rules, flying generals, check and checkmate come from the retained GameNest source.</div></div>';
 if(!turn)return;
 const refresh=()=>document.querySelectorAll('[data-xq]').forEach(b=>{const [y,x]=b.dataset.xq.split(',').map(Number);b.classList.toggle('legal',!!selected&&legalSet.has(selected+'>'+y+','+x));b.classList.toggle('selected',selected===b.dataset.xq)});
 document.querySelectorAll('[data-xq]').forEach(b=>b.onclick=()=>{const key=b.dataset.xq;const [y,x]=key.split(',').map(Number);if(!selected){const p=board[y]?.[x];if(!p||p.side!==me)return;selected=key;refresh();return}const [fy,fx]=selected.split(',').map(Number);const candidate=fy+','+fx+'>'+y+','+x;if(legalSet.has(candidate)){sendMove({from:{row:fy,col:fx},to:{row:y,col:x}});selected=null;refresh()}else{const p=board[y]?.[x];selected=p&&p.side===me?key:null;refresh()}});
}
function renderGo9(el,r){
 const s=r.state||{},me=r.players.findIndex(p=>p.id===state.me.id),turn=s.currentPlayer===me;
 const board=s.board||[];
 el.innerHTML='<div class="go9-shell source-board-shell"><div class="source-game-kicker">SOURCE ENGINE · GAMENEST · GO 9×9</div><div class="go9-head"><span>'+(turn?'Your move':'Opponent move')+'</span><span>Captures '+(s.captures?.[me]||0)+' · '+(s.captures?.[1-me]||0)+'</span></div><div class="go9-board">'+board.flatMap((row,y)=>row.map((v,x)=>'<button class="go9-point '+(((x+y)%2)?'alt':'')+'" data-go9="'+y+','+x+'">'+(v===1?'●':v===2?'○':'')+'</button>')).join('')+'</div><div class="source-actionbar"><button class="ghost" id="go9Pass" '+(turn?'':'disabled')+'>Pass</button></div><p class="game-note">Place stones, capture groups with no liberties, respect ko, and pass twice to score. The board/rules are retained from the GameNest 9×9 source.</p></div>';
 document.querySelectorAll('[data-go9]').forEach(b=>b.onclick=()=>{if(turn){const [y,x]=b.dataset.go9.split(',').map(Number);sendMove({row:y,col:x})}});
 document.querySelector('#go9Pass')?.addEventListener('click',()=>sendMove({pass:true}));
}
function renderBoard(r){const el=$('#gameBoard');const s=r.state;if(r.status!=='lobby'&&['tictactoe','battleship','yahtzee','monopoly','risk','life'].includes(r.game)){if(r.game==='monopoly'){renderMonopolySource(el,r);return}if(r.game==='risk'){renderRiskSource(el,r);return}if(r.game==='life'){renderLifeSource(el,r);return}if(renderLanSourceGame(el,r))return}if(r.status==='lobby'){el.innerHTML=`<div class="lobby-panel"><div class="lobby-icon">${icons[r.game]||'◈'}</div><span class="eyebrow">PRIVATE ROOM</span><h3>Waiting for opponent</h3><p>Share the code or send the invite link. Your game starts automatically when the second player joins.</p><div class="room-code-big">${r.code}</div><div class="lobby-actions"><button class="primary" id="copyRoom">Copy room code</button><button class="ghost" id="copyInvite">Copy invite link</button><button class="ghost" id="shareInvite">Share</button></div></div>`;$('#copyRoom').onclick=async()=>{try{await navigator.clipboard.writeText(r.code);toast('Room code copied')}catch{toast(r.code)}};$('#copyInvite').onclick=copyCurrentRoomLink;$('#shareInvite').onclick=shareCurrentRoom;return}
 if(r.game==='breakout')return renderBreakout(el,r);
 if(r.game==='spaceinvaders')return renderSpaceInvaders(el,r);
 if(r.game==='pacman')return renderPacman(el,r);
 if(r.game==='frogger')return renderFrogger(el,r);
 if(r.game==='flappy')return renderFlappy(el,r);
 if(r.game==='sudoku')return renderSudoku(el,r);
 if(r.game==='tictactoe')return el.innerHTML=`<div class="board-ttt">${s.board.map((v,i)=>`<button class="cell" data-c="${i}">${v===null?'':v===0?'×':'○'}</button>`).join('')}</div>`,$$('[data-c]').forEach(b=>b.onclick=()=>sendMove({cell:b.dataset.c}));
 if(r.game==='connect4')return el.innerHTML=`<div class="board-c4">${s.board.flatMap((row,y)=>row.map((v,x)=>`<button class="c4 ${v==='black'?'p0':v==='red'?'p1':''}" data-col="${x}" data-row="${y}" aria-label="Column ${x+1}"></button>`)).join('')}</div>`,$('[data-col]').forEach(b=>b.onclick=()=>sendMove({col:b.dataset.col}));
 if(r.game==='rps')return el.innerHTML=`<div style="text-align:center"><h2>Round ${s.round}</h2><p style="color:#777">${s.choices[state.room.players.findIndex(p=>p.id===state.me.id)]?'Choice locked':'Choose your move'}</p><div class="game-actions"><button class="primary big-action" data-rps="rock">✊ Rock</button><button class="ghost big-action" data-rps="paper">✋ Paper</button><button class="ghost big-action" data-rps="scissors">✌ Scissors</button></div><p style="color:#777">${s.score[0]} — ${s.score[1]}</p></div>`,$('[data-rps]').forEach(b=>b.onclick=()=>sendMove({choice:b.dataset.rps}));
 if(r.game==='dotsboxes')return renderDotsBoxes(el,s);
 if(r.game==='gomoku')return renderGomoku(el,s);
 if(r.game==='xiangqi')return renderXiangqi(el,r);
 if(r.game==='go9')return renderGo9(el,r);
 if(r.game==='chess')return renderChess(el,s);
 if(r.game==='backgammon')return renderBackgammon(el,s);
 if(r.game==='ludo')return renderLudo(el,s);
 if(r.game==='dominoes')return renderDominoes(el,s);
 if(r.game==='mancala')return renderMancala(el,s);
 if(r.game==='checkers')return renderCheckers(el,s);
 if(r.game==='battleship')return renderBattle(el,s);
 if(r.game==='memory'){const score=s.score||[0,0],cards=Array.isArray(s.cards)?s.cards:[];el.innerHTML='<div class="source-board-shell"><div class="source-game-kicker">SOURCE ENGINE · BATTLEBOX</div><div class="memory-grid">'+cards.map((v,i)=>'<button class="memory-card '+(v!==null?'up':'')+'" data-memory="'+i+'">'+(v===null?'?':(typeof v==='object'?(v.v??v.value??''):(Number(v)+1)))+'</button>').join('')+'</div><p class="scoreline">You '+(score[0]||0)+' — Opponent '+(score[1]||0)+'</p><p class="game-note">'+(s.currentPlayer===state.room.players.findIndex(p=>p.id===state.me.id)?'Your turn':'Opponent turn')+'</p></div>';$$('[data-memory]').forEach(b=>b.onclick=()=>sendMove({card:b.dataset.memory}));return;}
 if(r.game==='minesweeper'){const rows=s.rows||10,cols=s.cols||10,board=s.board||[];el.innerHTML='<div class="source-board-shell"><div class="source-game-kicker">SOURCE ENGINE · GAMENEST</div><div class="mine-grid">'+Array.from({length:rows*cols},(_,i)=>{const cell=board[Math.floor(i/cols)]?.[i%cols]||{};const cls=cell.revealed?'revealed':'';const v=cell.revealed?(cell.exploded?'×':(cell.adjacent||'')):(cell.flagged?'⚑':'?');return '<button class="mine '+cls+'" data-mine="'+i+'">'+v+'</button>'}).join('')+'</div><p class="game-note">'+(s.alive?'Reveal safe cells.':'You are out.')+' Cleared '+(s.revealedCount||0)+' safe cells.</p></div>';$$('[data-mine]').forEach(b=>b.onclick=()=>sendMove({action:'reveal',row:Math.floor(+b.dataset.mine/cols),col:+b.dataset.mine%cols}));return;}
 if(r.game==='anagram')return renderAnagram(el,s);
 if(r.game==='numberhunt')return renderNumberHunt(el,s);
 if(r.game==='speedtyping')return renderSpeedTyping(el,s);
 if(r.game==='wordchain'){return renderWordChain(el,s);}
function renderHangman(el,r){
  const s=r.state,me=r.players.findIndex(p=>p.id===state.me.id),p=s.players?.[me];
  if(!p){el.innerHTML='<div class="source-board-shell"><p>Hangman state unavailable.</p></div>';return}
  const alphabet='abcdefghijklmnopqrstuvwxyz'.split('');
  el.innerHTML='<div class="hangman-wrap"><div class="source-game-kicker">SOURCE ENGINE · T.MATTH11 HANGMAN</div><div class="hangman-top"><div><span class="eyebrow">HINT</span><p class="hangman-hint">'+escapeHtml(p.hint||'Hidden hint')+'</p></div><div class="status-pill">'+p.wrongGuessCount+'/'+p.maxGuesses+' wrong</div></div><div class="hangman-word">'+escapeHtml(p.display||'')+'</div><div class="hangman-keyboard">'+alphabet.map(ch=>'<button class="hangman-key '+(p.usedLetters?.includes(ch)?'used':'')+'" data-hletter="'+ch+'" '+(p.usedLetters?.includes(ch)||p.solved||p.lost?'disabled':'')+'>'+ch.toUpperCase()+'</button>').join('')+'</div><p class="game-note">'+(p.solved?'Solved!':p.lost?'You ran out of guesses.':'Guess a letter. First player to solve wins.')+'</p></div>';
  $$('[data-hletter]').forEach(b=>b.onclick=()=>sendMove({letter:b.dataset.hletter}));
}
 if(r.game==='hangman')return renderHangman(el,r);
 if(r.game==='wordbattle'){const gs=s.gameState||s,players=s.players||r.players,me=state.me.id;return el.innerHTML=`<div class="wordbattle-source"><div class="status-pill source-badge">SOURCE WORD CHAIN</div><div class="source-letter">${escapeHtml(String(gs.lastLetter||'A').toUpperCase())}</div><p class="game-note">${gs.currentPlayer===r.players.findIndex(p=>p.id===me)?'Your word must begin with the current letter.':'Opponent is choosing.'}</p><div class="scoreline">${players.map(p=>escapeHtml(p.name||'Player')+' '+(p.score||0)).join(' — ')}</div><form id="wordForm"><input class="word-input" id="wordInput" placeholder="Type a word" autocomplete="off"><button class="primary" style="margin-top:8px">Play word</button></form><p class="game-note">${(gs.chain||[]).length} words in chain</p></div>`,$('#wordForm').onsubmit=e=>{e.preventDefault();sendMove({word:$('#wordInput').value.trim()});$('#wordInput').value=''};}
 if(r.game==='uno')return renderUno(el,s);
 if(r.game==='reaction'){const ready=s.phase==='armed';const waiting=s.phase==='waiting';return el.innerHTML=`<div class="source-board-shell reaction-shell"><div class="source-game-kicker">SOURCE ENGINE · BATTLEBOX REACTION</div><div class="reaction-orb ${ready?'go':''}">${ready?'GO!':waiting?'WAIT':'NEXT ROUND'}</div><div class="scoreline">You ${s.scores[meIndex()]??0} — Opponent ${s.scores[1-meIndex()]??0}</div><button class="primary" id="reactionBtn" ${ready?'':'disabled'}>${ready?'CLICK NOW':'WAITING FOR SIGNAL'}</button><p class="game-note">First valid click after GO wins the round.</p></div>`;$('#reactionBtn').onclick=()=>sendMove({});}
 if(['pool','carrom'].includes(r.game))return renderCanvasGame(el,r);
 if(r.game==='minigolf')return renderMiniGolfSource(el,r);
 if(r.game==='racing')return renderRace(el,r);
 if(r.game==='pong')return renderPong(el,r);
 if(r.game==='othello')return renderOthello(el,r);
 if(r.game==='game2048')return render2048(el,r);
 if(r.game==='snake')return renderSnake(el,r);
 if(r.game==='tetris')return renderTetris(el,r);
}
function renderAnagram(el,s){
 const me=state.room.players.findIndex(p=>p.id===state.me.id),turn=(s.currentPlayer??0)===me;
 el.innerHTML='<div class="source-board-shell wordgame-shell"><div class="source-game-kicker">SOURCE ENGINE · BATTLEBOX</div><div class="glass-mini wordgame-prompt"><span class="eyebrow">SCRAMBLED WORD</span><strong>'+escapeHtml(String(s.scrambled||'—'))+'</strong><small>Round '+(s.round||1)+' / '+(s.maxRounds||10)+' · '+(turn?'Your turn':'Opponent turn')+'</small></div><form id="anagramForm" class="wordgame-form"><input id="anagramInput" class="word-input" placeholder="Unscramble the word" '+(!turn?'disabled':'')+'><button class="primary" '+(!turn?'disabled':'')+'>Submit</button></form><div class="scoreline">'+state.room.players.map((p,i)=>escapeHtml(p.name)+' '+(s.scores?.[i]??p.score??0)).join(' · ')+'</div></div>';
 $('#anagramForm')?.addEventListener('submit',e=>{e.preventDefault();const w=$('#anagramInput').value.trim();if(w)sendMove({word:w})});
}
function renderNumberHunt(el,s){
 const me=state.room.players.findIndex(p=>p.id===state.me.id),guesses=s.guesses||{};
 el.innerHTML='<div class="source-board-shell wordgame-shell"><div class="source-game-kicker">SOURCE ENGINE · BATTLEBOX</div><div class="glass-mini wordgame-prompt"><span class="eyebrow">GUESS THE TARGET</span><strong>10 — 30</strong><small>Round '+(s.round||1)+' / '+(s.maxRounds||6)+'</small></div><form id="numberHuntForm" class="wordgame-form"><input id="numberHuntInput" class="word-input" type="number" min="10" max="30" step="1" placeholder="Enter 10–30"><button class="primary">Lock guess</button></form><div class="guess-status">'+Object.entries(guesses).map(([k,v])=>'<span class="word-chip">'+escapeHtml(k)+': '+escapeHtml(v)+'</span>').join('')+'</div><p class="game-note">'+(s.revealedTarget!=null?'Target: '+s.revealedTarget:'The target stays hidden until the round resolves.')+'</p></div>';
 $('#numberHuntForm')?.addEventListener('submit',e=>{e.preventDefault();const v=Number($('#numberHuntInput').value);if(Number.isInteger(v)&&v>=10&&v<=30)sendMove({guess:v})});
}
function renderSpeedTyping(el,s){
 const me=state.room.players.findIndex(p=>p.id===state.me.id),done=s.completed||{};
 el.innerHTML='<div class="source-board-shell wordgame-shell"><div class="source-game-kicker">SOURCE ENGINE · BATTLEBOX</div><div class="glass-mini wordgame-prompt"><span class="eyebrow">TYPE THIS WORD</span><strong>'+escapeHtml(String(s.currentWord||'—'))+'</strong><small>Word '+((s.currentWordIndex||0)+1)+' / 10</small></div><form id="speedTypingForm" class="wordgame-form"><input id="speedTypingInput" class="word-input" autocomplete="off" placeholder="Type exactly..." '+(done['p'+me]>(s.currentWordIndex||0)?'disabled':'')+'><button class="primary">Submit</button></form><div class="guess-status">'+Object.entries(done).map(([k,v])=>'<span class="word-chip">'+escapeHtml(k)+': '+escapeHtml(v)+'</span>').join('')+'</div></div>';
 $('#speedTypingForm')?.addEventListener('submit',e=>{e.preventDefault();const v=$('#speedTypingInput').value.trim();if(v)sendMove({typed:v})});
}
function renderUno(el,s){
 const me=state.room.players.findIndex(p=>p.id===state.me.id),turn=s.turn===me,hand=s.hand||[],top=s.discard?.[0],color=s.currentColor||'';
 const canPlay=c=>c&&(c.color==='wild'||c.color===color||c.value===top?.value);
 el.innerHTML='<div class="uno-wrap source-board-shell"><div class="source-game-kicker">SOURCE ENGINE · GAMENEST UNO</div><div class="uno-meta"><div class="glass-mini"><span class="eyebrow">COLOR</span><b>'+escapeHtml(color.toUpperCase()||'—')+'</b></div><div class="glass-mini"><span class="eyebrow">DRAW STACK</span><b>+'+(s.drawStack||0)+'</b></div><div class="glass-mini"><span class="eyebrow">CARDS</span><b>'+(hand.length)+'</b></div></div><div class="uno-center"><div class="uno-pile">'+(top?'<div class="uno-card '+escapeHtml(top.color)+'"><b>'+escapeHtml(top.value)+'</b></div>':'—')+'</div><div class="game-note">'+(turn?'Your turn':'Opponent turn')+'</div></div><div class="eyebrow">YOUR HAND</div><div class="uno-cards">'+hand.map(c=>'<button class="uno-card '+escapeHtml(c.color)+' '+(turn&&canPlay(c)?'playable':'')+'" data-uno-card="'+escapeHtml(c.id)+'" '+(turn&&canPlay(c)?'':'disabled')+'><b>'+escapeHtml(c.value)+'</b><small>'+escapeHtml(c.color)+'</small></button>').join('')+'</div><div class="game-actions"><button class="ghost" id="unoDraw" '+(!turn?'disabled':'')+'>Draw</button><button class="ghost" id="unoCall" '+(hand.length===1&&!s.unoCalled?'':'disabled')+'>UNO!</button></div></div>';
 $$('[data-uno-card]').forEach(b=>b.onclick=()=>{const c=hand.find(x=>x.id===b.dataset.unoCard);if(c?.color==='wild'||c?.value==='+4'){const chosen=(prompt('Choose color: red, blue, green or yellow')||'red').toLowerCase();if(!['red','blue','green','yellow'].includes(chosen))return;sendMove({cardId:c.id,chosenColor:chosen})}else sendMove({cardId:c.id})});
 $('#unoDraw')?.addEventListener('click',()=>sendMove({}));$('#unoCall')?.addEventListener('click',()=>sendMove({uno:true}));
}
function renderWordChain(el,s){
 const me=state.room.players.findIndex(p=>p.id===state.me.id),turn=s.currentPlayer===me;
 el.innerHTML='<div class="wordchain-wrap source-board-shell"><div class="source-game-kicker">SOURCE ENGINE · BATTLEBOX WORD CHAIN</div><div class="glass-mini"><span class="eyebrow">NEXT WORD</span><b class="wordchain-letter">'+escapeHtml(String(s.lastLetter||'ANY').toUpperCase())+'</b><span class="game-note">'+(turn?'Your turn':'Opponent turn')+'</span></div><div class="word-chain">'+(s.chain||[]).slice(-14).map(w=>'<span class="word-chip">'+escapeHtml(w)+'</span>').join('')+'</div><form id="wordChainForm"><input class="word-input" id="wordChainInput" placeholder="'+(s.lastLetter?'Starts with '+escapeHtml(s.lastLetter):'Enter a word')+'" '+(!turn?'disabled':'')+'><button class="primary" '+(!turn?'disabled':'')+'>Submit</button></form><p class="game-note">The upstream Word Chain rules and word list are used unchanged.</p></div>';
 $('#wordChainForm')?.addEventListener('submit',e=>{e.preventDefault();const w=$('#wordChainInput').value.trim();if(w)sendMove({word:w})});
}
function renderBackgammon(el,s){
 const me=state.room.players.findIndex(p=>p.id===state.me.id),turn=s.turn===me,dice=s.dice,legal=Array.isArray(s.legalMoves)?s.legalMoves:[];let selected=null;
 const usablePiece=id=>turn&&legal.some(m=>m.pieceId===id);
 const pointHtml=(p,idx)=>{const stack=p||[],top=stack[stack.length-1],usable=top&&top.type===me&&usablePiece(top.id),count=stack.length;return '<button class="bg-point '+(usable?'usable':'')+'" data-bg-point="'+idx+'"><span class="bg-count">'+count+'</span><span class="bg-stack '+(top&&top.type===0?'white':'black')+'"></span></button>'};
 const stepsFor=pieceId=>[...new Set(legal.filter(m=>m.pieceId===pieceId).map(m=>m.steps))];
 el.innerHTML='<div class="backgammon-wrap"><div class="bg-head"><div><b>Backgammon</b><span>'+ (turn?'Your turn':'Opponent turn') +'</span></div><div class="bg-dice">'+(dice&&dice.values?dice.values.map(v=>'<span>'+v+'</span>').join(''):'')+'</div></div><div class="backgammon-board"><div class="bg-row top">'+Array.from({length:12},(_,k)=>pointHtml(s.points[23-k],23-k)).join('')+'</div><div class="bg-divider"></div><div class="bg-row bottom">'+Array.from({length:12},(_,k)=>pointHtml(s.points[k],k)).join('')+'</div><div class="bg-bars"><button class="bg-bar '+(((s.bar[me]||[]).length&&turn&&legal.some(m=>m.pieceId===s.bar[me][s.bar[me].length-1]))?'usable':'')+'" data-bg-bar>BAR <b>'+((s.bar[me]||[]).length)+'</b></button><div class="bg-out">You borne off <b>'+((s.outside[me]||[]).length)+'</b> · Opponent <b>'+((s.outside[1-me]||[]).length)+'</b></div></div></div><div class="bg-info">'+(turn?'Select a legal checker, then use one of its legal dice values.':'Waiting for opponent.')+'</div><div class="bg-steps">'+(legal.length?(selected?stepsFor(selected.pieceId):(dice&&dice.movesLeft?dice.movesLeft:[...new Set(legal.map(m=>m.steps))])).map(v=>'<button class="ghost bg-step" data-bg-step="'+v+'" '+(!turn?'disabled':'')+'>'+v+'</button>').join(''):'<span class="game-note">No legal move on this roll.</span>')+'</div></div>';
 $$('[data-bg-point]').forEach(b=>b.onclick=()=>{if(!turn)return;const idx=+b.dataset.bgPoint,stack=s.points[idx]||[],top=stack[stack.length-1];if(!top||top.type!==me||!usablePiece(top.id))return;selected={point:idx,pieceId:top.id};$$('[data-bg-point]').forEach(x=>x.classList.toggle('selected',x===b));const allowed=new Set(stepsFor(top.id));$$('[data-bg-step]').forEach(x=>x.classList.toggle('active',allowed.has(+x.dataset.bgStep)));});
 $('[data-bg-bar]')?.addEventListener('click',()=>{if(turn&&(s.bar[me]||[]).length){const id=s.bar[me][s.bar[me].length-1];if(usablePiece(id))selected={point:-1,pieceId:id};}});
 $$('[data-bg-step]').forEach(b=>b.onclick=()=>{if(!selected)return toast('Select a legal checker first');const step=+b.dataset.bgStep;if(!legal.some(m=>m.pieceId===selected.pieceId&&m.steps===step))return toast('That die cannot move the selected checker');sendMove({pieceId:selected.pieceId,steps:step});selected=null;});
}

function renderLudo(el,s){
 const me=state.room.players.findIndex(p=>p.id===state.me.id);
 const mine=s.tokens?.filter(t=>t.player===me)||[];
 const canRoll=s.phase==='roll'&&s.turn===me;
 const canMove=s.phase==='move'&&s.turn===me;
 const cell=(t)=>t.position==='still'?'YARD':t.position==='home'?'HOME':String(t.position||'TRACK');
 el.innerHTML='<div class="source-board-shell ludo-shell"><div class="source-game-kicker">SOURCE ENGINE · CHUKWUMAIJEM/LUDO</div><div class="ludo-head"><div><b>'+escapeHtml(state.me.name)+'</b><span>'+(s.turn===me?'Your turn':'Opponent turn')+' · '+(s.phase||'playing').toUpperCase()+'</span></div><div class="ludo-die">'+(s.dice??'—')+'</div></div><div class="ludo-board"><div class="ludo-quadrant p0"><strong>P1</strong></div><div class="ludo-track" id="ludoTrack"></div><div class="ludo-quadrant p1"><strong>P2</strong></div><div class="ludo-center">HOME</div></div><div class="ludo-token-row">'+mine.map(t=>'<button class="ludo-token '+(canMove&&canMoveTokenView(s,t)?'ready':'')+'" data-ludo-token="'+escapeHtml(t.id)+'"><b>'+escapeHtml(t.id.split('-')[1])+'</b><span>'+escapeHtml(cell(t))+'</span></button>').join('')+'</div><div class="source-actionbar"><button class="primary" id="ludoRoll" '+(canRoll?'':'disabled')+'>ROLL DICE</button></div><p class="game-note">The token path uses the vendored upstream Ludo seed-path implementation; UI skin is NEXUS only.</p></div>';
 const track=$('#ludoTrack');if(track){
   const p0=s.paths?.[0]||[],p1=s.paths?.[1]||[],all=[...new Set([...p0,...p1].filter(x=>x&&x!=='still'&&x!=='home'))];
   track.innerHTML=all.map((pos,k)=>'<span class="ludo-track-cell"><small>'+((k+1)%100)+'</small>'+escapeHtml(pos.replace('HL-','H').replace('VT-','V').replace('HR-','R').replace('VB-','B'))+'</span>').join('');
 }
 $('#ludoRoll')?.addEventListener('click',()=>sendMove({action:'roll'}));
 $('[data-ludo-token]').forEach(b=>b.onclick=()=>{if(!canMove)return;sendMove({action:'move',tokenId:b.dataset.ludoToken})});
}
function canMoveTokenView(s,t){const d=Number(s.dice);return (t.position==='still'&&d===6)||(t.position!=='still'&&t.position!=='home'&&d>0&&d<=Number(t.movesLeft||0))}

function renderMancala(el,s){
 const me=state.room.players.findIndex(p=>p.id===state.me.id),turn=s.turn===me;
 const my=s.myPit||[],opp=s.opponentPit||[];
 const pit=(n,count,enabled)=>'<button class="mancala-pit '+(enabled?'playable':'')+'" data-mancala="'+n+'"><b>'+count+'</b><span>P'+(n+1)+'</span></button>';
 el.innerHTML='<div class="mancala-shell source-board-shell"><div class="source-game-kicker">SOURCE ENGINE · HALILAYYILDIZ / MANCALA</div><div class="mancala-head"><div><b>'+escapeHtml(state.me.name)+'</b><span>'+(turn?'Your turn':'Opponent turn')+'</span></div><div class="status-pill">'+(turn?'Choose a pit':'Waiting')+'</div></div><div class="mancala-board"><div class="mancala-store opponent"><span>Opponent</span><b>'+Number(s.opponentStore||0)+'</b></div><div class="mancala-rows"><div class="mancala-row opponent-row">'+opp.slice().reverse().map((v,n)=>'<div class="mancala-view-pit"><b>'+v+'</b><span>O'+(6-n)+'</span></div>').join('')+'</div><div class="mancala-row my-row">'+my.map((v,n)=>pit(n,v,turn&&Number(v)>0)).join('')+'</div></div><div class="mancala-store mine"><span>You</span><b>'+Number(s.myStore||0)+'</b></div></div><div class="mancala-rule">6 stones per pit · sow counter-clockwise · landing in your store gives another turn · landing in an empty own pit captures the opposite pit.</div></div>';
 $('[data-mancala]').forEach(b=>b.onclick=()=>{if(turn)sendMove({pit:+b.dataset.mancala})});
}
function renderDominoes(el,s){
 const me=state.room.players.findIndex(p=>p.id===state.me.id),turn=s.turn===me;
 const playable=(s.hands?.[me]||[]).filter(t=>s.chain?.length?dominoCanPlaceView(t,s.head,s.tail):(turn&&t.isDouble&&t.left===Number(s.starterDouble)));
 const chain=(s.chain||[]);
 const tile=(t,clickable=false)=>'<button class="domino-tile '+(clickable?'playable':'')+'" '+(clickable?'data-domino-tile="'+escapeHtml(t.id)+'"':'')+'><span>'+t.left+'</span><i></i><span>'+t.right+'</span></button>';
 el.innerHTML='<div class="source-board-shell domino-shell"><div class="source-game-kicker">SOURCE ENGINE · PPYNE/DOMINOES</div><div class="domino-head"><div><b>'+escapeHtml(state.me.name)+'</b><span>'+(turn?'Your turn':'Opponent turn')+' · Boneyard '+(s.boneyard?.length||0)+'</span></div><div class="domino-ends"><span>'+String(s.head??'—')+'</span><span>'+String(s.tail??'—')+'</span></div></div><div class="domino-chain">'+(chain.length?chain.map(tile).join(''):'<div class="game-note">Highest double starts the chain.</div>')+'</div><div class="domino-hand">'+(s.hands?.[me]||[]).map(t=>tile(t,turn&&!!playable.find(x=>x.id===t.id))).join('')+'</div><div class="source-actionbar"><button class="ghost" id="dominoLeft" '+(turn?'':'disabled')+'>Place left</button><button class="primary" id="dominoRight" '+(turn?'':'disabled')+'>Place right</button><button class="ghost" id="dominoDraw" '+(turn&&s.boneyard?.length?'':'disabled')+'>Draw</button></div><p class="game-note">Double-six rules: highest double starts; match the open end; if you cannot play, draw from the boneyard.</p></div>';
 let selected=null;
 $('[data-domino-tile]').forEach(b=>b.onclick=()=>{selected=b.dataset.dominoTile;$('[data-domino-tile]').forEach(x=>x.classList.toggle('selected',x===b))});
 $('#dominoLeft')?.addEventListener('click',()=>{if(selected)sendMove({action:'place',tileId:selected,end:'left'});else toast('Select a playable domino')});
 $('#dominoRight')?.addEventListener('click',()=>{if(selected)sendMove({action:'place',tileId:selected,end:'right'});else toast('Select a playable domino')});
 $('#dominoDraw')?.addEventListener('click',()=>sendMove({action:'draw'}));
}
function dominoCanPlaceView(t,l,r){return l==null||r==null||t.left===l||t.right===l||t.left===r||t.right===r}
function renderOthello(el,r){const s=r.state,me=r.players.findIndex(p=>p.id===state.me.id);el.innerHTML='<div class="othello-wrap"><div class="board-othello">'+s.board.flatMap((row,y)=>row.map((v,x)=>'<button class="oth-cell '+((x+y)%2?'dark':'light')+'" data-oth="'+(y*8+x)+'">'+(v==null?'':v===0?'●':'○')+'</button>')).join('')+'</div><div class="scoreline">Black '+s.scores[0]+' — White '+s.scores[1]+'</div><p class="game-note">'+(s.turn===me?'Your move.':'Opponent move.')+'</p></div>';$('[data-oth]').forEach(b=>b.onclick=()=>sendMove({cell:+b.dataset.oth}))}
function render2048(el,r){const s=r.state||{},board=Array.isArray(s.board)?s.board:(Array.isArray(s.board?.[0])?s.board.flat():[]);el.innerHTML='<div class="duel-wrap source-board-shell"><div class="source-game-kicker">SOURCE ENGINE · GAMENEST 2048</div><div class="board-2048">'+board.map((v,i)=>'<button class="tile2048 t'+(v||0)+'" data-2048="'+i+'">'+(v||'')+'</button>').join('')+'</div><div class="scoreline">Score '+(s.score||0)+' · Room best '+(s.highScore||s.score||0)+' · '+(s.alive===false?'Locked':'Live')+'</div><div class="touch-pad"><button data-2048-dir="up">↑</button><button data-2048-dir="left">←</button><button data-2048-dir="right">→</button><button data-2048-dir="down">↓</button></div><p class="game-note">Reach 2048 first. Use arrows, WASD or touch.</p></div>';$$('[data-2048-dir]').forEach(b=>b.onclick=()=>sendMove({dir:b.dataset['2048Dir']}));}
function renderPong(el,r){el.innerHTML='<div class="pong-wrap"><canvas id="pongCanvas" class="game-canvas"></canvas><div class="physics-hud"><span id="pongScore"></span><span>W/S or ↑/↓ • mouse/touch</span></div></div>';const c=$('#pongCanvas');const sendY=y=>{const q=c.getBoundingClientRect();state.socket.emit('drive',{axis:(Math.max(.05,Math.min(.95,(y-q.top)/q.height))-.5)*2})};c.onpointermove=e=>{if(e.buttons)sendY(e.clientY)};c.ontouchmove=e=>{e.preventDefault();sendY(e.touches[0].clientY)};const draw=()=>{const st=state.room?.state||r.state,d=devicePixelRatio||1,w=c.clientWidth,h=c.clientHeight,g=c.getContext('2d');if(!w||!h)return;c.width=w*d;c.height=h*d;g.setTransform(d,0,0,d,0,0);g.fillStyle='#050505';g.fillRect(0,0,w,h);g.strokeStyle='#1f1f1f';g.setLineDash([8,10]);g.beginPath();g.moveTo(w/2,0);g.lineTo(w/2,h);g.stroke();g.setLineDash([]);g.fillStyle='#fff';g.fillRect(18,st.paddles[0]*h-40,12,80);g.fillStyle='#777';g.fillRect(w-30,st.paddles[1]*h-40,12,80);g.fillStyle='#eee';g.beginPath();g.arc(st.ball.x*w,st.ball.y*h,9,0,Math.PI*2);g.fill();$('#pongScore').textContent=st.scores[0]+' — '+st.scores[1]};const kd=e=>{if(e.key==='w'||e.key==='ArrowUp'){e.preventDefault();state.socket.emit('drive',{axis:-1})}else if(e.key==='s'||e.key==='ArrowDown'){e.preventDefault();state.socket.emit('drive',{axis:1})}};const ku=e=>{if(['w','s','ArrowUp','ArrowDown'].includes(e.key))state.socket.emit('drive',{axis:0})};window.addEventListener('keydown',kd);window.addEventListener('keyup',ku);window.addEventListener('resize',draw);state.realtimeDraw=draw;state.gameCleanup=()=>{window.removeEventListener('keydown',kd);window.removeEventListener('keyup',ku);window.removeEventListener('resize',draw)};draw()}
function renderSnake(el,r){el.innerHTML='<div class="snake-wrap source-board-shell"><div class="source-game-kicker">SOURCE ENGINE · GAMENEST SNAKEBATTLE</div><canvas id="snakeCanvas" class="game-canvas"></canvas><div class="physics-hud"><span id="snakeScore"></span><span>WASD / arrows</span></div></div>';const c=$('#snakeCanvas');const draw=()=>{const st=state.room?.state||r.state,d=devicePixelRatio||1,w=c.clientWidth,h=c.clientHeight,g=c.getContext('2d');if(!w||!h)return;c.width=w*d;c.height=h*d;g.setTransform(d,0,0,d,0,0);g.fillStyle='#050505';g.fillRect(0,0,w,h);const cw=w/st.width,ch=h/st.height;if(st.food){g.fillStyle='#aaa';g.beginPath();g.arc((st.food.x+.5)*cw,(st.food.y+.5)*ch,Math.min(cw,ch)*.35,0,Math.PI*2);g.fill()}(st.snakes||[]).forEach((sn,i)=>{g.fillStyle=i?'#777':'#fff';(sn.body||[]).forEach((p,j)=>{g.globalAlpha=j?Math.max(.35,1-j/(sn.body.length+2)):1;g.fillRect(p.x*cw+1,p.y*ch+1,cw-2,ch-2)});g.globalAlpha=1});$('#snakeScore').textContent=(st.snakes||[]).map(sn=>sn.score||0).join(' — ')};const key=e=>{const m={ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right'}[e.key];if(m){e.preventDefault();state.socket.emit('drive',{dir:m})}};window.addEventListener('keydown',key);window.addEventListener('resize',draw);state.realtimeDraw=draw;state.gameCleanup=()=>{window.removeEventListener('keydown',key);window.removeEventListener('resize',draw);state.realtimeDraw=null};draw()}
function renderTetris(el,r){
  var me=r.players.findIndex(function(p){return p.id===state.me.id});
  el.innerHTML='<div class="tetris-source-wrap">'+
    '<div class="tetris-source-head"><div><span class="eyebrow">UPSTREAM TETRIS ENGINE</span><h3>7-Bag · SRS · Hold · Ghost · Lock Delay</h3></div><div class="scoreline" id="tetSourceScore"></div></div>'+
    '<div class="tetris-duel">'+
      '<div class="tet-column"><b>You</b><canvas id="tetMe" class="tet-canvas"></canvas><div class="tet-meta" id="tetMeMeta"></div></div>'+
      '<div class="tet-column"><b>Opponent</b><canvas id="tetOp" class="tet-canvas"></canvas><div class="tet-meta" id="tetOpMeta"></div></div>'+
      '<div class="tet-controls"><button data-tet="left">←</button><button data-tet="rotate">↻</button><button data-tet="right">→</button><button data-tet="down">↓</button><button data-tet="drop">DROP</button><button data-tet="hold">HOLD</button></div>'+
    '</div></div>';
  function draw(){
    var s=state.room&&state.room.state||r.state;
    if(!s||!Array.isArray(s.players))return;
    var a=s.players[me],b=s.players[1-me];
    if(!a||!b)return;
    drawTet('#tetMe',a);
    drawTet('#tetOp',b);
    var score=document.getElementById('tetSourceScore');
    var metaA=document.getElementById('tetMeMeta');
    var metaB=document.getElementById('tetOpMeta');
    if(score)score.textContent=(a.score||0)+' — '+(b.score||0);
    if(metaA)metaA.textContent='Score '+(a.score||0)+' · Lv '+(a.level||1)+' · Hold '+(a.hold||'—');
    if(metaB)metaB.textContent='Score '+(b.score||0)+' · Lv '+(b.level||1)+' · Hold '+(b.hold||'—');
  }
  $$('[data-tet]').forEach(function(btn){
    btn.onclick=function(){
      state.socket.emit('drive',{action:btn.dataset.tet},function(res){if(res&&res.error)toast(res.error)});
    };
  });
  function key(e){
    var map={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'rotate',ArrowDown:'down'};
    var action=map[e.key]||(e.key===' '?'drop':(e.key.toLowerCase()==='c'?'hold':'')); 
    if(action){e.preventDefault();state.socket.emit('drive',{action:action})}
  }
  window.addEventListener('keydown',key);
  window.addEventListener('resize',draw);
  state.realtimeDraw=draw;
  state.gameCleanup=function(){window.removeEventListener('keydown',key);window.removeEventListener('resize',draw);state.realtimeDraw=null};
  draw();
}
function drawTet(sel,p){
  var c=document.querySelector(sel);
  if(!c||!p)return;
  var d=window.devicePixelRatio||1;
  var w=Math.max(120,c.clientWidth||120),h=Math.max(240,c.clientHeight||240),ctx=c.getContext('2d');
  c.width=w*d;c.height=h*d;ctx.setTransform(d,0,0,d,0,0);ctx.fillStyle='#050505';ctx.fillRect(0,0,w,h);
  var rows=20,cols=10,cw=w/cols,ch=h/rows;
  function cell(x,y,v){
    if(y<0||y>=rows||x<0||x>=cols||!v)return;
    ctx.fillStyle=v==='I'?'#fff':v==='O'?'#ddd':v==='T'?'#bbb':v==='S'?'#aaa':v==='Z'?'#999':v==='J'?'#888':'#777';
    ctx.fillRect(x*cw+1,y*ch+1,cw-2,ch-2);
  }
  var board=Array.isArray(p.board)?p.board:[];
  for(var y=0;y<rows;y++)for(var x=0;x<cols;x++){ctx.strokeStyle='#141414';ctx.strokeRect(x*cw,y*ch,cw,ch);cell(x,y,board[y]&&board[y][x])}
  var cur=p.current;
  if(!cur||!cur.matrix)return;
  for(var my=0;my<cur.matrix.length;my++)for(var mx=0;mx<cur.matrix[my].length;mx++)if(cur.matrix[my][mx])cell(cur.x+mx,cur.y+my,cur.type);
}

function fitCanvas(canvas,w=900,h=600){const d=devicePixelRatio||1;const r=canvas.getBoundingClientRect();canvas.width=Math.max(1,Math.floor((r.width||w)*d));canvas.height=Math.max(1,Math.floor((r.height||h)*d));const ctx=canvas.getContext('2d');ctx.setTransform(d,0,0,d,0,0);return ctx}
function renderBreakout(el,r){
 const s=r.state?.you;if(!s)return;
 el.innerHTML='<div class="source-arcade-shell"><div class="source-game-kicker">SOURCE ENGINE · CANVAS GAMES / BREAKOUT</div><canvas id="breakoutCanvas" class="game-canvas" aria-label="Breakout"></canvas><div class="physics-hud"><span id="breakoutHud"></span><span>Move pointer • A/D</span></div></div>';
 const c=$('#breakoutCanvas'),viewW=900,viewH=600;
 const draw=()=>{const g=fitCanvas(c,viewW,viewH),sx=c.clientWidth/viewW||1,sy=c.clientHeight/viewH||1,st=state.room?.state?.you||s;g.fillStyle='#050505';g.fillRect(0,0,c.clientWidth,c.clientHeight);g.save();g.scale(sx,sy);g.fillStyle='#0d0d0d';g.fillRect(0,0,viewW,viewH);for(const b of st.bricks||[]){if(!b.alive)continue;g.fillStyle='#e8e8e8';g.globalAlpha=.45+(b.hp/b.maxHp)*.55;g.fillRect(b.x,b.y,b.w,b.h)}g.globalAlpha=1;g.fillStyle='#fff';g.fillRect(st.paddle.x,st.paddle.y,st.paddle.w,st.paddle.h);for(const b of st.balls||[]){g.fillStyle='#fff';g.beginPath();g.arc(b.x,b.y,b.r,0,Math.PI*2);g.fill()}g.fillStyle='#777';for(const p of st.powerups||[]){g.fillRect(p.x,p.y,p.w,p.h)}g.restore();$('#breakoutHud').textContent='Score '+st.score+' · Lives '+st.lives+' · Level '+st.level}
 const pointer=e=>{const q=c.getBoundingClientRect();sendDrive({x:(e.clientX-q.left)/q.width})};
 const key=e=>{const k=e.key.toLowerCase();if(k==='a'||k==='arrowleft'||k==='d'||k==='arrowright'){e.preventDefault();const dir=(k==='a'||k==='arrowleft')?-1:1;sendDrive({x:.5+dir*.25})}};
 c.onpointermove=pointer;window.addEventListener('keydown',key);window.addEventListener('resize',draw);state.realtimeDraw=draw;state.gameCleanup=()=>{c.onpointermove=null;window.removeEventListener('keydown',key);window.removeEventListener('resize',draw);state.realtimeDraw=null};draw();
}
function renderSpaceInvaders(el,r){
 const s=r.state?.you;if(!s)return;
 el.innerHTML='<div class="source-arcade-shell"><div class="source-game-kicker">SOURCE ENGINE · CANVAS GAMES / SPACE INVADERS</div><canvas id="invadersCanvas" class="game-canvas" aria-label="Space Invaders"></canvas><div class="source-actionbar"><button class="ghost" data-inv="left">◀</button><button class="primary" data-inv="fire">FIRE</button><button class="ghost" data-inv="right">▶</button></div><div class="physics-hud"><span id="invHud"></span><span>←/→ or A/D • Space</span></div></div>';
 const c=$('#invadersCanvas');
 const draw=()=>{const g=fitCanvas(c,800,600),st=state.room?.state?.you||s,w=c.clientWidth,h=c.clientHeight;g.fillStyle='#050505';g.fillRect(0,0,w,h);const sx=w/800,sy=h/600;g.save();g.scale(sx,sy);for(const sh of st.shields||[]){for(let y=0;y<sh.rows;y++)for(let x=0;x<sh.cols;x++)if(sh.grid[y][x]){g.fillStyle='#777';g.fillRect(sh.x+x*sh.blockSize,sh.y+y*sh.blockSize,sh.blockSize,sh.blockSize)}}for(const a of st.aliens||[]){if(a.alive){g.fillStyle='#fff';g.fillRect(a.x,a.y,a.w,a.h);g.fillStyle='#111';g.fillRect(a.x+7,a.y+6,4,4);g.fillRect(a.x+a.w-11,a.y+6,4,4)}}g.fillStyle='#fff';if(st.player?.alive)g.fillRect(st.player.x,st.player.y,st.player.w,st.player.h);for(const b of st.bullets||[]){g.fillStyle=b.fromPlayer?'#fff':'#888';g.fillRect(b.x,b.y,b.w,b.h)}if(st.ufo?.active){g.fillStyle='#aaa';g.fillRect(st.ufo.x,st.ufo.y,st.ufo.w,st.ufo.h)}g.restore();$('#invHud').textContent='Score '+st.score+' · Lives '+st.lives+' · Level '+st.level}
 const stateInput={left:false,right:false};
 const push=()=>sendDrive({left:stateInput.left,right:stateInput.right});
 const kd=e=>{const k=e.key.toLowerCase();if(k==='a'||k==='arrowleft'){e.preventDefault();stateInput.left=true;push()}else if(k==='d'||k==='arrowright'){e.preventDefault();stateInput.right=true;push()}else if(k===' '){e.preventDefault();sendDrive({shoot:true})}};
 const ku=e=>{const k=e.key.toLowerCase();if(k==='a'||k==='arrowleft'){stateInput.left=false;push()}else if(k==='d'||k==='arrowright'){stateInput.right=false;push()}};
 window.addEventListener('keydown',kd);window.addEventListener('keyup',ku);window.addEventListener('resize',draw);$$('[data-inv]').forEach(b=>b.onclick=()=>b.dataset.inv==='fire'?sendDrive({shoot:true}):(stateInput[b.dataset.inv]=true,push(),setTimeout(()=>{stateInput[b.dataset.inv]=false;push()},120)));state.realtimeDraw=draw;state.gameCleanup=()=>{window.removeEventListener('keydown',kd);window.removeEventListener('keyup',ku);window.removeEventListener('resize',draw);state.realtimeDraw=null};draw();
}
function renderPacman(el,r){
 const s=r.state?.you;if(!s)return;
 el.innerHTML='<div class="source-arcade-shell"><div class="source-game-kicker">SOURCE ENGINE · CANVAS GAMES / PAC-MAN</div><canvas id="pacCanvas" class="game-canvas" aria-label="Pac-Man"></canvas><div class="source-actionbar"><button data-pac="up">↑</button><button data-pac="left">←</button><button data-pac="down">↓</button><button data-pac="right">→</button></div><div class="physics-hud"><span id="pacHud"></span><span>Arrow keys / WASD</span></div></div>';
 const c=$('#pacCanvas'),cols=s.gridWidth,rows=s.gridHeight;
 const draw=()=>{const g=fitCanvas(c,840,720),st=state.room?.state?.you||s,w=c.clientWidth,h=c.clientHeight;g.fillStyle='#050505';g.fillRect(0,0,w,h);const cw=w/st.gridWidth,ch=h/st.gridHeight;for(let y=0;y<st.gridHeight;y++)for(let x=0;x<st.gridWidth;x++){const cell=st.grid[y][x];if(cell.type==='wall'){g.fillStyle='#333';g.fillRect(x*cw,y*ch,cw,ch)}else if(cell.type==='dot'){g.fillStyle='#ddd';g.beginPath();g.arc((x+.5)*cw,(y+.5)*ch,Math.max(1,Math.min(cw,ch)*.07),0,Math.PI*2);g.fill()}else if(cell.type==='power'){g.fillStyle='#fff';g.beginPath();g.arc((x+.5)*cw,(y+.5)*ch,Math.max(3,Math.min(cw,ch)*.18),0,Math.PI*2);g.fill()}}const p=st.pacman;g.fillStyle='#fff';g.beginPath();g.arc((p.pos.x+.5)*cw,p.pos.y*ch,Math.min(cw,ch)*.35,0,Math.PI*2);g.fill();for(const gh of st.ghosts||[]){if(!gh.active)continue;g.fillStyle=gh.mode==='frightened'?'#888':'#fff';g.beginPath();g.arc((gh.pos.x+.5)*cw,gh.pos.y*ch,Math.min(cw,ch)*.30,Math.PI,0);g.fill();g.fillRect((gh.pos.x+.5)*cw-Math.min(cw,ch)*.30,gh.pos.y*ch,Math.min(cw,ch)*.60,Math.min(cw,ch)*.18)}$('#pacHud').textContent='Score '+st.score+' · Lives '+st.lives+' · Dots '+st.dotsEaten+'/'+st.totalDots}
 const send=d=>sendDrive({dir:d});const kd=e=>{const k=e.key.toLowerCase(),m={arrowup:'up',w:'up',arrowdown:'down',s:'down',arrowleft:'left',a:'left',arrowright:'right',d:'right'}[k];if(m){e.preventDefault();send(m)}};window.addEventListener('keydown',kd);window.addEventListener('resize',draw);$$('[data-pac]').forEach(b=>b.onclick=()=>send(b.dataset.pac));state.realtimeDraw=draw;state.gameCleanup=()=>{window.removeEventListener('keydown',kd);window.removeEventListener('resize',draw);state.realtimeDraw=null};draw();
}
function renderFrogger(el,r){
 const s=r.state?.you;if(!s)return;
 el.innerHTML='<div class="source-arcade-shell"><div class="source-game-kicker">SOURCE ENGINE · CANVAS GAMES / FROGGER</div><canvas id="frogCanvas" class="game-canvas" aria-label="Frogger"></canvas><div class="source-actionbar"><button data-frog="up">↑</button><button data-frog="left">←</button><button data-frog="down">↓</button><button data-frog="right">→</button></div><div class="physics-hud"><span id="frogHud"></span><span>Arrow keys / WASD</span></div></div>';
 const c=$('#frogCanvas');
 const draw=()=>{const g=fitCanvas(c,900,650),st=state.room?.state?.you||s,w=c.clientWidth,h=c.clientHeight,laneH=h/st.lanes.length;g.fillStyle='#050505';g.fillRect(0,0,w,h);for(let row=0;row<st.lanes.length;row++){const lane=st.lanes[row];g.fillStyle=lane.kind==='river'?'#151515':lane.kind==='road'?'#090909':lane.kind==='goal'?'#1b1b1b':'#111';g.fillRect(0,row*laneH,w,laneH)}for(const pad of st.lilyPads||[]){g.fillStyle=pad.occupied?'#555':'#aaa';g.beginPath();g.arc((pad.col+.5)*st.cellW/w*w,(.5)*laneH,Math.min(st.cellW,laneH)*.28,0,Math.PI*2);g.fill()}for(const log of st.logs||[]){g.fillStyle='#666';g.fillRect(log.x,log.row*st.cellH,log.width,st.cellH*.72)}for(const v of st.vehicles||[]){g.fillStyle='#777';g.fillRect(v.x,v.row*st.cellH+st.cellH*.2,v.width,st.cellH*.6)}g.fillStyle='#fff';g.fillRect(st.frog.col*st.cellW,st.frog.row*st.cellH,st.cellW,st.cellH);$('#frogHud').textContent='Score '+st.score+' · Lives '+st.lives+' · Goals '+st.goalsReached+'/'+st.lilyPads.length}
 const kd=e=>{const k=e.key.toLowerCase(),m={arrowup:'up',w:'up',arrowdown:'down',s:'down',arrowleft:'left',a:'left',arrowright:'right',d:'right'}[k];if(m){e.preventDefault();sendDrive({dir:m})}};window.addEventListener('keydown',kd);window.addEventListener('resize',draw);$$('[data-frog]').forEach(b=>b.onclick=()=>sendDrive({dir:b.dataset.frog}));state.realtimeDraw=draw;state.gameCleanup=()=>{window.removeEventListener('keydown',kd);window.removeEventListener('resize',draw);state.realtimeDraw=null};draw();
}
function renderFlappy(el,r){
 const s=r.state?.you;if(!s)return;
 el.innerHTML='<div class="source-arcade-shell"><div class="source-game-kicker">SOURCE ENGINE · CANVAS GAMES / FLAPPY BIRD</div><canvas id="flappyCanvas" class="game-canvas" aria-label="Flappy Bird"></canvas><div class="source-actionbar"><button class="primary" id="flapBtn">FLAP</button></div><div class="physics-hud"><span id="flapHud"></span><span>Space / tap</span></div></div>';
 const c=$('#flappyCanvas');
 const draw=()=>{const g=fitCanvas(c,800,600),st=state.room?.state?.you||s,w=c.clientWidth,h=c.clientHeight;g.fillStyle='#0d0d0d';g.fillRect(0,0,w,h);const sx=w/800,sy=h/600;g.save();g.scale(sx,sy);for(const p of st.pipes||[]){g.fillStyle='#777';g.fillRect(p.x,0,p.width,p.gapY-100);g.fillRect(p.x,p.gapY+100,p.width,600-(p.gapY+100))}g.fillStyle='#fff';g.beginPath();g.arc(st.bird.x,st.bird.y,st.bird.radius,0,Math.PI*2);g.fill();g.fillStyle='#444';g.fillRect(0,st.groundY,800,600-st.groundY);g.restore();$('#flapHud').textContent='Score '+st.score+' · '+(st.phase==='dead'?'DOWN':'LIVE')};
 const flap=()=>sendDrive({flap:true});const key=e=>{if(e.code==='Space'){e.preventDefault();flap()}};$('#flapBtn').onclick=flap;c.onpointerdown=flap;window.addEventListener('keydown',key);window.addEventListener('resize',draw);state.realtimeDraw=draw;state.gameCleanup=()=>{c.onpointerdown=null;window.removeEventListener('keydown',key);window.removeEventListener('resize',draw);state.realtimeDraw=null};draw();
}
function renderSudoku(el,r){
 const s=r.state?.you;if(!s)return;
 let selected=null;
 const render=()=>{const st=state.room?.state?.you||s,board=st.board||[];el.innerHTML='<div class="source-board-shell sudoku-shell"><div class="source-game-kicker">SOURCE ENGINE · CANVAS GAMES / SUDOKU</div><div class="sudoku-grid">'+board.flatMap((row,y)=>row.map((cell,x)=>'<button class="sudoku-cell '+(cell.given?'given ':'')+(cell.invalid?'invalid ':'')+(selected&&selected[0]===y&&selected[1]===x?'selected':'')+'" data-sudoku="'+y+','+x+'">'+(cell.value||'')+'</button>')).join('')+'</div><div class="sudoku-pad">'+[1,2,3,4,5,6,7,8,9,0].map(n=>'<button class="ghost" data-snum="'+n+'">'+(n||'Clear')+'</button>').join('')+'</div><div class="scoreline">You '+(st.status==='won'?'SOLVED':'PLAYING')+' · Opponent '+(r.state?.opponent?.status||'PLAYING').toUpperCase()+'</div></div>';$$('[data-sudoku]').forEach(b=>b.onclick=()=>{const [y,x]=b.dataset.sudoku.split(',').map(Number);if(!board[y][x].given)selected=[y,x];render()});$$('[data-snum]').forEach(b=>b.onclick=()=>{if(!selected)return toast('Select an empty cell');sendMove({row:selected[0],col:selected[1],num:Number(b.dataset.snum)});});};render();
}
function renderActions(r){const el=$('#gameActions');el.innerHTML=r.status==='finished'?`<button class="primary" id="rematch">Rematch</button>`:'';if($('#rematch'))$('#rematch').onclick=()=>state.socket.emit('rematch');}
function renderChess(el,s){
 const map={r:'♜',n:'♞',b:'♝',q:'♛',k:'♚',p:'♟',R:'♖',N:'♘',B:'♗',Q:'♕',K:'♔',P:'♙'};
 const ranks=s.fen.split(' ')[0].split('/'),arr=[];for(const rank of ranks){for(const ch of rank){if(/\d/.test(ch))for(let i=0;i<+ch;i++)arr.push(null);else arr.push(ch)}}
 const me=state.room.players.findIndex(p=>p.id===state.me.id),turn=s.turn===me;
 const moves=Array.isArray(s.legalMoves)?s.legalMoves:[];
 el.innerHTML='<div class="chess-layout"><div><div class="board-chess">'+arr.map((p,i)=>'<button class="chess-cell '+((Math.floor(i/8)+i%8)%2?'dark':'light')+' '+(state.selectedChess===i?'sel':'')+' '+(state.chessLegal.includes(i)?(p?'capture':'legal'):'')+'" data-chess="'+i+'" aria-label="'+toSquare(i)+'">'+(p?map[p]:'')+'</button>').join('')+'</div><div class="game-shell-tools"><button class="ghost" id="offerDraw">Offer draw</button><button class="ghost" id="resignChess">Resign</button></div></div><div class="chess-side"><div class="glass-mini"><b>Turn</b><div>'+ (turn?'Your move':'Opponent move') +'</div><div style="color:#777;margin-top:4px">'+escapeHtml(s.fen)+'</div></div><div class="glass-mini"><b>Move history</b><div class="move-list">'+(s.history||[]).map((m,i)=>'<div class="move-item">'+(i%2===0?(Math.floor(i/2)+1)+'. ':'')+escapeHtml(m)+'</div>').join('')+'</div></div></div></div>';
 const refreshSelection=()=>{
   $$('[data-chess]').forEach(b=>{
     const idx=+b.dataset.chess;
     b.classList.toggle('sel',state.selectedChess===idx);
     b.classList.toggle('legal',state.chessLegal.includes(idx)&&!arr[idx]);
     b.classList.toggle('capture',state.chessLegal.includes(idx)&&!!arr[idx]);
   });
 };
 $$('[data-chess]').forEach(btn=>btn.onclick=async()=>{
   const i=+btn.dataset.chess;
   if(!turn)return;
   if(state.selectedChess==null){
     const sq=toSquare(i);
     state.chessLegal=moves.filter(m=>m.from===sq).map(m=>squareIndex(m.to));
     if(!state.chessLegal.length)return;
     state.selectedChess=i;
     refreshSelection();
     return;
   }
   const from=toSquare(state.selectedChess),to=toSquare(i);
   if(!state.chessLegal.includes(i)){state.selectedChess=null;state.chessLegal=[];refreshSelection();return}
   const moving=arr[state.selectedChess];let promotion='q';
   if(moving?.toLowerCase()==='p'&&(i<8||i>=56))promotion=await choosePromotion();
   sendMove({from,to,promotion});state.selectedChess=null;state.chessLegal=[];refreshSelection();
 });
 $('#offerDraw').onclick=()=>state.socket.emit('drawOffer');$('#resignChess').onclick=()=>state.socket.emit('resign');
}
function meIndex(){return state.room?state.room.players.findIndex(p=>p.id===state.me.id):0}
function toSquare(i){return 'abcdefgh'[i%8]+(8-Math.floor(i/8))}
function squareIndex(sq){return (8-Number(sq[1]))*8+'abcdefgh'.indexOf(sq[0])}
function renderCheckers(el,s){
 const me=state.room.players.findIndex(p=>p.id===state.me.id),turn=s.turn===me,legal=Array.isArray(s.legalMoves)?s.legalMoves:[],coords=s.coords||[];let selected=null;
 const cells=s.board.flatMap((row,y)=>row.map((p,x)=>{const pos=coords.findIndex(c=>c&&c.x===x&&c.y===y);return '<button class="checker-cell '+((x+y)%2?'dark':'light')+' '+(legal.some(m=>m.from===pos)&&turn?'legal':'')+'" data-checkxy="'+x+','+y+'" data-pos="'+pos+'">'+(p!=null?'<span class="piece '+((p%2)?'black':'white')+' '+(p>=2?'king':'')+'"></span>':'')+'</button>'})).join('');
 el.innerHTML='<div><div class="board-checkers">'+cells+'</div><p class="game-note">Mandatory captures, multi-jumps and kings are enforced by the source checkers engine. '+(turn?'Your move.':'Opponent move.')+'</p></div>';
 const refresh=()=>$$('[data-checkxy]').forEach(b=>{const pos=+b.dataset.pos;b.classList.toggle('sel',!!(selected&&selected.pos===pos));b.classList.toggle('legal',!!(turn&&selected&&legal.some(m=>m.from===selected.pos&&m.to===pos)))});
 $$('[data-checkxy]').forEach(b=>b.onclick=()=>{if(!turn)return;const pos=+b.dataset.pos;if(pos<0)return;if(!selected){if(!legal.some(m=>m.from===pos))return;selected={pos};refresh();return}if(!legal.some(m=>m.from===selected.pos&&m.to===pos)){selected=null;refresh();return}sendMove({from:selected.pos,to:pos});selected=null});
}
async function choosePromotion(){
  const old=document.querySelector('.promotion-popover');old?.remove();
  return new Promise(resolve=>{
    const wrap=document.createElement('div');wrap.className='promotion-popover';wrap.innerHTML='<div class="promotion-card"><span class="eyebrow">PROMOTION</span><h4>Choose a piece</h4><div class="promotion-options"><button data-p="q">♛<small>Queen</small></button><button data-p="r">♜<small>Rook</small></button><button data-p="b">♝<small>Bishop</small></button><button data-p="n">♞<small>Knight</small></button></div></div>';
    document.body.appendChild(wrap);
    wrap.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{const p=b.dataset.p;wrap.remove();resolve(p)});
  });
}
function renderGomoku(el,s){
  const me=state.room.players.findIndex(p=>p.id===state.me.id);
  el.innerHTML='<div class="gomoku-wrap"><div class="gomoku-board">'+s.board.map((v,i)=>'<button class="gomoku-cell '+(v===1?'black':v===2?'white':'')+'" data-gomoku="'+i+'" aria-label="Gomoku '+i+'">'+(v===1?'●':v===2?'○':'')+'</button>').join('')+'</div><div class="scoreline">'+(s.turn===me?'Your move':'Opponent move')+' · '+s.moves+'/225</div></div>';
  $('[data-gomoku]').forEach(b=>b.onclick=()=>{if(s.turn!==me||s.board[+b.dataset.gomoku])return;const idx=+b.dataset.gomoku;sendMove({x:idx%15,y:Math.floor(idx/15)})});
}
function lineActive(s,kind,x,y){return kind==='h'?s.hLines.some(l=>l.x===x&&l.y===y):s.vLines.some(l=>l.x===x&&l.y===y)}
function renderDotsBoxes(el,s){
  const me=state.room.players.findIndex(p=>p.id===state.me.id);
  const cells=[];
  for(let gy=0;gy<19;gy++){
    for(let gx=0;gx<19;gx++){
      if(gy%2===0&&gx%2===0){cells.push('<div class="db-dot"></div>');continue}
      if(gy%2===1&&gx%2===1){const bx=(gx-1)/2,by=(gy-1)/2,owner=s.boxes?.[0]?.includes(by*9+bx)?0:s.boxes?.[1]?.includes(by*9+bx)?1:null;cells.push('<div class="db-box '+(owner===0?'owner0':owner===1?'owner1':'')+'">'+(owner===null?'':owner===0?'×':'○')+'</div>');continue}
      if(gy%2===0){const x=(gx-1)/2,y=gy/2,active=lineActive(s,'h',x,y);cells.push('<button class="db-line h '+(active?'active':'')+'" '+(active||s.turn!==me?'disabled':'')+' data-db="h,'+x+','+y+'" aria-label="horizontal line"></button>')}
      else{const x=gx/2,y=(gy-1)/2,active=lineActive(s,'v',x,y);cells.push('<button class="db-line v '+(active?'active':'')+'" '+(active||s.turn!==me?'disabled':'')+' data-db="v,'+x+','+y+'" aria-label="vertical line"></button>')}
    }
  }
  el.innerHTML='<div class="dots-wrap"><div class="dots-grid">'+cells.join('')+'</div><div class="scoreline">'+(s.turn===me?'Your move':'Opponent move')+' · You '+s.scores[me]+' — Opponent '+s.scores[1-me]+'</div></div>';
  $('[data-db]').forEach(b=>b.onclick=()=>{const [kind,x,y]=b.dataset.db.split(',').map((v,i)=>i?Number(v):v);sendMove(kind==='h'?{x1:x,y1:y,x2:x+1,y2:y}:{x1:x,y1:y,x2:x,y2:y+1})});
}
function renderBattle(el,s){const me=state.room.players.findIndex(p=>p.id===state.me.id),myShots=s.shots[me]||[];el.innerHTML=`<div><p style="color:#777;text-align:center">Your fleet is hidden from opponent. Fire on their grid.</p><div class="grid10">${Array.from({length:100},(_,i)=>{const x=i%10,y=Math.floor(i/10),shot=myShots.find(p=>p[0]===x&&p[1]===y);return`<button class="${shot?.[2]==='hit'?'hit':''}" data-shot="${x},${y}">${shot?shot[2]==='hit'?'×':'·':''}</button>`}).join('')}</div></div>`;$$('[data-shot]').forEach(b=>b.onclick=()=>{const[x,y]=b.dataset.shot.split(',').map(Number);sendMove({x,y})})}
function renderMiniGolfSource(el,r){
  const s=r.state;
  el.innerHTML='<div class="canvas-wrap physical-game source-minigolf"><canvas id="miniGolfCanvas" class="game-canvas"></canvas><div class="pool-help">Drag backward from your ball and release to putt</div><div class="physics-hud"><span id="miniGolfHud"></span></div></div>';
  const c=$('#miniGolfCanvas'),ctx=c.getContext('2d');let down=null;
  const stateNow=()=>state.room?.state||r.state;
  const mapPoint=(p,w,h)=>({x:p.x/1000*w,y:p.y/650*h});
  const drawShape=(shape,w,h)=>{if(!shape)return;ctx.beginPath();if(shape.kind==='circle'){const q=mapPoint(shape.center,w,h),rr=shape.radius/1000*w;ctx.arc(q.x,q.y,rr,0,Math.PI*2)}else{shape.points.forEach((p,n)=>{const q=mapPoint(p,w,h);n?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)});ctx.closePath()}};
  const drawState=(frame=null)=>{
    const st=stateNow(),course=st.course;if(!course)return;
    const w=c.clientWidth,h=c.clientHeight;if(!w||!h)return;const d=devicePixelRatio||1;c.width=w*d;c.height=h*d;ctx.setTransform(d,0,0,d,0,0);
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#090909';ctx.fillRect(0,0,w,h);
    ctx.save();ctx.lineJoin='round';ctx.lineWidth=5;ctx.strokeStyle='#666';ctx.fillStyle='#151515';drawShape({kind:'polygon',points:course.boundary},w,h);ctx.fill();ctx.stroke();
    ctx.lineWidth=3;ctx.strokeStyle='#3a3a3a';ctx.fillStyle='#0d0d0d';for(const wall of course.walls){drawShape({kind:'polygon',points:wall},w,h);ctx.fill();ctx.stroke()}
    for(const hz of course.hazards||[]){ctx.fillStyle=hz.type==='water'?'#181818':'#232323';ctx.strokeStyle='#444';drawShape(hz.shape,w,h);ctx.fill();ctx.stroke()}
    const cup=mapPoint(course.cup,w,h);ctx.fillStyle='#000';ctx.strokeStyle='#999';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cup.x,cup.y,Math.max(7,Math.min(w,h)*.018),0,Math.PI*2);ctx.fill();ctx.stroke();
    const balls=st.balls||[];const me=r.players.findIndex(p=>p.id===state.me.id);
    balls.forEach((b,idx)=>{let pos=b.position;if(frame&&idx===me&&frame.position)pos=frame.position;const q=mapPoint(pos,w,h),rad=Math.max(6,Math.min(w,h)*.017);ctx.beginPath();ctx.fillStyle=idx===0?'#f4f4f4':'#777';ctx.arc(q.x,q.y,rad,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#050505';ctx.stroke();if(idx===me&&!b.captured&&st.turn===me){ctx.strokeStyle='rgba(255,255,255,.35)';ctx.beginPath();ctx.arc(q.x,q.y,rad+7,0,Math.PI*2);ctx.stroke()}});
    ctx.restore();
    const totals=(st.players||[]).map(p=>p.totalStrokes).join(' — ');$('#miniGolfHud').textContent='Hole '+(st.holeIndex+1)+'/'+st.holeCount+' · '+st.holeName+' · Par '+st.par+' · Strokes '+totals;
  };
  const resize=()=>drawState();const point=e=>{const rect=c.getBoundingClientRect();return{x:(e.clientX-rect.left)/rect.width,y:(e.clientY-rect.top)/rect.height}};
  const downF=e=>{if(stateNow().turn!==r.players.findIndex(p=>p.id===state.me.id))return;e.preventDefault();down=point(e)};
  const up=e=>{if(!down)return;e.preventDefault();const p=point(e),dx=down.x-p.x,dy=down.y-p.y,dist=Math.hypot(dx,dy);down=null;if(dist<.02)return;sendMove({dx,dy,power:Math.min(1,dist*2.2)})};
  c.onpointerdown=downF;c.onpointerup=up;c.onpointercancel=()=>down=null;window.addEventListener('resize',resize);
  state.realtimeDraw=()=>drawState();
  state.realtimeAnimate=(frames)=>{if(Array.isArray(frames)&&frames.length>1)animateFrames(frames,frame=>drawState(frame),Math.min(1600,Math.max(700,frames.length*7)))};
  state.gameCleanup=()=>{window.removeEventListener('resize',resize);c.onpointerdown=null;c.onpointerup=null;c.onpointercancel=null;state.realtimeDraw=null;state.realtimeAnimate=null};
  resize();
}
function renderCanvasGame(el,r){
  const labels={pool:'Drag backward from the cue ball to aim and choose power',carrom:'Drag from the striker to shoot. Tap a new baseline position before shooting.',minigolf:'Drag backward from your ball. Release to hit the ball.'};
  el.innerHTML='<div class="canvas-wrap physical-game"><canvas id="gameCanvas" class="game-canvas"></canvas><div class="pool-help">'+labels[r.game]+'</div><div class="physics-hud"><span>'+ (r.game==='pool'?(r.state.ballInHand?'BALL IN HAND':'Aim • power follows drag'):r.game==='carrom'?'Score '+r.state.scores[0]+' — '+r.state.scores[1]:'Strokes '+r.state.strokes[0]+' — '+r.state.strokes[1]) +'</span></div></div>';
  const c=$('#gameCanvas'),ctx=c.getContext('2d');let down=null;
  const draw=(frame)=>{const w=c.clientWidth,h=c.clientHeight;if(!w||!h)return;ctx.clearRect(0,0,w,h);const st=frame||state.room?.state||r.state;if(r.game==='pool')drawPool(ctx,w,h,st);else if(r.game==='carrom')drawCarrom(ctx,w,h,st);else drawGolf(ctx,w,h,st)};
  const resize=()=>{const rect=c.getBoundingClientRect(),d=devicePixelRatio||1;c.width=Math.max(1,rect.width*d);c.height=Math.max(1,rect.height*d);ctx.setTransform(d,0,0,d,0,0);draw()};
  const point=e=>{const q=e.touches?e.touches[0]:e,rect=c.getBoundingClientRect();return{x:(q.clientX-rect.left)/rect.width,y:(q.clientY-rect.top)/rect.height}};
  const downF=e=>{e.preventDefault();down=point(e)};
  const up=e=>{if(!down)return;e.preventDefault();const p=point(e.changedTouches?e.changedTouches[0]:e),dx=down.x-p.x,dy=down.y-p.y,dist=Math.hypot(dx,dy);if(r.game==='pool'&&r.state.ballInHand){if(dist<.035)sendMove({cueX:p.x,cueY:p.y,placeOnly:true});else sendMove({cueX:p.x,cueY:p.y,dx,dy,power:Math.min(1,dist*1.55)});down=null;return}if(dist>.02)sendMove({x:down.x,dx,dy,power:Math.min(1,dist*1.8)});down=null};
  c.onpointerdown=downF;c.onpointerup=up;c.onpointercancel=()=>down=null;c.ontouchstart=downF;c.ontouchend=up;window.addEventListener('resize',resize);
  state.realtimeDraw=()=>draw();
  state.realtimeAnimate=(frames)=>{if(Array.isArray(frames)&&frames.length>1)animateFrames(frames,frame=>draw(frame),Math.min(1200,Math.max(600,frames.length*10)))};
  state.gameCleanup=()=>{window.removeEventListener('resize',resize);c.onpointerdown=null;c.onpointerup=null;c.onpointercancel=null;c.ontouchstart=null;c.ontouchend=null;state.realtimeDraw=null;state.realtimeAnimate=null};
  resize();
}
function animateFrames(frames,drawFrame,duration=900){if(!frames||frames.length<2)return;let start=performance.now();const step=now=>{const t=Math.min(1,(now-start)/duration),idx=Math.min(frames.length-1,Math.floor(t*(frames.length-1)));drawFrame(frames[idx]);if(t<1)requestAnimationFrame(step)};requestAnimationFrame(step)}
function drawPool(ctx,w,h,st){
 ctx.fillStyle='#101010';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#1c1c1c';ctx.lineWidth=28;ctx.strokeRect(14,14,w-28,h-28);ctx.strokeStyle='#2b2b2b';ctx.lineWidth=14;ctx.strokeRect(28,28,w-56,h-56);
 const ps=[[.03,.03],[.5,.03],[.97,.03],[.03,.97],[.5,.97],[.97,.97]];ctx.fillStyle='#030303';ps.forEach(([x,y])=>{ctx.beginPath();ctx.arc(x*w,y*h,Math.max(10,w*.018),0,Math.PI*2);ctx.fill()});
 const shades=['#f4f4f4','#d8d8d8','#bcbcbc','#a0a0a0','#888','#707070','#585858'];
 for(const b of st.balls||[]){if(b.pocketed)continue;const x=b.x*w,y=b.y*h,rad=Math.max(7,w*.0185);ctx.beginPath();ctx.fillStyle=b.group==='eight'?'#0b0b0b':b.group==='solid'?(shades[(b.number-1)%7]||'#ddd'):(shades[(b.number-9)%7]||'#cfcfcf');ctx.arc(x,y,rad,0,Math.PI*2);ctx.fill();if(b.type==='stripe'){ctx.save();ctx.beginPath();ctx.arc(x,y,rad*.98,0,Math.PI*2);ctx.clip();ctx.fillStyle='#e4e4e4';ctx.fillRect(x-rad,y-rad*.27,2*rad,rad*.54);ctx.restore()}ctx.strokeStyle=b.group==='eight'?'#aaa':'#444';ctx.stroke();if(b.number){ctx.fillStyle=b.group==='eight'?'#eee':'#111';ctx.font=`${Math.max(7,rad*.9)}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(b.number,x,y)}}}
function drawCarrom(ctx,w,h,st){
 const scaleX=(v)=>Math.abs(Number(v))>2?Number(v)/800:Number(v),scaleY=(v)=>Math.abs(Number(v))>2?Number(v)/800:Number(v);
 ctx.fillStyle='#111';ctx.fillRect(0,0,w,h);ctx.fillStyle='#181818';ctx.fillRect(w*.06,h*.06,w*.88,h*.88);ctx.strokeStyle='#303030';ctx.lineWidth=10;ctx.strokeRect(w*.045,h*.045,w*.91,h*.91);
 for(const [x,y] of [[.07,.07],[.93,.07],[.07,.93],[.93,.93]]){ctx.fillStyle='#050505';ctx.beginPath();ctx.arc(x*w,y*h,Math.max(11,w*.025),0,Math.PI*2);ctx.fill()}
 ctx.strokeStyle='#666';ctx.lineWidth=2;ctx.beginPath();ctx.arc(.5*w,.5*h,w*.08,0,Math.PI*2);ctx.stroke();
 for(const c of st.coins||[]){if(c.pocketed)continue;const x=scaleX(c.x)*w,y=scaleY(c.y)*h;ctx.fillStyle=c.type==='black'?'#090909':c.type==='queen'?'#7d7d7d':'#ededed';ctx.beginPath();ctx.arc(x,y,w*.018,0,Math.PI*2);ctx.fill();ctx.strokeStyle=c.type==='queen'?'#fff':'#777';ctx.lineWidth=c.type==='queen'?3:1.5;ctx.stroke();}
 const striker=st.striker;if(striker&&!striker.pocketed){const x=scaleX(striker.x)*w,y=scaleY(striker.y)*h;ctx.fillStyle='#eee';ctx.beginPath();ctx.arc(x,y,w*.027,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#222';ctx.stroke()}
}
function drawGolf(ctx,w,h,st){
 ctx.fillStyle='#0a0a0a';ctx.fillRect(0,0,w,h);ctx.fillStyle='#151515';ctx.fillRect(w*.05,h*.05,w*.9,h*.9);ctx.strokeStyle='#222';ctx.lineWidth=8;ctx.strokeRect(w*.05,h*.05,w*.9,h*.9);
 for(const wall of st.walls||[]){ctx.strokeStyle='#aaa';ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(wall.x1*w,wall.y1*h);ctx.lineTo(wall.x2*w,wall.y2*h);ctx.stroke()}
 ctx.fillStyle='#050505';ctx.beginPath();ctx.arc(st.hole.x*w,st.hole.y*h,st.hole.r*w,0,Math.PI*2);ctx.fill();(st.balls||[]).forEach((p,i)=>{if(st.done?.[i])return;ctx.fillStyle=i?'#888':'#fff';ctx.beginPath();ctx.arc(p.x*w,p.y*h,w*.024,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#111';ctx.stroke()})
}
function renderRace(el,r){el.innerHTML='<div style="width:min(820px,100%);text-align:center"><div class="canvas-wrap racing-wrap"><canvas id="raceCanvas" class="game-canvas"></canvas><div class="race-hud"><span>Lap '+(Math.max(...r.state.players.map(p=>p.lap))+1)+'/3</span><span>WASD / arrows</span></div></div><div class="race-controls"><button class="primary" id="raceUp">ACCELERATE</button><button class="ghost" id="raceLeft">◀</button><button class="ghost" id="raceBrake">BRAKE</button><button class="ghost" id="raceRight">▶</button></div></div>';drawRace();
 const input={up:false,left:false,right:false,brake:false};const send=()=>state.socket.emit('drive',input);const set=(k,v)=>{input[k]=v;send()};const bindHold=(id,k)=>{const b=$('#'+id);if(!b)return;b.onpointerdown=()=>set(k,true);b.onpointerup=()=>set(k,false);b.onpointerleave=()=>set(k,false);b.onpointercancel=()=>set(k,false)};bindHold('raceUp','up');bindHold('raceLeft','left');bindHold('raceRight','right');bindHold('raceBrake','brake');
 const keydown=e=>{const k=e.key.toLowerCase(),map={w:'up',arrowup:'up',a:'left',arrowleft:'left',d:'right',arrowright:'right',s:'brake',arrowdown:'brake'};if(map[k]){e.preventDefault();input[map[k]]=true;send()}};const keyup=e=>{const k=e.key.toLowerCase(),map={w:'up',arrowup:'up',a:'left',arrowleft:'left',d:'right',arrowright:'right',s:'brake',arrowdown:'brake'};if(map[k]){e.preventDefault();input[map[k]]=false;send()}};window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);
 state.realtimeDraw=drawRace;state.gameCleanup=()=>{window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);state.realtimeDraw=null};}
function drawRace(){const c=$('#raceCanvas');if(!c||!state.room?.state?.players)return;const w=c.clientWidth,h=c.clientHeight,d=devicePixelRatio||1;c.width=w*d;c.height=h*d;const x=c.getContext('2d');x.setTransform(d,0,0,d,0,0);x.fillStyle='#050505';x.fillRect(0,0,w,h);x.strokeStyle='#333';x.lineWidth=Math.min(w,h)*.18;x.beginPath();x.ellipse(w/2,h/2,Math.min(w,h)*.34,Math.min(w,h)*.30,0,0,Math.PI*2);x.stroke();x.strokeStyle='#888';x.lineWidth=2;x.setLineDash([10,12]);x.beginPath();x.ellipse(w/2,h/2,Math.min(w,h)*.25,Math.min(w,h)*.21,0,0,Math.PI*2);x.stroke();x.setLineDash([]);state.room.state.players.forEach((p,i)=>{x.save();x.translate(p.x*w,p.y*h);x.rotate(p.angle);x.fillStyle=i?'#777':'#fff';x.fillRect(-13,-7,26,14);x.fillStyle='#111';x.fillRect(1,-5,7,10);x.restore()})}

function renderFriends(){const el=$('#view-friends');el.innerHTML=`<div class="section-head"><div><h3>Friends</h3><span>Invite friends into the room.</span></div><button class="ghost" id="findFriends">Find</button></div><div class="list" id="friendList">Loading…</div>`;loadFriends()}
async function loadFriends(){const r=await emit('friends');const el=$('#friendList');if(!r)return;el.innerHTML=[...(r.requests||[]).map(u=>`<div class="list-row"><div><b>${escapeHtml(u.name)}</b><small>Friend request</small></div><div><button class="primary" data-accept="${u.id}">Accept</button><button class="ghost" data-decline="${u.id}">Decline</button></div></div>`),...(r.friends||[]).map(u=>`<div class="list-row"><div><b>${escapeHtml(u.name)}</b><small>${u.online?'Online':'Offline'} · ${u.wins} wins</small></div><button class="ghost" data-invite="${u.id}">Invite</button></div>`)].join('')||'<div class="friend-card">No friends yet.</div>';$$('[data-accept]').forEach(b=>b.onclick=async()=>{await emit('friendRespond',{from:b.dataset.accept,accept:true});loadFriends()});$$('[data-decline]').forEach(b=>b.onclick=async()=>{await emit('friendRespond',{from:b.dataset.decline,accept:false});loadFriends()});$$('[data-invite]').forEach(b=>b.onclick=async()=>{if(!state.room)return toast('Join a game room first');const z=await emit('invite',{to:b.dataset.invite});toast(z?.ok?'Invite sent':z?.error||'Invite failed')});$('#findFriends').onclick=async()=>{const q=prompt('Search username');if(!q)return;const users=await emit('users',{q});el.innerHTML=users.map(u=>`<div class="list-row"><div><b>${escapeHtml(u.name)}</b><small>${u.online?'Online':'Offline'}</small></div><button class="primary" data-add="${u.id}">Add</button></div>`).join('')||'No matches';$$('[data-add]').forEach(b=>b.onclick=async()=>{const z=await emit('friendRequest',{to:b.dataset.add});toast(z?.ok?'Request sent':z?.error||'Failed')})}}
function renderChat(){const el=$('#view-chat');el.innerHTML=`<div class="section-head"><div><h3>Direct chat</h3><span>Friends-only private messages plus global chat.</span></div></div><div class="chat-page"><div id="directMessages" class="chat-list" style="height:55vh"></div><form id="directForm" class="chat-form"><input id="directInput" placeholder="Global message…"><button>↑</button></form></div>`;loadChat('global');$('#directForm').onsubmit=e=>{e.preventDefault();const t=$('#directInput').value.trim();if(t){state.socket.emit('chatSend',{to:'global',text:t});$('#directInput').value=''}}}
async function loadChat(to){const msgs=await emit('chatHistory',{to});$('#directMessages').innerHTML=(msgs||[]).map(m=>`<div class="msg"><b>${escapeHtml(m.from===state.me.id?'You':(state.users?.[m.from]||m.from).slice(0,20))}</b>${escapeHtml(m.text)}</div>`).join('')||'<div style="color:#555;text-align:center">No messages yet.</div>'}
async function renderLeaderboard(){const el=$('#view-leaderboard');el.innerHTML=`<div class="section-head"><div><h3>Leaderboard</h3><span>Persistent match records.</span></div></div><div class="leader-card"><div class="list" id="leaderList">Loading…</div></div>`;const rows=await emit('leaderboard');$('#leaderList').innerHTML=rows.map((u,i)=>`<div class="list-row"><div style="display:flex;align-items:center"><span class="rank">${i+1}</span><div><b>${escapeHtml(u.name)}</b><small>${u.played} played · ${u.wins} wins · ${u.draws} draws</small></div></div><b>${u.wins}</b></div>`).join('')}
function renderProfile(){const u=state.me;$('#view-profile').innerHTML=`<div class="section-head"><div><h3>Profile</h3><span>Identity and account settings.</span></div></div><div class="profile-card"><div class="avatar" style="width:64px;height:64px;font-size:22px;margin-bottom:18px">${escapeHtml((u.name||'N')[0].toUpperCase())}</div><form class="profile-form" id="profileForm"><input id="profileName" value="${escapeHtml(u.name)}" maxlength="20"><input id="profileAvatar" placeholder="Avatar URL (optional)" value="${escapeHtml(u.avatar||'')}"><button class="primary">Save profile</button></form><div class="section-head"><h3>Stats</h3></div><div class="list"><div class="list-row"><span>Played</span><b>${u.played}</b></div><div class="list-row"><span>Wins</span><b>${u.wins}</b></div><div class="list-row"><span>Losses</span><b>${u.losses}</b></div><div class="list-row"><span>Draws</span><b>${u.draws}</b></div></div></div>`;$('#profileForm').onsubmit=async e=>{e.preventDefault();const r=await emit('profile',{name:$('#profileName').value,avatar:$('#profileAvatar').value});if(r?.ok){state.me=r.me;toast('Profile saved');renderProfile()}else toast(r?.error||'Save failed')}}

// WebRTC in-game voice/video call. Media is peer-to-peer; Socket.IO only relays signaling.
async function loadRTCConfig(){try{const r=await fetch('/api/config');const c=await r.json();if(Array.isArray(c.iceServers)&&c.iceServers.length)state.rtcConfig={iceServers:c.iceServers}}catch{}}
function callPeers(){return state.room?.players.filter(p=>p.id!==state.me.id).map(p=>p.id)||[]}
function rtcDebug(id,pc){try{window.__nexusRtc=window.__nexusRtc||{};window.__nexusRtc[id]={connectionState:pc.connectionState,iceConnectionState:pc.iceConnectionState,signalingState:pc.signalingState,senders:pc.getSenders().map(s=>s.track?.kind).filter(Boolean),receivers:pc.getReceivers().map(r=>r.track?.kind).filter(Boolean)}}catch{}}
function isE2EMedia(){return new URLSearchParams(location.search).get('e2eMedia')==='1'}
function makeSyntheticMedia(video){
  const tracks=[];let stopped=false;
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
  const ctx=canvas.getContext('2d');const started=performance.now();
  const paint=()=>{if(stopped)return;const t=(performance.now()-started)/1000;ctx.fillStyle='#050505';ctx.fillRect(0,0,640,360);ctx.strokeStyle='#fff';ctx.lineWidth=4;ctx.strokeRect(18,18,604,324);ctx.fillStyle='#fff';ctx.font='700 28px system-ui';ctx.fillText('NEXUS PLAY TEST MEDIA',42,68);ctx.font='500 20px system-ui';ctx.fillText('VIDEO '+t.toFixed(1)+'s',42,103);ctx.beginPath();ctx.arc(320+Math.cos(t)*110,205+Math.sin(t*1.2)*70,34,0,Math.PI*2);ctx.stroke();requestAnimationFrame(paint)};
  paint();
  if(video){const vs=canvas.captureStream(15);tracks.push(...vs.getVideoTracks())}
  let osc=null,audioContext=null;
  try{
    audioContext=new (window.AudioContext||window.webkitAudioContext)();
    const dest=audioContext.createMediaStreamDestination();osc=audioContext.createOscillator();const gain=audioContext.createGain();gain.gain.value=0;osc.connect(gain).connect(dest);osc.start();tracks.push(...dest.stream.getAudioTracks());
    if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
  }catch{}
  const stream=new MediaStream(tracks);
  state.call.syntheticCleanup=()=>{stopped=true;tracks.forEach(t=>t.stop());try{osc?.stop()}catch{};audioContext?.close().catch(()=>{})};
  return stream;
}
async function getUserMediaForCall(constraints){
  const get=()=>navigator.mediaDevices.getUserMedia(constraints);
  if(!isE2EMedia())return get();
  return Promise.race([get(),new Promise((_,reject)=>setTimeout(()=>reject(Object.assign(new Error('E2E media timeout'),{name:'E2EMediaTimeout'})),2200))]);
}
function isE2EMedia(){return new URLSearchParams(location.search).get('e2eMedia')==='1'}
function syntheticMedia(video){
 const tracks=[];let stopped=false;
 const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const ctx=canvas.getContext('2d');const t0=performance.now();
 const draw=()=>{if(stopped)return;const t=(performance.now()-t0)/1000;ctx.fillStyle='#050505';ctx.fillRect(0,0,640,360);ctx.strokeStyle='#fff';ctx.lineWidth=4;ctx.strokeRect(16,16,608,328);ctx.fillStyle='#fff';ctx.font='700 28px system-ui';ctx.fillText('NEXUS PLAY',34,66);ctx.font='500 20px system-ui';ctx.fillText('E2E MEDIA '+t.toFixed(1)+'s',34,102);ctx.beginPath();ctx.arc(320+Math.cos(t)*120,205+Math.sin(t*1.1)*70,34,0,Math.PI*2);ctx.stroke();requestAnimationFrame(draw)};draw();
 if(video){const vs=canvas.captureStream(15);tracks.push(...vs.getVideoTracks())}
 let audioContext=null,osc=null;
 try{audioContext=new (window.AudioContext||window.webkitAudioContext)();const dest=audioContext.createMediaStreamDestination();const gain=audioContext.createGain();gain.gain.value=0;osc=audioContext.createOscillator();osc.connect(gain).connect(dest);osc.start();tracks.push(...dest.stream.getAudioTracks());audioContext.resume().catch(()=>{})}catch{}
 const stream=new MediaStream(tracks);
 state.call.syntheticCleanup=()=>{stopped=true;tracks.forEach(t=>t.stop());try{osc?.stop()}catch{};audioContext?.close().catch(()=>{})};
 return stream;
}
async function getCallMedia(constraints){
 if(!isE2EMedia())return navigator.mediaDevices.getUserMedia(constraints);
 return Promise.race([navigator.mediaDevices.getUserMedia(constraints),new Promise((_,reject)=>setTimeout(()=>reject(new DOMException('Test media timeout','AbortError')),2200))]);
}
async function ensureMedia(video){
 if(state.call.stream){
  if(video&&!state.call.stream.getVideoTracks().length){
   try{
    const extra=await getCallMedia({video:true});
    for(const t of extra.getVideoTracks()){
      state.call.stream.addTrack(t);
      for(const [id,pc] of state.call.peers){
        const sender=pc.getSenders().find(s=>s.track?.kind==='video');
        if(sender)await sender.replaceTrack(t);else pc.addTrack(t,state.call.stream);
        renegotiatePeer(id,pc);
      }
    }
    state.call.video=!!state.call.stream.getVideoTracks().length;$('#localVideo').srcObject=state.call.stream;$('#callEmpty').style.display='none';
   }catch(err){
    if(isE2EMedia()){const extra=syntheticMedia(true);for(const t of extra.getVideoTracks()){state.call.stream.addTrack(t);for(const pc of state.call.peers.values())pc.addTrack(t,state.call.stream)}state.call.video=true;$('#localVideo').srcObject=state.call.stream;$('#callEmpty').style.display='none'}
    else{document.body.dataset.mediaError=err?.name||'MediaError';console.warn('[NEXUS MEDIA]',err?.name||'MediaError',err?.message||'');toast('Camera permission is required for video')}
   }
  }
  return state.call.stream;
 }
 try{state.call.stream=await getCallMedia({audio:true,video:!!video})}
 catch(err){
  if(isE2EMedia())state.call.stream=syntheticMedia(!!video);
  else{document.body.dataset.mediaError=err?.name||'MediaError';console.warn('[NEXUS MEDIA]',err?.name||'MediaError',err?.message||'');toast(video?'Allow microphone and camera permission to start video':'Allow microphone permission to start voice');return null}
 }
 state.call.video=!!state.call.stream.getVideoTracks().length;state.call.audio=!!state.call.stream.getAudioTracks().length;
 $('#localVideo').srcObject=state.call.stream;$('#callEmpty').style.display='none';
 return state.call.stream;
}
function attachRemoteTrack(pc,id){
 pc.ontrack=e=>{
  const v=$('#remoteVideo');if(!v)return;
  let stream=v.srcObject;
  if(!(stream instanceof MediaStream))stream=new MediaStream();
  if(e.track&&!stream.getTracks().some(t=>t.id===e.track.id))stream.addTrack(e.track);
  v.srcObject=stream;v.autoplay=true;v.playsInline=true;v.muted=false;v.volume=1;
  v.play().catch(()=>{});
  e.track.onunmute=()=>v.play().catch(()=>{});
  $('#callEmpty').style.display='none';$('#socialState').textContent='In call';rtcDebug(id,pc);
 }
}
async function waitIceComplete(pc,timeout=3500){if(pc.iceGatheringState==='complete')return;await new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;pc.removeEventListener('icegatheringstatechange',check);resolve()};const check=()=>pc.iceGatheringState==='complete'&&finish();pc.addEventListener('icegatheringstatechange',check);setTimeout(finish,timeout)})}
async function renegotiatePeer(id,pc){
 try{
  if(pc.signalingState!=='stable')return;
  const offer=await pc.createOffer({offerToReceiveAudio:true,offerToReceiveVideo:true});
  await pc.setLocalDescription(offer);
  state.socket.emit('webrtc',{to:id,type:'offer',data:pc.localDescription});
 }catch{}
}
function setCallUI(){['callVideo','mobileCallVideo'].forEach(id=>$('#'+id)?.classList.toggle('active',state.call.video));['callMute','mobileCallMute'].forEach(id=>$('#'+id)?.classList.toggle('active',!!state.call.stream?.getAudioTracks().length&&state.call.stream.getAudioTracks().every(t=>!t.enabled)));['callCamera','mobileCallCamera'].forEach(id=>$('#'+id)?.classList.toggle('active',!!state.call.stream?.getVideoTracks().length&&state.call.stream.getVideoTracks().every(t=>!t.enabled)))}
async function startCall(video){
 const st=await ensureMedia(video);if(!st)return;
 state.call.started=true;
 let peers=callPeers();
 try{
   const reply=await emit('callStart',{video:!!st.getVideoTracks().length});
   if(Array.isArray(reply?.peers)&&reply.peers.length)peers=reply.peers;
 }catch{}
 window.__nexusCall={me:state.me?.id||null,room:state.room?.code||null,players:(state.room?.players||[]).map(p=>p.id),peers,video:!!st.getVideoTracks().length,audio:!!st.getAudioTracks().length};
 if(!peers.length)return toast('Your opponent is not connected to the call yet');
 for(const id of peers)try{await makePeer(id,true)}catch(err){console.warn('[NEXUS RTC] peer setup failed',id,err);document.body.dataset.rtcError=err?.message||'peer setup failed'}
 setCallUI();
}
async function makePeer(id,offer){
 if(state.call.peers.has(id))return state.call.peers.get(id);
 const pc=new RTCPeerConnection({...state.rtcConfig,sdpSemantics:'unified-plan'});
 state.call.peers.set(id,pc);if(!state.call.pendingIce.has(id))state.call.pendingIce.set(id,[]);
 for(const t of state.call.stream?.getTracks()||[])pc.addTrack(t,state.call.stream);
 if(!state.call.stream?.getAudioTracks().length)pc.addTransceiver('audio',{direction:'recvonly'});
 if(offer&&!state.call.stream?.getVideoTracks().length)pc.addTransceiver('video',{direction:'recvonly'});
 attachRemoteTrack(pc,id);
 pc.onicecandidate=e=>{if(e.candidate)state.socket.emit('webrtc',{to:id,type:'ice',data:e.candidate})};
 pc.oniceconnectionstatechange=()=>{rtcDebug(id,pc);if(pc.iceConnectionState==='failed')toast('Call connection failed — configure TURN for restrictive networks')};
 pc.onconnectionstatechange=()=>{rtcDebug(id,pc);if(pc.connectionState==='connected'){$('#socialState').textContent='In call';$('#callEmpty').style.display='none'}};
 if(offer){
  const o=await pc.createOffer({offerToReceiveAudio:true,offerToReceiveVideo:true});
  await pc.setLocalDescription(o);
  state.socket.emit('webrtc',{to:id,type:'offer',data:pc.localDescription});
 }
 return pc;
}
async function handleRTC(msg){
 const id=msg.from;
 let pc=state.call.peers.get(id);
 if(msg.type==='offer'){
  const wantsVideo=typeof msg.data?.sdp==='string'&&msg.data.sdp.includes('m=video');
  const st=await ensureMedia(wantsVideo);if(!st)return;
  if(!pc)pc=await makePeer(id,false);
  await pc.setRemoteDescription(msg.data);
  const a=await pc.createAnswer();
  await pc.setLocalDescription(a);
  state.call.started=true;
  state.socket.emit('webrtc',{to:id,type:'answer',data:pc.localDescription});
  for(const c of state.call.pendingIce.get(id)||[])try{await pc.addIceCandidate(c)}catch{}
  state.call.pendingIce.set(id,[]);
  setCallUI();rtcDebug(id,pc);
 }else if(msg.type==='answer'&&pc){
  await pc.setRemoteDescription(msg.data);
  for(const c of state.call.pendingIce.get(id)||[])try{await pc.addIceCandidate(c)}catch{}
  state.call.pendingIce.set(id,[]);rtcDebug(id,pc);
 }else if(msg.type==='ice'){
  if(pc?.remoteDescription){try{await pc.addIceCandidate(msg.data)}catch{}}
  else{if(!state.call.pendingIce.has(id))state.call.pendingIce.set(id,[]);state.call.pendingIce.get(id).push(msg.data)}
 }else if(msg.type==='hangup'){
  if(pc)pc.close();state.call.peers.delete(id);state.call.pendingIce.delete(id);
  if(!state.call.peers.size){state.call.started=false;$('#socialState').textContent='Live';$('#callEmpty').style.display='block';$('#remoteVideo').srcObject=null}
 }
}
function stopCall(){
  state.socket?.emit('callStop');
  for(const id of state.call.peers.keys())state.socket?.emit('webrtc',{to:id,type:'hangup'});
  for(const pc of state.call.peers.values())pc.close();
  state.call.peers.clear();state.call.pendingIce.clear();
  state.call.stream?.getTracks().forEach(t=>t.stop());state.call.syntheticCleanup?.();state.call.syntheticCleanup=null;state.call.stream=null;
  state.call.started=false;state.call.video=false;state.call.audio=false;
  $('#localVideo').srcObject=null;$('#remoteVideo').srcObject=null;$('#callEmpty').style.display='block';$('#socialState').textContent='Live';setCallUI();
}
function bindCallButtons(){const a=[['callVideo',()=>startCall(true)],['callAudio',()=>startCall(false)],['callMute',()=>{state.call.stream?.getAudioTracks().forEach(t=>t.enabled=!t.enabled);setCallUI()}],['callCamera',()=>{state.call.stream?.getVideoTracks().forEach(t=>t.enabled=!t.enabled);setCallUI()}],['callEnd',stopCall],['mobileCallVideo',()=>startCall(true)],['mobileCallAudio',()=>startCall(false)],['mobileCallMute',()=>{state.call.stream?.getAudioTracks().forEach(t=>t.enabled=!t.enabled);setCallUI()}],['mobileCallCamera',()=>{state.call.stream?.getVideoTracks().forEach(t=>t.enabled=!t.enabled);setCallUI()}],['mobileCallEnd',stopCall]];a.forEach(([id,fn])=>{const b=$('#'+id);if(b)b.onclick=fn})}
function connect(){state.socket=io();state.socket.on('connect',async()=>{loadRTCConfig();const r=await emit('hello',{token:state.token,name:'Guest'});if(r?.token){state.token=r.token;localStorage.setItem('nexus_token',r.token)}state.me=r.me;state.games=r.games;$('#auth').classList.add('hidden');$('#app').classList.remove('hidden');$('#profileBtn').textContent=(state.me.name||'N')[0].toUpperCase();renderHome();setView('home');bindCallButtons();loadSocialFriends();bindSocialTabs();bindSocialDelegation();bindDirectSocialSendButtons();showSocialMode('room');const linkRoom=new URL(location.href).searchParams.get('room')?.trim().toUpperCase();if(linkRoom&&r.room?.code!==linkRoom){openGameModal();$('#gameTitle').textContent='Joining room';$('#gameBoard').innerHTML='<div class="lobby-panel"><div class="lobby-icon">◈</div><span class="eyebrow">INVITE LINK</span><h3>Joining room…</h3><p>Connecting you to room <b>'+escapeHtml(linkRoom)+'</b>.</p></div>';const joined=await emit('join',{code:linkRoom});if(!joined?.ok){toast(joined?.error||'Invite link expired');$('#gameModal').classList.add('hidden');document.body.classList.remove('game-active');document.body.style.overflow=''}else{state.room=joined.room||{code:linkRoom,game:'',private:false,host:null,players:[],status:'lobby',state:null,result:null,rematch:[],chat:[]};openGameModal();if(state.room.game){renderGame();renderRoomChat();renderMobileSocial()}history.replaceState({},'',location.pathname+location.hash)}}else if(r.room){state.room=r.room;openGameModal();renderGame();renderMobileSocial()}});state.socket.on('room',r=>{const isRealtime=['racing','pong','snake','tetris'].includes(r.game),isPhysical=['pool','carrom','minigolf'].includes(r.game),wasActive=(isRealtime||isPhysical)&&state.room?.game===r.game&&$('#gameModal')&&!$('#gameModal').classList.contains('hidden');if(!acceptRoomUpdate(r))return;if(wasActive&&isPhysical&&state.realtimeAnimate&&Array.isArray(r.state?.animation)){state.realtimeAnimate(r.state.animation);renderMobileSocial();return}if(wasActive&&state.realtimeDraw){state.realtimeDraw();const me=state.room.players.findIndex(p=>p.id===state.me.id);$('#turnPill').textContent=r.status==='finished'?(r.result?.draw?'Draw':r.result?.winnerId===state.me.id?'You won':'Match over'):(r.game==='racing'?'Race live':r.state?.turn===me?'Your turn':'Live');renderMobileSocial();return}openGameModal();renderGame();renderRoomChat();renderMobileSocial()});state.socket.on('roomPresence',p=>{if(!state.room?.code||state.room.status==='finished'||!Array.isArray(p?.players))return;const byId=new Map(p.players.map(x=>[x.id,x]));state.room.players=(state.room.players||[]).map(x=>byId.get(x.id)?{...x,...byId.get(x.id)}:x)});state.socket.on('online',n=>$('#online').textContent='● '+n+' online');state.socket.on('presence',()=>loadSocialFriends());state.socket.on('chat',m=>{if(m.to==='global'){state.globalChatRevision++;const pending=state.globalPending.get(m.text)||0;if(pending>0&&m.from===state.me.id){if(pending>1)state.globalPending.set(m.text,pending-1);else state.globalPending.delete(m.text)}else{if(state.view==='chat'&&!state.activeDM)loadChat('global');if(state.mobileChatTarget==='global')loadMobileChat('global');if(state.socialMode==='global'){const box=$('#globalChatList');if(box){box.insertAdjacentHTML('beforeend','<div class="msg"><b>'+escapeHtml(m.from===state.me.id?'You':(m.fromName||m.from))+'</b>'+escapeHtml(m.text)+'</div>');box.scrollTop=box.scrollHeight}}}}else{if(state.view==='chat'&&(state.activeDM===m.from||state.activeDM===m.to))loadChat(state.activeDM);if(state.mobileChatTarget==='friend'&&state.mobileFriend&&(m.from===state.mobileFriend||m.to===state.mobileFriend))loadMobileChat(state.mobileFriend);if(state.socialMode==='friends'&&state.desktopFriend&&(m.from===state.desktopFriend||m.to===state.desktopFriend))loadDesktopFriendChat(state.desktopFriend);}});state.socket.on('typing',n=>{if($('#typing')){ $('#typing').textContent=n.name+' is typing…';clearTimeout(state.typingTimer);state.typingTimer=setTimeout(()=>$('#typing').textContent='',1400)}});state.socket.on('notification',n=>toast(n.text));state.socket.on('gameInvite',async n=>{if(!confirm(n.from.name+' invited you to '+n.game+' in room '+n.room+'. Join now?'))return;const ok=await resolveJoinedRoom(n.room);if(!ok)toast('Invite room could not be loaded')});state.socket.on('drawOffer',n=>{if(confirm(n.from.name+' offered a draw'))state.socket.emit('drawRespond',{accept:true})});state.socket.on('webrtc',async m=>{try{await handleRTC(m)}catch{toast('Call negotiation failed')}});state.socket.on('callInvite',async m=>{if(!m?.from||m.from===state.me?.id)return;try{state.call.started=true;const st=await ensureMedia(!!m.video);if(!st)return;await makePeer(m.from,false);setCallUI();}catch(err){console.warn('[NEXUS RTC] invite failed',err);document.body.dataset.rtcError=err?.message||'invite failed';}});
state.socket.on('callEnded',m=>{if(!m?.from)return;const pc=state.call.peers.get(m.from);pc?.close();state.call.peers.delete(m.from);state.call.pendingIce.delete(m.from);if(!state.call.peers.size){state.call.started=false;$('#socialState').textContent='Live';$('#callEmpty').style.display='block';$('#remoteVideo').srcObject=null;}});state.socket.on('roomChat',m=>{if(!state.room)return;state.room.chat=[...(state.room.chat||[]),m].slice(-60);renderRoomChat();if(state.mobileChatTarget==='room')loadMobileChat('room')});state.socket.on('connect_error',()=>toast('Connection error'))}

function bindSocialTabs(){const ids=[['socialRoomTab','room'],['socialGlobalTab','global'],['socialFriendsTab','friends']];ids.forEach(([id,m])=>{const b=$('#'+id);if(b)b.onclick=e=>{e.preventDefault();showSocialMode(m)}})}
function bindSocialDelegation(){document.addEventListener('click',e=>{const b=e.target.closest?.('#socialRoomTab,#socialGlobalTab,#socialFriendsTab');if(!b)return;const mode=b.id==='socialGlobalTab'?'global':b.id==='socialFriendsTab'?'friends':'room';e.preventDefault();showSocialMode(mode)})}
function sendActiveGlobalChat(){const input=$('#globalChatInput'),t=input?.value.trim();if(!t||!state.socket)return false;state.globalChatRevision++;state.globalPending.set(t,(state.globalPending.get(t)||0)+1);input.value='';const box=$('#globalChatList');if(box){box.insertAdjacentHTML('beforeend','<div class="msg"><b>You</b>'+escapeHtml(t)+'</div>');box.scrollTop=box.scrollHeight}state.socket.emit('chatSend',{to:'global',text:t},res=>{if(res?.error){const n=state.globalPending.get(t)||0;if(n>1)state.globalPending.set(t,n-1);else state.globalPending.delete(t);toast(res.error)}});return true}
function sendActiveFriendChat(){if(!state.desktopFriend)return false;const input=$('#friendChatInput'),t=input?.value.trim();if(!t)return false;state.socket.emit('chatSend',{to:state.desktopFriend,text:t},res=>{if(res?.error)return toast(res.error);input.value='';loadDesktopFriendChat(state.desktopFriend)});return true}
document.addEventListener('click',e=>{
 const globalButton=e.target.closest?.('#globalChatForm button');
 if(globalButton){e.preventDefault();sendActiveGlobalChat();return}
 const friendButton=e.target.closest?.('#friendChatForm button');
 if(friendButton){e.preventDefault();if(!sendActiveFriendChat())toast('Select a friend first');}
});
document.addEventListener('keydown',e=>{
 if(e.key!=='Enter'||e.shiftKey||e.isComposing)return;
 if(e.target?.id==='globalChatInput'){e.preventDefault();sendActiveGlobalChat()}
 else if(e.target?.id==='friendChatInput'){e.preventDefault();if(!sendActiveFriendChat())toast('Select a friend first')}
});
function bindDirectSocialSendButtons(){
 const gb=$('#globalChatSend');
 if(gb)gb.onclick=()=>sendActiveGlobalChat();
 const fb=$('#friendChatSend');
 if(fb)fb.onclick=()=>{if(!sendActiveFriendChat())toast('Select a friend first')};
}
function showSocialMode(mode){state.socialMode=mode;['room','global','friends'].forEach(m=>{$('#social'+m[0].toUpperCase()+m.slice(1)+'Pane')?.classList.toggle('hidden',m!==mode);$('#social'+m[0].toUpperCase()+m.slice(1)+'Tab')?.classList.toggle('active',m===mode)});if(mode==='global')loadGlobalSocial();if(mode==='friends')loadSocialFriends()}
async function loadGlobalSocial(){const rev=state.globalChatRevision;const rows=await emit('chatHistory',{to:'global'});if(rev!==state.globalChatRevision)return;const box=$('#globalChatList');if(!box)return;box.innerHTML=(rows||[]).map(m=>'<div class="msg"><b>'+escapeHtml(m.from===state.me.id?'You':(m.fromName||m.from))+'</b>'+escapeHtml(m.text)+'</div>').join('')||'<div class="muted center">No global messages yet.</div>';box.scrollTop=box.scrollHeight}
async function loadDesktopFriendChat(id){const rows=await emit('chatHistory',{to:id});const box=$('#friendChatMessages');if(!box)return;box.innerHTML=(rows||[]).map(m=>'<div class="msg"><b>'+escapeHtml(m.from===state.me.id?'You':(m.fromName||m.from))+'</b>'+escapeHtml(m.text)+'</div>').join('')||'<div class="muted center">No messages yet.</div>';box.scrollTop=box.scrollHeight}
async function loadSocialFriends(){const x=await emit('friends');const fs=x?.friends||[];const box=$('#mobileFriendSelect');if(box)box.innerHTML='<option value="">Friend chat</option>'+fs.map(f=>'<option value="'+f.id+'">'+escapeHtml(f.name)+'</option>').join('');const side=$('#friendChatList');if(side)side.innerHTML=fs.map(f=>'<button class="friend-chat-item '+(state.desktopFriend===f.id?'active':'')+'" data-friend="'+f.id+'"><b>'+escapeHtml(f.name)+'</b><small>'+(f.online?'Online':'Offline')+'</small></button>').join('')||'<div class="muted">Add a friend to chat here.</div>';$$('[data-friend]').forEach(b=>b.onclick=()=>{state.desktopFriend=b.dataset.friend;state.mobileChatTarget='friend';state.mobileFriend=b.dataset.friend;loadDesktopFriendChat(state.desktopFriend);loadMobileChat(state.desktopFriend);$$('[data-friend]').forEach(x=>x.classList.toggle('active',x===b));$('#friendChatInput').placeholder='Message friend…'});}
async function loadMobileChat(to){const box=$('#mobileSocialMessages');if(!box)return;if(to==='room'){const r=state.room;box.innerHTML=(r?.chat||[]).map(m=>'<div class="msg"><b>'+escapeHtml(m.name)+'</b>'+escapeHtml(m.text)+'</div>').join('')||'<div class="muted center">Room chat</div>'}else if(to==='global'){const rows=await emit('chatHistory',{to:'global'});box.innerHTML=(rows||[]).map(m=>'<div class="msg"><b>'+escapeHtml(m.from===state.me.id?'You':m.fromName||m.from)+'</b>'+escapeHtml(m.text)+'</div>').join('')||'<div class="muted center">Global chat</div>'}else{const rows=await emit('chatHistory',{to});box.innerHTML=(rows||[]).map(m=>'<div class="msg"><b>'+escapeHtml(m.from===state.me.id?'You':m.fromName||m.from)+'</b>'+escapeHtml(m.text)+'</div>').join('')||'<div class="muted center">No messages yet</div>'}box.scrollTop=box.scrollHeight}
function renderMobileSocial(){if(!$('#gameMobileSocial'))return;$('#gameMobileSocial').style.display='block';$('[data-ms]').forEach(b=>b.onclick=()=>{state.mobileChatTarget=b.dataset.ms;state.mobileFriend=null;$('[data-ms]').forEach(x=>x.classList.toggle('active',x===b));loadMobileChat(state.mobileChatTarget)});const sel=$('#mobileFriendSelect');if(sel&&!sel.dataset.bound){sel.dataset.bound='1';sel.onchange=()=>{state.mobileFriend=sel.value||null;if(state.mobileFriend){state.mobileChatTarget='friend';}loadMobileChat(state.mobileFriend||state.mobileChatTarget)}}const form=$('#mobileSocialForm');if(form&&!form.dataset.bound){form.dataset.bound='1';form.onsubmit=e=>{e.preventDefault();const t=$('#mobileSocialInput').value.trim();if(!t)return;if(state.mobileChatTarget==='room')state.socket.emit('roomChat',{text:t});else state.socket.emit('chatSend',{to:state.mobileChatTarget==='global'?'global':state.mobileFriend,text:t});$('#mobileSocialInput').value='';loadMobileChat(state.mobileChatTarget==='friend'?state.mobileFriend:state.mobileChatTarget)}}loadMobileChat(state.mobileChatTarget==='friend'?state.mobileFriend:state.mobileChatTarget)}
function renderRoomChat(){const r=state.room;$('#roomChat').innerHTML=(r?.chat||[]).map(m=>`<div class="msg"><b>${escapeHtml(m.name)}</b>${escapeHtml(m.text)}</div>`).join('')||'<div style="color:#555;text-align:center;padding:20px">Room chat appears here.</div>';const box=$('#roomChat');box.scrollTop=box.scrollHeight}
$('#roomChatForm').onsubmit=e=>{e.preventDefault();const t=$('#roomChatInput').value.trim();if(t){state.socket.emit('roomChat',{text:t});$('#roomChatInput').value=''}};
$$('.nav').forEach(b=>b.onclick=()=>setView(b.dataset.view));$('#profileBtn').onclick=()=>setView('profile');$('#roomCodeBtn').onclick=openRoomModal;$('#logout').onclick=()=>{localStorage.removeItem('nexus_token');location.reload()};
$$('[data-auth]').forEach(b=>b.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.authMode=b.dataset.auth;$('#authForm button').textContent=state.authMode==='login'?'Sign in':'Create account'});
$('#authForm').onsubmit=async e=>{e.preventDefault();const endpoint=state.authMode==='login'?'/api/login':'/api/register';const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('#authName').value,password:$('#authPassword').value})});const data=await res.json();if(!res.ok)return toast(data.error||'Authentication failed');state.token=data.token;localStorage.setItem('nexus_token',data.token);location.reload()};$('#guest').onclick=()=>{localStorage.removeItem('nexus_token');connect()};
if(state.token)connect();
