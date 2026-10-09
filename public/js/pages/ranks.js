import { h, icon, avatar, S, ask, cap, clear } from '../core.js';

export default function ranks(root, ctx) {
  ctx.title('Leaderboard'); root.classList.add('fit');
  const f = { scope: 'global', game: 'all', period: 'all' };
  const seg = (opts, key) => h('div', { class: 'seg' }, opts.map(([v, l]) => h('button', { class: f[key] === v ? 'on' : '', onclick: e => { f[key] = v; e.currentTarget.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === e.currentTarget)); load(); } }, l)));
  const gsel = h('select', { class: 'inp', 'aria-label': 'Game', style: { width: 'auto', minWidth: '150px' }, onchange: e => { f.game = e.target.value; load(); } }, h('option', { value: 'all' }, 'All games'), S.catalog.map(g => h('option', { value: g.id }, g.title)));
  const body = h('div', { class: 'tscroll glass flat', style: { flex: 1 } });
  root.append(h('div', { class: 'row wrap', style: { marginBottom: '12px' } }, seg([['global', 'Global'], ['friends', 'Friends']], 'scope'), seg([['day', 'Today'], ['week', 'Week'], ['month', 'Month'], ['all', 'All time']], 'period'), gsel), body);
  let n = 0;
  async function load() {
    const my = ++n; body.replaceChildren(h('div', { class: 'empty' }, 'Loading…'));
    const r = await ask('leaderboard', f); if (my !== n) return;
    if (r.error) return body.replaceChildren(h('div', { class: 'empty' }, r.error));
    if (!r.rows.length) return body.replaceChildren(h('div', { class: 'empty' }, f.scope === 'friends' ? 'No ranked games among you and your friends in this period yet.' : 'No ranked games in this period yet. Be the first on the board.'));
    const t = h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['#', 'Player', 'Rating', 'W', 'L', 'D'].map((x, i) => h('th', { class: i > 1 ? 'num' : '' }, x)))),
      h('tbody', null, r.rows.map(p => h('tr', { class: p.you ? 'you' : '' }, h('td', null, h('span', { class: 'rankn' + (p.rank === 1 ? ' t1' : '') }, p.rank)),
        h('td', null, h('a', { href: '#/profile/' + p.id, class: 'row', style: { textDecoration: 'none' } }, avatar(p.av, 34), h('b', { class: 'ell' }, p.name), p.you ? h('span', { class: 'pill' }, 'You') : null)),
        h('td', { class: 'num b' }, p.rating), h('td', { class: 'num' }, p.wins), h('td', { class: 'num' }, p.losses), h('td', { class: 'num' }, p.draws)))));
    body.replaceChildren(t);
  }
  load();
}
