import type { Move } from '../game/moves.ts'

/**
 * A commit–reveal proof: the hash is published before the round, the move and secret after.
 * If the AI changed its move after seeing the player's hand, the hash would no longer match.
 */
export interface Commitment {
  move: Move
  /** Random salt. Without it there would be only 3 possible hashes, which would give the move away. */
  secret: string
  /** Hex SHA-256 of revealText(move, secret). */
  hash: string
}

export async function commit(move: Move): Promise<Commitment> {
  const secret = toHex(crypto.getRandomValues(new Uint8Array(16)))
  return { move, secret, hash: await sha256Hex(revealText(move, secret)) }
}

export async function verify({ move, secret, hash }: Commitment): Promise<boolean> {
  return (await sha256Hex(revealText(move, secret))) === hash
}

/** The exact text that gets hashed, e.g. "rock:5f1c0e…". */
export function revealText(move: Move, secret: string) {
  return `${move}:${secret}`
}

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return toHex(new Uint8Array(digest))
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}
