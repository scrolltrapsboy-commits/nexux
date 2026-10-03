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
