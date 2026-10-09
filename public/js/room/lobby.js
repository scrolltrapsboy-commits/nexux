import { h, icon, avatar, S, ask, toast, sock, copyText, gameInfo, cap, mmss } from '../core.js';
import { art } from '../art.js';

// Pre-game lobby: room code, player slots, ready state, start button and friend invitations.
export function lobby(R, invalidate) {
  const g = gameInfo(R.game), me = S.me.id, isHost = R.host === me, mine = R.players.find(p => p.id === me);
  const link = location.origin + '/#/room/' + R.code;
  const slots = [];
  for (let i = 0; i < R.max; i++) {
    const p = R.players[i];
    slots.push(p ? h('div', { class: 'slot' }, avatar(p.av, 40, p.connected ? 'online' : 'offline'), h('div', { class: 'grow' }, h('b', { class: 'ell' }, p.name + (p.id === me ? ' (you)' : '')), h('div', { class: 'small muted' }, 'Rating ' + p.rating + (p.id === R.host ? ' · Host' : ''))), h('span', { class: 'ready' + (p.ready || p.id === R.host ? ' on' : '') }, p.ready || p.id === R.host ? 'READY' : 'NOT READY'))
      : h('div', { class: 'slot empty' }, i < R.min ? 'Waiting for a player…' : 'Open seat'));
  }
  const allReady = R.players.every(p => p.ready || p.id === R.host), enough = R.players.length >= R.min;
  const optPills = R.opts ? Object.entries(R.opts).filter(([k, v]) => v && k !== 'ms').map(([k, v]) => h('span', { class: 'pill' }, k === 'time' ? v + ' min' : cap(k) + ': ' + v)) : [];
  const fill = R.fillAt ? Math.max(0, Math.ceil((R.fillAt - Date.now()) / 1000)) : null;
  // Include every currently connected friend; away friends can still accept, while in-game friends are shown as busy.
  const friends = (S.friends?.friends || []).filter(f => ['online', 'away', 'ingame'].includes(f.p));
  // Any game with an open seat can accept a friend invite, including 3+ player games.
  const canInvite = R.players.length < R.max;
  let action;
  if (isHost) action = h('button', { class: 'btn primary block', disabled: !enough || !allReady, onclick: async () => { const r = await ask('start'); if (r.error) toast(r.error); } }, icon('play', 'sm'), !enough ? 'Need ' + R.min + ' players' : !allReady ? 'Waiting for ready…' : 'Start game');
  else action = h('button', { class: 'btn primary block' + (mine && mine.ready ? '' : ''), onclick: () => sock.emit('ready') }, icon(mine && mine.ready ? 'check' : 'play', 'sm'), mine && mine.ready ? 'Ready · tap to cancel' : 'Ready');
  return h('div', { class: 'lobby glass' },
    h('div', { class: 'row' }, art(R.game, 44), h('div', { class: 'grow' }, h('h2', { class: 'h2' }, g.title), h('div', { class: 'small muted' }, (R.visibility === 'public' ? 'Public room' : R.visibility === 'friends' ? 'Friends only' : 'Private room') + ' · ' + R.players.length + '/' + R.max + ' players'))),
    optPills.length ? h('div', { class: 'opt-row' }, optPills) : null,
    h('button', { class: 'code', title: 'Copy room code', 'aria-label': 'Room code ' + R.code.split('').join(' ') + '. Tap to copy.', onclick: async () => toast((await copyText(R.code)) ? 'Room code copied' : 'Copy failed. Code: ' + R.code) }, R.code),
    h('div', { class: 'row' }, h('button', { class: 'btn sm grow', onclick: async () => toast((await copyText(link)) ? 'Invite link copied' : 'Copy failed') }, icon('link', 'sm'), 'Copy invite link'),
      navigator.share ? h('button', { class: 'btn sm', onclick: () => navigator.share({ title: 'Play ' + g.title + ' with me', text: 'Join my ' + g.title + ' room on NEXUS PLAY', url: link }).catch(() => {}) }, 'Share') : null),
    h('div', { class: 'plist' }, slots),
    fill != null ? h('div', { class: 'small tc muted' }, 'Match starts in ' + fill + 's, or sooner if the room fills up.') : (R.fillAt === null && R.players.length < R.min ? h('div', { class: 'small tc muted' }, 'Share the code, invite a friend, or wait for someone to join.') : null),
    action,
    canInvite && friends.length ? h('div', null, h('div', { class: 'label', style: { margin: '4px 0 8px' } }, 'Invite online friends'), friends.map(f => h('div', { class: 'list-item' }, avatar(f.av, 32, f.p), h('b', { class: 'grow ell' }, f.name), f.p === 'ingame' ? h('span', { class: 'small muted' }, 'In a game') : h('button', { class: 'btn xs', onclick: async e => { e.target.disabled = true; const r = await ask('invite', { id: f.id, game: R.game }); if (r.error) { toast(r.error); e.target.disabled = false; } else e.target.textContent = 'Invited'; } }, 'Invite')))) : null);
}
