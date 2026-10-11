import test from 'node:test'
import assert from 'node:assert/strict'
import { Game, score } from '../game.js'

const quiz = { title: 'T', questions: [{ text: 'q1', options: ['a', 'b'], correct: 0, seconds: 10 }, { text: 'q2', options: ['a', 'b'], correct: 1, seconds: 10 }] }

test('score rewards speed and streaks, zero when wrong', () => {
  assert.equal(score(false, 0, 10000, 3), 0)
  assert.equal(score(true, 0, 10000, 0), 1000)
  assert.equal(score(true, 10000, 10000, 0), 500)
  assert.equal(score(true, 0, 10000, 2), 1200)
  assert.equal(score(true, 0, 10000, 99), 1500)
})

test('game flow, one answer per question, streak tracking', () => {
  const g = new Game(quiz)
  const p = g.addPlayer('Ann')
  assert.throws(() => g.addPlayer('ann'), /taken/)
  g.nextQuestion(() => {})
  assert.equal(g.answer(p.id, 0), true)
  assert.equal(g.answer(p.id, 1), false)
  assert.ok(g.allAnswered())
  g.reveal()
  assert.ok(p.score >= 500)
  assert.equal(p.streak, 1)
  assert.throws(() => g.addPlayer('Late'), /started/)
  g.nextQuestion(() => {})
  g.reveal()
  assert.equal(p.streak, 0)
  g.nextQuestion(() => {})
  assert.equal(g.phase, 'end')
})

test('view hides the answer until reveal', () => {
  const g = new Game(quiz)
  g.addPlayer('Ann')
  g.nextQuestion(() => {})
  assert.equal('correct' in g.view().question, false)
  g.reveal()
  assert.equal(g.view().question.correct, 0)
})

test('reset returns to lobby and clears scores, kick removes a player', () => {
  const g = new Game(quiz)
  const a = g.addPlayer('Ann')
  const b = g.addPlayer('Bob')
  g.nextQuestion(() => {})
  g.answer(a.id, 0)
  g.reveal()
  assert.ok(a.score > 0)
  g.reset()
  assert.equal(g.phase, 'lobby')
  assert.equal(a.score, 0)
  assert.equal(g.kick(b.id), true)
  assert.equal(g.players.size, 1)
})
