/**
 * Sound + vibration for scan results, so staff don't need to look at the
 * screen: rising beep = OK, double beep = check the warning, low buzz = invalid.
 * Browsers only allow sound after a user gesture — `unlockAudio` is called
 * from the first tap (camera button, any button on the scan page).
 */
let ctx: AudioContext | undefined

export function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    /* no Web Audio */
  }
}

function tone(freq: number, at: number, duration: number, type: OscillatorType = 'sine') {
  if (!ctx || ctx.state !== 'running') return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  const t0 = ctx.currentTime + at
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

export function scanFeedback(kind: 'ok' | 'warn' | 'error') {
  if (kind === 'ok') {
    navigator.vibrate?.(120)
    tone(880, 0, 0.12)
    tone(1320, 0.12, 0.16)
  } else if (kind === 'warn') {
    navigator.vibrate?.([80, 60, 80])
    tone(660, 0, 0.12)
    tone(660, 0.18, 0.12)
  } else {
    navigator.vibrate?.([200, 80, 200])
    tone(180, 0, 0.35, 'square')
  }
}
