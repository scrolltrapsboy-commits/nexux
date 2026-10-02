# NEXUS PLAY 2.1 — Real Multiplayer Game Platform

NEXUS PLAY is a Node.js + Express + Socket.IO multiplayer game platform with a black/white Liquid Glass interface, persistent SQLite profiles, room/global chat and in-game WebRTC voice/video.

## Game set

- Tic Tac Toe
- Connect Four
- Rock Paper Scissors
- Chess
- Checkers
- Battleship
- Memory Match
- Minesweeper Duel
- Word Battle
- Reaction Race
- **8-Ball Pool — fixed-step collision/pocket physics, ball-in-hand, groups, fouls and 8-ball rules**
- **Carrom — 19-piece board, striker/coin collisions, pockets, scoring and queen**
- **Mini Golf — stroke counting, continuous ball motion, wall reflection and hole detection**
- **Neon Circuit Racing — simultaneous keyboard/touch driving with server-side race simulation**
- **Othello** — source-adapted 8×8 Reversi rules
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

See `THIRD_PARTY_SOURCES.md` for the open-source projects inspected during the rebuild and their license considerations. GPL code is not copied into the NEXUS PLAY codebase.


## 2.2 source-backed game engines

NEXUS PLAY 3.0 uses established online open-source engines/libraries instead of relying only on handwritten rule code. Chess is backed by `chess.js` 1.4.x (BSD-2-Clause), English Checkers is backed by `rapid-draughts` 1.0.6 (MIT), and physical vector calculations use `matter-js` (MIT). The multiplayer server remains authoritative and only serializes deterministic game state to clients. See `ONLINE_GAME_SOURCES.md` for the complete source/reference list and license notes.

After extracting the project, run `npm install` before starting the server so the source-backed engines are installed.


## Release verification
Current release hardening includes authoritative chess/checkers engines, realtime arcade state, in-game room/global/friend chat, and WebRTC media controls. CI is the release gate.
