import { describe, expect, it } from 'vitest'
import { MODE_MOVES, type Move } from '../game/moves.ts'
import { counterTo, judge, verb, type Round } from '../game/rules.ts'
import { analyzeEnsemble, predictEnsemble, predictorAccuracy } from './ensemble.ts'
import { predictFrequency } from './frequency.ts'
import { predictMarkov } from './markov.ts'
import { predictPattern } from './pattern.ts'
import { bestResponse, counts, uniform, type Distribution, type Predictor } from './predictor.ts'
import { predictPsychology } from './psychology.ts'

const RPS = MODE_MOVES.classic
const RPSLS = MODE_MOVES['lizard-spock']

const PREDICTORS: Record<string, Predictor> = {
  frequency: predictFrequency,
  markov: predictMarkov,
  pattern: predictPattern,
  psychology: predictPsychology,
  ensemble: predictEnsemble,
}

/** Seeded random numbers (mulberry32), so every simulation plays out the same way on every run. */
function seededRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A scripted player. Like a real one, it only sees past rounds, never the AI's current move. */
type Player = (history: readonly Round[], random: () => number) => Move

/** Plays the predictor-driven AI against `player` and returns every round. */
function playRounds(predict: Predictor, player: Player, rounds = 300, seed = 42, moves = RPS): Round[] {
  const random = seededRandom(seed)
  const history: Round[] = []
  for (let i = 0; i < rounds; i++) {
    const ai = bestResponse(predict(history, moves), moves, random)
    const move = player(history, random)
    history.push({ player: move, ai, outcome: judge(move, ai) })
  }
  return history
}

/** Share of rounds the AI won (outcomes are from the player's side, so 'lose' is an AI win). */
function aiWinShare(rounds: readonly Round[]) {
  return rounds.filter((round) => round.outcome === 'lose').length / rounds.length
}

function aiWinRate(predict: Predictor, player: Player, rounds = 300, seed = 42, moves = RPS) {
  return aiWinShare(playRounds(predict, player, rounds, seed, moves))
}

const randomMove = (random: () => number, moves = RPS) => moves[Math.floor(random() * moves.length)]

const randomPlayer: Player = (_, random) => randomMove(random)

// Rock 60% of the time, paper and scissors 20% each.
const rockLover: Player = (_, random) => {
  const r = random()
  return r < 0.6 ? 'rock' : r < 0.8 ? 'paper' : 'scissors'
}

// rock → paper → scissors → rock → …
const cycler: Player = (history) => RPS[history.length % RPS.length]

// Every move is followed by two different moves equally often, so one-move memory isn't enough.
const SEQUENCE: Move[] = ['rock', 'rock', 'paper', 'scissors', 'scissors', 'paper']
const sequencePlayer: Player = (history) => SEQUENCE[history.length % SEQUENCE.length]

// Repeats after winning, switches to what would have beaten the AI after losing, random after a draw.
const winStayLoseShift: Player = (history, random) => {
  const last = history.at(-1)
  if (!last || last.outcome === 'draw') return randomMove(random)
  return last.outcome === 'win' ? last.player : counterTo(last.ai, RPS)
}

// Favours rock for 150 rounds, then switches to the 6-move sequence.
const styleSwitcher: Player = (history, random) =>
  history.length < 150 ? rockLover(history, random) : sequencePlayer(history, random)

function someHistory(length: number, seed = 7): Round[] {
  const random = seededRandom(seed)
  return Array.from({ length }, () => {
    const player = randomMove(random)
    const ai = randomMove(random)
    return { player, ai, outcome: judge(player, ai) }
  })
}

/** A classic-mode prediction. */
const rps = (values: Partial<Distribution>): Distribution => ({ ...counts(RPS), ...values })

