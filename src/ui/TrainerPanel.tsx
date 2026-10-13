import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { GESTURE_CLASSES } from '../vision/gestureClasses.ts'
import type { GestureModel } from '../vision/gestureModel.ts'
import { loadSamples, parseSamples, roundFeatures, saveSamples, type GestureSamples } from '../vision/gestureSamples.ts'
import type { TrainingProgress, TrainingResult } from '../vision/trainGestureModel.ts'

const RECORD_MS = 5000
const SAMPLE_EVERY_MS = 66 // about 15 samples a second
/** Training is allowed once every required gesture has this many samples. */
const MIN_SAMPLES = 50
const SUGGESTED_SAMPLES = 200

export type ModelSource = 'yours' | 'shipped' | 'built-in'

interface TrainerPanelProps {
  /** Shape features of the hand in view, updated every frame. */
  featuresRef: RefObject<number[] | null>
  ready: boolean
  handVisible: boolean
  activeModel: GestureModel | null
  source: ModelSource
  /** Saves the model as the player's own (null forgets it). */
  onUseModel: (model: GestureModel | null) => void
}

interface Recording {
  id: string
  count: number
  secondsLeft: number
}

export function TrainerPanel({ featuresRef, ready, handVisible, activeModel, source, onUseModel }: TrainerPanelProps) {
  const [samples, setSamples] = useState<GestureSamples>(loadSamples)
  const [saved, setSaved] = useState(true)
  const [recording, setRecording] = useState<Recording | null>(null)
  const [progress, setProgress] = useState<TrainingProgress | null>(null)
  const [result, setResult] = useState<TrainingResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  // Every change goes through here, so it's saved to this browser right away.
  const latestSamples = useRef(samples)
  const changeSamples = useCallback((update: (prev: GestureSamples) => GestureSamples) => {
    const next = update(latestSamples.current)
    latestSamples.current = next
    setSamples(next)
    setSaved(saveSamples(next))
  }, [])

  // While recording, sample the hand in view a few times a second (frames without a hand are skipped).
  const recordingId = recording?.id
  useEffect(() => {
    if (!recordingId) return
    const collected: number[][] = []
    const started = performance.now()
    const timer = setInterval(() => {
      const features = featuresRef.current
      if (features) collected.push(roundFeatures(features))
      const left = RECORD_MS - (performance.now() - started)
      if (left > 0) {
        setRecording({ id: recordingId, count: collected.length, secondsLeft: Math.ceil(left / 1000) })
        return
      }
      clearInterval(timer)
      changeSamples((prev) => ({ ...prev, [recordingId]: [...(prev[recordingId] ?? []), ...collected] }))
      setRecording(null)
    }, SAMPLE_EVERY_MS)
    return () => clearInterval(timer)
  }, [recordingId, featuresRef, changeSamples])

  const count = (id: string) => samples[id]?.length ?? 0
  const total = GESTURE_CLASSES.reduce((sum, c) => sum + count(c.id), 0)
  const missing = GESTURE_CLASSES.filter((c) => !c.optional && count(c.id) < MIN_SAMPLES)
  const busy = !!recording || !!progress

  const train = async () => {
    setError(null)
    setResult(null)
    setProgress({ epoch: 0, epochs: 1, accuracy: 0, validationAccuracy: 0 })
    try {
      // Loads TensorFlow.js on demand; the game never needs it.
      const { trainGestureModel } = await import('../vision/trainGestureModel.ts')
      // Optional gestures only join once they have enough samples.
      const dataset = Object.fromEntries(
        GESTURE_CLASSES.filter((c) => count(c.id) >= MIN_SAMPLES).map((c) => [c.id, samples[c.id]]),
      )
      setResult(await trainGestureModel(dataset, setProgress))
    } catch (err) {
      setError(`Training failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setProgress(null)
    }
  }

  const clear = (id: string, label: string) => {
    if (window.confirm(`Delete all ${count(id)} ${label} samples?`)) changeSamples((prev) => ({ ...prev, [id]: [] }))
  }

  const importFile = async (file: File) => {
    try {
      const imported = parseSamples(JSON.parse(await file.text()))
      if (!imported) throw new Error('not a sample export')
      changeSamples((prev) => {
        const merged = { ...prev }
        for (const [id, rows] of Object.entries(imported)) merged[id] = [...(merged[id] ?? []), ...rows]
        return merged
      })
      setError(null)
    } catch {
      setError('That file isn’t a gesture sample export.')
    }
  }

  return (
    <section className="trainer" aria-label="Gesture trainer">
      <h2>🛠 Train your own gesture model</h2>
      <ol className="trainer__steps">
        <li>
          Record about {SUGGESTED_SAMPLES} samples of each gesture. While recording, tilt and turn your hand, move it
          closer and farther, half-close it, and swap hands (click with the other one).
        </li>
        <li>Train. It runs in your browser and takes a few seconds.</li>
        <li>Use it. The badge on the camera then shows your model’s guess.</li>
      </ol>

      <ul className="trainer__classes">
        {GESTURE_CLASSES.map((c) => {
          const isRecording = recording?.id === c.id
          return (
            <li key={c.id}>
              <span className="trainer__emoji" aria-hidden>
                {c.emoji}
              </span>
              <div className="trainer__class">
                <strong>
                  {c.label}
                  {c.optional && <span className="tag">optional</span>}
                </strong>
                <span>{c.hint}</span>
                <span className="trainer__count">
                  <span className="bar">
                    <span style={{ width: `${Math.min(100, (count(c.id) / SUGGESTED_SAMPLES) * 100)}%` }} />
                  </span>
                  {count(c.id)} samples
                </span>
              </div>
              <div className="trainer__buttons">
                <button
                  type="button"
                  className={`button button--small${isRecording ? ' is-recording' : ''}`}
                  disabled={!ready || busy}
                  onClick={() => setRecording({ id: c.id, count: 0, secondsLeft: RECORD_MS / 1000 })}
                >
                  {isRecording ? `● ${recording.secondsLeft}s · +${recording.count}` : '● Record 5 s'}
                </button>
                <button
                  type="button"
                  className="button button--small button--ghost"
                  disabled={busy || count(c.id) === 0}
                  onClick={() => clear(c.id, c.label)}
                >
                  Clear
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      {recording && !handVisible && (
        <p className="trainer__warning">No hand in view. Only frames with a visible hand are recorded.</p>
      )}
      {!saved && (
        <p className="trainer__warning">
          This browser wouldn’t save the samples (storage full or blocked). Export them so they aren’t lost.
        </p>
      )}

      <div className="trainer__train">
        <button type="button" className="button" disabled={busy || missing.length > 0} onClick={train}>
          {!progress
            ? 'Train model'
            : progress.epoch === 0
              ? 'Loading TensorFlow.js…'
              : `Training… ${progress.epoch}/${progress.epochs}`}
        </button>
        {missing.length > 0 ? (
          <span className="trainer__muted">
            Needs at least {MIN_SAMPLES} samples of {missing.map((c) => c.label).join(', ')}.
          </span>
        ) : progress && progress.epoch > 0 ? (
          <span className="trainer__muted">
            Accuracy on held-out samples: {Math.round(progress.validationAccuracy * 100)}%
          </span>
        ) : null}
      </div>
      {error && <p className="trainer__error">{error}</p>}

      {result && (
        <TrainingSummary
          result={result}
          inUse={activeModel === result.model}
          onUse={() => onUseModel(result.model)}
        />
      )}

      <div className="trainer__active">
        <h3>Recognizing gestures with</h3>
        {source === 'yours' && activeModel ? (
          <p>
            <strong>Your model</strong> · {Math.round(activeModel.validationAccuracy * 100)}% on held-out samples ·
            trained on {activeModel.sampleCount} samples{' '}
            <button type="button" className="button button--small button--ghost" onClick={() => onUseModel(null)}>
              Stop using it
            </button>
          </p>
        ) : source === 'shipped' ? (
          <p>
            <strong>The model shipped with this app</strong> (public/models/gesture-model.json)
          </p>
        ) : (
          <p>
            <strong>MediaPipe’s built-in gestures</strong> (fist, open palm, victory sign)
          </p>
        )}
      </div>

      <div className="trainer__data">
        <button
          type="button"
          className="button button--small button--ghost"
          disabled={total === 0}
          onClick={() => downloadJson('gesture-samples.json', samples)}
        >
          Export samples
        </button>
        <button
          type="button"
          className="button button--small button--ghost"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          Import samples
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void importFile(file)
            e.target.value = ''
          }}
        />
        <span className="trainer__muted">
          More people means a better model: have friends export their samples, then import them all here.
        </span>
      </div>
    </section>
  )
}

function TrainingSummary({ result, inUse, onUse }: { result: TrainingResult; inUse: boolean; onUse: () => void }) {
  const { model, perClass } = result
  const percent = Math.round(model.validationAccuracy * 100)
  const tested = Object.values(perClass).reduce((sum, c) => sum + c.total, 0)
  return (
    <div className="trainer__result">
      <p>
        <strong>{percent}% correct</strong> on {tested} samples it never trained on.
      </p>
      <ul className="trainer__per-class">
        {model.classes.map((id) => {
          const gesture = GESTURE_CLASSES.find((c) => c.id === id)
          const { correct, total } = perClass[id]
          return (
            <li key={id}>
              {gesture?.emoji} {gesture?.label ?? id}: {correct}/{total}
            </li>
          )
        })}
      </ul>
      {percent < 90 && (
        <p className="trainer__warning">
          Under 90%: record more varied samples of the weaker gestures and train again.
        </p>
      )}
      <div className="trainer__buttons">
        <button type="button" className="button button--small" disabled={inUse} onClick={onUse}>
          {inUse ? 'In use ✓' : 'Use this model'}
        </button>
        <button
          type="button"
          className="button button--small button--ghost"
          onClick={() => downloadJson('gesture-model.json', model)}
        >
          Download model
        </button>
      </div>
      <p className="trainer__muted">
        To ship it with the app for everyone, save the download as <code>public/models/gesture-model.json</code>.
      </p>
    </div>
  )
}

function downloadJson(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
