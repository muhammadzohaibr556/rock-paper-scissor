import { useEffect, useRef, useState, type RefObject } from 'react'
import { DrawingUtils, GestureRecognizer, type GestureRecognizerResult } from '@mediapipe/tasks-vision'
import { describeCameraError, openCamera, stopCamera } from './camera.ts'
import type { GestureModel } from './gestureModel.ts'
import {
  createGestureRecognizer,
  firstHandFeatures,
  modelReading,
  NO_HAND,
  toReading,
  type GestureReading,
} from './gestureRecognizer.ts'

export type TrackingStatus = 'loading' | 'ready' | 'error'

export interface HandTracking {
  status: TrackingStatus
  error: string | null
  reading: GestureReading
  /** Updated on every processed frame (no re-render), for code that samples readings over time. */
  readingRef: RefObject<GestureReading>
  /** The visible hand's shape features, updated every frame (null when no hand); used for recording samples. */
  featuresRef: RefObject<number[] | null>
}

/**
 * Streams the webcam into `videoRef`, runs gesture recognition on every new frame,
 * draws the hand skeleton onto `canvasRef`, and returns the latest reading. With a trained
 * `model`, readings come from it instead of MediaPipe's built-in gestures.
 */
export function useHandTracking(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  model: GestureModel | null,
): HandTracking {
  const [status, setStatus] = useState<TrackingStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState<GestureReading>(NO_HAND)
  const readingRef = useRef<GestureReading>(NO_HAND)
  const featuresRef = useRef<number[] | null>(null)
  // The frame loop reads the model through a ref, so switching models doesn't restart the camera.
  const modelRef = useRef(model)
  useEffect(() => {
    modelRef.current = model
  }, [model])

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!video || !canvas || !ctx) return

    const drawer = new DrawingUtils(ctx)
    let cancelled = false
    let stream: MediaStream | null = null
    let recognizer: GestureRecognizer | null = null
    let frameId = 0
    let lastVideoTime = -1

    const fail = (message: string) => {
      setError(message)
      setStatus('error')
    }

    const tick = () => {
      frameId = requestAnimationFrame(tick)
      // Only run the model when the camera has produced a new frame.
      if (!recognizer || video.currentTime === lastVideoTime) return
      lastVideoTime = video.currentTime
      const result = recognizer.recognizeForVideo(video, performance.now())
      drawHands(ctx, drawer, result)
      const features = firstHandFeatures(result)
      featuresRef.current = features
      const next = modelRef.current ? modelReading(modelRef.current, features) : toReading(result)
      readingRef.current = next
      setReading((prev) => (sameReading(prev, next) ? prev : next))
    }

    const start = async () => {
      // Ask for the camera and download the model at the same time.
      const [camera, model] = await Promise.allSettled([openCamera(), createGestureRecognizer()])
      if (camera.status === 'fulfilled') stream = camera.value
      if (model.status === 'fulfilled') recognizer = model.value
      if (cancelled) return

      if (camera.status === 'rejected') return fail(describeCameraError(camera.reason))
      if (model.status === 'rejected') {
        return fail(`Couldn’t load the hand-tracking model (${String(model.reason)}). Check your connection and reload.`)
      }

      video.srcObject = stream
      try {
        await video.play()
      } catch (err) {
        if (!cancelled) fail(describeCameraError(err))
        return
      }
      if (cancelled) return

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      setStatus('ready')
      tick()
    }

    const started = start()
    return () => {
      cancelled = true
      cancelAnimationFrame(frameId)
      // start() may still be waiting on the camera or model; release them once it settles.
      void started.finally(() => {
        stopCamera(stream)
        recognizer?.close()
      })
    }
  }, [videoRef, canvasRef])

  return { status, error, reading, readingRef, featuresRef }
}

function drawHands(ctx: CanvasRenderingContext2D, drawer: DrawingUtils, result: GestureRecognizerResult) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  for (const landmarks of result.landmarks) {
    drawer.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, { color: '#38bdf8', lineWidth: 4 })
    drawer.drawLandmarks(landmarks, { color: '#ffffff', fillColor: '#f43f5e', lineWidth: 2, radius: 5 })
  }
}

// Skip re-renders when nothing visible changed (confidence is shown as a whole percent).
function sameReading(a: GestureReading, b: GestureReading) {
  return (
    a.move === b.move &&
    a.gesture === b.gesture &&
    Math.round(a.confidence * 100) === Math.round(b.confidence * 100)
  )
}
