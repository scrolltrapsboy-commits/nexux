// Shared client plumbing: DOM helper, icons, avatars, state, socket, toasts, modals, sound.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function h(tag, p, ...kids) {
  const e = document.createElement(tag);
  if (p) for (const k in p) {
    const v = p[k]; if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') e.innerHTML = v;
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, v);
  }
  add(e, kids); return e;
}
function add(e, kids) { for (const c of kids) { if (c == null || c === false) continue; if (Array.isArray(c)) add(e, c); else e.append(c.nodeType ? c : document.createTextNode(String(c))); } }
export const clear = e => { while (e.firstChild) e.removeChild(e.firstChild); return e; };

/* ---------- icons ---------- */
const P = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10', gamepad: 'M6 12h4M8 10v4M15 13h.01M18 11h.01M17.3 5H6.7a4 4 0 00-3.9 3.1l-1.7 7.6A2.5 2.5 0 005.5 18.5L7.5 16h9l2 2.5a2.5 2.5 0 004.4-2.8l-1.7-7.6A4 4 0 0017.3 5z',
  users: 'M16 20v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 10a4 4 0 100-8 4 4 0 000 8zM22 20v-2a4 4 0 00-3-3.9M16 2.1a4 4 0 010 7.8',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3', user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
  settings: 'M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4', bell: 'M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 003.4 0',
  mic: 'M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v3', micoff: 'M2 2l20 20M9 9v3a3 3 0 005.1 2.1M15 9.3V5a3 3 0 00-5.9-.7M19 10v2a7 7 0 01-.1 1.2M5 10v2a7 7 0 0011.5 5.4M12 19v3',
  video: 'M23 7l-7 5 7 5V7zM3 5h11a2 2 0 012 2v10a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2z', videooff: 'M2 2l20 20M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.7 0H14a2 2 0 012 2v3.3l1 1L23 7v10',
  phone: 'M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z', chat: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z', x: 'M18 6L6 18M6 6l12 12',
  volume: 'M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 010 7M19 5a9 9 0 010 14', volumeoff: 'M11 5L6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6',
  headphones: 'M3 18v-6a9 9 0 0118 0v6M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z',
  refresh: 'M3 12a9 9 0 019-9 9.8 9.8 0 016.7 2.8L21 8M21 3v5h-5M21 12a9 9 0 01-9 9 9.8 9.8 0 01-6.7-2.8L3 16M3 21v-5h5',
  left: 'M15 18l-6-6 6-6', right: 'M9 18l6-6-6-6', down: 'M6 9l6 6 6-6', plus: 'M12 5v14M5 12h14', check: 'M20 6L9 17l-5-5', copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  flag: 'M4 22V4M4 4h13l-2 4 2 4H4', equal: 'M5 9h14M5 15h14', eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3', logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9', lock: 'M5 11h14v10H5zM8 11V7a4 4 0 018 0v4',
  globe: 'M12 22a10 10 0 100-20 10 10 0 000 20zM2 12h20M12 2a15 15 0 010 20 15 15 0 010-20', bolt: 'M13 2L3 14h9l-1 8 10-12h-9z', clock: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2',
  userplus: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM19 8v6M22 11h-6', ban: 'M12 22a10 10 0 100-20 10 10 0 000 20zM4.9 4.9l14.2 14.2',
  crown: 'M2 19h20L19 7l-5 5-2-7-2 7-5-5z', play: 'M6 4l14 8-14 8z', link: 'M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1',
  more: 'M12 12h.01M19 12h.01M5 12h.01', panel: 'M3 3h18v18H3zM15 3v18', star: 'M12 2l3 7 7 .6-5.3 4.8 1.6 7.1L12 17.8 5.7 21.5l1.6-7.1L2 9.6 9 9z', minus: 'M5 12h14',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6', shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', award: 'M12 15a6 6 0 100-12 6 6 0 000 12zM8.2 13.9L7 23l5-3 5 3-1.2-9.1',
};
export const icon = (n, cls = '') => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ico ' + cls); s.setAttribute('aria-hidden', 'true'); const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', P[n] || P.more); s.append(p); return s; };

