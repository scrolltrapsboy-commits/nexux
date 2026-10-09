import { h, icon, avatar, S, sock, ask, toast, menu, modal, confirmBox, clear, gameInfo, presenceText, hm, ago, debounce, sfx } from '../core.js';
import { art } from '../art.js';

export function inviteModal(peer) {
  // Invites can fill a seat in 3+ player lobbies too; don't hide those games here.
  const multiplayer = S.catalog.filter(g => g.max >= 2);
  modal((b, close) => {
    b.append(h('h2', null, 'Invite ' + peer.name), h('p', { class: 'small muted', style: { marginBottom: '12px' } }, 'Pick a game. They get a notification and can join in one tap.'),
      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: '8px' } }, multiplayer.map(g => h('button', { class: 'btn', style: { flexDirection: 'column', height: 'auto', padding: '12px 8px', borderRadius: '16px', whiteSpace: 'normal' }, onclick: async () => { const r = await ask('invite', { id: peer.id, game: g.id }); if (r.error) toast(r.error); else { toast('Invitation sent to ' + peer.name); close(); } } }, art(g.id, 40), g.title))),
      h('div', { class: 'acts' }, h('button', { class: 'btn', onclick: close }, 'Close')));
  });
}

export default function friends(root, ctx) {
  ctx.title('Friends'); root.classList.add('fit');
  let open = ctx.args[0] || null, thread = null, q = '', results = [];
  const wrap = h('div', { class: 'split' + (open ? ' thread-open' : '') });
  const listP = h('section', { class: 'panel glass list', 'aria-label': 'Friends list' }), thP = h('section', { class: 'panel glass thread', 'aria-label': 'Conversation' });
  wrap.append(listP, thP); root.append(wrap);
  const stat = c => c.p === 'ingame' ? 'Playing ' + (S.byId[c.game] || { title: 'a game' }).title : presenceText(c);
  const find = id => [...S.friends.friends, ...S.friends.recent, ...S.friends.incoming].find(c => c.id === id);

  /* ----- list ----- */
  const person = (c, opts = {}) => h('div', { class: 'frow' + (open === c.id ? ' on' : ''), role: 'button', tabindex: 0, onclick: () => opts.open && openThread(c.id), onkeydown: e => { if (e.key === 'Enter' && opts.open) openThread(c.id); } },
    avatar(c.av, 42, c.p || 'offline'), h('div', { class: 'grow' }, h('b', { class: 'ell' }, c.name), h('small', null, c.p ? stat(c) : opts.sub || '')),
    S.unread[c.id] ? h('span', { class: 'badge' }, S.unread[c.id]) : null, opts.actions || null);
  const drawList = () => {
    const F = S.friends, order = { ingame: 0, online: 1, away: 2, offline: 3 };
    const fl = [...F.friends].sort((a, b) => order[a.p] - order[b.p] || a.name.localeCompare(b.name));
    clear(listP);
    const inp = h('input', { class: 'inp', type: 'search', placeholder: 'Find players to add…', value: q, 'aria-label': 'Search players', style: { minHeight: '42px' }, oninput: debounce(async e => { q = e.target.value.trim(); results = q.length >= 2 ? await ask('search', { q }) : []; if (!Array.isArray(results)) results = []; drawList(); const i = listP.querySelector('input'); i.focus(); i.setSelectionRange(q.length, q.length); }, 250) });
    const body = h('div', { class: 'panel-b' });
    if (q.length >= 2) {
      body.append(h('div', { class: 'label sec-h' }, 'Search results'));
      if (!results.length) body.append(h('div', { class: 'empty' }, 'No players found.'));
      results.forEach(c => body.append(person(c, { sub: '', actions: c.rel === 'friend' ? h('span', { class: 'pill' }, 'Friends') : c.rel === 'sent' ? h('span', { class: 'pill' }, 'Requested') : h('button', { class: 'btn xs primary', onclick: e => { e.stopPropagation(); act(c.id, 'add'); } }, icon('userplus', 'sm'), 'Add') })));
    }
    if (F.incoming.length) { body.append(h('div', { class: 'label sec-h' }, 'Requests · ' + F.incoming.length)); F.incoming.forEach(c => body.append(person(c, { sub: 'wants to be friends', actions: h('span', { class: 'row', style: { gap: '6px' } }, h('button', { class: 'btn xs primary', onclick: e => { e.stopPropagation(); act(c.id, 'accept'); } }, 'Accept'), h('button', { class: 'btn xs', 'aria-label': 'Decline', onclick: e => { e.stopPropagation(); act(c.id, 'decline'); } }, icon('x', 'sm'))) }))); }
    body.append(h('div', { class: 'label sec-h' }, 'Friends · ' + fl.length));
    if (!fl.length) body.append(h('div', { class: 'empty' }, 'No friends yet. Search for a username above, or add someone from Recent players.'));
    fl.forEach(c => body.append(person(c, { open: true, actions: h('button', { class: 'btn xs ghost round', 'aria-label': 'More for ' + c.name, onclick: e => { e.stopPropagation(); menu(e.currentTarget, [{ label: 'View profile', icon: 'user', fn: () => location.hash = '#/profile/' + c.id }, { label: 'Invite to a game', icon: 'gamepad', fn: () => inviteModal(c) }, { label: 'Remove friend', icon: 'x', fn: async () => { if (await confirmBox('Remove ' + c.name + '?', 'You can add them again later.', 'Remove')) act(c.id, 'remove'); } }, { label: 'Block', icon: 'ban', fn: async () => { if (await confirmBox('Block ' + c.name + '?', 'They will not be able to message or invite you.', 'Block')) act(c.id, 'block'); } }]); } }, icon('more', 'sm')) })));
    const recent = F.recent.filter(c => !F.friends.some(f => f.id === c.id));
    if (recent.length) { body.append(h('div', { class: 'label sec-h' }, 'Recent players')); recent.forEach(c => body.append(person(c, { sub: 'Played recently', actions: h('button', { class: 'btn xs', onclick: e => { e.stopPropagation(); act(c.id, 'add'); } }, icon('userplus', 'sm'), 'Add') }))); }
    if (F.blocked.length) { body.append(h('div', { class: 'label sec-h' }, 'Blocked')); F.blocked.forEach(c => body.append(person(c, { sub: 'Blocked', actions: h('button', { class: 'btn xs', onclick: () => act(c.id, 'unblock') }, 'Unblock') }))); }
    listP.append(h('div', { class: 'chat-h' }, icon('users', 'sm'), h('b', null, 'Friends')), h('div', { style: { padding: '10px 12px 0' } }, inp), body);
  };
  async function act(id, op) { const r = await ask('friend', { id, op }); if (r.error) toast(r.error); else if (op === 'add') { toast(r.status === 'accepted' ? 'You are now friends' : 'Friend request sent'); results = results.map(c => c.id === id ? { ...c, rel: r.status === 'accepted' ? 'friend' : 'sent' } : c); drawList(); } if (op === 'remove' || op === 'block') { if (open === id) closeThread(); } }

  /* ----- thread ----- */
  let msgsEl, typingEl, peerRead = 0, tmo;
  const closeThread = () => { open = null; thread = null; wrap.classList.remove('thread-open'); history.replaceState(null, '', '#/friends'); drawThread(); drawList(); };
  async function openThread(id) {
    open = id; wrap.classList.add('thread-open'); history.replaceState(null, '', '#/friends/' + id);
    const r = await ask('dm:open', { id }); if (r.error) { toast(r.error); return closeThread(); }
    thread = { id, msgs: r.msgs, peer: r.peer }; peerRead = r.peerRead || 0; drawThread(); drawList();
  }
  function msgNode(m) { const me = m.id === S.me.id; return h('div', { class: 'msg' + (me ? ' me' : '') }, h('div', { class: 'bub' }, h('div', { class: 'tx' }, m.text), h('div', { class: 'tiny muted', style: { marginTop: '2px' } }, hm(m.t)))); }
  function seenMark() { const last = thread && [...thread.msgs].reverse().find(m => m.id === S.me.id); const old = msgsEl && msgsEl.querySelector('.seen'); if (old) old.remove(); if (last && last.t <= peerRead && msgsEl) msgsEl.append(h('div', { class: 'tiny muted seen', style: { textAlign: 'right' } }, 'Seen')); }
  function drawThread() {
    clear(thP);
    if (!thread) return thP.append(h('div', { class: 'empty', style: { margin: 'auto' } }, icon('chat', 'lg'), h('p', { style: { marginTop: '8px' } }, 'Pick a friend to start chatting.')));
    const c = find(thread.id) || thread.peer;
    msgsEl = h('div', { class: 'msgs' }, thread.msgs.length ? thread.msgs.map(msgNode) : h('div', { class: 'empty' }, 'Say hello to ' + c.name + '.'));
    typingEl = h('div', { class: 'typing' });
    const inp = h('input', { class: 'inp', placeholder: 'Message ' + c.name, maxlength: 500, autocomplete: 'off', enterkeyhint: 'send', 'aria-label': 'Direct message' });
    let last = 0; inp.addEventListener('input', () => { if (Date.now() - last > 1800) { last = Date.now(); sock.emit('typing', { scope: 'dm', id: thread.id }); } });
    thP.append(h('div', { class: 'chat-h' }, h('button', { class: 'btn ghost round sm back-m', 'aria-label': 'Back to friends', onclick: closeThread }, icon('left')), avatar(c.av, 36, c.p || 'offline'), h('div', { class: 'grow' }, h('b', { class: 'ell' }, c.name), h('div', { class: 'tiny muted' }, c.p ? stat(c) : '')),
      h('button', { class: 'btn sm', onclick: () => location.hash = '#/profile/' + c.id }, 'Profile'), h('button', { class: 'btn sm primary', onclick: () => inviteModal(c) }, icon('gamepad', 'sm'), 'Invite')),
      msgsEl, typingEl, h('form', { class: 'chat-f', onsubmit: async e => { e.preventDefault(); const text = inp.value.trim(); if (!text) return; inp.value = ''; const r = await ask('dm:send', { id: thread.id, text }); if (r.error) { toast(r.error); inp.value = text; } } }, inp, h('button', { class: 'btn primary round', type: 'submit', 'aria-label': 'Send' }, icon('send', 'sm'))));
    requestAnimationFrame(() => { msgsEl.scrollTop = msgsEl.scrollHeight; seenMark(); });
  }
  ctx.on('dm', m => {
    const peer = m.id === S.me.id ? m.to : m.id;
    if (thread && thread.id === peer) { thread.msgs.push({ id: m.id, text: m.text, t: m.t }); const e = msgsEl.querySelector('.empty'); if (e) e.remove(); const near = msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 100; msgsEl.append(msgNode(m)); seenMark(); if (near || m.id === S.me.id) msgsEl.scrollTop = msgsEl.scrollHeight; if (m.id !== S.me.id) { sock.emit('dm:read', { id: peer }); sfx('msg'); } }
  });
  ctx.on('dm:seen', m => { if (thread && thread.id === m.id) { peerRead = m.t; seenMark(); } });
  ctx.on('typing', t => { if (t.scope === 'dm' && thread && thread.id === t.id && typingEl) { typingEl.textContent = t.from + ' is typing…'; clearTimeout(tmo); tmo = setTimeout(() => typingEl && (typingEl.textContent = ''), 2500); } });
  ctx.on('friends', () => { drawList(); if (thread) { const c = find(thread.id); if (c) { const hd = thP.querySelector('.chat-h .tiny'); if (hd) hd.textContent = stat(c); } } });
  ctx.on('unread', drawList);
  drawList(); drawThread(); if (open) openThread(open);
}
