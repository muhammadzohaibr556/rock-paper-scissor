import { describe, expect, it } from 'vitest'
import { MODE_MOVES, type Move } from '../game/moves.ts'
import { counterTo, judge, type Round } from '../game/rules.ts'
import { habitReport } from './report.ts'

const MOVES = MODE_MOVES.classic

/** Seeded random numbers (mulberry32), so every generated history is the same on every run. */
function seededRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Builds a history where the AI plays at random and the player follows `choose`. */
function historyOf(rounds: number, choose: (history: Round[], random: () => number) => Move, seed = 1): Round[] {
  const random = seededRandom(seed)
  const pick = () => MOVES[Math.floor(random() * MOVES.length)]
  const history: Round[] = []
  for (let i = 0; i < rounds; i++) {
    const ai = pick()
    const player = choose(history, () => random())
    history.push({ player, ai, outcome: judge(player, ai) })
  }
  return history
}

const randomMove = (random: () => number) => MOVES[Math.floor(random() * MOVES.length)]

const headlines = (history: Round[]) => habitReport(history, MOVES).map((insight) => insight.headline)

describe('habitReport', () => {
  it('says nothing with too few rounds to be sure', () => {
    expect(habitReport([], MOVES)).toEqual([])
    // Even a perfectly consistent 3-round streak is too little evidence.
    expect(headlines(historyOf(3, () => 'rock'))).toEqual([])
  })

  it('reports the move played after losing (“you played rock after losing 80% of the time”)', () => {
    const history = historyOf(40, (h, random) => (h.at(-1)?.outcome === 'lose' ? 'rock' : randomMove(random)))
    expect(headlines(history)).toContainEqual(expect.stringMatching(/^After losing, you played ✊ Rock 100% of the time\.$/))
  })

  it('reports a switch habit in plain words', () => {
    // Win-stay: repeats the winning move every time.
    const history = historyOf(40, (h, random) => {
      const last = h.at(-1)
      return last?.outcome === 'win' ? last.player : randomMove(random)
    })
    expect(headlines(history)).toContainEqual(expect.stringMatching(/^After winning, you kept your winning move 100%/))
  })

  it('describes “lose-shift” as switching to what beats the move that beat you', () => {
    const history = historyOf(40, (h, random) => {
      const last = h.at(-1)
      return last?.outcome === 'lose' ? counterTo(last.ai, MOVES) : randomMove(random)
    })
    expect(headlines(history)).toContainEqual(
      expect.stringMatching(/^After losing, you switched to the move that beats the one that just beat you 100%/),
    )
  })

  it('reports a favourite move', () => {
    const history = historyOf(30, (_, random) => (random() < 0.7 ? 'paper' : randomMove(random)))
    expect(headlines(history)).toContainEqual(expect.stringMatching(/^You threw ✋ Paper \d+% of the time\.$/))
  })

  it('reports avoiding repeats', () => {
    const history = historyOf(30, (h, random) => {
      const options = MOVES.filter((move) => move !== h.at(-1)?.player)
      return options[Math.floor(random() * options.length)]
    })
    expect(headlines(history)).toContainEqual(expect.stringMatching(/^You avoid repeating yourself: only 0%/))
  })

  it('keeps at most four findings, strongest first', () => {
    const report = habitReport(historyOf(60, (h) => MOVES[h.length % 3]), MOVES)
    expect(report.length).toBeLessThanOrEqual(4)
    for (let i = 1; i < report.length; i++) expect(report[i - 1].strength).toBeGreaterThanOrEqual(report[i].strength)
  })

  it('finds nothing to say about a truly random player', () => {
    expect(headlines(historyOf(200, (_, random) => randomMove(random)))).toEqual([])
  })

  it('needs strong evidence from a small sample', () => {
    // After 4 losses, playing rock all 4 times could still be luck (z ≈ 2.8).
    const fourLosses: Round[] = [
      ...(['paper', 'scissors', 'rock', 'paper'] as const).flatMap((ai): Round[] => [
        { player: counterTo(counterTo(ai, MOVES), MOVES), ai, outcome: 'lose' },
        { player: 'rock', ai: 'rock', outcome: 'draw' },
      ]),
    ]
    expect(headlines(fourLosses).filter((h) => h.startsWith('After losing'))).toEqual([])
  })
})
