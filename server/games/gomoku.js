// Gomoku (five in a row) on a 15x15 board.
const N = 15;
module.exports = {
  id: 'gomoku', title: 'Gomoku', category: 'board', difficulty: 'Medium', min: 2, max: 2, resign: true, watch: true,
  desc: 'Place stones on a 15 by 15 grid. Five in a row wins.',
  init: () => ({ board: Array(N * N).fill(null), turn: 0, last: null, line: null, n: N }),
  move(s, i, m) {
    const c = m.c; if (!Number.isInteger(c) || c < 0 || c >= N * N || s.board[c] !== null) return 'That point is taken.';
    s.board[c] = i; s.last = c;
    const r = (c / N) | 0, x = c % N;
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const cells = [c];
      for (const sg of [1, -1]) { let y = r + dr * sg, z = x + dc * sg; while (y >= 0 && y < N && z >= 0 && z < N && s.board[y * N + z] === i) { cells.push(y * N + z); y += dr * sg; z += dc * sg; } }
      if (cells.length >= 5) { s.line = cells; return { winner: i }; }
    }
    if (s.board.every(v => v !== null)) return { draw: true };
    s.turn = 1 - i;
  },
};
