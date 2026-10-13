import { DIFFICULTIES, type Difficulty, type DifficultyId } from '../ai/difficulty.ts'
import { MODE_MOVES, MOVE_EMOJI, MOVE_LABEL, type Mode } from '../game/moves.ts'
import { beats, verb, type Round } from '../game/rules.ts'

const MODE_NAME: Record<Mode, string> = { classic: '✊✋✌️ Classic', 'lizard-spock': '🦎🖖 Lizard–Spock' }

interface DifficultyPickerProps {
  difficulty: Difficulty
  onChange: (id: DifficultyId) => void
  mode: Mode
  onModeChange: (mode: Mode) => void
  /** Lizard–Spock needs a trained gesture model that knows both moves. */
  lizardSpockAvailable: boolean
  cheat: boolean
  onCheatChange: (cheat: boolean) => void
  /** Settings can only change between matches. */
  locked: boolean
  /** Every round the AI has learned from this session, in this mode. */
  history: readonly Round[]
}

export function DifficultyPicker({
  difficulty,
  onChange,
  mode,
  onModeChange,
  lizardSpockAvailable,
  cheat,
  onCheatChange,
  locked,
  history,
}: DifficultyPickerProps) {
  const aiWins = history.filter((round) => round.outcome === 'lose').length
  const aiWinPercent = history.length ? Math.round((aiWins / history.length) * 100) : 0

  return (
    <section className="difficulty">
      <div className="segmented" role="radiogroup" aria-label="Difficulty">
        {DIFFICULTIES.map((d) => (
          <label key={d.id} className="segmented__option">
            <input
              type="radio"
              name="difficulty"
              value={d.id}
              checked={d.id === difficulty.id}
              disabled={locked}
              onChange={() => onChange(d.id)}
            />
            <span>{d.name}</span>
          </label>
        ))}
      </div>
      <p className="difficulty__description">
        {difficulty.description}
        {locked && <span className="difficulty__locked"> Change settings between matches.</span>}
      </p>
      <p className="difficulty__stats">
        🧠 Remembers {history.length} round{history.length === 1 ? '' : 's'} of your play
        {history.length > 0 && <> · AI won {aiWinPercent}%</>}
      </p>
      <div className="mode">
        <div className="segmented" role="radiogroup" aria-label="Moves in play">
          {(Object.keys(MODE_NAME) as Mode[]).map((m) => (
            <label key={m} className="segmented__option">
              <input
                type="radio"
                name="mode"
                value={m}
                checked={m === mode}
                disabled={locked || (m === 'lizard-spock' && !lizardSpockAvailable)}
                onChange={() => onModeChange(m)}
              />
              <span>{MODE_NAME[m]}</span>
            </label>
          ))}
        </div>
        {mode === 'lizard-spock' ? (
          <ul className="mode__rules" aria-label="Who beats whom">
            {MODE_MOVES['lizard-spock'].map((winner) => (
              <li key={winner}>
                {MOVE_EMOJI[winner]} {MOVE_LABEL[winner]}{' '}
                {MODE_MOVES['lizard-spock']
                  .filter((loser) => beats(winner, loser))
                  .map((loser) => `${verb(winner, loser)} ${MOVE_LABEL[loser]}`)
                  .join(', ')}
              </li>
            ))}
          </ul>
        ) : (
          !lizardSpockAvailable && (
            <span className="mode__hint">
              🔒 Lizard–Spock needs a trained model that knows 🦎 and 🖖. Record them in the Train gestures tab.
            </span>
          )
        )}
      </div>
      <label className={`cheat${cheat ? ' is-on' : ''}`}>
        <input type="checkbox" checked={cheat} disabled={locked} onChange={(e) => onCheatChange(e.target.checked)} />
        <span>
          <strong>😈 Cheat mode</strong> (a joke): the AI peeks at your hand and always wins. Watch the fairness
          proof catch it.
        </span>
      </label>
    </section>
  )
}
