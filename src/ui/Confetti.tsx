import type { CSSProperties } from 'react'

const COLORS = ['#f43f5e', '#38bdf8', '#facc15', '#4ade80', '#a78bfa', '#fb923c']

// Fixed, evenly scattered pieces (no randomness during render).
const PIECES = Array.from({ length: 48 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i % 12) * 0.07,
  color: COLORS[i % COLORS.length],
  drift: ((i * 53) % 40) - 20,
  spin: 360 + ((i * 97) % 360),
}))

/** A one-off burst for winning a match. Hidden for people who prefer reduced motion (see index.css). */
export function Confetti() {
  return (
    <div className="confetti" aria-hidden>
      {PIECES.map((piece, i) => (
        <span
          key={i}
          style={
            {
              left: `${piece.left}%`,
              background: piece.color,
              animationDelay: `${piece.delay}s`,
              '--drift': `${piece.drift}vw`,
              '--spin': `${piece.spin}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
