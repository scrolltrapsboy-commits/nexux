// Game registry. To add a game: create server/games/<id>.js with { id, title, category, difficulty, min, max, desc, init, move, ... }
// and a client module public/js/games/<id>.js, then list the id below.
const ORDER = ['chess', 'tictactoe', 'connect4', 'checkers', 'reversi', 'gomoku', 'battleship', 'memory', 'rps', 'reaction', 'minesweeper', 'wordbattle', 'minigolf', 'carrom', 'racing', 'cards', 'snakesladders'];
const games = {};
for (const id of ORDER) {
  let g = null;
  try { g = require('./' + id); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') console.warn(`[games] ${id} failed to load:`, e.message); }
  if (g) games[id] = g; else console.warn(`[games] ${id} is not available and will not be offered`);
}
const catalog = () => Object.values(games).map(g => ({ id: g.id, title: g.title, category: g.category, difficulty: g.difficulty, min: g.min, max: g.max, desc: g.desc, options: g.options || null, resign: !!g.resign, draws: !!g.draws }));
module.exports = { games, catalog, ORDER };