/* ---------- avatars: 16 monochrome glyphs ---------- */
const GL = [
  '<circle cx="20" cy="20" r="8" fill="none" stroke="C" stroke-width="3.5"/>', '<rect x="12" y="12" width="16" height="16" rx="3" fill="C"/>', '<path d="M20 10l10 18H10z" fill="C"/>', '<path d="M20 9l11 11-11 11L9 20z" fill="C"/>',
  '<path d="M20 11v18M11 20h18" stroke="C" stroke-width="4" stroke-linecap="round"/>', '<path d="M12 13v14M20 10v20M28 15v10" stroke="C" stroke-width="3.5" stroke-linecap="round"/>', '<g fill="C"><circle cx="14" cy="14" r="3.2"/><circle cx="26" cy="14" r="3.2"/><circle cx="14" cy="26" r="3.2"/><circle cx="26" cy="26" r="3.2"/></g>', '<path d="M10 24a10 10 0 0120 0z" fill="C"/>',
  '<path d="M20 9l9.5 5.5v11L20 31l-9.5-5.5v-11z" fill="none" stroke="C" stroke-width="3.2"/>', '<path d="M20 8c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12z" fill="C"/>', '<path d="M11 15l9 7 9-7M11 24l9 7 9-7" fill="none" stroke="C" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>', '<g fill="none" stroke="C" stroke-width="3"><circle cx="20" cy="20" r="11"/><circle cx="20" cy="20" r="4.5" fill="C"/></g>',
  '<path d="M8 22c4-8 8-8 12 0s8 8 12 0" fill="none" stroke="C" stroke-width="3.6" stroke-linecap="round"/>', '<path d="M14 30L26 10M22 31L32 14M8 28L18 12" stroke="C" stroke-width="3" stroke-linecap="round"/>', '<g><rect x="9" y="9" width="22" height="22" rx="5" fill="none" stroke="C" stroke-width="3"/><path d="M20 15v10M15 20h10" stroke="C" stroke-width="3" stroke-linecap="round"/></g>', '<path d="M26 10a11 11 0 100 20 9 9 0 010-20z" fill="C"/>',
];
export function avatarSVG(i) { i = ((i | 0) % 16 + 16) % 16; const dark = i < 8; return `<svg viewBox="0 0 40 40"><rect width="40" height="40" fill="${dark ? '#202026' : '#e9e9ee'}"/>${GL[i].replace(/C/g, dark ? '#f4f4f6' : '#17171b')}</svg>`; }
export const avatar = (i, size = 40, status) => {
  const a = h('span', { class: 'av', style: { '--s': size + 'px' }, html: avatarSVG(i) });
  return status ? h('span', { class: 'avw' }, a, h('i', { class: 'dot ' + status })) : a;
};

/* ---------- state + events ---------- */
export const S = { me: null, token: null, catalog: [], byId: {}, gstats: {}, chat: [], online: 0, room: null, friends: { friends: [], incoming: [], blocked: [], recent: [] }, notes: [], unread: {}, prefs: loadPrefs(), conn: false };
const bus = new EventTarget();
export const on = (ev, fn) => { const f = e => fn(e.detail); bus.addEventListener(ev, f); return () => bus.removeEventListener(ev, f); };
export const emit = (ev, d) => bus.dispatchEvent(new CustomEvent(ev, { detail: d }));
function loadPrefs() { let p = {}; try { p = JSON.parse(localStorage.getItem('np.prefs') || '{}'); } catch {} return { sound: true, theme: 'dark', reduce: false, dock: true, ...p }; }
export function setPref(k, v) { S.prefs[k] = v; try { localStorage.setItem('np.prefs', JSON.stringify(S.prefs)); } catch {} applyPrefs(); emit('prefs', k); }
export function applyPrefs() {
  document.documentElement.dataset.theme = S.prefs.theme === 'light' ? 'light' : 'dark';
  document.documentElement.classList.toggle('reduce', !!S.prefs.reduce || matchMedia('(prefers-reduced-motion: reduce)').matches);
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = S.prefs.theme === 'light' ? '#ececf0' : '#09090b';
}
export const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }, del: k => { try { localStorage.removeItem(k); } catch {} } };

/* ---------- socket ---------- */
export const sock = window.io ? window.io({ autoConnect: false, transports: ['websocket', 'polling'], reconnectionDelayMax: 4000 }) : null;
export const ask = (ev, d) => new Promise(res => { if (!sock) return res({ error: 'Realtime connection is unavailable.' }); const t = setTimeout(() => res({ error: 'The server did not respond. Check your connection.' }), 12000); sock.emit(ev, d, r => { clearTimeout(t); res(r || {}); }); });
export const gameInfo = id => S.byId[id] || { id, title: id, category: 'board', min: 2, max: 2 };

