import { MOVE_EMOJI, MOVE_LABEL } from '../game/moves.ts'
import type { Outcome } from '../game/rules.ts'
import type { AIReveal } from '../game/useGame.ts'

interface AICardProps {
  commitment: string | null
  reveal: AIReveal | null
  /** How the round went for the player, once it's over (drives the card's win/lose animation). */
  outcome: Outcome | null
}

export function AICard({ commitment, reveal, outcome }: AICardProps) {
  let status
  if (reveal) {
    status = reveal.verified ? '✅ Matches its commitment' : '⚠️ Doesn’t match its commitment!'
  } else if (commitment) {
    status = (
      <>
        🔒 Locked in <code>#{commitment.slice(0, 8)}</code>
      </>
    )
  } else {
    status = 'Waiting for you'
  }

  return (
    <section className={`ai-card${outcome ? ` ai-card--${outcome}` : ''}`} aria-label="AI move">
      <h2 className="ai-card__title">🤖 AI</h2>
      <div className={`flip${reveal ? ' is-flipped' : ''}`}>
        <div className="flip__inner">
          <div className="flip__face flip__face--back" aria-hidden={!!reveal}>
            <span className="ai-card__back">?</span>
          </div>
          <div className="flip__face flip__face--front" aria-hidden={!reveal}>
            {reveal && (
              <>
                <span className="ai-card__emoji">{MOVE_EMOJI[reveal.move]}</span>
                <span>{MOVE_LABEL[reveal.move]}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <p className="ai-card__status">{status}</p>
    </section>
  )
}
