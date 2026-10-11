import { customAlphabet } from 'nanoid'
import { randomUUID } from 'node:crypto'

const makeCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 5)
const MAX_PLAYERS = 100

export function score(correct, elapsedMs, durationMs, streak) {
  if (!correct) return 0
  const speed = Math.round(1000 * (1 - Math.min(elapsedMs / durationMs, 1) / 2))
  return speed + Math.min(streak, 5) * 100
}

export class Game {
  constructor(quiz) {
    this.code = makeCode()
    this.hostToken = randomUUID()
    this.quiz = quiz
    this.phase = 'lobby'
    this.index = -1
    this.players = new Map()
    this.startedAt = 0
    this.endsAt = 0
    this.timer = null
    this.touched = Date.now()
  }

  get question() {
    return this.quiz.questions[this.index]
  }

  addPlayer(name, existingId) {
    const found = existingId && this.players.get(existingId)
    if (found) return found
    if (this.phase !== 'lobby') throw new Error('Game already started')
    if (this.players.size >= MAX_PLAYERS) throw new Error('Game is full')
    const taken = [...this.players.values()].some((p) => p.name.toLowerCase() === name.toLowerCase())
    if (taken) throw new Error('Name already taken')
    const player = { id: randomUUID(), name, score: 0, streak: 0, pending: null, last: null, socketId: null, connected: true }
    this.players.set(player.id, player)
    return player
  }

  kick(playerId) {
    return this.players.delete(playerId)
  }

  reset() {
    clearTimeout(this.timer)
    this.phase = 'lobby'
    this.index = -1
    for (const p of this.players.values()) Object.assign(p, { score: 0, streak: 0, pending: null, last: null })
  }

  nextQuestion(onExpire) {
    clearTimeout(this.timer)
    if (this.index + 1 >= this.quiz.questions.length) {
      this.phase = 'end'
      return
    }
    this.index += 1
    this.phase = 'question'
    this.startedAt = Date.now()
    this.endsAt = this.startedAt + this.question.seconds * 1000
    for (const p of this.players.values()) {
      p.pending = null
      p.last = null
    }
    this.timer = setTimeout(onExpire, this.question.seconds * 1000)
  }

  answer(playerId, choice, now = Date.now()) {
    const p = this.players.get(playerId)
    if (!p || this.phase !== 'question' || p.pending || now > this.endsAt) return false
    if (!Number.isInteger(choice) || choice < 0 || choice >= this.question.options.length) return false
    const correct = choice === this.question.correct
    const points = score(correct, now - this.startedAt, this.question.seconds * 1000, p.streak)
    p.pending = { choice, correct, points }
    return true
  }

  allAnswered() {
    const live = [...this.players.values()].filter((p) => p.connected)
    return live.length > 0 && live.every((p) => p.pending)
  }

  reveal() {
    if (this.phase !== 'question') return
    clearTimeout(this.timer)
    this.phase = 'reveal'
    for (const p of this.players.values()) {
      const a = p.pending
      if (a?.correct) {
        p.score += a.points
        p.streak += 1
      } else {
        p.streak = 0
      }
      p.last = { choice: a ? a.choice : null, correct: Boolean(a?.correct), points: a?.correct ? a.points : 0 }
    }
  }

  sorted() {
    return [...this.players.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  }

  view() {
    this.touched = Date.now()
    const q = this.phase === 'question' || this.phase === 'reveal' ? this.question : null
    const revealed = this.phase === 'reveal'
    const counts = q ? q.options.map((_, i) => [...this.players.values()].filter((p) => p.last?.choice === i).length) : null
    return {
      code: this.code,
      title: this.quiz.title,
      phase: this.phase,
      index: this.index,
      total: this.quiz.questions.length,
      players: [...this.players.values()].map((p) => ({ id: p.id, name: p.name, connected: p.connected })),
      answered: [...this.players.values()].filter((p) => p.pending).length,
      question: q && {
        text: q.text,
        options: q.options,
        seconds: q.seconds,
        ...(revealed ? { correct: q.correct, counts } : {})
      },
      endsAt: this.endsAt,
      now: Date.now(),
      leaderboard: this.phase === 'reveal' || this.phase === 'end'
        ? this.sorted().slice(0, 10).map((p) => ({ id: p.id, name: p.name, score: p.score, streak: p.streak }))
        : []
    }
  }

  me(playerId) {
    const p = this.players.get(playerId)
    if (!p) return null
    return {
      id: p.id,
      name: p.name,
      score: p.score,
      streak: p.streak,
      rank: this.sorted().findIndex((x) => x.id === p.id) + 1,
      answered: Boolean(p.pending),
      last: this.phase === 'reveal' ? p.last : null
    }
  }
}
