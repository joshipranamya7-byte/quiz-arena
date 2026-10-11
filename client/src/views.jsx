import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { SAMPLE } from './sample.js'
import { quizApi } from './api.js'
import { sfx } from './sound.js'
import { Timer, Leaderboard, Podium, celebrate } from './components.jsx'

const COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c']
const SHAPES = ['▲', '◆', '●', '■']

export function Home({ onJoin, onHost }) {
  const [code, setCode] = useState(new URLSearchParams(location.search).get('code') || '')
  const [name, setName] = useState('')
  return (
    <section className="hero">
      <h1 className="logo">Quiz <span>Arena</span></h1>
      <p className="tag">Live multiplayer quizzes. Join with a code, answer fast, climb the board.</p>
      <div className="glass">
        <input placeholder="GAME CODE" value={code} maxLength={5} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <input placeholder="Your name" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
        <button className="big" disabled={code.length !== 5 || !name.trim()} onClick={() => onJoin(code, name.trim())}>Join game</button>
      </div>
      <button className="ghost" onClick={onHost}>Host your own quiz</button>
    </section>
  )
}

function clean(quiz) {
  const questions = []
  for (const [n, q] of quiz.questions.entries()) {
    const opts = q.options.map((t, i) => ({ t: t.trim(), i })).filter((o) => o.t)
    if (!q.text.trim()) return `Question ${n + 1} needs text`
    if (opts.length < 2) return `Question ${n + 1} needs at least 2 options`
    if (!opts.some((o) => o.i === q.correct)) return `Question ${n + 1}: pick a filled option as correct`
    questions.push({ text: q.text.trim(), options: opts.map((o) => o.t), correct: opts.findIndex((o) => o.i === q.correct), seconds: q.seconds })
  }
  if (!quiz.title.trim()) return 'Give your quiz a title'
  return { title: quiz.title.trim(), questions }
}

export function Create({ onCreate, onBack }) {
  const [quiz, setQuiz] = useState(SAMPLE)
  const [saved, setSaved] = useState([])
  const [note, setNote] = useState('')
  const refresh = () => quizApi.list().then(setSaved).catch(() => {})
  useEffect(() => { refresh() }, [])

  const setQ = (i, patch) => setQuiz((q) => ({ ...q, questions: q.questions.map((x, j) => (j === i ? { ...x, ...patch } : x)) }))
  const setOpt = (i, k, v) => setQ(i, { options: quiz.questions[i].options.map((o, j) => (j === k ? v : o)) })
  const add = () => setQuiz((q) => ({ ...q, questions: [...q.questions, { text: '', options: ['', '', '', ''], correct: 0, seconds: 15 }] }))
  const remove = (i) => setQuiz((q) => ({ ...q, questions: q.questions.filter((_, j) => j !== i) }))
  const build = (then) => {
    const out = clean(quiz)
    if (typeof out === 'string') return setNote(out)
    setNote('')
    then(out)
  }
  const load = (s) => setQuiz({ title: s.title, questions: s.questions.map((q) => ({ ...q, options: [...q.options, '', '', ''].slice(0, 4) })) })

  return (
    <section className="create">
      {saved.length > 0 && (
        <div className="glass library">
          <h3>My saved quizzes</h3>
          {saved.map((s) => (
            <div key={s.id} className="optrow">
              <span className="grow">{s.title} · {s.questions.length} questions</span>
              <button className="ghost" onClick={() => load(s)}>Load</button>
              <button className="ghost" onClick={() => quizApi.remove(s.id).then(refresh)}>Delete</button>
            </div>
          ))}
        </div>
      )}
      <input className="title" value={quiz.title} onChange={(e) => setQuiz({ ...quiz, title: e.target.value })} />
      {quiz.questions.map((q, i) => (
        <div className="glass qcard" key={i}>
          <input placeholder={`Question ${i + 1}`} value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} />
          {q.options.map((o, k) => (
            <label key={k} className="optrow">
              <input type="radio" checked={q.correct === k} onChange={() => setQ(i, { correct: k })} />
              <span className="swatch" style={{ background: COLORS[k] }}>{SHAPES[k]}</span>
              <input placeholder={`Option ${k + 1}`} value={o} onChange={(e) => setOpt(i, k, e.target.value)} />
            </label>
          ))}
          <div className="optrow">
            <span>Seconds</span>
            <input type="number" min={5} max={60} value={q.seconds} onChange={(e) => setQ(i, { seconds: Number(e.target.value) })} />
            <button className="ghost" onClick={() => remove(i)} disabled={quiz.questions.length === 1}>Remove</button>
          </div>
        </div>
      ))}
      {note && <p className="note">{note}</p>}
      <div className="actions">
        <button className="ghost" onClick={onBack}>Back</button>
        <button className="ghost" onClick={add}>Add question</button>
        <button className="ghost" onClick={() => build((out) => quizApi.save(out).then(refresh).then(() => setNote('Saved')).catch((e) => setNote(e.message)))}>Save to library</button>
        <button className="big" onClick={() => build(onCreate)}>Create game</button>
      </div>
    </section>
  )
}

