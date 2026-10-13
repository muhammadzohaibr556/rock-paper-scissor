import { useState } from 'react'
import { revealText } from '../fairness/commit.ts'
import type { AIReveal } from '../game/useGame.ts'

interface FairnessProofProps {
  commitment: string | null
  reveal: AIReveal | null
}

export function FairnessProof({ commitment, reveal }: FairnessProofProps) {
  if (!commitment) return null
  const text = reveal ? revealText(reveal.move, reveal.secret) : null
  const command = text ? `printf %s '${text}' | shasum -a 256` : null

  return (
    <section className="proof" aria-label="Fairness proof">
      <h2>🔐 Fairness proof</h2>
      <p className="proof__intro">
        Before each countdown the AI publishes a SHA-256 hash of its move plus a random secret. Changing its move
        after seeing your hand would change the hash.
      </p>
      <dl>
        <dt>Commitment (before “Shoot!”)</dt>
        <dd>
          <code>{commitment}</code>
        </dd>
        <dt>Revealed (after the round)</dt>
        <dd>{text ? <code>{text}</code> : <span className="proof__muted">Hidden until you play</span>}</dd>
        {reveal && (
          <>
            <dt>Check</dt>
            <dd className={reveal.verified ? 'proof__ok' : 'proof__bad'}>
              {reveal.verified
                ? '✅ SHA-256 of the revealed text matches the commitment'
                : '❌ SHA-256 of the revealed text does NOT match the commitment: the AI changed its move after committing'}
            </dd>
          </>
        )}
      </dl>
      {command && (
        <details>
          <summary>Verify it yourself</summary>
          <p>
            Run this in a terminal (macOS / Linux), or paste the revealed text into any SHA-256 tool. The output
            should equal the commitment above.
          </p>
          <pre>
            <code>{command}</code>
          </pre>
          <CopyButton text={command} />
        </details>
      )}
    </section>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard can be blocked (e.g. permissions); the command is still selectable above.
    }
  }
  return (
    <button type="button" className="button button--small" onClick={copy}>
      {copied ? 'Copied ✓' : 'Copy command'}
    </button>
  )
}
