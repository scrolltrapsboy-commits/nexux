# NEXUS PLAY 3.0 — Online Game Sources

This build uses established open-source game engines/libraries where they provide a reliable rules/physics foundation. NEXUS PLAY remains the multiplayer integration layer.

| Game / subsystem | Online source | License / use |
|---|---|---|
| Chess rules | https://github.com/jhlywa/chess.js | BSD-2-Clause; installed as `chess.js` |
| Checkers rules | https://github.com/loks0n/rapid-draughts | MIT; installed as `rapid-draughts` |
| Pool physics reference | https://github.com/tailuge/billiards | GPL-3.0; used as a technical reference, not copied into the proprietary engine |
| Pool browser implementation reference | https://github.com/emikyu/8ball_pool | See repository license before redistribution |
| Carrom browser implementation reference | https://github.com/sasidharreddy-janke/Carrom-Game- | See repository license before redistribution |
| Racing implementation reference | https://github.com/Steve-IX/Speed_Racer_Game | MIT |
| Racing pseudo-3D reference | https://github.com/jakesgordon/javascript-racer | MIT (project notes include restrictions on bundled music/sprites) |
| Battleship multiplayer architecture reference | https://github.com/andreykishtov/BattleShip-Game | See repository license before redistribution |
| Connect Four rules/UI source | https://github.com/bryanbraun/connect-four | MIT; exact `vars.js`/`functions.js` source retained under `third_party/source-games/connect-four/` |
| Minesweeper reference | https://github.com/smithsa/minesweeper | Public domain |
| Multiplayer architecture reference | https://github.com/kbennett2000/lan-games | See repository license before redistribution |
| Othello / Pong / 2048 / Snake / Tetris source | https://github.com/rkendel1/ganes | MIT; source snapshots retained under `third_party/littlejs-ai/` with license |
| Dots & Boxes engine | https://github.com/gmetzker/DotBox | MIT; vendored engine + required state utilities under `third_party/source-games/dots-and-boxes/` |
| Gomoku source | https://github.com/lunatikek/Gomoku | MIT; upstream `Gomoku.js` and license retained under `third_party/source-games/gomoku/` |
| Mancala source | https://github.com/halilayyildiz/mancala-game | MIT; exact `mancala.js`, `move-stones.js`, and `check-winner.js` rule source retained under `third_party/source-games/mancala/` |
| Carrom physics/controller source | https://github.com/sasidharreddy-janke/Carrom-Game- | Repository README states MIT, but no LICENSE file is present; retained source copies are clearly marked and should be reviewed before any external redistribution |

NEXUS PLAY does not download or execute remote JavaScript at runtime. The MIT LittleJS-AI source snapshots are retained in-repository for audit/reference; NEXUS PLAY adapts their game concepts into the server-authoritative multiplayer layer. Do not add code/assets from a repository whose license does not permit redistribution.


## Policy

New games are not accepted as button-only placeholders. A new game must point to an identified upstream source, retain the source license/notice, and have server integration tests before release. UI skinning is kept outside the upstream rule/physics source so the game behavior is not altered by the Liquid Glass presentation layer.

| Backgammon rules/model | https://github.com/quasoft/backgammonjs | MIT; exact model + RuleBgCasual source retained under `third_party/source-games/backgammon/` |


## Added source engine: LAN Games (MIT)

- Repository: https://github.com/kbennett2000/lan-games
- License: MIT License
- Vendored under: third_party/source-games/lan-games
- Executed by: server/lanSourceGames.js
- Current NEXUS integrations: Tic Tac Toe, Battleship, Yahtzee


## Newly integrated upstream engines

### Tetris — paulfxyz/tetris
- Repository: https://github.com/paulfxyz/tetris
- Snapshot: `public/js/engine.js`
- License: MIT
- NEXUS integration: the vendored upstream `Engine` is executed by a thin server adapter; the NEXUS UI only renders the engine state and sends player input.

### Pong — enricolucia/pong
- Repository: https://github.com/enricolucia/pong
- Snapshots: `src/scripts/elements/ball.es6.js`, `actor.es6.js`, `pong.es6.js`
- License: MIT
- NEXUS integration: the upstream Ball/Actor/Pong collision methods are loaded by a thin server adapter; the NEXUS social/game shell does not replace the game rules.


## Newly added source engines

