import { counts, normalize, uniform, type Distribution } from './predictor.ts'
import type { Move } from '../game/moves.ts'
import { shiftBetween, shiftSize, type Outcome, type Round, type Shift } from '../game/rules.ts'

// Typical human habits, as starting counts: winners tend to repeat their move ("win-stay"),
// losers tend to switch to the move that beats the one that just beat them ("lose-shift"),
// which in classic mode is a downgrade from their own last move.
const PRIOR: Record<Outcome, Record<Shift, number>> = {
  win: { stay: 2, upgrade: 1, downgrade: 1 },
  lose: { stay: 1, upgrade: 1, downgrade: 2 },
  draw: { stay: 1, upgrade: 1, downgrade: 1 },
}

/**
 * Predicts from how the player reacts to winning, losing or drawing. Starts from typical human
 * habits and learns this player's own reactions as rounds are played.
 */
export function predictPsychology(history: readonly Round[], moves: readonly Move[]): Distribution {
  const last = history.at(-1)
  if (!last) return uniform(moves)

  const shifts = { ...PRIOR[last.outcome] }
  for (let i = 1; i < history.length; i++) {
    const before = history[i - 1]
    if (before.outcome === last.outcome) shifts[shiftBetween(before.player, history[i].player)]++
  }

  // With five moves, an upgrade or downgrade could be either of two moves: split it between them.
  const next = counts(moves)
  for (const move of moves) {
    const shift = shiftBetween(last.player, move)
    next[move] = shifts[shift] / shiftSize(shift, moves)
  }
  return normalize(next, moves)
}
