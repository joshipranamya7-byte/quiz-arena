let ctx
let muted = localStorage.getItem('muted') === '1'

export const isMuted = () => muted
export const setMuted = (m) => {
  muted = m
  localStorage.setItem('muted', m ? '1' : '0')
}

function beep(freq, dur = 0.12, type = 'sine', vol = 0.12) {
  if (muted) return
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.value = freq
    g.gain.value = vol
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur)
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + dur)
  } catch { /* audio unavailable */ }
}

export const sfx = {
  join: () => beep(660),
  tick: () => beep(880, 0.05, 'square', 0.04),
  start: () => { beep(440); setTimeout(() => beep(660), 100) },
  correct: () => { beep(523); setTimeout(() => beep(784, 0.2), 110) },
  wrong: () => beep(160, 0.3, 'sawtooth', 0.1)
}
