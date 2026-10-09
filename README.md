# NEXUS PLAY

Real-time multiplayer games with friends. Monochrome "liquid glass" design, mobile first.
Every game fills the screen; chat, voice and video live in a side panel **only while you are in a game room**.
There is one global chat, on the Home page.

**Games (16):** Chess (clocks, promotion, draw offers, spectators), Tic Tac Toe, Connect Four, Checkers, Reversi, Gomoku,
Battleship, Memory, Rock Paper Scissors, Reaction Race, Minesweeper Duel, Word Battle, Mini Golf (2-4), Carrom, Nexus Grand Prix racing (2-4), Nexus Cards (2-4, original card game).

## Quick start

Requires **Node 22.5 or newer** (the database uses the built-in `node:sqlite`).

```bash
npm install
cp .env.example .env      # then edit SESSION_SECRET
npm start                 # http://localhost:3000
```

Open it in two browser windows to play against yourself. Camera and microphone need `https://` or `localhost`.

| Command | What it does |
|---|---|
| `npm start` | Start the server (also serves the client from `public/`). |
| `npm run dev` | Start with auto restart on file changes. |
| `npm run migrate` | Create/upgrade the database and import `data.json` from the old version (safe to run repeatedly). |
| `npm test` | Protocol, accounts, social and call-signaling tests (starts its own in-memory servers). |
| `npm run test:ui` | Real-browser tests (needs `npm i -D playwright` and a Chromium, see "Testing"). |

## Environment variables

See `.env.example`. Summary:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port. |
| `DATABASE_URL` | `sqlite:./data/nexus.db` | `sqlite:<file>` or `sqlite::memory:`. |
| `SESSION_SECRET` (alias `JWT_SECRET`) | random per start | Keys the hash of session tokens. **Set it in production.** |
| `CLIENT_URL` | empty | Allowed browser origin if the client is hosted elsewhere (CORS). |
| `FORCE_HTTPS` | `0` | `1` redirects http to https (behind a proxy that sets `x-forwarded-proto`). |
| `TURN_SERVER_URL`, `TURN_SERVER_USERNAME`, `TURN_SERVER_PASSWORD` | empty | TURN relay for strict NATs (comma separate several URLs). STUN is always used. |
| `LEGACY_JSON` | `./data.json` | Old data file imported once at start. |
| `RATE_SCALE` | `1` | Multiplies REST rate limits (test suites only). |
| `NP_TEST` | off | Test hooks (short clocks, state injection). **Never enable in production.** |

## Accounts and data

* Anyone can **play as a guest** immediately; a guest can later **create an account** and keeps their stats, friends and rating (the guest is upgraded in place).
* Passwords are hashed with scrypt. Session tokens are random; only a keyed SHA-256 of each token is stored. Sessions last 30 days and slide forward.
* Password reset: `POST /api/password/forgot` creates a single-use token valid for one hour. **There is no email sender in this build**: the reset link is written to the server log, so an operator can pass it on. Wire `server/services/auth.js#requestReset` to your mail provider to send it automatically.
* Leaderboards: global or friends, per game or overall, for today / this week / this month / all time. Pairwise Elo (K=24) for every game, including 3 and 4 player ones.
* Achievements: first win, 10 and 50 wins, 100 games, chess master, perfect game, comeback, speed winner, explorer, friend maker.

### Database

SQLite in WAL mode through a small wrapper (`server/database/database.js`) that exposes `run/get/all/tx/exec`. Tables: `users, sessions, friends, friend_requests, blocked_users, rooms, matches, match_players, game_stats, messages, dm_reads, global_chat, notifications, achievements, password_resets, meta` plus a `leaderboards` view. Migrations are versioned in `server/database/schema.js`.
Back up by copying `data/nexus.db` (together with `-wal`/`-shm` if the server is running, or stop it first).

**Not implemented:** a PostgreSQL adapter. The wrapper is the only place that talks to the database driver, so one can be added there; `DATABASE_URL=postgres://...` currently fails with a clear message.

## Voice and video

