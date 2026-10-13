import type { Move } from '../game/moves.ts'

/** Easy AI: ignores the player completely. */
export function randomMove(moves: readonly Move[]): Move {
  return moves[Math.floor(Math.random() * moves.length)]
}
