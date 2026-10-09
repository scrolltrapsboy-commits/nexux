import { h, icon, avatar, S, sock, ask, toast, clear, gameInfo, ago } from '../core.js';
import { art } from '../art.js';
import { chatPanel } from '../chatui.js';
import { openCreate, quick } from '../play.js';

export default function home(root, ctx) {
  ctx.title('Home'); root.classList.add('fit');
  const m = S.me;
  const stats = h('div', { class: 'stats-row' });
  const featured = h('div', { class: 'rail-h' });
  const rooms = h('div');
  const chat = chatPanel({ scope: 'global', title: 'Global chat', subtitle: 'One chat for everyone on NEXUS PLAY', history: S.chat, placeholder: 'Say something to everyone…' });
  const code = h('input', { class: 'inp', placeholder: 'ROOM CODE', maxlength: 6, 'aria-label': 'Room code', autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false' });
  const join = async () => { const c = code.value.trim().toUpperCase(); if (c.length < 4) return toast('Enter the 6 character room code.'); const r = await ask('join', { code: c }); if (r.error) { const w = await ask('watch', { code: c }); if (w.error) toast(r.error); else location.hash = '#/room/' + c; } };
  code.addEventListener('keydown', e => { if (e.key === 'Enter') join(); });
  const qpick = h('select', { class: 'inp', 'aria-label': 'Game for quick match', style: { flex: 1, minWidth: 0 } }, S.catalog.map(g => h('option', { value: g.id }, g.title)));
  const savedQ = localStorage.getItem('np.qg'); if (savedQ && S.byId[savedQ]) qpick.value = savedQ;
  qpick.onchange = () => localStorage.setItem('np.qg', qpick.value);

  const left = h('div', { class: 'home-l' },
    h('section', { class: 'hero glass' },
      h('div', { class: 'label' }, 'Welcome back'), h('h1', { class: 'h1', style: { margin: '6px 0 4px' } }, m.name),
      h('p', { class: 'muted', style: { maxWidth: '46ch' } }, 'Jump into a match in seconds. Voice and video open inside the game room, so you can play and talk together.'),
      h('div', { class: 'row wrap' }, qpick, h('button', { class: 'btn primary', onclick: () => quick(qpick.value) }, icon('bolt', 'sm'), 'Quick match')),
      h('div', { class: 'row wrap', style: { marginTop: '10px' } }, h('button', { class: 'btn sm', onclick: () => openCreate(qpick.value) }, icon('plus', 'sm'), 'Create room'), h('div', { class: 'joinbox grow', style: { maxWidth: '260px' } }, code, h('button', { class: 'btn sm', onclick: join }, 'Join')))),
    stats,
    h('section', null, h('div', { class: 'row', style: { marginBottom: '8px' } }, h('div', { class: 'h2 grow' }, 'Play something'), h('a', { class: 'btn ghost sm', href: '#/games' }, 'All games', icon('right', 'sm'))), featured),
    h('section', null, h('div', { class: 'h2', style: { marginBottom: '8px' } }, 'Rooms you can join'), rooms));

  const segm = h('div', { class: 'segm' }, h('div', { class: 'seg' }, h('button', { class: 'on', 'data-t': 'play' }, 'Play'), h('button', { 'data-t': 'chat' }, 'Chat')));
  const wrap = h('div', { class: 'home show-play' }, segm, left, h('div', { class: 'home-r', style: { minHeight: 0 } }, chat.el));
  segm.querySelectorAll('button').forEach(b => b.onclick = () => { segm.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); wrap.classList.toggle('show-play', b.dataset.t === 'play'); wrap.classList.toggle('show-chat', b.dataset.t === 'chat'); if (b.dataset.t === 'chat') setTimeout(() => chat.el.querySelector('.msgs').scrollTop = 1e9, 30); });
  root.append(wrap);

  const drawStats = () => {
    clear(stats); const me = S.me;
    [['Level', me.level], ['Rating', me.rating], ['XP', me.xp], ['Online now', S.online]].forEach(([k, v]) => stats.append(h('div', { class: 'stat' }, h('b', null, v), h('span', null, k))));
  };
  const drawFeatured = () => {
    clear(featured);
    S.catalog.forEach(g => featured.append(h('button', { class: 'mini glass', onclick: () => quick(g.id), 'aria-label': 'Quick match ' + g.title }, art(g.id, 54), h('b', null, g.title), h('small', null, (S.gstats[g.id] ? S.gstats[g.id] + ' playing' : g.min === g.max ? g.min + ' players' : g.min + '–' + g.max + ' players')))));
  };
  const drawRooms = async () => {
    const r = await ask('rooms:list'); if (!rooms.isConnected) return; clear(rooms);
    const open = r.open || [], live = r.live || [];
    if (!open.length && !live.length) return rooms.append(h('div', { class: 'list-item muted' }, 'No public rooms right now. Start a quick match and others will find you.'));
    open.forEach(o => rooms.append(h('div', { class: 'list-item' }, art(o.game, 36), h('div', { class: 'grow' }, h('b', null, gameInfo(o.game).title), h('div', { class: 'small muted' }, 'Hosted by ' + o.host + ' · ' + o.players + '/' + o.max)), h('button', { class: 'btn sm primary', onclick: async () => { const x = await ask('join', { code: o.code }); if (x.error) toast(x.error); } }, 'Join'))));
    live.forEach(o => rooms.append(h('div', { class: 'list-item' }, art(o.game, 36), h('div', { class: 'grow' }, h('b', null, o.players.join(' vs ')), h('div', { class: 'small muted' }, gameInfo(o.game).title + ' · ' + o.spectators + ' watching')), h('button', { class: 'btn sm', onclick: async () => { const x = await ask('watch', { code: o.code }); if (x.error) toast(x.error); else location.hash = '#/room/' + o.code; } }, icon('eye', 'sm'), 'Watch'))));
  };
  drawStats(); drawFeatured(); drawRooms();
  const iv = setInterval(drawRooms, 8000);
  ctx.on('online', drawStats); ctx.on('hello', () => { drawStats(); drawFeatured(); }); ctx.on('gstats', drawFeatured);
  return () => { clearInterval(iv); chat.destroy(); };
}
