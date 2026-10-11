import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { io } from 'socket.io-client'

const PORT = 4311
const call = (s, e, d) => new Promise((res, rej) => s.emit(e, d, (r) => (r.error ? rej(new Error(r.error)) : res(r))))
const once = (s, e, pred) => new Promise((res) => {
  const h = (x) => { if (pred(x)) { s.off(e, h); res(x) } }
  s.on(e, h)
})

test('REST library and full game over sockets', async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-e2e-'))
  const server = spawn('node', ['index.js'], { env: { ...process.env, PORT, DATA_DIR: dataDir }, cwd: new URL('..', import.meta.url).pathname })
  await new Promise((r) => setTimeout(r, 1000))
  const url = `http://localhost:${PORT}`
  const [host, a, b] = [io(url), io(url), io(url)]
  t.after(() => { [host, a, b].forEach((s) => s.close()); server.kill() })

  const quiz = { title: 'T', questions: [{ text: 'q', options: ['x', 'y'], correct: 1, seconds: 10 }] }
  const owner = randomUUID()
  const headers = { 'content-type': 'application/json', 'x-owner': owner }
  const health = await fetch(`${url}/api/health`)
  assert.equal(health.headers.get('x-content-type-options'), 'nosniff')
  assert.equal((await fetch(`${url}/api/quizzes`)).status, 400)
  assert.equal((await fetch(`${url}/api/quizzes`, { method: 'POST', headers, body: JSON.stringify({ title: '' }) })).status, 400)
  assert.equal((await fetch(`${url}/api/quizzes`, { method: 'POST', headers, body: JSON.stringify(quiz) })).status, 201)
  assert.equal((await (await fetch(`${url}/api/quizzes`, { headers })).json()).length, 1)

  await assert.rejects(call(host, 'host:create', { title: '', questions: [] }), /Invalid/)
  const { code } = await call(host, 'host:create', quiz)
  const { playerId } = await call(a, 'player:join', { code, name: 'Ann' })
  const joinedB = await call(b, 'player:join', { code, name: 'Bob' })
  await assert.rejects(call(b, 'player:join', { code, name: 'ann' }), /taken/)

  const kicked = once(b, 'kicked', () => true)
  await call(host, 'host:kick', joinedB.playerId)
  await kicked
  assert.ok(playerId)

  const revealed = once(host, 'state', (s) => s.phase === 'reveal')
  await call(host, 'host:start')
  await call(a, 'player:answer', 1)
  const s = await revealed
  assert.equal(s.leaderboard[0].name, 'Ann')
  assert.equal(s.players.length, 1)
  const lobby = once(host, 'state', (x) => x.phase === 'lobby')
  await call(host, 'host:reset')
  assert.equal((await lobby).index, -1)
})
