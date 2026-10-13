import { describe, expect, it } from 'vitest'
import { classify, isGestureModel, type GestureModel } from './gestureModel.ts'
import { parseSamples, type GestureSamples } from './gestureSamples.ts'
import { FEATURE_COUNT } from './handFeatures.ts'
import { trainGestureModel } from './trainGestureModel.ts'

/** Seeded random numbers (mulberry32). */
function seededRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fake "gestures": noisy samples around a different random center per class. */
function syntheticSamples(classes: string[], perClass: number, noise = 0.15): GestureSamples {
  const random = seededRandom(5)
  const samples: GestureSamples = {}
  for (const id of classes) {
    const center = Array.from({ length: FEATURE_COUNT }, () => random() * 2 - 1)
    samples[id] = Array.from({ length: perClass }, () => center.map((v) => v + (random() * 2 - 1) * noise))
  }
  return samples
}

describe('classify', () => {
  it('runs the network forward (dense → relu → dense → softmax)', () => {
    const zeros = (rows: number, cols: number) => Array.from({ length: rows }, () => Array<number>(cols).fill(0))
    // Hidden unit 0 = relu(feature 0), hidden unit 1 = relu(-feature 0); output a = 2·h0, output b = 2·h1.
    const first = zeros(FEATURE_COUNT, 2)
    first[0] = [1, -1]
    const model: GestureModel = {
      version: 1,
      classes: ['a', 'b'],
      layers: [
        { weights: first, bias: [0, 0], activation: 'relu' },
        { weights: [[2, 0], [0, 2]], bias: [0, 0], activation: 'softmax' },
      ],
      validationAccuracy: 1,
      sampleCount: 0,
      trainedAt: '',
    }
    const features = Array<number>(FEATURE_COUNT).fill(0)
    features[0] = 1
    const result = classify(model, features)
    expect(result.label).toBe('a')
    // softmax([2, 0]) = e² / (e² + 1)
    expect(result.confidence).toBeCloseTo(Math.exp(2) / (Math.exp(2) + 1), 10)
    expect(isGestureModel(model)).toBe(true)
  })
})

describe('isGestureModel', () => {
  it('rejects malformed models', () => {
    expect(isGestureModel(null)).toBe(false)
    expect(isGestureModel({ version: 1, classes: ['a'], layers: [] })).toBe(false)
    expect(
      isGestureModel({
        version: 1,
        classes: ['a', 'b'],
        layers: [{ weights: [[1, 2]], bias: [0, 0], activation: 'softmax' }], // wrong input size
      }),
    ).toBe(false)
  })
})

describe('parseSamples', () => {
  it('keeps only known classes and well-formed rows', () => {
    const good = Array<number>(FEATURE_COUNT).fill(0.5)
    const parsed = parseSamples({ rock: [good, [1, 2, 3], 'x'], banana: [good] })
    expect(parsed).toEqual({ rock: [good] })
    expect(parseSamples('nope')).toBeNull()
  })
})

describe('trainGestureModel', () => {
  it('learns separable gestures, and the plain-JS model agrees with what it learned', async () => {
    const samples = syntheticSamples(['rock', 'paper', 'scissors', 'none'], 80)
    const progress: number[] = []
    const { model, perClass } = await trainGestureModel(samples, (p) => progress.push(p.validationAccuracy), {
      epochs: 25,
    })

    expect(isGestureModel(model)).toBe(true)
    expect(model.classes).toEqual(['rock', 'paper', 'scissors', 'none'])
    expect(model.sampleCount).toBe(320)
    expect(progress).toHaveLength(25)
    // Measured with plain-JS classify on held-out samples...
    expect(model.validationAccuracy).toBeGreaterThan(0.95)
    // ...and it matches TensorFlow.js's own held-out accuracy for the final epoch.
    expect(Math.abs(model.validationAccuracy - progress.at(-1)!)).toBeLessThan(0.02)
    for (const { total } of Object.values(perClass)) expect(total).toBe(16)
    expect(Object.values(perClass).every(({ correct, total }) => correct / total > 0.9)).toBe(true)
  }, 30_000)

  it('needs at least two gestures', async () => {
    await expect(trainGestureModel({ rock: syntheticSamples(['rock'], 10).rock })).rejects.toThrow(/two gestures/)
  })
})
