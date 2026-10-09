import { h } from '../core.js';
export default {
  seat: (R, i) => ({ sub: i === 0 ? 'Solid discs' : 'Ring discs' }),
  mount(el, api) {
    const cols = Array.from({ length: 7 }, (_, c) => h('button', { class: 'c4-col', 'aria-label': 'Drop in column ' + (c + 1), onclick: () => api.move({ col: c }) }, Array.from({ length: 6 }, () => h('i', { class: 'c4-cell' }))));
    const board = h('div', { class: 'board c4' }, cols); el.append(board);
    let lastKey = ''; const rendered = Array.from({ length: 6 }, () => Array(7).fill(undefined));
    return {
      update(R) {
        const s = R.state, my = api.myTurn();
        cols.forEach((col, c) => {
          col.disabled = !my || s.board[0][c] !== null;
          [...col.children].forEach((cell, r) => {
            const v = s.board[r][c], changed = rendered[r][c] !== v, isLast = s.last && s.last[0] === r && s.last[1] === c, win = s.line && s.line.some(x => x[0] === r && x[1] === c);
            cell.className = 'c4-cell' + (v !== null ? ' d' + v : '') + (changed && v !== null && isLast ? ' drop' : '') + (win ? ' win' : '');
            rendered[r][c] = v;
          });
        });
        const k = s.last ? s.last.join() : ''; if (k && k !== lastKey) api.sfx('move'); lastKey = k;
      }, destroy() {},
    };
  },
};
