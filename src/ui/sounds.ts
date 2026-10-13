/** Little synthesized sound effects (Web Audio API), so there are no audio files to ship. */
export type Sound = 'tick' | 'shoot' | 'win' | 'lose' | 'draw' | 'missed' | 'match-win' | 'match-lose'

/** [frequency in Hz, start in s, duration in s] */
type Note = [number, number, number]

const TUNES: Record<Sound, { wave: OscillatorType; notes: Note[] }> = {
  tick: { wave: 'triangle', notes: [[660, 0, 0.08]] },
  shoot: { wave: 'square', notes: [[990, 0, 0.14]] },
  win: { wave: 'triangle', notes: [[523, 0, 0.12], [659, 0.1, 0.12], [784, 0.2, 0.22]] },
  lose: { wave: 'triangle', notes: [[392, 0, 0.14], [330, 0.13, 0.14], [262, 0.26, 0.3]] },
  draw: { wave: 'triangle', notes: [[440, 0, 0.1], [440, 0.15, 0.12]] },
  missed: { wave: 'sine', notes: [[220, 0, 0.25]] },
  'match-win': {
    wave: 'triangle',
    notes: [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.1], [1047, 0.3, 0.45]],
  },
  'match-lose': {
    wave: 'sawtooth',
    notes: [[330, 0, 0.22], [311, 0.24, 0.22], [294, 0.48, 0.22], [277, 0.72, 0.6]],
  },
}

const MUTED_KEY = 'rps.muted'
let context: AudioContext | null = null
let muted = loadMuted()

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === '1'
  } catch {
    return false
  }
}

export function isMuted() {
  return muted
}

/** Mutes or unmutes every sound, and remembers it for next time. */
export function setMuted(value: boolean) {
  muted = value
  try {
    localStorage.setItem(MUTED_KEY, value ? '1' : '0')
  } catch {
    // Not remembered next time; the toggle still works now.
  }
}

export function playSound(sound: Sound) {
  if (muted) return
  try {
    // Browsers only let audio start after the user has interacted with the page, which pressing
    // Start / Space already counts as.
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume()
    const { wave, notes } = TUNES[sound]
    const now = context.currentTime
    for (const [frequency, start, duration] of notes) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = wave
      oscillator.frequency.value = frequency
      // Quick fade in and out, so notes don't click.
      gain.gain.setValueAtTime(0, now + start)
      gain.gain.linearRampToValueAtTime(0.18, now + start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(now + start)
      oscillator.stop(now + start + duration + 0.02)
    }
  } catch {
    // No Web Audio (or it's blocked): play silently.
  }
}
