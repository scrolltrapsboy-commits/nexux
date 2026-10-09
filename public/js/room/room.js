import { h, icon, avatar, S, sock, on, ask, toast, confirmBox, clear, gameInfo, sfx, mmss, cap, copyText } from '../core.js';
import { createCall } from './call.js';
import { createDock } from './dock.js';
import { lobby } from './lobby.js';

const ACH = { first_win: 'First win', wins_10: '10 wins', wins_50: '50 wins', games_100: '100 games', chess_master: 'Chess master', perfect_game: 'Perfect game', comeback: 'Comeback', speed_winner: 'Speed winner', explorer: 'Explorer', friend_maker: 'Friend maker' };
const REASON = { checkmate: 'by checkmate', timeout: 'on time', resign: 'by resignation', forfeit: 'by forfeit', stalemate: 'by stalemate', agreed: 'by agreement', abandoned: 'abandoned', cleared: 'board cleared', time: 'time up', draw: 'draw' };

export default function room(root, { code }) {
  const call = createCall(); const offs = []; let R = null, game = null, gameMod = null, gameFor = null, offset = 0, ticker = null, dead = false;
  let matchKey = 0, chatOpen = false, unread = 0, resultHidden = false, prevStatus = null, soundDone = null, listeners = [];

  /* ---------- skeleton ---------- */
  const title = h('b'), sub = h('small'), status = h('div', { class: 'status' }), specs = h('span', { class: 'pill', hidden: true }), seatsEl = h('div', { class: 'seats' }), stage = h('div', { class: 'stage' }), actions = h('div', { class: 'actions' });
  const dockBtn = h('button', { class: 'btn round sm', 'aria-label': 'Toggle call and chat panel', title: 'Toggle call and chat panel', onclick: () => { S.prefs.dock = !S.prefs.dock; try { localStorage.setItem('np.prefs', JSON.stringify(S.prefs)); } catch {} layout(); } }, icon('panel', 'sm'));
  const leaveBtn = h('button', { class: 'btn round sm', 'aria-label': 'Leave room', title: 'Leave room', onclick: leave }, icon('left', 'sm'));
  const shareBtn = h('button', { class: 'btn sm', 'aria-label': 'Copy room invite link', title: 'Copy room invite link', onclick: async () => { const link = location.origin + '/#/room/' + code; toast((await copyText(link)) ? 'Room invite link copied' : 'Could not copy link. Room code: ' + code); } }, icon('link', 'sm'), 'Share room');
  const dock = createDock(call, { onNew: () => { if (!chatOpen) { unread++; dock.refresh(); } }, setChat, unread: () => unread });
  const scrim = h('div', { class: 'sheet-scrim', onclick: () => setChat(false) });
  const el = h('div', { class: 'room' },
    h('section', { class: 'play' }, h('header', { class: 'bar' }, leaveBtn, h('div', { class: 'ttl' }, title, sub), h('div', { class: 'sp' }), shareBtn, specs, status, dockBtn), seatsEl, stage, actions),
    h('aside', { class: 'dock' }, dock.vids, dock.bar, dock.chat.el), scrim);
  root.append(el);
  const layout = () => { const mobile = matchMedia('(max-width: 860px)').matches; el.classList.toggle('nodock', !S.prefs.dock && !mobile); el.classList.toggle('mobile-room', mobile); dockBtn.classList.toggle('on', !!S.prefs.dock); stage.dispatchEvent(new Event('resize')); requestAnimationFrame(() => { stage.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('resize')); }); };
  function setChat(v) { chatOpen = v; dock.chat.el.classList.toggle('open', v); scrim.classList.toggle('on', v); if (v) { unread = 0; setTimeout(() => dock.chat.focus(), 250); const m = dock.chat.el.querySelector('.msgs'); m.scrollTop = m.scrollHeight; } dock.refresh(); }
  if (window.visualViewport) { const vv = window.visualViewport, f = () => el.style.setProperty('--kb', Math.max(0, innerHeight - vv.height - vv.offsetTop) + 'px'); vv.addEventListener('resize', f); vv.addEventListener('scroll', f); offs.push(() => { vv.removeEventListener('resize', f); vv.removeEventListener('scroll', f); }); }

  async function leave() {
    if (R && R.status === 'playing' && !R.watching && !(await confirmBox('Leave this match?', 'Leaving counts as a forfeit and your opponent wins.', 'Leave match'))) return;
    call.leave(); sock.emit('leave'); setTimeout(() => { if (location.hash.startsWith('#/room/')) location.hash = '#/'; }, 400);
  }

  /* ---------- game api handed to each game module ---------- */
  const api = {
    send: (m) => ask('move', m).then(r => { if (typeof r === 'string') { sfx('err'); toast(r); } return r; }),
    // ask() wraps non-object callbacks, so moves use the raw socket ack
    move(m) { return new Promise(res => { sock.emit('move', m, err => { if (err) { sfx('err'); toast(typeof err === 'string' ? err : 'Move not allowed'); } res(err); }); }); },
    room: () => R, idx: () => (R ? R.youIdx : -1), players: () => (R ? R.players : []), now: () => Date.now() + offset, me: () => S.me,
    listen(ev, fn) { sock.on(ev, fn); listeners.push([ev, fn]); }, emit: (d) => sock.emit('g', d), sfx, toast,
    myTurn: () => R && R.state && R.youIdx >= 0 && (R.state.turn === R.youIdx || R.state.turn === -1) && R.status === 'playing',
    name: i => (R && R.players[i] ? R.players[i].name : '?'),
  };

  /* ---------- rendering ---------- */
  function seatInfo(i) {
    const p = R.players[i], d = game && gameMod.seat ? gameMod.seat(R, i, api.now()) || {} : {}, turn = R.status === 'playing' && R.state && (R.state.turn === i || (R.state.turn === -1 && d.active !== false));
    return { p, d, turn };
  }
  function drawSeats() {
    seatsEl.dataset.n = R.players.length; seatsEl.replaceChildren(...R.players.map((p, i) => {
      const { d, turn } = seatInfo(i), speaking = !!call.speak.get(p.id), inCall = call.st.members.find(m => m.id === p.id);
      return h('div', { class: 'seat' + (turn ? ' turn' : '') + (p.connected && !p.left ? '' : ' off') + (speaking ? ' speaking' : ''), 'data-i': i },
        avatar(p.av, 38), h('div', { class: 'who' }, h('b', { class: 'nmrow' }, h('span', { class: 'ell' }, p.name), p.id === S.me.id ? h('span', { class: 'you' }, 'YOU') : null), h('small', { class: 'ell' }, p.left ? 'Left the match' : !p.connected ? 'Reconnecting…' : d.sub != null ? d.sub : 'Rating ' + p.rating)),
        d.badge != null ? h('div', { class: 'badge2' + (d.low ? ' low' : ''), 'data-badge': 1 }, d.badge) : null, inCall && !inCall.mic ? h('span', { class: 'mic' }, icon('micoff', 'sm')) : null);
    }));
  }
  function updateBadges() { if (!R || !game || !gameMod.seat) return; seatsEl.querySelectorAll('.seat').forEach((s, i) => { const d = gameMod.seat(R, i, api.now()) || {}, b = s.querySelector('[data-badge]'); if (b && d.badge != null) { b.textContent = d.badge; b.classList.toggle('low', !!d.low); } }); }
  function statusText() {
    if (R.status === 'lobby') return { t: R.players.length < R.min ? 'Waiting for players…' : 'Ready to start' };
    if (R.status === 'finished') { const r = R.result; if (!r) return { t: 'Game over' }; if (r.draw) return { t: 'Draw' }; if (R.watching) return { t: (R.players.find(p => p.id === r.winnerId) || { name: '?' }).name + ' wins' }; return { t: r.winnerId === S.me.id ? 'You won' : 'You lost', turn: r.winnerId === S.me.id }; }
    const custom = game && gameMod.status ? gameMod.status(R, api) : null; if (custom) return typeof custom === 'string' ? { t: custom } : custom;
    if (R.watching) return { t: 'Watching live' };
    if (!R.state || R.state.turn === -1) return { t: 'Play!', turn: true };
    return R.state.turn === R.youIdx ? { t: 'Your turn', turn: true } : { t: (R.players[R.state.turn] ? R.players[R.state.turn].name : 'Opponent') + '’s turn' };
  }
  function drawActions() {
    clear(actions); const g = gameInfo(R.game), btns = [];
    if (R.watching) { actions.append(h('span', { class: 'pill' }, icon('eye', 'sm'), 'You are spectating')); return; }
    if (R.status === 'lobby') {
      const mine = R.players.find(p => p.id === S.me.id), host = R.host === S.me.id;
      const enough = R.players.length >= R.min, allReady = R.players.every(p => p.ready || p.id === R.host);
      if (host) btns.push(h('button', { class: 'btn primary', disabled: !enough || !allReady, onclick: async () => { const r = await ask('start'); if (r.error) toast(r.error); } }, icon('play', 'sm'), !enough ? 'Need ' + R.min + ' players' : !allReady ? 'Waiting for players to ready up' : 'Start game'));
      else btns.push(h('button', { class: 'btn primary', onclick: () => sock.emit('ready') }, icon(mine && mine.ready ? 'check' : 'play', 'sm'), mine && mine.ready ? 'Ready · tap to cancel' : 'Ready'));
      btns.push(h('button', { class: 'btn', onclick: () => { location.hash = '#/friends'; } }, icon('userplus', 'sm'), 'Add friends'));
      actions.append(...btns); return;
    }
    if (R.status === 'playing') {
      if (g.draws) {
        if (R.drawOffer && R.drawOffer !== S.me.id) btns.push(h('span', { class: 'pill solid' }, 'Draw offered'), h('button', { class: 'btn sm primary', onclick: () => sock.emit('draw', { op: 'accept' }) }, 'Accept'), h('button', { class: 'btn sm', onclick: () => sock.emit('draw', { op: 'decline' }) }, 'Decline'));
        else btns.push(h('button', { class: 'btn sm', disabled: !!R.drawOffer, onclick: () => { sock.emit('draw', { op: 'offer' }); toast('Draw offered'); } }, icon('equal', 'sm'), R.drawOffer ? 'Draw offered' : 'Offer draw'));
      }
      if (g.resign && R.players.length === 2) btns.push(h('button', { class: 'btn sm', onclick: async () => { if (await confirmBox('Resign?', 'You will lose this game.', 'Resign')) sock.emit('resign'); } }, icon('flag', 'sm'), 'Resign'));
      if (gameMod && gameMod.actions) btns.push(...gameMod.actions(R, api));
    } else if (R.status === 'finished') {
      const can = R.players.filter(p => !p.left).length >= R.min, voted = R.rematch.includes(S.me.id);
      btns.push(h('button', { class: 'btn sm primary', disabled: !can || voted, onclick: () => sock.emit('rematch') }, icon('refresh', 'sm'), !can ? 'Opponent left' : voted ? 'Waiting… (' + R.rematch.length + '/' + R.players.length + ')' : 'Rematch' + (R.rematch.length ? ' (' + R.rematch.length + '/' + R.players.length + ')' : '')));
      if (resultHidden) btns.push(h('button', { class: 'btn sm', onclick: () => { resultHidden = false; render(); } }, 'Show result'));
      btns.push(h('button', { class: 'btn sm', onclick: leave }, 'Leave'));
    }
    actions.append(...btns);
  }
  function resultCard() {
    const r = R.result; if (!r || resultHidden) return null;
    const aw = (r.awards || {})[S.me.id], won = r.winnerId === S.me.id, w = R.players.find(p => p.id === r.winnerId);
    const head = r.draw ? 'Draw' : R.watching ? (w ? w.name + ' wins' : 'Game over') : won ? 'Victory' : 'Defeat';
    const scores = r.scores ? R.players.map((p, i) => p.name + ' ' + r.scores[i]).join('  ·  ') : null;
    const d = aw ? aw.ratingAfter - aw.ratingBefore : 0;
    return h('div', { class: 'result glass', role: 'dialog', 'aria-label': 'Game result' },
      h('button', { class: 'btn ghost round sm x', 'aria-label': 'Close result', onclick: () => { resultHidden = true; render(); } }, icon('x', 'sm')),
      h('div', { class: 'label' }, gameInfo(R.game).title), h('div', { class: 'big', style: { margin: '6px 0' } }, head),
      h('div', { class: 'small muted' }, (REASON[r.reason] ? cap(REASON[r.reason]) : '') + (scores ? (REASON[r.reason] ? ' · ' : '') + scores : '')),
      aw && !R.watching ? h('div', { class: 'delta' }, h('div', null, h('b', null, (d >= 0 ? '+' : '') + d), h('span', null, 'Rating (' + aw.ratingAfter + ')')), h('div', null, h('b', null, '+' + aw.xp), h('span', null, 'XP'))) : null,
      aw && aw.unlocked && aw.unlocked.length ? h('div', { class: 'unl' }, icon('award', 'sm'), ' Unlocked: ' + aw.unlocked.map(k => ACH[k] || k).join(', ')) : null,
      !R.watching ? h('div', { class: 'acts' }, h('button', { class: 'btn primary sm', disabled: R.rematch.includes(S.me.id) || R.players.filter(p => !p.left).length < R.min, onclick: () => sock.emit('rematch') }, icon('refresh', 'sm'), R.rematch.includes(S.me.id) ? 'Waiting…' : 'Rematch'), h('button', { class: 'btn sm', onclick: () => { resultHidden = true; render(); } }, 'View board'), h('button', { class: 'btn sm', onclick: leave }, 'Leave')) : h('div', { class: 'acts' }, h('button', { class: 'btn sm', onclick: leave }, 'Leave')));
  }
  async function ensureGame() {
    const want = R.code + ':' + matchKey;
    if (game && gameFor === want) return;
    if (game) { game.destroy && game.destroy(); game = null; listeners.forEach(([e, f]) => sock.off(e, f)); listeners = []; }
    gameFor = want; clear(stage);
    try { gameMod = (await import('../games/' + R.game + '.js')).default; } catch (e) { console.error(e); stage.append(h('div', { class: 'empty glass' }, 'This game could not be loaded. Reload the page.')); return; }
    if (dead) return;
    const box = h('div', { class: 'gbox' }); stage.append(box); game = gameMod.mount(box, api); game.update(R); drawSeats(); drawActions(); requestAnimationFrame(() => { stage.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('resize')); });
  }
  function render() {
    if (!R || dead) return;
    const g = gameInfo(R.game);
    seatsEl.hidden = R.status === 'lobby';
    title.textContent = g.title; sub.textContent = 'ROOM ' + R.code; specs.hidden = !R.spectators; specs.replaceChildren(icon('eye', 'sm'), R.spectators + '');
    const st = statusText(); status.className = 'status' + (st.turn ? ' turn' : ''); status.replaceChildren(h('span', { class: 'ell' }, st.t));
    dock.setRoom(R);
    if (R.status === 'lobby') {
      if (game) { game.destroy && game.destroy(); game = null; gameFor = null; listeners.forEach(([e, f]) => sock.off(e, f)); listeners = []; }
      try { stage.replaceChildren(lobby(R)); }
      catch (e) { console.error('Room lobby render failed', e); stage.replaceChildren(h('div', { class: 'lobby glass' }, h('h2', { class: 'h2' }, g.title + ' lobby'), h('p', { class: 'muted' }, 'Lobby details could not load. You can still ready up, start the game, or add friends using the controls below.'))); }
    } else {
      if (prevStatus === 'lobby' || prevStatus === null || (prevStatus === 'finished' && R.status === 'playing')) { matchKey++; resultHidden = false; soundDone = null; }
      ensureGame().then(() => { if (game) game.update(R); drawSeats(); });
      stage.querySelectorAll(':scope > .result').forEach(e => e.remove()); const rc = R.status === 'finished' ? resultCard() : null; if (rc) stage.append(rc);
    }
    if (R.status === 'finished' && R.result && soundDone !== R.result) { soundDone = R.result; sfx(R.result.draw ? 'tick' : R.result.winnerId === S.me.id ? 'win' : R.watching ? 'tick' : 'lose'); }
    drawSeats(); drawActions(); prevStatus = R.status;
  }

  /* ---------- wiring ---------- */
  const apply = r => { if (!r || r.code !== code) return; offset = r.now - Date.now(); R = r; render(); };
  offs.push(on('room', ({ room: r }) => { if (r && r.code === code) apply(r); }));
  offs.push(call.subscribe(() => { if (R) { drawSeats(); el.classList.toggle('call-active', !!call.st.joined); el.classList.toggle('call-video', !!call.st.joined && !!call.st.cam); requestAnimationFrame(() => stage.dispatchEvent(new Event('resize'))); } }));
  offs.push(on('friends', () => { if (R && R.status === 'lobby') render(); }));
  ticker = setInterval(() => { if (!R) return; updateBadges(); if (R.status === 'lobby' && R.fillAt) stage.replaceChildren(lobby(R)); }, 250);
  window.addEventListener('resize', layout); offs.push(() => window.removeEventListener('resize', layout));
  layout();
  stage.append(h('div', { class: 'empty' }, 'Joining room…'));
  (async () => {
    if (S.room && S.room.code === code) return apply(S.room);
    let r = await ask('join', { code });
    if (r.error) { const w = await ask('watch', { code }); if (w.error) { toast(r.error); location.hash = '#/'; return; } }
    if (S.room && S.room.code === code) apply(S.room);
  })();
  const t = setTimeout(() => { if (!R && !dead) { toast('Could not join that room.'); location.hash = '#/'; } }, 9000);

  return { destroy() { dead = true; clearTimeout(t); clearInterval(ticker); offs.forEach(f => f()); listeners.forEach(([e, f]) => sock.off(e, f)); game && game.destroy && game.destroy(); dock.destroy(); call.destroy(); } };
}