Peer-to-peer WebRTC mesh (best for 2-4 players), signalled over Socket.IO, scoped to the game room. Nobody is asked for camera or microphone until they press **Voice** or **Video** inside a room. Controls: mute, camera on/off, deafen, per-person volume, device selection, camera switch on phones, speaking indicator, automatic re-join after a reconnect.
Behind strict firewalls peers need a TURN relay: set the three `TURN_SERVER_*` variables (for example a self-hosted coturn). Without TURN, calls work on most home and mobile networks but can fail on some corporate or carrier-grade NAT networks.

## Project layout

```
server/            Node server
  server.js        createServer() + start
  http.js          REST (/api/*), security headers, static files
  socket.js        every Socket.IO event
  rooms.js         rooms, matchmaking, clocks, reconnect, spectators, rematch
  games/<id>.js    one server-authoritative module per game (+ index.js registry)
  services/        users, auth, friends, chat, notifications, presence, stats, webrtc
  database/        connection wrapper, schema/migrations, legacy import, migrate CLI
shared/            code used by both sides (racing track, golf holes)
public/            client (ES modules, no build step)
  js/pages/        home, games, friends, ranks, profile, settings, auth
  js/room/         full-screen game shell, call (WebRTC), dock (video + chat)
  js/games/<id>.js one renderer per game
tests/             node:test suites (+ tests/ui Playwright scripts)
```

### Adding a game
1. `server/games/<id>.js` exporting `{ id, title, category, difficulty, min, max, desc, init, move, redact, ... }` (see `tictactoe.js` for the smallest example). The server owns all rules and hidden information.
2. `public/js/games/<id>.js` exporting `{ mount(el, api), update(room), seat(), status() }`.
3. Add the id to `ORDER` in `server/games/index.js` and an icon in `public/js/art.js`. A game whose module is missing is never offered.

## Security notes

CSP and other security headers, per-socket and per-IP rate limits, input validation on every event, server-side move validation, hidden information (hands, fleets, mines) never leaves the server, chat is rendered as text (never HTML), room codes use a restricted alphabet, and private rooms cannot be spectated.

## Deployment

Any host that runs a long-lived Node 22 process with WebSockets and a persistent disk works (a small VPS, Fly.io with a volume, Railway or Render with a disk). Not Vercel/Netlify functions.

1. Set `NODE_ENV=production`, `SESSION_SECRET`, `FORCE_HTTPS=1`, and (optionally) `TURN_SERVER_*`.
2. Mount a persistent volume and point `DATABASE_URL` at it, e.g. `sqlite:/data/nexus.db`.
3. Run `npm ci --omit=dev && npm start`. Put it behind TLS (Caddy, nginx, or your host's proxy) and make sure WebSocket upgrades are forwarded.
4. `GET /health` returns `{ok:true,...}` for health checks.

A `Dockerfile` is included. It has not been built or run in the environment this project was developed in.

**Scaling limit:** rooms, matchmaking and presence are held in the memory of one process, so run **one instance**. Scaling out needs sticky sessions plus a shared state layer (for example the Socket.IO Redis adapter and moving room state out of process), which is not built.

## Testing

`npm test` runs 31 tests against in-process servers: every game's rules and hidden-information redaction, a full racing lap with anti-cheat, accounts (register, login, logout, change/reset password, guest upgrade, rate limits, legacy import), friends, invites, DMs, global and room chat, spectators, reconnect, and call signalling.

Browser tests (`tests/ui/*.js`) use Playwright with Chromium's fake camera and microphone: `call.js` runs two real browsers through a WebRTC call (video flowing, mute, camera off/on, deafen, leave), `games.js` opens every game at phone/tablet/desktop widths and checks that nothing scrolls, overflows or logs errors, and `widths.js` checks the app pages from 320 px to 1920 px.
```bash
npm i -D playwright && npx playwright install chromium
PORT=3111 RATE_SCALE=100 NP_TEST=1 npm start &     # in one terminal
BASE=http://localhost:3111 node tests/ui/call.js
```

## Known limitations

See the final section of the delivery notes; in short: no email sending for password reset, SQLite only, one server instance, and automated browser tests were run in Chromium only (not Safari or Firefox).
