export type Move = 'rock' | 'paper' | 'scissors' | 'lizard' | 'spock'

/** Which set of moves is in play. */
export type Mode = 'classic' | 'lizard-spock'

export const MODE_MOVES: Record<Mode, readonly Move[]> = {
  classic: ['rock', 'paper', 'scissors'],
  'lizard-spock': ['rock', 'paper', 'scissors', 'lizard', 'spock'],
}

export const MOVE_EMOJI: Record<Move, string> = {
  rock: '✊',
  paper: '✋',
  scissors: '✌️',
  lizard: '🦎',
  spock: '🖖',
}

export const MOVE_LABEL: Record<Move, string> = {
  rock: 'Rock',
  paper: 'Paper',
  scissors: 'Scissors',
  lizard: 'Lizard',
  spock: 'Spock',
}

/** How to make each move with your hand. */
export const MOVE_HAND: Record<Move, string> = {
  rock: 'Fist',
  paper: 'Open palm',
  scissors: 'Two fingers',
  lizard: 'Sock-puppet hand',
  spock: 'Vulcan salute',
}

export function isMove(value: string): value is Move {
  return (MODE_MOVES['lizard-spock'] as readonly string[]).includes(value)
}
