import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const MAX_PER_OWNER = 50
const fail = (message, status = 400) => Object.assign(new Error(message), { status })

export function createStore(dir) {
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, 'quizzes.json')
  let db = []
  try { db = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { db = [] }

  const persist = () => {
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(db))
    fs.renameSync(tmp, file)
  }
  const strip = ({ owner, ...rest }) => rest

  return {
    list: (owner) => db.filter((q) => q.owner === owner).map(strip).sort((a, b) => b.createdAt - a.createdAt),
    save(owner, quiz) {
      if (db.filter((q) => q.owner === owner).length >= MAX_PER_OWNER) throw fail(`Limit of ${MAX_PER_OWNER} saved quizzes reached`)
      const rec = { id: randomUUID(), owner, createdAt: Date.now(), ...quiz }
      db.push(rec)
      persist()
      return strip(rec)
    },
    remove(owner, id) {
      const before = db.length
      db = db.filter((q) => !(q.id === id && q.owner === owner))
      if (db.length === before) throw fail('Quiz not found', 404)
      persist()
    }
  }
}
