import { MOVE_EMOJI, MOVE_LABEL } from '../game/moves.ts'
import { WINS_NEEDED, type Round, type Score } from '../game/rules.ts'

export function Scoreboard({ score, rounds }: { score: Score; rounds: Round[] }) {
  return (
    <section className="scoreboard" aria-label="Score">
      <div className="scoreboard__side">
        <span className="scoreboard__name">You</span>
        {/* Keyed by the value so the bump animation replays when it changes. */}
        <span key={score.player} className="scoreboard__points">
          {score.player}
        </span>
      </div>
      <div className="scoreboard__middle">
        <span>First to {WINS_NEEDED}</span>
        {score.draws > 0 && (
          <span>
            {score.draws} draw{score.draws === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <div className="scoreboard__side scoreboard__side--ai">
        <span key={score.ai} className="scoreboard__points">
          {score.ai}
        </span>
        <span className="scoreboard__name">AI</span>
      </div>

      {rounds.length > 0 && (
        <ol className="history" aria-label="Rounds played">
          {rounds.map((round, i) => (
            <li
              key={i}
              className={`history__round history__round--${round.outcome}`}
              title={`Round ${i + 1}: you ${MOVE_LABEL[round.player]}, AI ${MOVE_LABEL[round.ai]}`}
            >
              {MOVE_EMOJI[round.player]}
              <small>vs</small>
              {MOVE_EMOJI[round.ai]}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
