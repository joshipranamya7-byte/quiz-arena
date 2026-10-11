# QuizArena

**QuizArena** is a real-time multiplayer quiz platform built with React, Node.js, Express, and Socket.IO. Hosts can create or load quizzes, invite players using a room code or QR code, and run live quiz sessions with synchronized timers, speed-based scoring, streak bonuses, and an animated leaderboard.

### Key Features
- Real-time multiplayer gameplay using Socket.IO
- Room-code and QR-code-based player joining
- Live leaderboard with speed and streak bonuses
- Server-authoritative scoring and answer validation
- Synchronized countdown timers
- Player reconnection support
- Host controls for managing players and quiz sessions
- Saved quiz library with file-based persistence
- Responsive interface with animations, confetti, and sound effects
- Request validation, rate limiting, and security headers
- Automated unit and integration tests
- Docker configuration and GitHub Actions CI

### Tech Stack
- **Frontend:** React, Vite, JavaScript, CSS
- **Backend:** Node.js, Express
- **Real-time communication:** Socket.IO
- **Validation & security:** Zod, Helmet, express-rate-limit
- **Testing:** Node.js test runner, Socket.IO Client
- **DevOps:** Docker, GitHub Actions

### Run Locally
```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### Tests and Production Build
```bash
npm test
npm run build
npm start
```

### Architecture
The client handles the user interface and real-time interactions, while the server manages game state, timers, answer validation, and scoring. Quiz persistence is implemented through a repository layer with atomic file writes.

### Future Improvements
- Persistent database integration
- User authentication and multi-device quiz libraries
- Redis-backed game state for horizontal scaling

