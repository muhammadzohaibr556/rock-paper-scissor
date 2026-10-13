import { useMemo } from 'react'
import { habitReport } from '../ai/report.ts'
import type { Move } from '../game/moves.ts'
import type { Round } from '../game/rules.ts'

/** Shown when a match ends: the player's strongest habits across the whole session. */
export function MatchReport({ history, moves }: { history: readonly Round[]; moves: readonly Move[] }) {
  const insights = useMemo(() => habitReport(history, moves), [history, moves])
  const rounds = history.length

  let body
  if (insights.length > 0) {
    body = (
      <ol className="report__list">
        {insights.map((insight) => (
          <li key={insight.headline}>
            <strong>{insight.headline}</strong>
            <span>{insight.evidence}</span>
          </li>
        ))}
      </ol>
    )
  } else if (rounds < 15) {
    body = <p>No habit stands out yet. Play more rounds and the AI will have more to say. 😏</p>
  } else {
    body = <p>🎲 Nothing stands out: you’re hard to read. That’s the best defence against a predicting AI.</p>
  }

  return (
    <section className="report" aria-label="Post-game report">
      <h2>📋 What the AI learned about you</h2>
      <p className="report__intro">
        From {rounds} round{rounds === 1 ? '' : 's'} this session. Only patterns too strong to be luck are shown.
      </p>
      {body}
    </section>
  )
}
