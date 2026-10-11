const uuid = () => crypto.randomUUID?.() ||
  '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16))

function ownerId() {
  let id = localStorage.getItem('owner-id')
  if (!id) {
    id = uuid()
    localStorage.setItem('owner-id', id)
  }
  return id
}

async function call(path, opts = {}) {
  const res = await fetch('/api/quizzes' + path, { ...opts, headers: { 'content-type': 'application/json', 'x-owner': ownerId() } })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Request failed')
  return res.status === 204 ? null : res.json()
}

export const quizApi = {
  list: () => call(''),
  save: (quiz) => call('', { method: 'POST', body: JSON.stringify(quiz) }),
  remove: (id) => call('/' + id, { method: 'DELETE' })
}
