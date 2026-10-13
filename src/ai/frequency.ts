import { counts, normalize, type Distribution } from './predictor.ts'
import type { Move } from '../game/moves.ts'
import type { Round } from '../game/rules.ts'

/** "You play rock 45% of the time": how often the player has thrown each move overall. */
export function predictFrequency(history: readonly Round[], moves: readonly Move[]): Distribution {
  // Start every count at 1 so the first few rounds don't swing the prediction wildly.
  const seen = counts(moves, 1)
  for (const round of history) seen[round.player]++
  return normalize(seen, moves)
}
