import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { AIThought, Difficulty } from '../ai/difficulty.ts'
import { commit, verify } from '../fairness/commit.ts'
import type { GestureReading } from '../vision/gestureRecognizer.ts'
import { pickMove } from './capture.ts'
import { MODE_MOVES, type Mode, type Move } from './moves.ts'
import { addToScore, counterTo, judge, matchWinner, type Round, type Score } from './rules.ts'

export const COUNTDOWN = ['Rock…', 'Paper…', 'Scissors…', 'Shoot!'] as const

const BEAT_MS = 650
// Players finish forming their hand just after "Shoot!", so wait a moment before sampling.
const CAPTURE_DELAY_MS = 250
const CAPTURE_MS = 700
const SAMPLE_EVERY_MS = 50

export type Phase = 'idle' | 'countdown' | 'result' | 'match-over'

/** Everything the AI kept secret during the round: its move, the proof secret and its reasoning. */
export interface AIReveal extends AIThought {
  secret: string
  /** Whether SHA-256(move:secret) matched the commitment published before the round. */
  verified: boolean
  /** Cheat mode: the AI changed its move after seeing the player's hand. */
  cheated: boolean
}

export interface GameState {
  phase: Phase
  /** Index into COUNTDOWN while phase is 'countdown'. */
  beat: number
  /** Hash of the AI's move, published before the countdown. */
  commitment: string | null
  /** The AI's move, secret and reasoning, published once the round is over. */
  reveal: AIReveal | null
  /** The player's captured move. null on a finished round means no move was detected. */
  playerMove: Move | null
  /** Scored rounds in the current match. */
  rounds: Round[]
  /** Every scored round this session, across matches, per mode. This is what the AI learns from. */
  histories: Record<Mode, Round[]>
  score: Score
}

const NEW_MATCH: GameState = {
  phase: 'idle',
  beat: 0,
  commitment: null,
  reveal: null,
  playerMove: null,
  rounds: [],
  histories: { classic: [], 'lizard-spock': [] },
  score: { player: 0, ai: 0, draws: 0 },
}

/**
 * Runs the countdown → capture → judge loop, sampling the player's hand from `readingRef`.
 * `difficulty` picks the AI's move at the start of each round; with `cheat` on, the AI swaps it
 * for whatever beats the player's hand once it has seen it. `mode` sets which moves are in play.
 */
export function useGame(
  readingRef: RefObject<GestureReading>,
  difficulty: Difficulty,
  cheat: boolean,
  mode: Mode,
) {
  const [state, setState] = useState<GameState>(NEW_MATCH)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const playRound = useCallback(
    async (newMatch: boolean, thought: AIThought, cheating: boolean, mode: Mode) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const { signal } = controller

      // The AI commits to its move before the countdown, so it can't react to the player's hand.
      // Only the hash goes into state; the move and the prediction behind it (which would give
      // the move away) stay in this closure until the reveal.
      const aiCommitment = await commit(thought.move)
      if (signal.aborted) return
      setState((s) => ({
        // A new match resets the score, but the AI keeps what it has learned about you.
        ...(newMatch ? { ...NEW_MATCH, histories: s.histories } : s),
        phase: 'countdown',
        beat: 0,
        commitment: aiCommitment.hash,
        reveal: null,
        playerMove: null,
      }))

      try {
        for (let beat = 1; beat < COUNTDOWN.length; beat++) {
          await sleep(BEAT_MS, signal)
          setState((s) => ({ ...s, beat }))
        }

        await sleep(CAPTURE_DELAY_MS, signal)
        const samples: GestureReading[] = []
        for (let t = 0; t < CAPTURE_MS; t += SAMPLE_EVERY_MS) {
          samples.push(readingRef.current)
          await sleep(SAMPLE_EVERY_MS, signal)
        }

        const moves = MODE_MOVES[mode]
        const playerMove = pickMove(samples, moves)
        // Cheat mode (a joke, and a demo of the fairness proof): peek at the hand and switch to the
        // move that beats it. Revealing a different move than the one committed to fails the check.
        const peeked = cheating && playerMove ? counterTo(playerMove, moves) : null
        const move = peeked ?? thought.move
        const verified = await verify({ ...aiCommitment, move })
        if (signal.aborted) return
        const reveal = { ...thought, move, secret: aiCommitment.secret, verified, cheated: move !== thought.move }
        setState((s) => finishRound(s, reveal, playerMove, mode))
      } catch (err) {
        if (!signal.aborted) throw err
      }
    },
    [readingRef],
  )

  /** Starts a match, plays the next round, or starts over, depending on the phase. */
  const advance = useCallback(() => {
    if (state.phase === 'countdown') return
    void playRound(state.phase !== 'result', difficulty.think(state.histories[mode], MODE_MOVES[mode]), cheat, mode)
  }, [state.phase, state.histories, difficulty, cheat, mode, playRound])

  return { state, history: state.histories[mode], advance }
}

function finishRound(state: GameState, reveal: AIReveal, playerMove: Move | null, mode: Mode): GameState {
  const aiMove = reveal.move
  // No move detected: show the result but don't score it; the next round replays it.
  if (!playerMove) return { ...state, phase: 'result', reveal, playerMove: null }

  const round = { player: playerMove, ai: aiMove, outcome: judge(playerMove, aiMove) }
  const score = addToScore(state.score, round.outcome)
  return {
    ...state,
    phase: matchWinner(score) ? 'match-over' : 'result',
    reveal,
    playerMove,
    score,
    rounds: [...state.rounds, round],
    // Cheated rounds count toward the match, but not toward what the AI learns or the stats.
    histories: reveal.cheated ? state.histories : { ...state.histories, [mode]: [...state.histories[mode], round] },
  }
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const id = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(id)
        reject(signal.reason)
      },
      { once: true },
    )
  })
}
