import http from 'node:http'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import express from 'express'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import { Server } from 'socket.io'
import { z } from 'zod'
import { Game } from './game.js'
import { createStore } from './store.js'
import { quizSchema, codeSchema } from './schema.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 3001
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data')
const MAX_GAMES = Number(process.env.MAX_GAMES) || 500
const IDLE_MS = 2 * 60 * 60 * 1000

const log = (level, msg, extra = {}) => console.log(JSON.stringify({ t: new Date().toISOString(), level, msg, ...extra }))
const games = new Map()
const store = createStore(DATA_DIR)

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      upgradeInsecureRequests: null
    }
  }
}))
app.use(compression())
app.use(express.json({ limit: '50kb' }))

app.get('/api/health', (req, res) => res.json({ ok: true, games: games.size, uptime: Math.round(process.uptime()) }))

const api = express.Router()
api.use(rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }))
api.use((req, res, next) => {
  const owner = req.get('x-owner')
  if (!z.string().uuid().safeParse(owner).success) return res.status(400).json({ error: 'Missing or invalid x-owner header' })
  req.owner = owner
  next()
})
api.get('/', (req, res) => res.json(store.list(req.owner)))
api.post('/', (req, res) => res.status(201).json(store.save(req.owner, quizSchema.parse(req.body))))
api.delete('/:id', (req, res) => {
  store.remove(req.owner, req.params.id)
  res.status(204).end()
})
app.use('/api/quizzes', api)

const dist = path.join(__dirname, '../client/dist')
if (fs.existsSync(dist)) {
  app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y' }))
  app.use(express.static(dist))
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')))
}

app.use((err, req, res, next) => {
  if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input' })
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message })
  log('error', 'unhandled', { message: err.message })
  res.status(500).json({ error: 'Internal error' })
})

const server = http.createServer(app)
const io = new Server(server, { cors: { origin: process.env.CLIENT_ORIGIN || false }, maxHttpBufferSize: 1e5 })

function emitState(g) {
  io.to(g.code).emit('state', g.view())
  for (const p of g.players.values()) {
    if (p.socketId && p.connected) io.to(p.socketId).emit('me', g.me(p.id))
  }
}
const expire = (g) => () => {
  g.reveal()
  emitState(g)
}

io.on('connection', (socket) => {
  let hits = []

  const on = (event, schema, handler) => {
    socket.on(event, (data, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {}
      const now = Date.now()
      hits = hits.filter((t) => now - t < 5000)
      hits.push(now)
      if (hits.length > 40) return reply({ error: 'Slow down' })
      try {
        const input = schema ? schema.parse(data) : data
        reply({ ok: true, ...(handler(input) || {}) })
      } catch (e) {
        reply({ error: e instanceof z.ZodError ? 'Invalid input' : e.message })
      }
    })
  }

  const hostGame = () => {
    const g = games.get(socket.data.code)
    if (!g || socket.data.role !== 'host') throw new Error('Not the host')
    return g
  }
  const playerGame = () => {
    const g = games.get(socket.data.code)
    if (!g || socket.data.role !== 'player') throw new Error('Not in a game')
    return g
  }
  const attachHost = (g) => {
    socket.data = { code: g.code, role: 'host' }
    socket.join(g.code)
    emitState(g)
  }
  const advance = () => {
    const g = hostGame()
    if (g.phase === 'question') throw new Error('Question in progress')
    if (g.phase === 'lobby' && g.players.size === 0) throw new Error('Wait for players to join')
    g.nextQuestion(expire(g))
    emitState(g)
  }

  on('host:create', quizSchema, (quiz) => {
    if (games.size >= MAX_GAMES) throw new Error('Server is busy, try again later')
    const g = new Game(quiz)
    games.set(g.code, g)
    attachHost(g)
    log('info', 'game created', { code: g.code, questions: quiz.questions.length })
    return { code: g.code, hostToken: g.hostToken }
  })

  on('host:rejoin', z.object({ code: codeSchema, hostToken: z.string().uuid() }), ({ code, hostToken }) => {
    const g = games.get(code)
    if (!g || g.hostToken !== hostToken) throw new Error('Game not found')
    attachHost(g)
    return { code }
  })

  on('player:join', z.object({ code: codeSchema, name: z.string().trim().min(1).max(20), playerId: z.string().uuid().optional() }), ({ code, name, playerId }) => {
    const g = games.get(code)
    if (!g) throw new Error('Game not found')
    const p = g.addPlayer(name, playerId)
    p.socketId = socket.id
    p.connected = true
    socket.data = { code, role: 'player', playerId: p.id }
    socket.join(code)
    emitState(g)
    return { code, playerId: p.id }
  })

  on('host:start', null, advance)
  on('host:next', null, advance)
  on('host:reveal', null, () => {
    const g = hostGame()
    g.reveal()
    emitState(g)
  })
  on('host:reset', null, () => {
    const g = hostGame()
    g.reset()
    emitState(g)
  })
  on('host:kick', z.string().uuid(), (playerId) => {
    const g = hostGame()
    const p = g.players.get(playerId)
    if (!p) return
    g.kick(playerId)
    if (p.socketId) {
      io.to(p.socketId).emit('kicked')
      io.in(p.socketId).socketsLeave(g.code)
    }
    emitState(g)
  })

  on('player:answer', z.number().int().min(0).max(3), (choice) => {
    const g = playerGame()
    if (g.answer(socket.data.playerId, choice)) {
      if (g.allAnswered()) g.reveal()
      emitState(g)
    }
  })

  socket.on('disconnect', () => {
    const g = games.get(socket.data?.code)
    if (!g) return
    for (const p of g.players.values()) if (p.socketId === socket.id) p.connected = false
    emitState(g)
  })
})

const sweep = setInterval(() => {
  for (const [code, g] of games) {
    if (Date.now() - g.touched > IDLE_MS) {
      clearTimeout(g.timer)
      games.delete(code)
      log('info', 'game expired', { code })
    }
  }
}, 10 * 60 * 1000)
sweep.unref()

const shutdown = (signal) => {
  log('info', 'shutting down', { signal })
  io.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 5000).unref()
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

server.listen(PORT, () => log('info', 'listening', { port: PORT }))