describe('bestResponse', () => {
  it('counters the most likely move', () => {
    expect(bestResponse(rps({ rock: 0.6, paper: 0.2, scissors: 0.2 }), RPS)).toBe('paper')
    expect(bestResponse(rps({ rock: 0.1, paper: 0.1, scissors: 0.8 }), RPS)).toBe('rock')
  })

  it('weighs the risk of losing, not just the top guess', () => {
    // Paper beats the likeliest move (rock) but almost as often loses to scissors.
    // Rock beats scissors and only loses to the unlikely paper, so it's the better bet.
    expect(bestResponse(rps({ rock: 0.4, paper: 0.21, scissors: 0.39 }), RPS)).toBe('rock')
    expect(bestResponse(rps({ rock: 0.45, paper: 0.1, scissors: 0.45 }), RPS)).toBe('rock')
  })

  it('picks at random when it has no idea', () => {
    expect(bestResponse(uniform(RPS), RPS, () => 0)).toBe('rock')
    expect(bestResponse(uniform(RPS), RPS, () => 0.5)).toBe('paper')
    expect(bestResponse(uniform(RPS), RPS, () => 0.99)).toBe('scissors')
  })
})

describe.each(Object.entries(PREDICTORS))('%s predictor', (_, predict) => {
  it('has no opinion before any rounds are played', () => {
    expect(predict([], RPS)).toEqual(uniform(RPS))
  })

  it('always returns probabilities that sum to 1', () => {
    for (const length of [1, 2, 5, 30]) {
      const p = predict(someHistory(length), RPS)
      expect(p.rock + p.paper + p.scissors).toBeCloseTo(1)
      for (const move of RPS) expect(p[move]).toBeGreaterThan(0)
      expect(p.lizard + p.spock).toBe(0)
    }
  })

  it('cannot exploit a truly random player', () => {
    const rate = aiWinRate(predict, randomPlayer, 900)
    expect(rate).toBeGreaterThan(0.27)
    expect(rate).toBeLessThan(0.4)
  })
})

describe('frequency predictor', () => {
  it('beats a player who favours rock', () => {
    expect(aiWinRate(predictFrequency, rockLover)).toBeGreaterThan(0.5)
  })

  it('is blind to order: a simple cycle fools it', () => {
    expect(aiWinRate(predictFrequency, cycler)).toBeLessThan(0.4)
  })
})

describe('markov predictor', () => {
  it('beats a player who cycles rock → paper → scissors', () => {
    expect(aiWinRate(predictMarkov, cycler)).toBeGreaterThan(0.9)
  })

  it('beats a player who favours rock', () => {
    expect(aiWinRate(predictMarkov, rockLover)).toBeGreaterThan(0.45)
  })
})

describe('pattern predictor', () => {
  it('beats a repeating 6-move sequence', () => {
    expect(aiWinRate(predictPattern, sequencePlayer)).toBeGreaterThan(0.9)
  })

  it('sees what one-move memory (Markov) cannot', () => {
    const pattern = aiWinRate(predictPattern, sequencePlayer)
    const markov = aiWinRate(predictMarkov, sequencePlayer)
    expect(markov).toBeLessThan(0.6)
    expect(pattern - markov).toBeGreaterThan(0.3)
  })

  it('beats a player who cycles rock → paper → scissors', () => {
    expect(aiWinRate(predictPattern, cycler)).toBeGreaterThan(0.9)
  })
})

describe('psychology predictor', () => {
  it('beats a win-stay / lose-shift player', () => {
    expect(aiWinRate(predictPsychology, winStayLoseShift)).toBeGreaterThan(0.5)
  })

  it('expects a winner to repeat their move before it has learned anything', () => {
    const p = predictPsychology([{ player: 'rock', ai: 'scissors', outcome: 'win' }], RPS)
    expect(p.rock).toBeGreaterThan(p.paper)
    expect(p.rock).toBeGreaterThan(p.scissors)
  })

  it('expects a loser to switch to what beats the AI’s last move', () => {
    // Player lost with rock to paper; scissors would beat paper.
    const p = predictPsychology([{ player: 'rock', ai: 'paper', outcome: 'lose' }], RPS)
    expect(p.scissors).toBeGreaterThan(p.rock)
    expect(p.scissors).toBeGreaterThan(p.paper)
  })
})

