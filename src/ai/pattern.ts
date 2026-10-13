import { counts, normalize, uniform, type Distribution } from './predictor.ts'
import type { Move } from '../game/moves.ts'
import type { Round } from '../game/rules.ts'

const LONGEST = 4
const SHORTEST = 2

/**
 * N-gram pattern detector: finds earlier places where the player's last few moves appeared in
 * the same order, and counts what they played next. Tries the longest pattern (4 moves) first
 * and falls back to shorter ones, down to 2 (1 move would just be the Markov predictor).
 */
export function predictPattern(history: readonly Round[], moves: readonly Move[]): Distribution {
  const played = history.map((round) => round.player)

  for (let n = Math.min(LONGEST, played.length - 1); n >= SHORTEST; n--) {
    const recent = played.slice(-n)
    const next = counts(moves, 0.5)
    let found = 0
    // Every earlier window of n moves that has a move after it.
    for (let start = 0; start + n < played.length; start++) {
      if (sameMoves(played, start, recent)) {
        next[played[start + n]]++
        found++
      }
    }
    if (found > 0) return normalize(next, moves)
  }
  return uniform(moves)
}

function sameMoves(played: readonly Move[], start: number, pattern: readonly Move[]) {
  return pattern.every((move, i) => played[start + i] === move)
}
