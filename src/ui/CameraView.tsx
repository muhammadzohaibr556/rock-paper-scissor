import type { ReactNode, RefObject } from 'react'
import { MOVE_EMOJI, MOVE_LABEL } from '../game/moves.ts'
import type { GestureReading } from '../vision/gestureRecognizer.ts'
import type { HandTracking } from '../vision/useHandTracking.ts'

interface CameraViewProps {
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  tracking: HandTracking
  /** Extra overlays drawn on top of the feed (e.g. the countdown). */
  children?: ReactNode
}

export function CameraView({ videoRef, canvasRef, tracking, children }: CameraViewProps) {
  const { status, error, reading } = tracking
  return (
    <section className="camera">
      {/* Mirrored so moving your hand right moves it right on screen. */}
      <div className="camera__feed">
        <video ref={videoRef} autoPlay muted playsInline />
        <canvas ref={canvasRef} />
      </div>

      {status === 'loading' && (
        <div className="camera__overlay">
          <span className="spinner" aria-hidden />
          Starting camera and loading the AI model…
        </div>
      )}
      {status === 'error' && <div className="camera__overlay camera__overlay--error">{error}</div>}
      {status === 'ready' && <GestureBadge reading={reading} />}
      {children}
    </section>
  )
}

function GestureBadge({ reading }: { reading: GestureReading }) {
  if (!reading.gesture) {
    return <div className="badge badge--hint">Show your hand to the camera ✋</div>
  }
  if (!reading.move) {
    // "None" (MediaPipe) / "none" (a trained model's "not a move" class) need no name.
    const name = reading.gesture.toLowerCase() === 'none' ? '' : reading.gesture.replaceAll('_', ' ')
    return (
      <div className="badge badge--hint">
        🤔 Not a move {name && <small>({name})</small>}
      </div>
    )
  }
  const percent = Math.round(reading.confidence * 100)
  return (
    <div className="badge" aria-live="polite">
      <span className="badge__emoji">{MOVE_EMOJI[reading.move]}</span>
      <span>{MOVE_LABEL[reading.move]}</span>
      <span className="badge__percent">{percent}%</span>
      <span className="badge__bar">
        <span style={{ width: `${percent}%` }} />
      </span>
    </div>
  )
}
