import type { Move } from '../game/moves.ts'
import { beats, type Round } from '../game/rules.ts'

/** Probability of each move. Moves in play sum to 1; moves not in play are 0. */
export type Distribution = Record<Move, number>

/**
 * Predicts how likely the player is to throw each move in play next, from every scored round
 * so far (oldest first). Predictors are pure functions, so the ensemble can replay history to score them.
 */
export type Predictor = (history: readonly Round[], moves: readonly Move[]) => Distribution

/** A count (or probability) of `start` for each move in play, 0 for the rest. */
export function counts(moves: readonly Move[], start = 0): Distribution {
  const result: Distribution = { rock: 0, paper: 0, scissors: 0, lizard: 0, spock: 0 }
  for (const move of moves) result[move] = start
  return result
}

/** No idea: every move in play equally likely. */
export function uniform(moves: readonly Move[]): Distribution {
  return counts(moves, 1 / moves.length)
}

export function normalize(raw: Distribution, moves: readonly Move[]): Distribution {
  const total = moves.reduce((sum, move) => sum + raw[move], 0)
  if (total <= 0) return uniform(moves)
  const result = counts(moves)
  for (const move of moves) result[move] = raw[move] / total
  return result
}

/** The move(s) the prediction considers most likely; all of them when it has no idea. */
export function topGuesses(prediction: Distribution, moves: readonly Move[]): Move[] {
  const top = Math.max(...moves.map((move) => prediction[move]))
  return moves.filter((move) => top - prediction[move] < 1e-9)
}

/** The AI moves with the best expected score against `prediction` (+1 per win, −1 per loss). */
export function bestResponses(prediction: Distribution, moves: readonly Move[]): Move[] {
  const value = (ai: Move) =>
    moves.reduce((sum, player) => sum + (beats(ai, player) ? 1 : beats(player, ai) ? -1 : 0) * prediction[player], 0)
  const best = Math.max(...moves.map(value))
  return moves.filter((move) => best - value(move) < 1e-9)
}

/** One of the best responses; ties are broken at random, so a uniform prediction means a random move. */
export function bestResponse(
  prediction: Distribution,
  moves: readonly Move[],
  random: () => number = Math.random,
): Move {
  const candidates = bestResponses(prediction, moves)
  return candidates[Math.floor(random() * candidates.length)]
}
