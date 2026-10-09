import { h } from '../core.js';
const COLORS = ['#e05252', '#36a66b', '#e0b83f', '#4788e8'];
const SNAKES = new Set([17, 54, 62, 64, 87, 93, 95, 99]);
const LADDERS = new Set([4, 9, 20, 28, 40, 51, 63, 71]);
const indexOf = n => {
  const band = Math.floor((n - 1) / 10), offset = (n - 1) % 10;
  const col = band % 2 === 0 ? offset : 9 - offset;
  return (9 - band) * 10 + col;
};
export default {
  seat: (R, i) => ({ sub: 'Player ' + (i + 1) }),
  mount(el, api) {
    const title = h('div', { class: 'sl-title' });
    const board = h('div', { class: 'sl-board', role: 'group', 'aria-label': 'Snakes and Ladders 100-square board' });
    const controls = h('div', { class: 'sl-controls' });
    const die = h('div', { class: 'sl-die', 'aria-live': 'polite' }, '—');
    const roll = h('button', { class: 'btn primary sl-roll', onclick: () => api.move({ action: 'roll' }) }, 'Roll die');
    const status = h('div', { class: 'sl-status', 'aria-live': 'polite' });
    const cells = Array.from({ length: 100 }, (_, idx) => {
      const band = 9 - Math.floor(idx / 10);\n      const n = band * 10 + (band % 2 === 0 ? idx % 10 + 1 : 10 - idx % 10);
      return h('div', { class: 'sl-cell' + (SNAKES.has(n) ? ' snake' : '') + (LADDERS.has(n) ? ' ladder' : '') + (n === 100 ? ' goal' : ''), dataset: { square: n } }, h('small', null, String(n)), h('div', { class: 'sl-tokens' }));
    });
    board.append(...cells);
    el.append(h('style', null, `
      .sl{width:min(100%,820px);height:100%;max-height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto auto;gap:9px;min-height:0;padding:4px;color:var(--fg)}
      .sl-title{display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:850;font-size:14px}
      .sl-board{width:min(100%,calc(100cqh - 116px));max-width:100%;aspect-ratio:1;max-height:100%;justify-self:center;display:grid;grid-template-columns:repeat(10,minmax(0,1fr));grid-template-rows:repeat(10,minmax(0,1fr));gap:2px;min-height:0}
      .sl-cell{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:space-between;min-width:0;min-height:0;overflow:hidden;border:1px solid var(--line);border-radius:4px;background:var(--glass);padding:2px}
      .sl-cell:nth-child(odd){background:var(--glass2)}
      .sl-cell.snake{background:rgba(224,82,82,.17);border-color:rgba(224,82,82,.5)}
      .sl-cell.ladder{background:rgba(54,166,107,.17);border-color:rgba(54,166,107,.5)}
      .sl-cell.goal{background:var(--glass3);border-color:var(--line2)}
      .sl-cell small{align-self:flex-start;font-size:clamp(6px,1.1cqw,11px);font-weight:800;opacity:.7;line-height:1}
      .sl-tokens{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:1px;max-width:100%}
      .sl-token{width:clamp(5px,1.35cqw,12px);aspect-ratio:1;border-radius:50%;border:1px solid rgba(255,255,255,.85);box-shadow:0 1px 3px #0006}
      .sl-controls{display:flex;align-items:center;justify-content:center;gap:10px}
      .sl-die{width:44px;aspect-ratio:1;display:grid;place-items:center;border-radius:12px;border:1px solid var(--line2);background:var(--glass2);font-size:24px;font-weight:900}
      .sl-status{text-align:center;min-height:1.3em;font-size:12px;font-weight:650;color:var(--fg3)}
      .sl-legend{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--fg3)}
      .sl-legend span{display:inline-flex;align-items:center;gap:5px}.sl-legend i{width:9px;height:9px;border-radius:3px}
      @media(max-width:500px){.sl-board{width:min(100%,calc(100cqh - 150px))}.sl-cell{padding:1px}}
    `));
    const shell = h('div', { class: 'sl' }, title, board, controls, status, h('div', { class: 'sl-legend' }, h('span', null, h('i', { style: { background: 'rgba(54,166,107,.7)' } }), 'Ladder'), h('span', null, h('i', { style: { background: 'rgba(224,82,82,.7)' } }), 'Snake'), h('span', null, 'Exact roll to 100; six gives another turn')));
    controls.append(die, roll);
    el.append(shell);
    let previous = '';
    return {
      update(R) {
        const s = R.state, me = R.youIdx, mine = s.turn === me && R.status === 'playing';
        title.textContent = R.status === 'lobby' ? 'Waiting for players' : (R.players[s.turn]?.name || ('Player ' + (s.turn + 1))) + (mine ? ' · Your turn' : ' · Turn');
        die.textContent = s.die || '—';
        roll.disabled = !mine || R.status !== 'playing';
        roll.textContent = mine ? 'Roll die' : 'Waiting…';
        cells.forEach((cell, idx) => {
          const n = Number(cell.dataset.square);
          const tokens = [];
          s.positions.forEach((p, seat) => { if (p === n) tokens.push(seat); });
          const holder = cell.querySelector('.sl-tokens');
          holder.replaceChildren(...tokens.map(seat => h('i', { class: 'sl-token', title: R.players[seat]?.name || ('Player ' + (seat + 1)), style: { background: COLORS[seat] } })));
        });
        const last = s.last;
        if (last && last.seat === me) {
          if (last.overshoot) status.textContent = 'Rolled ' + last.die + ' — you need an exact roll to reach 100.';
          else if (last.jump?.type === 'ladder') status.textContent = 'Rolled ' + last.die + ': climbed a ladder to ' + last.to + '!';
          else if (last.jump?.type === 'snake') status.textContent = 'Rolled ' + last.die + ': a snake sent you down to ' + last.to + '.';
          else status.textContent = 'Rolled ' + last.die + ': moved to square ' + last.to + '.';
        } else status.textContent = mine ? 'Roll the die. First player to land exactly on 100 wins.' : 'Waiting for ' + (R.players[s.turn]?.name || ('Player ' + (s.turn + 1))) + '.';
        const key = JSON.stringify(last); if (key && key !== previous) api.sfx('move'); previous = key;
      }, destroy() {},
    };
  },
};