### Dominoes — ppyne/dominoes
- Repository: https://github.com/ppyne/dominoes
- License: BSD-3-Clause
- Exact upstream browser snapshot retained at: `third_party/source-games/dominoes/index.html`
- License retained at: `third_party/source-games/dominoes/LICENSE`
- NEXUS adapter: `server/sourceBoardGames.js`
- Rule basis: double-six, 28 tiles, five-tile hands, 18-tile boneyard, highest-double start, matching open ends, draw-until-playable, and blocked-game lower-pip win.

### Ludo — chukwumaijem/ludo-game
- Repository: https://github.com/chukwumaijem/ludo-game
- License: MIT
- Upstream rule/path snapshots retained under: `third_party/source-games/ludo/`
- NEXUS adapter: `server/sourceBoardGames.js`
- The NEXUS presentation layer is separate from the retained upstream rule/path source.


### Hangman — tmatth11/hangman
- Repository: https://github.com/tmatth11/hangman
- License: MIT
- Snapshots: third_party/source-games/hangman/script.js, word-list.js, LICENSE
- NEXUS integration: server/sourceHangman.js
- Source behavior retained: 37-word list, one-letter guessing, six maximum wrong guesses, reveal-all-matching-letters, victory/loss scoring.


### Mini Golf — freegamestore-online/minigolf
- Repository: https://github.com/freegamestore-online/minigolf
- License: MIT
- Snapshots: third_party/source-games/minigolf/types.ts, geometry.ts, physics.ts, holes.ts, LICENSE
- NEXUS integration: server/sourceMiniGolf.js
- Upstream functions executed: createBall, launchBall, stepBall, and the source course definitions.

### Neon Circuit Racing — Steve-IX/Speed_Racer_Game
- Repository: https://github.com/Steve-IX/Speed_Racer_Game
- License: MIT
- Snapshots: third_party/source-games/racing/car.js, track.js, LICENSE
- NEXUS integration: server/sourceRacing.js
- Upstream classes executed: Car and Track including checkpoints and lap progression.


## 3.6 source arcade expansion — forinda/canvas-games

Upstream repository: https://github.com/forinda/canvas-games
License: MIT (copyright notice retained in `third_party/source-games/canvas-games/LICENSE`). The upstream repository describes 52 playable TypeScript/HTML5 Canvas games.

NEXUS retains the upstream gameplay/system source used for these six additions. The NEXUS renderer and multiplayer transport are separate adapters; upstream gameplay files are not rewritten into placeholder logic.

- Breakout: `src/games/breakout/BreakoutEngine.ts`, `types.ts`, `data/levels.ts`, `systems/PhysicsSystem.ts`, `systems/CollisionSystem.ts`, `systems/PowerupSystem.ts`, `systems/LevelSystem.ts`.
- Space Invaders: `src/games/space-invaders/InvadersEngine.ts`, `types.ts`, `data/formations.ts`, `systems/AlienSystem.ts`, `systems/CollisionSystem.ts`, `systems/PlayerSystem.ts`, `systems/UFOSystem.ts`, `systems/InputSystem.ts`.
- Pac-Man: `src/games/pacman/PacManEngine.ts`, `types.ts`, `data/maze.ts`, `systems/CollisionSystem.ts`, `systems/GhostSystem.ts`, `systems/PlayerSystem.ts`.
- Frogger: `src/games/frogger/FroggerEngine.ts`, `types.ts`, `data/levels.ts`, `systems/CollisionSystem.ts`, `systems/RiverSystem.ts`, `systems/TrafficSystem.ts`, `systems/InputSystem.ts`.
- Flappy Bird: `src/games/flappy-bird/FlappyEngine.ts`, `types.ts`, `systems/BirdSystem.ts`, `systems/PipeSystem.ts`, `systems/CollisionSystem.ts`, `systems/InputSystem.ts`.
- Sudoku: `src/games/sudoku/SudokuEngine.ts`, `types.ts`, `data/puzzles.ts`, `systems/BoardSystem.ts`, `systems/InputSystem.ts`.

Note: the upstream source is a single-player Canvas arcade collection. NEXUS wraps each engine/system set in a two-player server-authoritative match state; that multiplayer wrapper is NEXUS code, while the retained gameplay systems remain upstream snapshots.


### Mancala — halilayyildiz/mancala-game
- Repository: https://github.com/halilayyildiz/mancala-game
- License: MIT (Copyright (c) 2018 Halil AYYILDIZ)
- Exact rule snapshots retained at: `third_party/source-games/mancala/mancala.js`, `move-stones.js`, `check-winner.js`
- NEXUS adapter: `server/sourceMancala.js`
- The upstream sowing, extra-turn, capture, and end-of-game rule methods execute unchanged inside an isolated server runtime; NEXUS only supplies the multiplayer state bridge and presentation.
