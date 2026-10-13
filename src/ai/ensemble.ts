import type { Move } from '../game/moves.ts'
import { judge, type Round } from '../game/rules.ts'
import { predictFrequency } from './frequency.ts'
import { predictMarkov } from './markov.ts'
import { predictPattern } from './pattern.ts'
import { bestResponses, topGuesses, uniform, type Distribution, type Predictor } from './predictor.ts'
import { predictPsychology } from './psychology.ts'

export type PredictorId = 'frequency' | 'markov' | 'pattern' | 'psychology'

export const PREDICTORS: Record<PredictorId, { name: string; predict: Predictor }> = {
  frequency: { name: 'Frequency', predict: predictFrequency },
  markov: { name: 'Markov chain', predict: predictMarkov },
  pattern: { name: 'Pattern detector', predict: predictPattern },
  psychology: { name: 'Psychology', predict: predictPsychology },
}

export const PREDICTOR_IDS = Object.keys(PREDICTORS) as PredictorId[]

// Each round further back counts 0.85× as much, so roughly the last 10 rounds decide who's trusted
// and the ensemble switches quickly when the player changes style.
const DECAY = 0.85
// Older rounds would weigh almost nothing (0.85^40 ≈ 0.002), so don't spend time replaying them.
const LOOKBACK = 40

export interface EnsembleAnalysis {
  /** Each predictor's recent record: decayed sum of +1 / 0 / −1 for how following its advice would have gone. */
  scores: Record<PredictorId, number>
  /** The predictor with the best recent record, or null while none is doing better than chance. */
  trusted: PredictorId | null
  /** What the trusted predictor expects next; uniform (a random move) when trusting nobody. */
  prediction: Distribution
}

export function analyzeEnsemble(history: readonly Round[], moves: readonly Move[]): EnsembleAnalysis {
  const scores: Record<PredictorId, number> = { frequency: 0, markov: 0, pattern: 0, psychology: 0 }
  for (let i = Math.max(0, history.length - LOOKBACK); i < history.length; i++) {
    const weight = DECAY ** (history.length - 1 - i)
    const before = history.slice(0, i)
    for (const id of PREDICTOR_IDS) {
      scores[id] += weight * advicePayoff(PREDICTORS[id].predict(before, moves), history[i].player, moves)
    }
  }

  let trusted: PredictorId | null = null
  for (const id of PREDICTOR_IDS) {
    if (scores[id] > (trusted ? scores[trusted] : 0)) trusted = id
  }
  return { scores, trusted, prediction: trusted ? PREDICTORS[trusted].predict(history, moves) : uniform(moves) }
}

export const predictEnsemble: Predictor = (history, moves) => analyzeEnsemble(history, moves).prediction

/**
 * How often each predictor's top guess matched the player's actual move over the last `window`
 * rounds (a tie between k guesses that includes the right one counts 1/k, so chance is one in
 * however many moves are in play).
 * Null before any rounds have been played.
 */
export function predictorAccuracy(
  history: readonly Round[],
  moves: readonly Move[],
  window = 20,
): Record<PredictorId, number> | null {
  const start = Math.max(0, history.length - window)
  const rounds = history.length - start
  if (rounds === 0) return null

  const hits: Record<PredictorId, number> = { frequency: 0, markov: 0, pattern: 0, psychology: 0 }
  for (let i = start; i < history.length; i++) {
    const before = history.slice(0, i)
    for (const id of PREDICTOR_IDS) {
      const guesses = topGuesses(PREDICTORS[id].predict(before, moves), moves)
      if (guesses.includes(history[i].player)) hits[id] += 1 / guesses.length
    }
  }
  for (const id of PREDICTOR_IDS) hits[id] /= rounds
  return hits
}

/** How the AI would have done playing the best response to `prediction`, averaged over ties. */
function advicePayoff(prediction: Distribution, actual: Move, moves: readonly Move[]): number {
  const responses = bestResponses(prediction, moves)
  let total = 0
  for (const ai of responses) {
    const outcome = judge(actual, ai)
    total += outcome === 'lose' ? 1 : outcome === 'win' ? -1 : 0
  }
  return total / responses.length
}
