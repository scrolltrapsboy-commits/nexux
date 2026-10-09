// Reusable chat panel used for the single global chat (home) and in-room chat (game dock).
import { h, icon, avatar, S, sock, on, ask, toast, hm, clear, sfx, debounce } from './core.js';

export function chatPanel({ scope, title, subtitle, history = [], placeholder = 'Message…', onNew, closeBtn, canSend = true }) {
  const list = h('div', { class: 'msgs', role: 'log', 'aria-live': 'polite' });
  const typing = h('div', { class: 'typing' });
  const inp = h('input', { class: 'inp', placeholder, maxlength: 200, autocomplete: 'off', enterkeyhint: 'send', 'aria-label': 'Chat message', disabled: !canSend });
  const send = h('button', { class: 'btn primary round', type: 'submit', 'aria-label': 'Send', disabled: !canSend }, icon('send', 'sm'));
  const form = h('form', { class: 'chat-f', onsubmit: async e => { e.preventDefault(); const text = inp.value.trim(); if (!text) return; inp.value = ''; const r = await ask('chat', { scope, text }); if (r.error) { toast(r.error); inp.value = text; } } }, inp, send);
  const el = h('section', { class: 'chat-p chat glass' + (scope === 'global' ? '' : ' flat'), 'aria-label': title },
    h('div', { class: 'chat-h' }, icon('chat', 'sm'), h('div', { class: 'grow' }, h('b', null, title), subtitle ? h('div', { class: 'tiny muted' }, subtitle) : null), closeBtn || null), list, typing, form);
  let last = 0, tt = null;
  const near = () => list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  const add = (m, quiet) => {
    const wasNear = near(), me = m.id === S.me.id;
    if (m.sys) list.append(h('div', { class: 'msg sys' }, m.text));
    else list.append(h('div', { class: 'msg' + (me ? ' me' : '') }, me ? null : avatar(m.av, 30), h('div', { class: 'bub' }, h('div', { class: 'nm' }, me ? 'You' : m.from, h('i', null, hm(m.t))), h('div', { class: 'tx' }, m.text))));
    while (list.children.length > 150) list.firstChild.remove();
    if (wasNear || me) list.scrollTop = list.scrollHeight;
    if (!quiet && !me) { sfx('msg'); onNew && onNew(m); }
  };
  history.forEach(m => add(m, true)); requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
  const offs = [];
  if (scope === 'global') offs.push(on('chat', m => add(m)));
  else {
    offs.push(on('roomchat', m => add(m)));
    offs.push(on('typing', t => { if (t.scope !== 'room' || t.id === S.me.id) return; typing.textContent = t.from + ' is typing…'; clearTimeout(tt); tt = setTimeout(() => typing.textContent = '', 2500); }));
    inp.addEventListener('input', debounce(() => { if (inp.value && Date.now() - last > 1800) { last = Date.now(); sock.emit('typing', { scope: 'room' }); } }, 120));
  }
  return { el, add, focus: () => inp.focus(), destroy: () => offs.forEach(f => f()), input: inp };
}
