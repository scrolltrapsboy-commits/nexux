# NEXUS PLAY 3.8 — Source-backed Multiplayer Game Platform

NEXUS PLAY is a Node.js + Express + Socket.IO multiplayer game platform with a black/white Liquid Glass interface, persistent SQLite profiles, room/global chat and in-game WebRTC voice/video.

## Game set

The library includes source-backed Connect Four, Chess, Chinese Chess, Checkers, Go 9×9, Carrom, Dots & Boxes, Gomoku and Backgammon alongside the other games listed below.

- Tic Tac Toe
- Connect Four — source-backed MIT rules
- Rock Paper Scissors
- Chess
- Chinese Chess
- Checkers
- Go 9×9
- Battleship
- Memory Match
- Minesweeper Duel
- Word Battle
- Reaction Race
- **8-Ball Pool — fixed-step collision/pocket physics, ball-in-hand, groups, fouls and 8-ball rules**
- **Carrom — source-backed board/physics integration**
- **Mini Golf — stroke counting, continuous ball motion, wall reflection and hole detection**
- **Neon Circuit Racing — simultaneous keyboard/touch driving with server-side race simulation**
- **Othello** — 8×8 Reversi rules
- **Pong** — real-time two-player paddle/ball simulation
- **2048 Duel** — authentic merge-and-double mechanics
- **Tetris Duel** — seven tetrominoes, rotation, gravity, line clears
- **Snake Arena** — real-time two-player snake arena

## Run

```bash
npm install
npm start
```

Open `http://localhost:3000` in two browsers/devices and create/join the same room.

## Test

```bash
npm test
```

## Architecture

The game rules are server-authoritative. A browser sends intent such as `move`, `drive`, aim and power; the server validates it, advances the simulation and broadcasts sanitized state back to each player. Hidden information in Battleship, Minesweeper and Memory is filtered per viewer.

The physical games use fixed-step deterministic simulations with collision resolution and friction rather than button-driven score changes. The browser renders the simulation and animates returned frames.

## Online open-source references

See `ONLINE_GAME_SOURCES.md` for the open-source projects inspected during the rebuild and their license considerations. GPL code is not copied into the NEXUS PLAY codebase.


## Source-backed game engines

NEXUS PLAY uses established open-source engines and source snapshots instead of relying only on handwritten rule code. Chess is backed by `chess.js` 1.4.0 (BSD-2-Clause), English Checkers by `rapid-draughts` 1.0.6 (MIT), Connect Four by vendored MIT source from `bryanbraun/connect-four`, Dots & Boxes by vendored MIT source, Gomoku by vendored MIT source, Carrom by vendored upstream source, and Backgammon by vendored `quasoft/backgammonjs` MIT source. `matter-js` remains available for vector/physics work. The multiplayer server remains authoritative and only serializes deterministic game state to clients. See `ONLINE_GAME_SOURCES.md` for the complete source/reference list and license notes. Mancala uses the retained MIT-licensed upstream rule source from `halilayyildiz/mancala-game`.

After extracting the project, run `npm install` before starting the server so the source-backed engines are installed.


## Source-engine rule policy

Games are only added when an identified upstream implementation is retained in `third_party/source-games/` with its license/notice and connected through a NEXUS adapter. The Liquid Glass UI is kept separate from the gameplay source so visual changes cannot silently alter the rule engine.

## Release verification
Release hardening includes authoritative chess/checkers rules, realtime arcade state, separate room/global/friend chat channels, persisted profiles, and WebRTC media controls. GitHub Actions is the release gate; a production deployment should also provide a TURN service through `ICE_SERVERS_JSON` for networks where STUN alone cannot establish a peer connection.

## In-game experience

The game view opens as a full-window play surface. On desktop, live voice/video and Room/Global/Friend chat stay in a dedicated right-side social rail; on phones, the same controls collapse into a compact bottom social panel so the game remains usable without overlap. Game rooms expose a shareable `?room=CODE` invite link and can auto-join from that link.


## Source-engine rebuild

This release adds exact vendored upstream source snapshots for Dots & Boxes (MIT DotBox), Gomoku (MIT), and Carrom physics/rule reference (MIT Carrom-Game-). Their licenses are retained in `third_party/source-games/`. Chess and English Checkers continue to use source-backed libraries. The NEXUS multiplayer layer remains responsible for rooms, synchronized state, chat and calls.

## Source-engine policy

NEXUS PLAY now vendors and executes unchanged MIT-licensed game logic from `kbennett2000/lan-games` for Tic Tac Toe, Battleship, and Yahtzee. The NEXUS layer only adapts room identities, Socket.IO transport, privacy filtering, and the existing monochrome UI. Additional source integrations are only accepted when the upstream rules code and license can be verified; gameplay logic is not replaced by a simplified look-alike implementation.

## Source-backed game policy

The source-backed multiplayer set currently includes Tic Tac Toe, Connect Four, Chess, Chinese Chess, Checkers, Go 9×9, Battleship, Yahtzee, Monopoly, Risk, The Game of Life, Dots & Boxes, Gomoku, Backgammon, Carrom, 8-Ball Pool, Mini Golf, Neon Circuit Racing, Word Chain, UNO, 2048, Snake, Tetris, Othello, Pong, Anagram Sprint, Number Hunt, Speed Typing, Ludo, Dominoes, Reaction Race, and Hangman. Their rule/controller source is vendored under `third_party/source-games` with the corresponding license/notice files, and NEXUS wraps that source for Socket.IO state synchronization and the Liquid Glass presentation layer.

The remaining arcade/physics games in the catalog retain NEXUS-specific realtime adapters. They are not described as verbatim upstream ports unless their source is actually executed by the adapter.


### Source-engine rule policy
Every newly added game is required to retain its upstream source snapshot and license/notice inside `third_party/source-games/`. The NEXUS Liquid Glass UI is a presentation shell; it does not replace the retained game rules. Ludo and Dominoes were added from verified MIT/BSD upstream sources and are integrated through thin server adapters.


## Source-backed Hangman

NEXUS PLAY vendors the core source files from tmatth11/hangman (MIT): third_party/source-games/hangman/script.js, word-list.js, and LICENSE. The NEXUS shell adapts the source guessing rules for synchronized two-player play without changing the six-mistake rule or word selection source.


## 3.5 source-backed expansion

The catalog now contains 43 games. Mini Golf executes the vendored MIT `freegamestore-online/minigolf` physics/course source through `server/sourceMiniGolf.js`; Neon Circuit Racing executes the vendored MIT `Steve-IX/Speed_Racer_Game` Car and Track source through `server/sourceRacing.js`; Hangman vendors the MIT `tmatth11/hangman` rule and 37-word-list source through `server/sourceHangman.js`. NEXUS adds only the multiplayer transport, player isolation and Liquid Glass presentation shell around those engines.


## 3.6 online-source expansion

The 3.6 arcade expansion vendors the gameplay source used by Breakout, Space Invaders, Pac-Man, Frogger, Flappy Bird and Sudoku from the MIT-licensed `forinda/canvas-games` repository. The upstream gameplay/system files are retained under `third_party/source-games/canvas-games/`; NEXUS replaces only the presentation/input bridge so the Liquid Glass shell does not alter the upstream mechanics. The upstream project documents all of these games as complete TypeScript/Canvas implementations and publishes its MIT license. See `ONLINE_GAME_SOURCES.md` for the exact source paths.
