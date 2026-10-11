import { useEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { sfx } from './sound.js'

export const celebrate = (big = false) =>
  confetti({ particleCount: big ? 220 : 90, spread: big ? 110 : 70, origin: { y: 0.6 } })

export function Timer({ endsAt, seconds, offset }) {
  const left = () => Math.max(0, endsAt - (Date.now() + offset.current))
  const [ms, setMs] = useState(left)
  const lastTick = useRef(null)
  useEffect(() => {
    const t = setInterval(() => setMs(left()), 100)
    return () => clearInterval(t)
  }, [endsAt])
  const secs = Math.ceil(ms / 1000)
  useEffect(() => {
    if (secs > 0 && secs <= 5 && lastTick.current !== secs) sfx.tick()
    lastTick.current = secs
  }, [secs])
  const R = 34
  const C = 2 * Math.PI * R
  return (
    <div className={'ring' + (secs <= 5 ? ' urgent' : '')}>
      <svg viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={R} className="track" />
        <circle cx="40" cy="40" r={R} className="prog" strokeDasharray={C} strokeDashoffset={C * (1 - ms / (seconds * 1000))} />
      </svg>
      <span>{secs}</span>
    </div>
  )
}

const ROW = 52
export function Leaderboard({ rows, meId }) {
  const max = Math.max(1, ...rows.map((r) => r.score))
  return (
    <div className="board" style={{ height: rows.length * ROW }}>
      {rows.map((r, i) => (
        <div key={r.id} className={'row' + (r.id === meId ? ' me' : '')} style={{ transform: `translateY(${i * ROW}px)` }}>
          <span className="rank">{i + 1}</span>
          <span className="pname">{r.name}{r.streak > 1 ? ` 🔥${r.streak}` : ''}</span>
          <div className="bar"><i style={{ width: `${(r.score / max) * 100}%` }} /></div>
          <b>{r.score}</b>
        </div>
      ))}
    </div>
  )
}

export function Podium({ rows }) {
  const places = [2, 1, 3]
  const order = [rows[1], rows[0], rows[2]]
  return (
    <div className="podium">
      {order.map((r, i) => r && (
        <div key={r.id} className={`pod p${places[i]}`}>
          <div className="pname">{r.name}</div>
          <div className="step"><b>{places[i]}</b><span>{r.score}</span></div>
        </div>
      ))}
    </div>
  )
}
