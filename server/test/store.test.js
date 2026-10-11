import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createStore } from '../store.js'

const quiz = { title: 'T', questions: [{ text: 'q', options: ['a', 'b'], correct: 0, seconds: 10 }] }

test('store isolates owners, persists to disk, and enforces limits', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-'))
  const s = createStore(dir)
  const saved = s.save('owner-1', quiz)
  assert.equal(s.list('owner-1').length, 1)
  assert.equal(s.list('owner-2').length, 0)
  assert.equal('owner' in saved, false)
  assert.equal(createStore(dir).list('owner-1').length, 1)
  assert.throws(() => s.remove('owner-2', saved.id), /not found/)
  s.remove('owner-1', saved.id)
  assert.equal(s.list('owner-1').length, 0)
  for (let i = 0; i < 50; i++) s.save('owner-1', quiz)
  assert.throws(() => s.save('owner-1', quiz), /Limit/)
})
