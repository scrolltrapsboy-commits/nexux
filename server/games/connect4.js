module.exports = {
  id: 'connect4', title: 'Connect Four', category: 'board', difficulty: 'Easy', min: 2, max: 2, watch: true, resign: true,
  desc: 'Drop discs and line up four before your opponent does.',
  init: () => ({ board: Array.from({ length: 6 }, () => Array(7).fill(null)), turn: 0, last: null, line: null }),
  move(s, i, m) {
    const c = m.col;
    if (!Number.isInteger(c) || c < 0 || c > 6) return 'Pick a column.';
    let r = 5; while (r >= 0 && s.board[r][c] !== null) r--;
    if (r < 0) return 'That column is full.';
    s.board[r][c] = i; s.last = [r, c];
    const run = (dr, dc) => { const cells = []; let y = r + dr, x = c + dc; while (y >= 0 && y < 6 && x >= 0 && x < 7 && s.board[y][x] === i) { cells.push([y, x]); y += dr; x += dc; } return cells; };
    for (const [a, b] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const cells = [[r, c], ...run(a, b), ...run(-a, -b)];
      if (cells.length >= 4) { s.line = cells; return { winner: i }; }
    }
    if (s.board[0].every(x => x !== null)) return { draw: true };
    s.turn = 1 - i;
  },
};
