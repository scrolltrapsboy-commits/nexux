import { h, $, clear, icon, avatar, S, sock, on, emit, ask, api, store, applyPrefs, toast, menu, ago, modal, confirmBox } from './core.js';
import { wire, goNote, hello } from './net.js';
import { authScreen } from './pages/auth.js';

applyPrefs();
const appEl = $('#app');
let roomEl = null, cleanup = [], frame = null, current = null;

const PAGES = {
  '': () => import('./pages/home.js'), games: () => import('./pages/games.js'), friends: () => import('./pages/friends.js'),
  ranks: () => import('./pages/ranks.js'), profile: () => import('./pages/profile.js'), settings: () => import('./pages/settings.js'),
};
const NAV = [['', 'home', 'Home'], ['games', 'gamepad', 'Games'], ['friends', 'users', 'Friends'], ['ranks', 'trophy', 'Ranks'], ['profile', 'user', 'Profile']];

export const go = p => { const t = '#/' + p; if (location.hash === t) route(); else location.hash = t; };

/* ---------- app frame (rail, top bar, tabs) ---------- */
function buildFrame() {
  const navLink = (n, cls) => h('a', { class: cls + ' nav', href: '#/' + n[0], 'data-r': n[0], 'aria-label': n[2] }, icon(n[1]), h('span', null, n[2]), n[0] === 'friends' ? h('span', { class: 'badge', hidden: true, id: 'fbadge' }) : null);
  const bell = h('button', { class: 'iconbtn', 'aria-label': 'Notifications', onclick: e => notesPanel(e.currentTarget) }, icon('bell'), h('span', { class: 'badge', id: 'nbadge', hidden: true }));
  const meChip = h('button', { class: 'me-chip', 'aria-label': 'Account menu', onclick: e => menu(e.currentTarget, [
    { label: 'My profile', icon: 'user', fn: () => go('profile') }, { label: 'Settings', icon: 'settings', fn: () => go('settings') },
    { label: 'Sign out', icon: 'logout', fn: signOut }]) });
  const f = h('div', { class: 'app' },
    h('aside', { class: 'rail glass' }, h('div', { class: 'logo' }, 'N'), NAV.map(n => navLink(n, '')), h('div', { class: 'sp' }), h('a', { class: 'nav', href: '#/settings', 'data-r': 'settings', 'aria-label': 'Settings' }, icon('settings'), h('span', null, 'Settings'))),
    h('main', { class: 'main' },
      h('header', { class: 'top' }, h('div', { class: 'ttl', id: 'ttl' }, 'Home'), h('div', { class: 'sp' }), h('div', { class: 'online-pill' }, h('i', { class: 'dot online' }), h('span', { id: 'onl' }, '0 online')), bell, meChip),
      h('div', { class: 'page', id: 'page' })),
    h('nav', { class: 'tabs glass', 'aria-label': 'Main' }, NAV.map(n => navLink(n, ''))));
  return f;
}
const refreshChrome = () => {
  if (!frame) return;
  const nb = $('#nbadge'), unread = S.notes.filter(n => !n.read).length; nb.hidden = !unread; nb.textContent = unread > 9 ? '9+' : unread;
  const fb = S.friends.incoming.length + Object.values(S.unread).reduce((a, b) => a + b, 0);
  frame.querySelectorAll('#fbadge').forEach(b => { b.hidden = !fb; b.textContent = fb > 9 ? '9+' : fb; });
  const chip = $('.me-chip', frame); if (S.me) { clear(chip); chip.append(avatar(S.me.avatar, 36), h('span', { class: 'nm b' }, S.me.name)); }
  const o = $('#onl'); if (o) o.textContent = S.online + ' online';
  rejoinPill();
};
function rejoinPill() {
  document.querySelectorAll('.rejoin').forEach(e => e.remove());
  if (S.room && !location.hash.startsWith('#/room/') && frame) {
    const g = S.byId[S.room.game] || { title: S.room.game };
    document.body.append(h('button', { class: 'btn primary rejoin', onclick: () => go('room/' + S.room.code) }, icon('play', 'sm'), (S.room.status === 'playing' ? 'Return to ' : 'Open room · ') + g.title));
  }
}
function notesPanel(anchor) {
  document.querySelectorAll('.notes').forEach(n => n.remove());
  const p = h('div', { class: 'notes glass', role: 'dialog', 'aria-label': 'Notifications' });
  const draw = () => {
    clear(p); const unread = S.notes.some(n => !n.read);
    p.append(h('div', { class: 'chat-h' }, h('b', { class: 'grow' }, 'Notifications'), h('button', { class: 'btn xs', disabled: !unread, onclick: () => sock.emit('notes:read', { id: 'all' }) }, 'Mark all read')),
      h('div', { style: { overflow: 'auto', flex: 1 } }, S.notes.length ? S.notes.map(n => h('button', { class: 'note' + (n.read ? '' : ' unread'), onclick: () => { sock.emit('notes:read', { id: n.id }); p.remove(); goNote(n.go); } }, h('span', { class: 'grow' }, h('div', { class: 't' }, n.text), h('div', { class: 'tiny muted' }, ago(n.t))))) : h('div', { class: 'empty' }, 'Nothing yet. Friend requests, invitations and results show up here.')));
  };
  draw(); document.body.append(p);
  const off = on('notes', draw), away = e => { if (!p.contains(e.target) && !anchor.contains(e.target)) { p.remove(); off(); document.removeEventListener('mousedown', away, true); } };
  setTimeout(() => document.addEventListener('mousedown', away, true));
}
async function signOut() {
  if (!(await confirmBox('Sign out?', S.me.guest ? 'You are a guest. Signing out will lose this guest account unless you create an account first.' : 'You can sign back in any time.', 'Sign out'))) return;
  await api('/logout', {}); store.del('np.token'); location.hash = ''; location.reload();
}

