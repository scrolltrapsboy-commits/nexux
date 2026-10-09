// Socket event wiring: server pushes update the shared state `S`, then pages react through the event bus.
import { S, sock, emit, on, toast, sfx, ask, store, h, icon, avatar, clear } from './core.js';

export function goNote(go) {
  if (!go) return; if (go === 'room') return S.room ? location.hash = '#/room/' + S.room.code : null;
  if (go.startsWith('dm:')) return location.hash = '#/friends/' + go.slice(3);
  location.hash = '#/' + (go === 'home' ? '' : go);
}

export function wire() {
  sock.on('room', r => { const prev = S.room; S.room = r; emit('room', { room: r, prev }); });
  sock.on('friends', f => { S.friends = f; emit('friends', f); });
  sock.on('notes', n => { S.notes = n; emit('notes', n); });
  sock.on('unread', u => { S.unread = u; emit('unread', u); });
  sock.on('online', n => { S.online = n; emit('online', n); });
  sock.on('gstats', g => { S.gstats = g; emit('gstats', g); });
  sock.on('chat', m => { if (m.scope === 'room') emit('roomchat', m); else { S.chat.push(m); if (S.chat.length > 150) S.chat.shift(); emit('chat', m); } });
  sock.on('typing', t => emit('typing', t));
  sock.on('dm', m => emit('dm', m));
  sock.on('dm:seen', m => emit('dm:seen', m));
  sock.on('notify', n => { sfx('note'); toast(n.text, n.go && n.go !== 'home' ? { go: () => goNote(n.go), label: 'View' } : {}); });
  sock.on('invite', iv => { sfx('note'); showInvite(iv); });
  sock.on('rtc:list', l => emit('rtc:list', l));
  sock.on('rtc:signal', s => emit('rtc:signal', s));
  sock.on('connect', hello);
  sock.on('disconnect', () => { S.conn = false; emit('conn', false); });
  document.addEventListener('visibilitychange', () => { if (sock.connected) sock.emit('away', document.hidden); });
}

export async function hello() {
  const r = await ask('hello', { token: S.token });
  if (r.error || !r.me) { toast(r.error || 'Could not sign in.'); return; }
  S.token = r.token; store.set('np.token', r.token);
  Object.assign(S, { me: r.me, catalog: r.catalog, chat: r.chat, gstats: r.gstats, online: r.online, room: r.room, conn: true });
  S.byId = Object.fromEntries(r.catalog.map(g => [g.id, g]));
  emit('hello', r); emit('conn', true); emit('room', { room: r.room, prev: null, boot: true });
  if (document.hidden) sock.emit('away', true);
}

let inviteEl = null;
function showInvite(iv) {
  if (inviteEl) inviteEl.remove();
  const g = S.byId[iv.game] || { title: iv.game };
  const done = () => { inviteEl && inviteEl.remove(); inviteEl = null; clearTimeout(t); };
  const t = setTimeout(done, iv.exp || 60000);
  inviteEl = h('div', { class: 'invite glass', role: 'alertdialog' }, avatar(iv.av, 44),
    h('div', { class: 'grow' }, h('b', null, iv.from), h('div', { class: 'small muted' }, 'invites you to play ' + g.title)),
    h('button', { class: 'btn sm', onclick: () => { sock.emit('invite:decline', { code: iv.code }); done(); } }, 'Decline'),
    h('button', { class: 'btn sm primary', onclick: async () => { const r = await ask('invite:accept', { code: iv.code }); done(); if (r.error) toast(r.error); } }, 'Accept'));
  document.body.append(inviteEl);
}
