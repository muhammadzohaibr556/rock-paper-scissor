import { counts, normalize, uniform, type Distribution } from './predictor.ts'
import type { Move } from '../game/moves.ts'
import type { Round } from '../game/rules.ts'

/** "After rock, you usually play scissors": what the player threw after their previous move. */
export function predictMarkov(history: readonly Round[], moves: readonly Move[]): Distribution {
  const last = history.at(-1)
  if (!last) return uniform(moves)

  const next = counts(moves, 1)
  for (let i = 1; i < history.length; i++) {
    if (history[i - 1].player === last.player) next[history[i].player]++
  }
  return normalize(next, moves)
}
