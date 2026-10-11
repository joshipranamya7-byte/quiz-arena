# Quiz Arena

Real-time multiplayer quiz platform. A host builds or loads a quiz, players join from their phones with a code or QR, and answers are scored live with speed and streak bonuses on an animated leaderboard.

## Features
- Server-authoritative engine: correct answers never reach clients before reveal; scoring and timers run on the server
- Speed and streak scoring, one answer per player per question
- Reconnect support for players and hosts after refresh or network drops
- Clock-skew-corrected countdown ring synced to the server deadline
- Host tools: QR join, kick players, skip timer, play again
- Saved quiz library per browser, persisted on disk with atomic writes
- Polished UI: animated transitions, confetti, podium, sound effects with mute
- Security and ops: helmet CSP, zod validation, REST and socket rate limits, game caps, idle cleanup, structured JSON logs, graceful shutdown, health endpoint
- Tests: engine unit tests, store tests, socket and REST integration test, run in CI

## Stack
React, Vite, Node.js, Express, Socket.IO, zod, helmet, Docker, GitHub Actions

## Run locally
```
npm install
npm run dev
```
Open http://localhost:5173. To play from phones on the same Wi-Fi, use `npm run dev:lan`.

## Test, build, production run
```
npm test
npm run build
npm start
```
Production serves the app and sockets from one port (default 3001, set `PORT`).

## Configuration
See `.env.example`: `PORT`, `DATA_DIR`, `MAX_GAMES`, `CLIENT_ORIGIN`.

## Architecture
- `server/game.js`: pure game logic with no I/O, unit tested
- `server/index.js`: HTTP, Socket.IO transport, validation, limits, lifecycle
- `server/store.js`: quiz repository with atomic file persistence, swappable for a database
- `client/`: React views, timer, leaderboard, podium, sound and API helpers

## Design decisions
- The server owns game state, so clients cannot cheat and every screen stays consistent
- Absolute `endsAt` plus server clock in each message lets clients correct for clock skew
- Answers stay pending until reveal so score and streak update atomically
- Repository interface for quizzes isolates persistence from routing
- Saved quizzes are scoped by a random per-browser id: lightweight, not real authentication

## Known limits and next steps
- Live games are in memory on one instance. To scale out: Redis for game state plus the Socket.IO Redis adapter
- Saved quizzes use a JSON file. Move to MongoDB or Postgres with real user accounts for multi-device libraries
- Free hosting disks are ephemeral, so saved quizzes may reset on redeploy unless a persistent disk is attached
