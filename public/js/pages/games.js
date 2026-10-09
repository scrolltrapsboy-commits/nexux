import { h, icon, S, cap } from '../core.js';
import { art } from '../art.js';
import { quick, openCreate } from '../play.js';

export default function games(root, ctx) {
  ctx.title('Games');
  let cat = 'all', q = '';
  const cats = ['all', ...['board', 'card', 'arcade', 'racing', 'casual'].filter(c => S.catalog.some(g => g.category === c))];
  const grid = h('div', { class: 'gcards' }), chips = h('div', { class: 'chips', role: 'tablist' });
  const search = h('input', { class: 'inp', type: 'search', placeholder: 'Search games', 'aria-label': 'Search games', style: { maxWidth: '280px' }, oninput: e => { q = e.target.value.toLowerCase(); draw(); } });
  const draw = () => {
    chips.replaceChildren(...cats.map(c => h('button', { class: 'chip' + (c === cat ? ' on' : ''), role: 'tab', 'aria-selected': c === cat, onclick: () => { cat = c; draw(); } }, c === 'all' ? 'All' : cap(c))));
    const list = S.catalog.filter(g => (cat === 'all' || g.category === cat) && (!q || g.title.toLowerCase().includes(q)));
    grid.replaceChildren(...(list.length ? list.map(g => h('article', { class: 'gcard glass' },
      art(g.id, 64), h('div', null, h('h3', null, g.title), h('div', { class: 'meta', style: { marginTop: '6px' } }, h('span', { class: 'pill' }, cap(g.category)), h('span', { class: 'pill' }, g.difficulty), h('span', { class: 'pill' }, icon('users', 'sm'), g.min === g.max ? g.min : g.min + '–' + g.max), S.gstats[g.id] ? h('span', { class: 'pill solid' }, S.gstats[g.id] + ' playing') : null)),
      h('p', null, g.desc),
      h('div', { class: 'acts' }, h('button', { class: 'btn primary sm', onclick: () => quick(g.id) }, icon('bolt', 'sm'), 'Play now'), h('button', { class: 'btn sm', onclick: () => openCreate(g.id), 'aria-label': 'Create ' + g.title + ' room' }, 'Create room')))) : [h('div', { class: 'empty glass', style: { gridColumn: '1/-1' } }, 'No games match your search.')]));
  };
  root.append(h('div', { class: 'row wrap' }, h('div', { class: 'grow', style: { minWidth: '240px' } }, chips), search), grid);
  draw(); ctx.on('gstats', draw);
}