/* ---------- router ---------- */
async function route() {
  if (!S.me) return;
  const parts = location.hash.replace(/^#\/?/, '').split('/'), seg = parts[0] || '', args = parts.slice(1);
  document.querySelectorAll('.menu,.notes').forEach(e => e.remove());
  cleanup.forEach(f => { try { f(); } catch {} }); cleanup = []; current = null;
  if (seg === 'room' && args[0]) {
    appEl.hidden = true; if (roomEl) roomEl.remove(); roomEl = h('div', { id: 'roomroot' }); document.body.append(roomEl);
    document.querySelectorAll('.rejoin').forEach(e => e.remove());
    const mod = await import('./room/room.js'); const d = mod.default(roomEl, { code: args[0].toUpperCase() }); cleanup.push(() => { d && d.destroy && d.destroy(); roomEl && roomEl.remove(); roomEl = null; appEl.hidden = false; });
    return;
  }
  appEl.hidden = false;
  if (!PAGES[seg]) return go('');
  if (!frame) { frame = buildFrame(); clear(appEl); appEl.append(frame); }
  frame.querySelectorAll('[data-r]').forEach(a => a.classList.toggle('on', a.dataset.r === seg || (seg === 'profile' && a.dataset.r === 'profile')));
  const pg = $('#page'); clear(pg); pg.className = 'page'; pg.scrollTop = 0;
  const my = current = {};
  const mod = await PAGES[seg](); if (current !== my) return;
  const ctx = { args, page: pg, title: t => { $('#ttl').textContent = t; document.title = t + ' · NEXUS PLAY'; }, on: (ev, fn) => { const off = on(ev, fn); cleanup.push(off); return off; }, go, onCleanup: fn => cleanup.push(fn) };
  const d = mod.default(pg, ctx); if (typeof d === 'function') cleanup.push(d); else if (d && d.destroy) cleanup.push(() => d.destroy());
  refreshChrome();
}

/* ---------- boot ---------- */
function start() {
  const params = location.hash.match(/^#\/reset\/([a-f0-9]+)/);
  if (params) return authScreen(appEl, () => start(), 'reset', params[1]);
  S.token = store.get('np.token');
  const showAuth = () => authScreen(appEl, () => connect(), 'in');
  if (!S.token) return showAuth();
  api('/me').then(r => { if (r.error && /expired|Sign in/i.test(r.error)) { store.del('np.token'); S.token = null; showAuth(); } else connect(); });
}
let booted = false;
function connect() {
  if (!sock) { appEl.textContent = 'Realtime library failed to load. Reload the page.'; return; }
  if (!booted) {
    booted = true; wire();
    on('room', ({ room, prev, boot }) => {
      if (!S.me) return;
      const inRoom = location.hash.startsWith('#/room/');
      if (room && (!prev || prev.code !== room.code) && !(inRoom && location.hash.toUpperCase().endsWith(room.code))) go('room/' + room.code);
      else if (!room && inRoom && !boot) go('');
      refreshChrome();
    });
    for (const e of ['friends', 'notes', 'unread', 'online', 'hello']) on(e, refreshChrome);
    window.addEventListener('hashchange', route);
  }
  const once = on('hello', () => { once(); if (!location.hash.startsWith('#/room/') && !PAGES[location.hash.replace(/^#\/?/, '').split('/')[0] || ''] ) location.hash = '#/'; route(); });
  if (sock.connected) hello(); else sock.connect();
}
start();