describe('ensemble predictor', () => {
  it.each([
    ['favours rock', rockLover, 0.45],
    ['cycles rock → paper → scissors', cycler, 0.9],
    ['repeats a 6-move sequence', sequencePlayer, 0.9],
    ['plays win-stay / lose-shift', winStayLoseShift, 0.9],
  ] as const)('beats a player who %s', (_, player, minWinRate) => {
    expect(aiWinRate(predictEnsemble, player)).toBeGreaterThan(minWinRate)
  })

  it('trusts nobody before any predictor has proven itself', () => {
    expect(analyzeEnsemble([], RPS).trusted).toBeNull()
  })

  it('trusts the predictor that reads the player best', () => {
    // Only the pattern detector can follow the 6-move sequence (see the Markov comparison above).
    expect(analyzeEnsemble(playRounds(predictEnsemble, sequencePlayer, 30), RPS).trusted).toBe('pattern')
  })

  it('adapts when the player changes style', () => {
    const rounds = playRounds(predictEnsemble, styleSwitcher, 300)
    // The switch happens at round 150; give it 20 rounds to catch on.
    expect(aiWinShare(rounds.slice(170))).toBeGreaterThan(0.9)
  })
})

describe('predictorAccuracy', () => {
  it('has nothing to report before any rounds', () => {
    expect(predictorAccuracy([], RPS)).toBeNull()
  })

  it('shows which predictor reads the player', () => {
    const accuracy = predictorAccuracy(playRounds(predictEnsemble, sequencePlayer, 60), RPS)!
    expect(accuracy.pattern).toBeGreaterThan(0.95)
    expect(accuracy.frequency).toBeLessThan(0.5)
  })

  it('sits near chance (1/3) against a random player', () => {
    const accuracy = predictorAccuracy(playRounds(predictEnsemble, randomPlayer, 500), RPS, 500)!
    for (const value of Object.values(accuracy)) {
      expect(value).toBeGreaterThan(0.25)
      expect(value).toBeLessThan(0.42)
    }
  })
})

describe('Rock-Paper-Scissors-Lizard-Spock', () => {
  it('every move beats exactly two others and loses to the other two', () => {
    for (const a of RPSLS) {
      const results = RPSLS.filter((b) => b !== a).map((b) => judge(a, b))
      expect(results.filter((r) => r === 'win')).toHaveLength(2)
      expect(results.filter((r) => r === 'lose')).toHaveLength(2)
    }
  })

  it('says how each move wins', () => {
    expect(verb('spock', 'rock')).toBe('vaporizes')
    expect(verb('lizard', 'paper')).toBe('eats')
    expect(verb('scissors', 'lizard')).toBe('decapitates')
  })

  it('picks the move that beats both likeliest moves', () => {
    // Rock or scissors are likely: paper beats rock but loses to scissors; Spock beats both.
    const prediction = { ...counts(RPSLS), rock: 0.45, scissors: 0.45, paper: 0.05, lizard: 0.025, spock: 0.025 }
    expect(bestResponse(prediction, RPSLS)).toBe('spock')
  })

  const randomFiveMovePlayer: Player = (_, random) => randomMove(random, RPSLS)
  const fiveMoveCycle: Player = (history) => RPSLS[history.length % RPSLS.length]

  it.each(Object.entries(PREDICTORS))('%s predicts over all five moves and can’t exploit randomness', (_, predict) => {
    const p = predict(playRounds(predict, randomFiveMovePlayer, 20, 3, RPSLS), RPSLS)
    expect(RPSLS.reduce((sum, move) => sum + p[move], 0)).toBeCloseTo(1)
    // Each move beats two of five, so against a random player the AI wins 40% (not 33%).
    const rate = aiWinRate(predict, randomFiveMovePlayer, 900, 42, RPSLS)
    expect(rate).toBeGreaterThan(0.33)
    expect(rate).toBeLessThan(0.47)
  })

  it('the ensemble learns a five-move cycle', () => {
    expect(aiWinRate(predictEnsemble, fiveMoveCycle, 300, 42, RPSLS)).toBeGreaterThan(0.9)
  })

  it('psychology still expects a winner to repeat', () => {
    const p = predictPsychology([{ player: 'spock', ai: 'rock', outcome: 'win' }], RPSLS)
    for (const move of RPSLS) if (move !== 'spock') expect(p.spock).toBeGreaterThan(p[move])
  })
})
