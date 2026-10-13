import { FEATURE_COUNT } from './handFeatures.ts'

export interface DenseLayer {
  /** weights[input][output] */
  weights: number[][]
  bias: number[]
  activation: 'relu' | 'softmax'
}

/**
 * A small neural network trained in the browser with TensorFlow.js (see trainGestureModel.ts).
 * Only the weights are kept, so the game can run it in plain JS without loading TensorFlow.js.
 */
export interface GestureModel {
  version: 1
  /** Class ids, in the order of the network's outputs. */
  classes: string[]
  layers: DenseLayer[]
  /** Share of held-out samples it classified correctly after training. */
  validationAccuracy: number
  sampleCount: number
  trainedAt: string
}

export interface Classification {
  label: string
  confidence: number
}

/** Runs the network on one hand's features. */
export function classify(model: GestureModel, features: readonly number[]): Classification {
  let values: number[] = [...features]
  for (const layer of model.layers) {
    const out = [...layer.bias]
    for (let i = 0; i < values.length; i++) {
      const input = values[i]
      if (input === 0) continue
      const row = layer.weights[i]
      for (let j = 0; j < out.length; j++) out[j] += input * row[j]
    }
    values = layer.activation === 'relu' ? out.map((v) => Math.max(0, v)) : softmax(out)
  }

  let best = 0
  for (let i = 1; i < values.length; i++) if (values[i] > values[best]) best = i
  return { label: model.classes[best], confidence: values[best] }
}

function softmax(values: number[]) {
  const max = Math.max(...values)
  const exps = values.map((v) => Math.exp(v - max))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map((v) => v / sum)
}

/** Checks that untrusted JSON (localStorage, an imported or shipped file) is a usable model. */
export function isGestureModel(value: unknown): value is GestureModel {
  const model = value as GestureModel
  if (!model || model.version !== 1 || !Array.isArray(model.classes) || !Array.isArray(model.layers)) return false
  if (!model.classes.every((c) => typeof c === 'string') || model.layers.length === 0) return false

  let inputs = FEATURE_COUNT
  for (const layer of model.layers) {
    if (!Array.isArray(layer.weights) || !Array.isArray(layer.bias) || layer.weights.length !== inputs) return false
    if (layer.activation !== 'relu' && layer.activation !== 'softmax') return false
    const outputs = layer.bias.length
    const finite = (row: unknown) => Array.isArray(row) && row.length === outputs && row.every(Number.isFinite)
    if (!finite(layer.bias) || !layer.weights.every(finite)) return false
    inputs = outputs
  }
  return model.layers.at(-1)!.activation === 'softmax' && inputs === model.classes.length
}

const STORAGE_KEY = 'rps.gestureModel'
/** Put a downloaded model here to ship it with the app (used when the player hasn't trained their own). */
const SHIPPED_MODEL_URL = `${import.meta.env.BASE_URL}models/gesture-model.json`

/** The model the player trained and chose to use, saved in this browser. */
export function loadSavedModel(): GestureModel | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    return isGestureModel(value) ? value : null
  } catch {
    return null
  }
}

/** Saves (or with null, forgets) the player's model. Returns false if the browser refused. */
export function saveModel(model: GestureModel | null): boolean {
  try {
    if (model) localStorage.setItem(STORAGE_KEY, JSON.stringify(model))
    else localStorage.removeItem(STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

/** The model shipped in public/models/, if there is one. */
export async function loadShippedModel(): Promise<GestureModel | null> {
  try {
    const response = await fetch(SHIPPED_MODEL_URL)
    // A missing file can come back as the app's index.html, so check it's really JSON.
    if (!response.ok || !response.headers.get('content-type')?.includes('json')) return null
    const value: unknown = await response.json()
    return isGestureModel(value) ? value : null
  } catch {
    return null
  }
}