/* ---------- misc helpers ---------- */
export const ago = t => { const s = Math.max(0, (Date.now() - t) / 1000); if (s < 45) return 'just now'; if (s < 3600) return Math.round(s / 60) + 'm ago'; if (s < 86400) return Math.round(s / 3600) + 'h ago'; if (s < 604800) return Math.round(s / 86400) + 'd ago'; return new Date(t).toLocaleDateString(); };
export const hm = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
export const mmss = ms => { ms = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(ms / 60) + ':' + String(ms % 60).padStart(2, '0'); };
export const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export async function api(path, body, method) {
  try {
    const r = await fetch('/api' + path, { method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({})); if (!r.ok && !j.error) j.error = 'Something went wrong (' + r.status + ').'; return j;
  } catch { return { error: 'Cannot reach the server. Check your connection.' }; }
}
export const presenceText = c => c.p === 'ingame' ? 'In a game' : c.p === 'online' ? 'Online' : c.p === 'away' ? 'Away' : 'Offline';

/* ---------- toast ---------- */
export function toast(msg, o = {}) {
  const box = $('#toasts'); if (!box) return;
  const t = h('div', { class: 'toast', role: 'status' }, h('span', null, msg));
  if (o.go) t.append(h('button', { class: 'go', onclick: () => { o.go(); kill(); } }, o.label || 'Open'));
  box.append(t); while (box.children.length > 3) box.firstChild.remove();
  const kill = () => { t.classList.add('out'); setTimeout(() => t.remove(), 260); };
  setTimeout(kill, o.ms || 3800); return kill;
}

/* ---------- modal + menu ---------- */
export function modal(build, o = {}) {
  const close = () => { scrim.remove(); document.removeEventListener('keydown', esc); o.onClose && o.onClose(); };
  const esc = e => { if (e.key === 'Escape') close(); };
  const box = h('div', { class: 'modal glass', role: 'dialog', 'aria-modal': 'true' });
  const scrim = h('div', { class: 'scrim', onmousedown: e => { if (e.target === scrim && !o.sticky) close(); } }, box);
  build(box, close); document.body.append(scrim); document.addEventListener('keydown', esc);
  const f = box.querySelector('input,textarea,select,button.primary'); if (f && !o.noFocus) setTimeout(() => f.focus(), 30);
  return close;
}
export function confirmBox(title, text, yes = 'Confirm', no = 'Cancel') {
  return new Promise(res => modal((b, close) => {
    b.append(h('h2', null, title), h('p', { class: 'muted' }, text), h('div', { class: 'acts' }, h('button', { class: 'btn', onclick: () => { close(); res(false); } }, no), h('button', { class: 'btn primary', onclick: () => { close(); res(true); } }, yes)));
  }, { onClose: () => res(false) }));
}
export function menu(anchor, items) {
  document.querySelectorAll('.menu').forEach(m => m.remove());
  const r = anchor.getBoundingClientRect();
  const m = h('div', { class: 'menu', role: 'menu' }, items.filter(Boolean).map(i => h('button', { role: 'menuitem', onclick: () => { m.remove(); i.fn(); } }, i.icon ? icon(i.icon, 'sm') : null, i.label)));
  document.body.append(m);
  const w = m.offsetWidth, hh = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px';
  m.style.top = (r.bottom + hh + 12 > innerHeight ? Math.max(8, r.top - hh - 6) : r.bottom + 6) + 'px';
  const off = e => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', off, true); document.removeEventListener('touchstart', off, true); } };
  setTimeout(() => { document.addEventListener('mousedown', off, true); document.addEventListener('touchstart', off, true); });
  return m;
}

/* ---------- sound (tiny synthesized cues, no downloads) ---------- */
let ac = null;
export function sfx(kind) {
  if (!S.prefs.sound) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume();
    const seq = { move: [[420, .05]], cap: [[300, .06], [220, .08]], note: [[660, .08], [880, .1]], win: [[523, .1], [659, .1], [784, .18]], lose: [[330, .12], [247, .2]], msg: [[740, .04]], tick: [[900, .03]], err: [[160, .12]] }[kind] || [];
    let t = ac.currentTime;
    for (const [f, d] of seq) { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.12, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + .02); t += d * .9; }
  } catch {}
}
export const copyText = async t => { try { await navigator.clipboard.writeText(t); return true; } catch { const i = h('textarea', { style: { position: 'fixed', opacity: 0 } }); i.value = t; document.body.append(i); i.select(); let ok = false; try { ok = document.execCommand('copy'); } catch {} i.remove(); return ok; } };

/* per-game stylesheet loader */
const cssDone = new Set();
export const loadCss = href => { if (!cssDone.has(href)) { cssDone.add(href); document.head.append(h('link', { rel: 'stylesheet', href })); } const colorful = document.querySelector('link[data-colorful-games]'); if (colorful) document.head.append(colorful); };
