import { h, loadCss, icon } from '../core.js';
loadCss('/css/g-cards.css');
const MK = ['<path d="M12 3l10 18H2z"/>', '<circle cx="12" cy="12" r="10"/>', '<rect x="3" y="3" width="18" height="18" rx="2"/>', '<path d="M12 1l10 11-10 11L2 12z"/>'];
const MKN = ['triangle', 'circle', 'square', 'diamond'];
const mk = i => h('span', { html: '<svg class="mk" viewBox="0 0 24 24" aria-hidden="true">' + MK[i] + '</svg>' }).firstChild;
const FACE = { b: '⊘', f: '⇄', d: '+2', w: '', x: '+4' }, VN = { b: 'Block', f: 'Flip', d: 'Draw two', w: 'Wild', x: 'Wild draw four' };
const label = c => c.m < 0 ? VN[c.v] : (VN[c.v] || c.v) + ' of ' + MKN[c.m] + 's';
function face(c, extra = '') {
  const w = c.m < 0, body = c.v in FACE ? FACE[c.v] : c.v;
  const el = h('button', { class: 'nc-c' + (w ? ' wild' : '') + ' ' + extra, 'aria-label': label(c), type: 'button' });
  if (w) { const q = h('div', { class: 'quad' }); for (let i = 0; i < 4; i++) q.append(mk(i)); el.append(q); }
  else el.append(h('span', { class: 'v' }, body));
  if (!w) { const corner = cl => h('span', { class: cl }, h('span', null, c.v in FACE ? FACE[c.v] : c.v), mk(c.m)); el.append(corner('tl'), corner('br')); el.append(h('span', { class: 'ctr' }, mk(c.m))); }
  else { el.append(h('span', { class: 'tl' }, c.v === 'x' ? '+4' : 'W'), h('span', { class: 'br' }, c.v === 'x' ? '+4' : 'W')); }
  return el;
}
const ok = (s, c) => c.m < 0 || c.m === s.mark || c.v === s.top.v;
export default {
  seat: (R, i) => ({ sub: R.state.gone[i] ? 'Left' : R.state.counts[i] + (R.state.counts[i] === 1 ? ' card · last card!' : ' cards'), badge: R.state.counts[i], low: R.state.counts[i] <= 2 }),
  status(R) {
    const s = R.state, p = R.players[s.turn];
    if (R.watching) return p ? p.name + '’s turn' : 'Watching';
    if (s.turn === R.youIdx) return { t: s.drew >= 0 ? 'Play the drawn card or pass' : 'Your turn: play or draw', turn: true };
    return (p ? p.name : 'Opponent') + '’s turn';
  },
  mount(el, api) {
    const opp = h('div', { class: 'nc-opp' }), mid = h('div', { class: 'nc-mid' }), note = h('div', { class: 'nc-note', 'aria-live': 'polite' }), hand = h('div', { class: 'nc-hand', role: 'group', 'aria-label': 'Your hand' }), acts = h('div', { class: 'nc-acts' });
    const root = h('div', { class: 'nc' }, opp, mid, note, h('div', { style: { display: 'grid' } }, hand, acts));
    el.append(root);
    let lastSeq = -1, pick = null;
    const choose = idx => new Promise(res => {
      pick = h('div', { class: 'nc-pick', role: 'dialog', 'aria-label': 'Choose a mark' }, h('div', { class: 'glass' }, h('b', null, 'Choose the next mark'), h('div', { class: 'row4' }, [0, 1, 2, 3].map(m => h('button', { class: 'mkb', 'aria-label': MKN[m], onclick: () => { pick.remove(); pick = null; res(m); } }, mk(m)))), h('button', { class: 'btn sm', onclick: () => { pick.remove(); pick = null; res(-1); } }, 'Cancel')));
      el.append(pick);
    });
    return {
      update(R) {
        const s = R.state, me = R.youIdx, mine = api.myTurn();
        opp.replaceChildren(...R.players.map((p, i) => i === me ? null : h('div', { class: 'nc-o' + (s.turn === i ? ' turn' : '') + (s.gone[i] ? ' gone' : '') },
          h('div', { class: 'nc-fan', 'aria-label': p.name + ' has ' + s.counts[i] + ' cards' }, ...Array.from({ length: Math.min(s.counts[i], 12) }, () => h('i'))), h('span', { class: 'nc-n' }, s.counts[i])), ).filter(Boolean));
        const canDraw = mine && s.drew < 0;
        const pile = h('button', { class: 'nc-c nc-back nc-pile' + (canDraw ? ' can' : ''), 'aria-label': 'Draw a card, ' + s.pile + ' left in the deck', disabled: !canDraw, onclick: () => api.move({ draw: true }) }, h('span', { class: 'cnt' }, s.pile));
        const top = face(s.top, 'nc-top'); top.disabled = true; top.classList.add('pop');
        if (lastSeq === s.seq && mid.querySelector('.nc-top')) top.classList.remove('pop');
        const cur = h('div', { class: 'nc-cur' }, h('span', null, 'Mark'), h('span', { class: 'chip', 'aria-label': 'Current mark: ' + MKN[s.mark], html: '<svg viewBox="0 0 24 24">' + MK[s.mark] + '</svg>' }), h('span', { class: 'nc-dir' }, h('span', { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="transform:scaleX(' + s.dir + ')"><path d="M4 12h16M14 6l6 6-6 6"/></svg>' }).firstChild, s.dir > 0 ? 'clockwise' : 'reverse'));
        mid.replaceChildren(pile, top, cur);
        const L = s.last; let txt = '';
        if (L) { const who = L.who === me ? 'You' : api.name(L.who); txt = L.act === 'draw' ? `<b>${who}</b> drew a card` : L.act === 'pass' ? `<b>${who}</b> passed` : `<b>${who}</b> played ${label(L.card).toLowerCase()}` + (L.card.m < 0 ? ` and chose ${MKN[L.mark]}` : '') + (L.hit ? ` · <b>${L.hit.who === me ? 'You' : api.name(L.hit.who)}</b> draws ${L.hit.n}` : ''); }
        note.innerHTML = txt;
        if (L && s.seq !== lastSeq) { api.sfx(L.act === 'play' ? 'move' : 'tick'); } lastSeq = s.seq;
        hand.replaceChildren(...s.hand.map((c, k) => { const can = mine && ok(s, c) && (s.drew < 0 || s.drew === k); const b = face(c, can ? 'ok' : mine ? 'no' : ''); b.disabled = !can;
          b.onclick = async () => { let mark; if (c.m < 0) { mark = await choose(k); if (mark < 0) return; } api.move({ play: k, mark }); }; return b; }));
        acts.replaceChildren(...(mine && s.drew >= 0 ? [h('button', { class: 'btn primary sm', onclick: () => api.move({ pass: true }) }, 'Pass')] : []));
        if (R.watching) { hand.replaceChildren(h('div', { class: 'muted small' }, 'You are watching. Hands are hidden.')); }
        if (R.status !== 'playing' && pick) { pick.remove(); pick = null; }
      }, destroy() {},
    };
  },
};
