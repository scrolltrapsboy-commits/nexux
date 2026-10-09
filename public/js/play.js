// Entry points for starting a match: quick match and the "create room" dialog.
import { h, S, ask, toast, modal, icon, gameInfo, cap } from './core.js';

export async function quick(id, opts) {
  const r = await ask('quick', { game: id, opts }); if (r.error) toast(r.error);
}
export function openCreate(id, pre = {}) {
  const g = gameInfo(id), vis = { v: 'public' }, opts = {};
  modal((b, close) => {
    const visSeg = h('div', { class: 'seg', style: { display: 'flex' } }, [['public', 'Public'], ['friends', 'Friends'], ['private', 'Private']].map(([v, l]) => h('button', { class: v === 'public' ? 'on' : '', style: { flex: 1 }, onclick: e => { vis.v = v; visSeg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === e.currentTarget)); } }, l)));
    b.append(h('h2', null, 'Create ' + g.title + ' room'), h('p', { class: 'small muted', style: { marginBottom: '14px' } }, 'Share the code with a friend or let the room appear in the public list.'),
      h('div', { class: 'field' }, h('span', null, 'Who can join'), visSeg));
    if (g.options) for (const [k, vals] of Object.entries(g.options)) {
      opts[k] = vals[Math.min(2, vals.length - 1)]; if (pre[k]) opts[k] = pre[k];
      const seg = h('div', { class: 'seg', style: { display: 'flex' } }, vals.map(v => h('button', { class: v === opts[k] ? 'on' : '', style: { flex: 1 }, onclick: e => { opts[k] = v; seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === e.currentTarget)); } }, k === 'time' ? v + ' min' : String(v))));
      b.append(h('div', { class: 'field' }, h('span', null, k === 'time' ? 'Time per player' : cap(k)), seg));
    }
    let maxSel = null;
    if (g.max > g.min) { maxSel = h('select', { class: 'inp' }, Array.from({ length: g.max - g.min + 1 }, (_, i) => h('option', { value: g.min + i, selected: g.min + i === g.max }, (g.min + i) + ' players'))); b.append(h('label', { class: 'field' }, h('span', null, 'Players'), maxSel)); }
    b.append(h('div', { class: 'acts' }, h('button', { class: 'btn', onclick: close }, 'Cancel'), h('button', { class: 'btn primary', onclick: async e => { e.currentTarget.disabled = true; const r = await ask('create', { game: id, visibility: vis.v, opts, max: maxSel ? +maxSel.value : undefined }); if (r.error) { toast(r.error); e.currentTarget.disabled = false; } else close(); } }, 'Create room')));
  });
}
