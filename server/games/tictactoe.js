const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
module.exports = {
  id: 'tictactoe', title: 'Tic Tac Toe', category: 'board', difficulty: 'Easy', min: 2, max: 2, watch: true,
  desc: 'Three in a row wins. Fast, simple and still mind-games.',
  init: () => ({ board: Array(9).fill(null), turn: 0 }),
  move(s, i, m) {
    const c = m.cell;
    if (!Number.isInteger(c) || c < 0 || c > 8 || s.board[c] !== null) return 'That square is taken.';
    s.board[c] = i;
    const line = LINES.find(l => l.every(x => s.board[x] === i));
    if (line) { s.line = line; return { winner: i }; }
    if (s.board.every(x => x !== null)) return { draw: true };
    s.turn = 1 - i;
  },
};
