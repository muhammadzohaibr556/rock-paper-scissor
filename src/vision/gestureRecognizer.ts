import { GestureRecognizer, type GestureRecognizerResult } from '@mediapipe/tasks-vision'
// Bundled by Vite so the WASM runtime always matches the installed JS package version.
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'
import { isMove, type Move } from '../game/moves.ts'
import { classify, type GestureModel } from './gestureModel.ts'
import { handFeatures } from './handFeatures.ts'

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task'

// MediaPipe's built-in ("canned") gestures that line up with rock, paper and scissors.
// Everything else it knows (Thumb_Up, Pointing_Up, ILoveYou, None, ...) is not a move.
const GESTURE_TO_MOVE: Partial<Record<string, Move>> = {
  Closed_Fist: 'rock',
  Open_Palm: 'paper',
  Victory: 'scissors',
}

export interface GestureReading {
  /** The recognized move, or null when no hand is visible or the hand isn't a move. */
  move: Move | null
  /** Score of the top gesture, 0..1. */
  confidence: number
  /** Raw MediaPipe category name (e.g. "Thumb_Up"), or null when no hand is visible. */
  gesture: string | null
}

export const NO_HAND: GestureReading = { move: null, confidence: 0, gesture: null }

export async function createGestureRecognizer(): Promise<GestureRecognizer> {
  const fileset = { wasmLoaderPath, wasmBinaryPath }
  const create = (delegate: 'GPU' | 'CPU') =>
    GestureRecognizer.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numHands: 1,
    })
  try {
    return await create('GPU')
  } catch {
    // Some browsers/GPUs can't run the WebGL path; CPU is slower but works everywhere.
    return create('CPU')
  }
}

export function toReading(result: GestureRecognizerResult): GestureReading {
  const top = result.gestures[0]?.[0]
  if (!top) return NO_HAND
  return {
    move: GESTURE_TO_MOVE[top.categoryName] ?? null,
    confidence: top.score,
    gesture: top.categoryName,
  }
}

/** Shape features of the first visible hand (see handFeatures.ts), or null when there's none. */
export function firstHandFeatures(result: GestureRecognizerResult): number[] | null {
  const hand = result.worldLandmarks[0]
  return hand ? handFeatures(hand, result.handedness[0]?.[0]?.categoryName) : null
}

/** Reading from the player's own trained model instead of MediaPipe's built-in gestures. */
export function modelReading(model: GestureModel, features: readonly number[] | null): GestureReading {
  if (!features) return NO_HAND
  const { label, confidence } = classify(model, features)
  return { move: isMove(label) ? label : null, confidence, gesture: label }
}
