import type { Move } from '../game/moves.ts'
import type { Round } from '../game/rules.ts'
import { analyzeEnsemble, type PredictorId } from './ensemble.ts'
import { predictFrequency } from './frequency.ts'
import { bestResponse, uniform, type Distribution } from './predictor.ts'
import { randomMove } from './random.ts'

export type DifficultyId = 'easy' | 'medium' | 'hard'

/** The AI's move plus the reasoning behind it, kept secret until the round is revealed. */
export interface AIThought {
  move: Move
  /** What the AI expected the player to throw; uniform when it wasn't predicting. */
  prediction: Distribution
  /** The predictor the move was based on; null when it played at random. */
  basedOn: PredictorId | null
  /** The moves it was choosing among. */
  moves: readonly Move[]
}

export interface Difficulty {
  id: DifficultyId
  name: string
  description: string
  /** Picks the AI's move (one of `moves`) from the rounds played so far — never from the hand it's about to face. */
  think: (history: readonly Round[], moves: readonly Move[]) => AIThought
}

export const DIFFICULTIES: readonly Difficulty[] = [
  {
    id: 'easy',
    name: 'Easy',
    description: 'Plays at random. Pure luck: it never learns your habits.',
    think: (_, moves) => ({ move: randomMove(moves), prediction: uniform(moves), basedOn: null, moves }),
  },
  {
    id: 'medium',
    name: 'Medium',
    description: 'Counters the move you play most often.',
    think: (history, moves) => {
      const prediction = predictFrequency(history, moves)
      return { move: bestResponse(prediction, moves), prediction, basedOn: 'frequency', moves }
    },
  },
  {
    id: 'hard',
    name: 'Hard',
    description:
      'Runs every predictor at once and trusts whichever has been reading you best lately. Plays at random until one proves itself.',
    think: (history, moves) => {
      const { prediction, trusted } = analyzeEnsemble(history, moves)
      return { move: bestResponse(prediction, moves), prediction, basedOn: trusted, moves }
    },
  },
]
