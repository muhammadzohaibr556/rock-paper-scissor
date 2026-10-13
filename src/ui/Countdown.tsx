import { COUNTDOWN } from '../game/useGame.ts'

export function Countdown({ beat }: { beat: number }) {
  const isShoot = beat === COUNTDOWN.length - 1
  return (
    // Keyed by beat so the pop-in animation replays for every word.
    <div key={beat} className={`countdown${isShoot ? ' countdown--shoot' : ''}`} aria-live="assertive">
      {COUNTDOWN[beat]}
    </div>
  )
}
