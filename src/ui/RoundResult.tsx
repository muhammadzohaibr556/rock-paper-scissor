import type { ReactNode } from 'react'
import { MOVE_EMOJI, MOVE_LABEL, type Move } from '../game/moves.ts'
import { judge, matchWinner, verb, type Outcome } from '../game/rules.ts'
import { COUNTDOWN, type GameState } from '../game/useGame.ts'

interface RoundResultProps {
  game: GameState
  /** False until the camera and model are running. */
  ready: boolean
  onAdvance: () => void
}

export function RoundResult({ game, ready, onAdvance }: RoundResultProps) {
  const { phase, beat, reveal, playerMove, score } = game
  const aiMove = reveal?.move ?? null
  const finished = phase === 'result' || phase === 'match-over'
  const outcome = finished && playerMove && aiMove ? judge(playerMove, aiMove) : null

  let message: ReactNode
  if (phase === 'idle') {
    message = 'Start the match, then show your move right on “Shoot!”'
  } else if (phase === 'countdown') {
    message = beat === COUNTDOWN.length - 1 ? 'Show your move now!' : 'Get ready…'
  } else if (!outcome || !playerMove || !aiMove) {
    message = '😶 Didn’t catch your move. Hold it steady in view right after “Shoot!”'
  } else {
    message = describeRound(outcome, playerMove, aiMove)
    if (reveal?.cheated) {
      message = (
        <>
          {message} <em>😈 It peeked, and the fairness proof caught it.</em>
        </>
      )
    }
  }

  const winner = phase === 'match-over' ? matchWinner(score) : null
  const finalScore = `${score.player}–${score.ai}`

  return (
    <section className={`result result--${outcome ?? 'neutral'}`} aria-live="polite">
      <div className="result__text">
        {winner && (
          <p className="result__match">
            {winner === 'player' ? `🏆 You beat the AI ${finalScore}!` : `🤖 The AI wins the match ${finalScore}.`}
          </p>
        )}
        <p>{message}</p>
      </div>
      <div className="result__actions">
        <button type="button" className="button" onClick={onAdvance} disabled={!ready || phase === 'countdown'}>
          {buttonLabel(game)}
        </button>
        <kbd>Space</kbd>
      </div>
    </section>
  )
}

function describeRound(outcome: Outcome, player: Move, ai: Move): ReactNode {
  const show = (move: Move) => `${MOVE_EMOJI[move]} ${MOVE_LABEL[move]}`
  switch (outcome) {
    case 'win':
      return (
        <>
          <strong>You win the round!</strong> {show(player)} {verb(player, ai)} {show(ai)}.
        </>
      )
    case 'lose':
      return (
        <>
          <strong>AI wins the round.</strong> {show(ai)} {verb(ai, player)} {show(player)}.
        </>
      )
    case 'draw':
      return (
        <>
          <strong>Draw.</strong> You both played {show(player)}.
        </>
      )
  }
}

function buttonLabel({ phase, playerMove }: GameState) {
  switch (phase) {
    case 'idle':
      return 'Start match'
    case 'countdown':
      return 'Playing…'
    case 'result':
      return playerMove ? 'Next round' : 'Try again'
    case 'match-over':
      return 'Play again'
  }
}
