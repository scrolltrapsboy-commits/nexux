import { h } from '../core.js';
const COLORS = ['#e05252', '#36a66b', '#e0b83f', '#4788e8'];
const NAMES = ['Red', 'Green', 'Yellow', 'Blue'];
const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const START = [0, 13, 26, 39];
const pos = (seat, step) => (START[seat] + step) % 52;
const label = p => p < 0 ? 'Home' : p === 58 ? 'Finished' : p >= 52 ? 'Home lane ' + (p - 51) : 'Track ' + (pos(0, p) + 1);
export default {
  seat: (R, i) => ({ sub: NAMES[i] + ' pawns' }),
  mount(el, api) {
    const title = h('div', { class: 'ludo-title' });
    const board = h('div', { class: 'ludo-board', role: 'group', 'aria-label': 'Ludo board' });
    const roll = h('button', { class: 'btn primary ludo-roll', onclick: () => api.move({ action: 'roll' }) }, 'Roll die');
    const die = h('div', { class: 'ludo-die', 'aria-live': 'polite' }, '—');
    const trays = h('div', { class: 'ludo-trays' });
    const hint = h('div', { class: 'ludo-hint', 'aria-live': 'polite' });
    const squares = Array.from({ length: 52 }, (_, n) => h('div', { class: 'ludo-square' + (SAFE.has(n) ? ' safe' : ''), title: 'Track space ' + (n + 1) }, h('small', null, String(n + 1))));
    board.append(...squares);
    el.append(h('style', null, `
      .ludo{width:min(100%,760px);height:100%;max-height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto auto;gap:8px;min-height:0;padding:4px;color:var(--fg)}
      .ludo-title{display:flex;justify-content:space-between;align-items:center;gap:8px;font-weight:800}
      .ludo-board{display:grid;grid-template-columns:repeat(13,minmax(0,1fr));grid-template-rows:repeat(4,minmax(0,1fr));gap:3px;min-height:0;align-content:center}
      .ludo-square{display:grid;place-items:center;position:relative;border-radius:7px;border:1px solid var(--line);background:var(--glass);min-width:0;min-height:0;font-size:10px}
      .ludo-square.safe{background:var(--glass3);border-color:var(--line2)}
      .ludo-square small{opacity:.5;font-size:clamp(7px,1.2cqw,11px)}
      .ludo-pawns{display:flex;flex-wrap:wrap;gap:3px;justify-content:center;align-items:center}
      .ludo-pawn{border-radius:50%;width:clamp(20px,4.2cqw,32px);aspect-ratio:1;padding:0;display:grid;place-items:center;color:#fff;font-size:12px;font-weight:900;border:2px solid rgba(255,255,255,.7);box-shadow:0 2px 5px #0003}
      .ludo-pawn:disabled{opacity:.5;filter:grayscale(.5)}
      .ludo-trays{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
      .ludo-tray{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:5px;border:1px solid var(--line);border-radius:12px;padding:6px;background:var(--glass)}
      .ludo-tray-head{display:flex;align-items:center;gap:6px;font-weight:800;font-size:12px;min-width:0}
      .ludo-dot{width:9px;height:9px;border-radius:50%;flex:none}
      .ludo-controls{display:flex;align-items:center;justify-content:center;gap:10px}
      .ludo-die{display:grid;place-items:center;width:42px;aspect-ratio:1;border-radius:12px;border:1px solid var(--line2);background:var(--glass2);font-size:23px;font-weight:900}
      .ludo-hint{font-size:12px;color:var(--fg3);text-align:center;min-height:1.2em}
      @media(max-width:500px){.ludo-trays{grid-template-columns:1fr}.ludo-board{gap:2px}.ludo-square{border-radius:4px}}
    `));
    const shell = h('div', { class: 'ludo' }, title, board, h('div', { class: 'ludo-controls' }, die, roll), trays, hint);
    el.append(shell);
    let last = '';
    return {
      update(R) {
        const s = R.state, me = R.youIdx, mine = s.turn === me && R.status === 'playing', rolling = s.phase === 'roll';
        title.textContent = R.status === 'lobby' ? 'Waiting for players' : (R.players[s.turn]?.name || NAMES[s.turn]) + (mine ? ' · Your turn' : ' · Turn');
        die.textContent = s.last?.die || '—';
        roll.disabled = !mine || !rolling;
        roll.textContent = !mine ? 'Waiting…' : rolling ? 'Roll die' : 'Choose a pawn';
        squares.forEach((sq, n) => {
          const occupants = [];
          s.pawns.forEach((ps, seat) => ps.forEach((step, token) => {
            if (step >= 0 && step < 52 && pos(seat, step) === n) occupants.push({ seat, token });
          }));
          sq.replaceChildren(h('small', null, SAFE.has(n) ? '★' : String(n + 1)));
          if (START.includes(n)) sq.style.boxShadow = 'inset 0 0 0 2px ' + COLORS[START.indexOf(n)];
          else sq.style.boxShadow = '';
          if (occupants.length) {
            const stack = h('div', { class: 'ludo-pawns' });
            occupants.slice(0, 4).forEach(o => stack.append(h('span', { class: 'ludo-pawn', style: { background: COLORS[o.seat], width: 'clamp(12px,2.5cqw,20px)', fontSize: '9px' } }, String(o.token + 1))));
            sq.append(stack);
          }
        });
        trays.replaceChildren(...s.pawns.map((ps, seat) => {
          const pawns = h('div', { class: 'ludo-pawns' });
          ps.forEach((step, token) => {
            const can = mine && s.phase === 'move' && s.rolledBy === me && (step === 58 ? false : step === -1 ? s.die === 6 : step + s.die <= 58);
            const b = h('button', { class: 'ludo-pawn', style: { background: COLORS[seat] }, disabled: seat !== me || !can, title: NAMES[seat] + ' pawn ' + (token + 1) + ' — ' + (step < 0 ? 'home' : step === 58 ? 'finished' : 'step ' + step), onclick: () => api.move({ token }) }, String(token + 1));
            pawns.append(b);
          });
          return h('div', { class: 'ludo-tray' }, h('div', { class: 'ludo-tray-head' }, h('i', { class: 'ludo-dot', style: { background: COLORS[seat] } }), h('span', { class: 'ell' }, R.players[seat]?.name || NAMES[seat]), h('small', { class: 'muted' }, ps.filter(p => p === 58).length + '/4 home')), pawns);
        }));
        if (s.phase === 'move' && mine) hint.textContent = 'Rolled ' + s.die + '. Choose a highlighted pawn to move.';
        else if (s.last?.note) hint.textContent = s.last.note + '.';
        else hint.textContent = mine ? 'Roll the die. A six releases a pawn from home.' : 'Waiting for ' + (R.players[s.turn]?.name || NAMES[s.turn]) + '.';
        const key = JSON.stringify(s.last); if (key !== last && s.last) api.sfx('move'); last = key;
      }, destroy() {},
    };
  },
};
