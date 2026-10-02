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
| Connect Four UI/reference | https://github.com/bryanbraun/connect-four | MIT |
| Minesweeper reference | https://github.com/smithsa/minesweeper | Public domain |
| Multiplayer architecture reference | https://github.com/kbennett2000/lan-games | See repository license before redistribution |
| Othello / Pong / 2048 / Snake / Tetris source | https://github.com/rkendel1/ganes | MIT; source snapshots retained under `third_party/littlejs-ai/` with license |

NEXUS PLAY does not download or execute remote JavaScript at runtime. The MIT LittleJS-AI source snapshots are retained in-repository for audit/reference; NEXUS PLAY adapts their game concepts into the server-authoritative multiplayer layer. Do not add code/assets from a repository whose license does not permit redistribution.
