import { MOVE_EMOJI, MOVE_LABEL, type Move } from '../game/moves.ts'
import { shiftBetween, shiftSize, type Outcome, type Round, type Shift } from '../game/rules.ts'
import { PREDICTOR_IDS, PREDICTORS, predictorAccuracy } from './ensemble.ts'

export interface Insight {
  /** The finding, e.g. "After losing, you played ✊ Rock 80% of the time." */
  headline: string
  /** The evidence behind it, e.g. "4 of 5 times. Random would be 33%." */
  evidence: string
  /** How far from chance the finding is (a z-score); higher means more surprising. */
  strength: number
}

// Only report findings at least this far from chance, so luck isn't called a habit. Each finding
// picks the most common of several options, so a lower bar fires too often: at z ≥ 2, 44% of purely
// random players got a "habit"; at 3 it's about 4%. (5 of 5 or 8 of 10 qualifies; 7 of 10 doesn't.)
const MIN_STRENGTH = 3
const MAX_INSIGHTS = 4
// Minimum rounds behind each kind of finding.
const MIN_ROUNDS = 6
const MIN_REACTIONS = 4
const MIN_ROUNDS_FOR_PREDICTORS = 10

/** Up to four of the player's most surprising habits, strongest first. `moves` are the moves in play. */
export function habitReport(history: readonly Round[], moves: readonly Move[]): Insight[] {
  const candidates = [
    favouriteMove(history, moves),
    ...(['lose', 'win', 'draw'] as const).map((outcome) => reaction(history, moves, outcome)),
    repeats(history, moves),
    bestReader(history, moves),
  ]
  return candidates
    .filter((insight): insight is Insight => insight !== null && insight.strength >= MIN_STRENGTH)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, MAX_INSIGHTS)
}

/** How surprising `hits` out of `total` would be for a random player, who'd score `chance` of the time. */
function surprise(hits: number, total: number, chance: number) {
  return (hits - total * chance) / Math.sqrt(total * chance * (1 - chance))
}

const percent = (share: number) => `${Math.round(share * 100)}%`
const show = (move: Move) => `${MOVE_EMOJI[move]} ${MOVE_LABEL[move]}`

function finding(headline: string, hits: number, total: number, chance: number): Insight {
  return {
    headline,
    evidence: `${hits} of ${total} times. Random would be ${percent(chance)}.`,
    strength: surprise(hits, total, chance),
  }
}

function mostCommon<T extends string>(items: readonly T[]): [T, number] {
  const counts = new Map<T, number>()
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1)
  return [...counts].reduce((best, entry) => (entry[1] > best[1] ? entry : best))
}

function favouriteMove(history: readonly Round[], moves: readonly Move[]): Insight | null {
  if (history.length < MIN_ROUNDS) return null
  const [move, hits] = mostCommon(history.map((round) => round.player))
  const total = history.length
  return finding(`You threw ${show(move)} ${percent(hits / total)} of the time.`, hits, total, 1 / moves.length)
}

const AFTER: Record<Outcome, string> = { win: 'After winning', lose: 'After losing', draw: 'After a draw' }

// What each shift means in plain words, given how the previous round went. With three moves there's
// exactly one move of each kind, which allows more specific wording: after a loss, the AI's winning
// move is an upgrade from yours; after a win, its losing move is a downgrade.
const CLASSIC_PHRASE: Record<Outcome, Record<Shift, string>> = {
  win: {
    stay: 'you kept your winning move',
    upgrade: 'you switched to the move that beats your winning one',
    downgrade: 'you switched to the AI’s losing move',
  },
  lose: {
    stay: 'you stuck with your losing move',
    upgrade: 'you copied the move that just beat you',
    downgrade: 'you switched to the move that beats the one that just beat you',
  },
  draw: {
    stay: 'you played the same move again',
    upgrade: 'you switched to the move that beats it',
    downgrade: 'you switched to the move it beats',
  },
}

const FIVE_MOVE_PHRASE: Record<Outcome, Record<Shift, string>> = {
  win: {
    stay: 'you kept your winning move',
    upgrade: 'you switched to a move that beats your winning one',
    downgrade: 'you switched to a move your winning one beats',
  },
  lose: {
    stay: 'you stuck with your losing move',
    upgrade: 'you switched to a move that beats your losing one',
    downgrade: 'you switched to a move your losing one beats',
  },
  draw: {
    stay: 'you played the same move again',
    upgrade: 'you switched to a move that beats it',
    downgrade: 'you switched to a move it beats',
  },
}

/** The player's strongest reaction to a win, loss or draw: either a specific move or a kind of switch. */
function reaction(history: readonly Round[], moves: readonly Move[], outcome: Outcome): Insight | null {
  const next: Move[] = []
  const shifts: Shift[] = []
  for (let i = 1; i < history.length; i++) {
    if (history[i - 1].outcome !== outcome) continue
    next.push(history[i].player)
    shifts.push(shiftBetween(history[i - 1].player, history[i].player))
  }
  const total = next.length
  if (total < MIN_REACTIONS) return null

  const [move, moveHits] = mostCommon(next)
  const [shift, shiftHits] = mostCommon(shifts)
  const phrase = (moves.length === 3 ? CLASSIC_PHRASE : FIVE_MOVE_PHRASE)[outcome][shift]
  const bySwitch = finding(
    `${AFTER[outcome]}, ${phrase} ${percent(shiftHits / total)} of the time.`,
    shiftHits,
    total,
    shiftSize(shift, moves) / moves.length,
  )
  const byMove = finding(
    `${AFTER[outcome]}, you played ${show(move)} ${percent(moveHits / total)} of the time.`,
    moveHits,
    total,
    1 / moves.length,
  )
  // Prefer the switch when it's at least as strong: it explains the habit, not just the move.
  return bySwitch.strength >= byMove.strength ? bySwitch : byMove
}

/** Random players repeat their last move one time in three (or five); most people repeat far less, or more. */
function repeats(history: readonly Round[], moves: readonly Move[]): Insight | null {
  const total = history.length - 1
  if (total < MIN_ROUNDS) return null
  let hits = 0
  for (let i = 1; i < history.length; i++) if (history[i].player === history[i - 1].player) hits++

  const chance = 1 / moves.length
  const z = surprise(hits, total, chance)
  return {
    headline:
      z < 0
        ? `You avoid repeating yourself: only ${percent(hits / total)} of your moves matched the one before.`
        : `You like repeating yourself: ${percent(hits / total)} of your moves matched the one before.`,
    evidence: `${hits} of ${total} times. A random player repeats ${percent(chance)} of the time.`,
    strength: Math.abs(z),
  }
}

function bestReader(history: readonly Round[], moves: readonly Move[]): Insight | null {
  if (history.length < MIN_ROUNDS_FOR_PREDICTORS) return null
  const accuracy = predictorAccuracy(history, moves, history.length)
  if (!accuracy) return null
  const best = PREDICTOR_IDS.reduce((a, b) => (accuracy[b] > accuracy[a] ? b : a))
  const chance = 1 / moves.length
  return {
    headline: `${PREDICTORS[best].name} guessed your next move ${percent(accuracy[best])} of the time.`,
    evidence: `Over ${history.length} rounds. Guessing blindly gets ${percent(chance)}.`,
    strength: surprise(accuracy[best] * history.length, history.length, chance),
  }
}
