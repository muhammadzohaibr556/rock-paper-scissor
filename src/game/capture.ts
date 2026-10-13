import type { GestureReading } from '../vision/gestureRecognizer.ts'
import type { Move } from './moves.ts'

const MIN_CONFIDENCE = 0.5
// The winning move must show up in at least this share of samples, so one flickery frame can't count.
const MIN_SHARE = 0.3

/**
 * Picks the player's move from readings sampled just after "Shoot!" by majority vote, counting
 * only `moves` in play (a Lizard in classic mode isn't a move). Returns null when no move was
 * shown clearly enough.
 */
export function pickMove(samples: readonly GestureReading[], moves: readonly Move[]): Move | null {
  const counts = new Map<Move, number>()
  for (const { move, confidence } of samples) {
    if (move && moves.includes(move) && confidence >= MIN_CONFIDENCE) counts.set(move, (counts.get(move) ?? 0) + 1)
  }

  let best: Move | null = null
  let bestCount = 0
  for (const [move, count] of counts) {
    if (count > bestCount) {
      best = move
      bestCount = count
    }
  }
  return bestCount > 0 && bestCount >= samples.length * MIN_SHARE ? best : null
}
