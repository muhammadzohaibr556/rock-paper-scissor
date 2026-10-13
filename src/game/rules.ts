import type { Move } from './moves.ts'

/** Round outcome from the player's point of view. */
export type Outcome = 'win' | 'lose' | 'draw'

export interface Round {
  player: Move
  ai: Move
  outcome: Outcome
}

export interface Score {
  player: number
  ai: number
  draws: number
}

/** First to 3 round wins takes the match (best of 5, draws don't count). */
export const WINS_NEEDED = 3

// Each move, the two it beats, and how. Classic mode simply never uses Lizard or Spock,
// which leaves the usual rock → scissors → paper → rock cycle.
const BEATS: Record<Move, Partial<Record<Move, string>>> = {
  rock: { scissors: 'crushes', lizard: 'crushes' },
  paper: { rock: 'covers', spock: 'disproves' },
  scissors: { paper: 'cuts', lizard: 'decapitates' },
  lizard: { spock: 'poisons', paper: 'eats' },
  spock: { scissors: 'smashes', rock: 'vaporizes' },
}

export function beats(winner: Move, loser: Move): boolean {
  return loser in BEATS[winner]
}

/** How `winner` beats `loser`, e.g. "crushes". */
export function verb(winner: Move, loser: Move): string {
  return BEATS[winner][loser] ?? 'beats'
}

export function judge(player: Move, ai: Move): Outcome {
  if (beats(player, ai)) return 'win'
  if (beats(ai, player)) return 'lose'
  return 'draw'
}

/** The moves in play that beat `move`. */
export function movesThatBeat(move: Move, moves: readonly Move[]): Move[] {
  return moves.filter((other) => beats(other, move))
}

/** A move in play that beats `move` (the first one, when two do). */
export function counterTo(move: Move, moves: readonly Move[]): Move {
  return movesThatBeat(move, moves)[0]
}

/**
 * How a player's next move relates to their previous one: the same move, a move that beats it
 * ("upgrade"), or a move it beats ("downgrade"). With three moves each kind is one move; with five,
 * upgrade and downgrade are two moves each.
 */
export type Shift = 'stay' | 'upgrade' | 'downgrade'

export function shiftBetween(from: Move, to: Move): Shift {
  if (to === from) return 'stay'
  return beats(to, from) ? 'upgrade' : 'downgrade'
}

/** How many of the moves in play a shift covers. */
export function shiftSize(shift: Shift, moves: readonly Move[]): number {
  return shift === 'stay' ? 1 : (moves.length - 1) / 2
}

export function addToScore(score: Score, outcome: Outcome): Score {
  switch (outcome) {
    case 'win':
      return { ...score, player: score.player + 1 }
    case 'lose':
      return { ...score, ai: score.ai + 1 }
    case 'draw':
      return { ...score, draws: score.draws + 1 }
  }
}

export function matchWinner(score: Score): 'player' | 'ai' | null {
  if (score.player >= WINS_NEEDED) return 'player'
  if (score.ai >= WINS_NEEDED) return 'ai'
  return null
}
