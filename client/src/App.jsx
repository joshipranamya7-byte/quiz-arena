import { useEffect, useRef, useState } from 'react'
import { socket, emit } from './socket.js'
import { isMuted, setMuted } from './sound.js'
import { Home, Create, Host, Player } from './views.jsx'

const KEY = 'quiz-session'
const save = (s) => (s ? sessionStorage.setItem(KEY, JSON.stringify(s)) : sessionStorage.removeItem(KEY))

export default function App() {
  const [session, setSession] = useState(() => JSON.parse(sessionStorage.getItem(KEY) || 'null'))
  const [state, setState] = useState(null)
  const [me, setMe] = useState(null)
  const [online, setOnline] = useState(socket.connected)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [muted, setMutedState] = useState(isMuted())
  const offset = useRef(0)
  const sessionRef = useRef(session)
  sessionRef.current = session

  const leave = (msg = '') => {
    save(null)
    setSession(null)
    setState(null)
    setMe(null)
    setCreating(false)
    setError(typeof msg === 'string' ? msg : '')
  }
  const begin = (s) => {
    save(s)
    setSession(s)
    setError('')
  }

  useEffect(() => {
    const onState = (s) => { offset.current = s.now - Date.now(); setState(s) }
    const onConnect = () => {
      setOnline(true)
      const s = sessionRef.current
      if (s) emit(s.role === 'host' ? 'host:rejoin' : 'player:join', s).catch(() => leave())
    }
    const onDisconnect = () => setOnline(false)
    const onKicked = () => leave('You were removed by the host')
    socket.on('state', onState)
    socket.on('me', setMe)
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('kicked', onKicked)
    if (socket.connected) onConnect()
    return () => {
      socket.off('state', onState)
      socket.off('me', setMe)
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('kicked', onKicked)
    }
  }, [])

  const act = (event, data) => emit(event, data).catch((e) => setError(e.message))
  const join = async (code, name) => {
    try {
      const r = await emit('player:join', { code, name })
      begin({ role: 'player', code: r.code, name, playerId: r.playerId })
    } catch (e) { setError(e.message) }
  }
  const host = async (quiz) => {
    try {
      const r = await emit('host:create', quiz)
      begin({ role: 'host', code: r.code, hostToken: r.hostToken })
    } catch (e) { setError(e.message) }
  }
  const toggleMute = () => { setMuted(!muted); setMutedState(!muted) }

  let body
  if (!session) body = creating ? <Create onCreate={host} onBack={() => setCreating(false)} /> : <Home onJoin={join} onHost={() => setCreating(true)} />
  else if (!state) body = <p className="center">Connecting...</p>
  else body = session.role === 'host' ? <Host s={state} act={act} offset={offset} onLeave={leave} /> : <Player s={state} me={me} act={act} offset={offset} />

  return (
    <div className="app">
      <header>
        <b>Quiz Arena</b>
        <span className={'dot ' + (online ? 'on' : 'off')} title={online ? 'online' : 'reconnecting'} />
        <button className="ghost icon" onClick={toggleMute} title="Sound">{muted ? '🔇' : '🔊'}</button>
        {session && <button className="ghost" onClick={() => leave()}>Leave</button>}
      </header>
      {error && <div className="error" onClick={() => setError('')}>{error}</div>}
      <main>{body}</main>
    </div>
  )
}
