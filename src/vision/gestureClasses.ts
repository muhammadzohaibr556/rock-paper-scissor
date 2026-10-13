export interface GestureClass {
  /** Also the model's output label; for real moves it's the Move itself. */
  id: string
  emoji: string
  label: string
  /** What to show the camera while recording it. */
  hint: string
  /** Optional classes are only trained when they have enough samples. */
  optional?: boolean
}

export const GESTURE_CLASSES: readonly GestureClass[] = [
  { id: 'rock', emoji: '✊', label: 'Rock', hint: 'A fist' },
  { id: 'paper', emoji: '✋', label: 'Paper', hint: 'An open, flat hand' },
  { id: 'scissors', emoji: '✌️', label: 'Scissors', hint: 'Index and middle finger out' },
  {
    id: 'lizard',
    emoji: '🦎',
    label: 'Lizard',
    hint: 'A sock puppet: fingers together, thumb touching them. Unlocks Lizard–Spock mode',
    optional: true,
  },
  {
    id: 'spock',
    emoji: '🖖',
    label: 'Spock',
    hint: 'Vulcan salute: fingers split between middle and ring. Unlocks Lizard–Spock mode',
    optional: true,
  },
  {
    id: 'none',
    emoji: '🤷',
    label: 'Not a move',
    hint: 'Anything else: thumbs up, pointing, a hand halfway between moves',
    optional: true,
  },
]