function Final({ s, me, host, act, onLeave }) {
  const top = s.leaderboard
  useEffect(() => { if (host || (me && me.rank <= 3)) setTimeout(() => celebrate(true), 400) }, [])
  return (
    <section className="center">
      <h2>{host ? 'Final results' : `You finished #${me?.rank}`}</h2>
      <Podium rows={top} />
      <Leaderboard rows={top} meId={me?.id} />
      {host && (
        <div className="actions">
          <button className="ghost" onClick={onLeave}>New quiz</button>
          <button className="big" onClick={() => act('host:reset')}>Play again</button>
        </div>
      )}
    </section>
  )
}

export function Host({ s, act, offset, onLeave }) {
  useEffect(() => { if (s.phase === 'lobby') sfx.join() }, [s.players.length])
  useEffect(() => { if (s.phase === 'question') sfx.start() }, [s.index, s.phase])
  if (s.phase === 'lobby') {
    const url = `${location.origin}/?code=${s.code}`
    return (
      <section className="center">
        <p className="small">{s.title}</p>
        <div className="lobby">
          <div className="glass joinbox">
            <p>Join with code</p>
            <h1 className="code">{s.code}</h1>
            <div className="qr"><QRCodeSVG value={url} size={150} /></div>
            <p className="small">{url}</p>
          </div>
          <div className="glass players">
            <h3>{s.players.length} {s.players.length === 1 ? 'player' : 'players'}</h3>
            <div className="chips">
              {s.players.map((p) => (
                <span key={p.id} className={p.connected ? '' : 'off'}>{p.name}<button onClick={() => act('host:kick', p.id)} title="Remove">×</button></span>
              ))}
              {!s.players.length && <em className="small">Waiting for players...</em>}
            </div>
          </div>
        </div>
        <button className="big" disabled={!s.players.length} onClick={() => act('host:start')}>Start game</button>
      </section>
    )
  }
  if (s.phase === 'end') return <Final s={s} host act={act} onLeave={onLeave} />
  const q = s.question
  const revealed = s.phase === 'reveal'
  return (
    <section key={s.index} className="slide">
      <div className="meta">Question {s.index + 1} / {s.total} · {s.answered}/{s.players.length} answered</div>
      <div className="qhead">
        <h2>{q.text}</h2>
        {!revealed && <Timer endsAt={s.endsAt} seconds={q.seconds} offset={offset} />}
      </div>
      <div className="opts">
        {q.options.map((o, i) => (
          <div key={i} className={'opt' + (revealed && i !== q.correct ? ' dim' : '')} style={{ background: COLORS[i] }}>
            <span>{SHAPES[i]} {o}</span>{revealed && <b>{q.counts[i]}</b>}
          </div>
        ))}
      </div>
      {revealed ? (
        <>
          <Leaderboard rows={s.leaderboard} />
          <button className="big" onClick={() => act('host:next')}>{s.index + 1 === s.total ? 'Finish' : 'Next question'}</button>
        </>
      ) : <button className="ghost" onClick={() => act('host:reveal')}>Skip timer</button>}
    </section>
  )
}

function Reveal({ s, me }) {
  const r = me?.last
  useEffect(() => {
    if (r?.correct) { sfx.correct(); celebrate() } else sfx.wrong()
  }, [s.index])
  const kind = r?.correct ? 'ok' : r?.choice === null ? 'late' : 'bad'
  return (
    <section className={`center reveal ${kind}`}>
      <h1>{kind === 'ok' ? 'Correct!' : kind === 'late' ? "Time's up" : 'Not quite'}</h1>
      <h2>+{r?.points ?? 0}</h2>
      <p>Rank #{me?.rank} · {me?.score} pts{me?.streak > 1 ? ` · 🔥 ${me.streak} streak` : ''}</p>
      <p className="small">Answer: {s.question.options[s.question.correct]}</p>
    </section>
  )
}

export function Player({ s, me, act, offset }) {
  if (s.phase === 'lobby') return <section className="center"><h2>You're in, {me?.name}!</h2><p>Look at the big screen. The host will start soon.</p></section>
  if (s.phase === 'end') return <Final s={s} me={me} />
  if (s.phase === 'reveal') return <Reveal s={s} me={me} />
  const q = s.question
  if (me?.answered) return <section className="center"><h2>Locked in</h2><p>Waiting for others...</p></section>
  return (
    <section key={s.index} className="slide">
      <div className="qhead">
        <h2>{q.text}</h2>
        <Timer endsAt={s.endsAt} seconds={q.seconds} offset={offset} />
      </div>
      <div className="opts big">
        {q.options.map((o, i) => (
          <button key={i} className="opt" style={{ background: COLORS[i] }} onClick={() => act('player:answer', i)}>{SHAPES[i]} {o}</button>
        ))}
      </div>
    </section>
  )
}
