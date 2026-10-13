import { useMemo } from 'react'
import { PREDICTOR_IDS, PREDICTORS, predictorAccuracy, type PredictorId } from '../ai/ensemble.ts'
import { topGuesses } from '../ai/predictor.ts'
import { MOVE_EMOJI, MOVE_LABEL, type Move } from '../game/moves.ts'
import type { Round } from '../game/rules.ts'
import type { AIReveal, GameState } from '../game/useGame.ts'
import { WinRateChart } from './WinRateChart.tsx'

/** Rounds the predictor accuracy is measured over (close to how far back Hard mode's trust looks). */
const ACCURACY_WINDOW = 10

/** Shows what the AI was thinking last round, how well each predictor reads the player, and its win rate. */
interface BrainPanelProps {
  game: GameState
  /** Every scored round in the current mode. */
  history: readonly Round[]
  /** The moves in play. */
  moves: readonly Move[]
}

export function BrainPanel({ game, history, moves }: BrainPanelProps) {
  const { phase, reveal, playerMove } = game
  const accuracy = useMemo(() => predictorAccuracy(history, moves, ACCURACY_WINDOW), [history, moves])
  // During the countdown even the name of the trusted predictor stays hidden with the rest of the reasoning.
  const trusted = phase === 'countdown' ? null : (reveal?.basedOn ?? null)

  return (
    <section className="brain" aria-label="AI brain">
      <h2>🧠 AI brain</h2>
      <div className="brain__grid">
        <div className="brain__column">
          <LastThought hidden={phase === 'countdown'} reveal={reveal} playerMove={playerMove} />
          <Accuracy
            accuracy={accuracy}
            trusted={trusted}
            rounds={Math.min(history.length, ACCURACY_WINDOW)}
            chance={1 / moves.length}
          />
        </div>
        <div className="brain__column">
          <h3>AI win rate over time</h3>
          {/* A random AI wins when its move beats the player's: one of three, or two of five. */}
          <WinRateChart history={history} chance={(moves.length - 1) / 2 / moves.length} />
        </div>
      </div>
    </section>
  )
}

interface LastThoughtProps {
  hidden: boolean
  reveal: AIReveal | null
  playerMove: Move | null
}

function LastThought({ hidden, reveal, playerMove }: LastThoughtProps) {
  if (hidden) {
    return (
      <div>
        <h3>This round</h3>
        <p className="brain__muted">🤫 Its prediction stays hidden until the reveal. Showing it now would give its move away.</p>
      </div>
    )
  }
  if (!reveal) {
    return (
      <div>
        <h3>Last round</h3>
        <p className="brain__muted">Play a round to see what the AI was thinking.</p>
      </div>
    )
  }

  const show = (move: Move) => `${MOVE_EMOJI[move]} ${MOVE_LABEL[move]}`
  if (reveal.cheated) {
    return (
      <div>
        <h3>Last round</h3>
        <p>😈 I peeked at your hand and switched to {show(reveal.move)}.</p>
        <p className="brain__muted">Cheat-mode rounds don’t count toward what I learn or these stats.</p>
      </div>
    )
  }

  const guesses = topGuesses(reveal.prediction, reveal.moves)
  if (!reveal.basedOn || guesses.length === reveal.moves.length) {
    return (
      <div>
        <h3>Last round</h3>
        <p>No pattern to go on, so I played {show(reveal.move)} at random.</p>
      </div>
    )
  }

  let verdict
  if (!playerMove) verdict = 'You didn’t show a move, so it didn’t count.'
  else if (guesses.includes(playerMove)) verdict = `✅ Called it: you played ${show(playerMove)}.`
  else verdict = `😮 You surprised me: you played ${show(playerMove)}.`

  return (
    <div>
      <h3>Last round</h3>
      <p>I predicted you’d play:</p>
      <ul className="bars">
        {reveal.moves.map((move) => {
          const percent = Math.round(reveal.prediction[move] * 100)
          return (
            <li key={move}>
              <span>
                {show(move)}
                {move === playerMove && <span className="tag">you</span>}
              </span>
              <span className="bar">
                <span style={{ width: `${percent}%` }} />
              </span>
              <span className="bars__value">{percent}%</span>
            </li>
          )
        })}
      </ul>
      <p>
        Based on <strong>{PREDICTORS[reveal.basedOn].name}</strong>, I played {show(reveal.move)}.
      </p>
      <p>{verdict}</p>
    </div>
  )
}

interface AccuracyProps {
  accuracy: Record<PredictorId, number> | null
  trusted: PredictorId | null
  rounds: number
  /** A blind guess's hit rate: 1/3, or 1/5 with Lizard and Spock. */
  chance: number
}

function Accuracy({ accuracy, trusted, rounds, chance }: AccuracyProps) {
  return (
    <div>
      <h3>How well each predictor reads you</h3>
      {accuracy ? (
        <>
          <ul className="bars bars--accuracy">
            {PREDICTOR_IDS.map((id) => {
              const percent = Math.round(accuracy[id] * 100)
              return (
                <li key={id} className={id === trusted ? 'is-trusted' : undefined}>
                  <span>
                    {PREDICTORS[id].name}
                    {id === trusted && <span className="tag">trusted</span>}
                  </span>
                  <span className="bar">
                    <span style={{ width: `${percent}%` }} />
                    <span className="bar__chance" style={{ left: `${chance * 100}%` }} aria-hidden />
                  </span>
                  <span className="bars__value">{percent}%</span>
                </li>
              )
            })}
          </ul>
          <p className="brain__caption">
            How often its top guess was right over your last {rounds} round{rounds === 1 ? '' : 's'}. The tick marks
            chance ({Math.round(chance * 100)}%). Hard mode trusts whichever predictor’s advice has won it the most lately, with the latest
            rounds counting most, so it isn’t always the longest bar.
          </p>
        </>
      ) : (
        <p className="brain__muted">Nothing to measure yet.</p>
      )}
    </div>
  )
}
