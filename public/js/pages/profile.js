import { h, icon, avatar, S, ask, toast, gameInfo, ago, presenceText } from '../core.js';
import { art } from '../art.js';
import { inviteModal } from './friends.js';

const AI = { first_win: 'star', wins_10: 'trophy', wins_50: 'crown', games_100: 'gamepad', chess_master: 'crown', perfect_game: 'shield', comeback: 'refresh', speed_winner: 'bolt', explorer: 'globe', friend_maker: 'users' };

export default function profile(root, ctx) {
  ctx.title('Profile');
  const id = ctx.args[0] || S.me.id;
  root.append(h('div', { class: 'empty' }, 'Loading profile…'));
  (async () => {
    const p = await ask('profile', { id }); root.replaceChildren();
    if (p.error) return root.append(h('div', { class: 'empty glass' }, p.error));
    const pct = Math.max(0, Math.min(100, Math.round((p.xp - p.xpFloor) / Math.max(1, p.xpNext - p.xpFloor) * 100)));
    const acts = h('div', { class: 'row wrap' });
    if (p.you) acts.append(h('a', { class: 'btn', href: '#/settings' }, icon('settings', 'sm'), 'Edit profile'));
    else {
      const rel = p.relation;
      if (rel === 'friend') acts.append(h('a', { class: 'btn primary', href: '#/friends/' + p.id }, icon('chat', 'sm'), 'Message'), h('button', { class: 'btn', onclick: () => inviteModal({ id: p.id, name: p.name }) }, icon('gamepad', 'sm'), 'Invite'));
      else if (rel === 'sent') acts.append(h('span', { class: 'pill' }, 'Request sent'));
      else if (rel === 'received') acts.append(h('button', { class: 'btn primary', onclick: async () => { const r = await ask('friend', { id: p.id, op: 'accept' }); r.error ? toast(r.error) : (toast('You are now friends'), ctx.go('profile/' + p.id)); } }, 'Accept request'));
      else if (rel !== 'blocked') acts.append(h('button', { class: 'btn primary', onclick: async e => { const r = await ask('friend', { id: p.id, op: 'add' }); if (r.error) toast(r.error); else { toast('Friend request sent'); e.target.disabled = true; } } }, icon('userplus', 'sm'), 'Add friend'));
    }
    const st = (k, v) => h('div', { class: 'stat' }, h('b', null, v), h('span', null, k));
    const have = new Set(p.achievements.map(a => a.key));
    root.append(
      h('section', { class: 'glass prof-h' }, avatar(p.av, 96, p.you ? undefined : p.presence && p.presence.p),
        h('div', { class: 'grow', style: { minWidth: '220px' } }, h('div', { class: 'row wrap' }, h('h1', { class: 'h1', style: { fontSize: '30px' } }, p.name), p.guest ? h('span', { class: 'pill' }, 'Guest') : null, p.you ? h('span', { class: 'pill solid' }, 'You') : null),
          h('p', { class: 'muted', style: { margin: '4px 0 10px' } }, p.bio || (p.you ? 'Add a short bio in Settings.' : 'No bio yet.')),
          h('div', { class: 'row small' }, h('b', null, 'Level ' + p.level), h('span', { class: 'muted' }, p.xp + ' / ' + p.xpNext + ' XP'), p.presence && !p.you ? h('span', { class: 'muted' }, '· ' + presenceText(p.presence)) : null),
          h('div', { class: 'xpbar', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: { width: pct + '%' } }))),
        acts),
      h('div', { class: 'stats-row', style: { margin: '14px 0' } }, st('Rating', p.rating), st('Matches', p.games), st('Win rate', p.winRate + '%'), st('Friends', p.friends)),
      h('div', { class: 'grid-2' },
        h('section', { class: 'glass', style: { padding: '18px' } }, h('div', { class: 'h2', style: { marginBottom: '10px' } }, 'By game'),
          p.perGame.filter(g => g.game !== 'legacy').length ? p.perGame.filter(g => g.game !== 'legacy').map(g => h('div', { class: 'list-item' }, art(g.game, 30), h('div', { class: 'grow' }, h('b', null, gameInfo(g.game).title), h('div', { class: 'small muted' }, g.wins + 'W · ' + g.losses + 'L · ' + g.draws + 'D')), h('b', null, g.rating))) : h('div', { class: 'empty' }, 'No ranked matches yet.')),
        h('section', { class: 'glass', style: { padding: '18px' } }, h('div', { class: 'h2', style: { marginBottom: '10px' } }, 'Recent matches'),
          p.recent.length ? p.recent.map(m => h('div', { class: 'list-item' }, art(m.game, 30), h('div', { class: 'grow' }, h('b', null, gameInfo(m.game).title), h('div', { class: 'small muted ell' }, 'vs ' + (m.vs || 'unknown') + ' · ' + ago(m.ended_at))), h('span', { class: 'pill' + (m.outcome === 'win' ? ' solid' : '') }, m.outcome === 'win' ? 'Win' : m.outcome === 'loss' ? 'Loss' : 'Draw'))) : h('div', { class: 'empty' }, 'No matches played yet.'))),
      h('section', { class: 'glass', style: { padding: '18px', marginTop: '16px' } }, h('div', { class: 'h2', style: { marginBottom: '10px' } }, 'Achievements · ' + have.size + '/' + Object.keys(p.ach).length),
        h('div', { class: 'achs' }, Object.entries(p.ach).map(([k, a]) => h('div', { class: 'ach' + (have.has(k) ? '' : ' lock') }, h('span', { class: 'ai' }, icon(have.has(k) ? (AI[k] || 'award') : 'lock', 'sm')), h('b', null, a.title), h('small', null, a.desc))))));
  })();
}
