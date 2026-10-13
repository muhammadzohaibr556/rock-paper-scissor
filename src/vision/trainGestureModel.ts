import { classify, type DenseLayer, type GestureModel } from './gestureModel.ts'
import type { GestureSamples } from './gestureSamples.ts'
import { FEATURE_COUNT } from './handFeatures.ts'

export interface TrainingProgress {
  epoch: number
  epochs: number
  /** On the training samples. */
  accuracy: number
  /** On the held-out samples the network never trains on. */
  validationAccuracy: number
}

export interface TrainingResult {
  model: GestureModel
  /** Held-out results per class: how many it got right. */
  perClass: Record<string, { correct: number; total: number }>
}

interface Options {
  epochs?: number
  /** Share of each class held back to measure accuracy honestly. */
  validationShare?: number
}

/**
 * Trains a small neural network (60 features → 64 → 32 → one output per class) on the recorded
 * samples. TensorFlow.js is loaded only here, so the game itself never downloads it.
 */
export async function trainGestureModel(
  samples: GestureSamples,
  onProgress?: (progress: TrainingProgress) => void,
  { epochs = 60, validationShare = 0.2 }: Options = {},
): Promise<TrainingResult> {
  const tf = await import('@tensorflow/tfjs')
  // The network is tiny, so the CPU is quicker than GPU round-trips, and it leaves the GPU to MediaPipe.
  await tf.setBackend('cpu')
  const classes = Object.keys(samples).filter((id) => samples[id].length > 0)
  if (classes.length < 2) throw new Error('Record at least two gestures first.')

  // Hold back the same share of every class, so each one is tested.
  const train: [number[], number][] = []
  const validation: [number[], number][] = []
  classes.forEach((id, label) => {
    const rows = shuffle([...samples[id]])
    const held = Math.max(1, Math.round(rows.length * validationShare))
    rows.forEach((row, i) => (i < held ? validation : train).push([row, label]))
  })
  shuffle(train)

  const toTensors = (set: [number[], number][]) => [
    tf.tensor2d(
      set.map(([row]) => row),
      [set.length, FEATURE_COUNT],
    ),
    tf.oneHot(
      tf.tensor1d(
        set.map(([, label]) => label),
        'int32',
      ),
      classes.length,
    ),
  ]
  const [xTrain, yTrain] = toTensors(train)
  const [xVal, yVal] = toTensors(validation)

  const network = tf.sequential({
    layers: [
      tf.layers.dense({ inputShape: [FEATURE_COUNT], units: 64, activation: 'relu' }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({ units: 32, activation: 'relu' }),
      tf.layers.dense({ units: classes.length, activation: 'softmax' }),
    ],
  })
  network.compile({ optimizer: tf.train.adam(0.003), loss: 'categoricalCrossentropy', metrics: ['accuracy'] })

  try {
    await network.fit(xTrain, yTrain, {
      epochs,
      batchSize: 32,
      shuffle: true,
      validationData: [xVal, yVal],
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          onProgress?.({
            epoch: epoch + 1,
            epochs,
            accuracy: logs?.acc ?? 0,
            validationAccuracy: logs?.val_acc ?? 0,
          })
          // Let the page repaint (progress, camera) between epochs.
          await new Promise((resolve) => setTimeout(resolve, 0))
        },
      },
    })

    // Keep just the dense layers' weights (dropout does nothing once trained).
    const layers: DenseLayer[] = network.layers
      .filter((layer) => layer.getClassName() === 'Dense')
      .map((layer) => {
        const [kernel, bias] = layer.getWeights()
        return {
          weights: kernel.arraySync() as number[][],
          bias: bias.arraySync() as number[],
          activation: (layer.getConfig() as { activation: string }).activation === 'softmax' ? 'softmax' : 'relu',
        }
      })

    const model: GestureModel = {
      version: 1,
      classes,
      layers,
      validationAccuracy: 0,
      sampleCount: train.length + validation.length,
      trainedAt: new Date().toISOString(),
    }

    // Score the held-out samples with the same plain-JS code the game will use.
    const perClass = Object.fromEntries(classes.map((id) => [id, { correct: 0, total: 0 }]))
    for (const [row, label] of validation) {
      const counts = perClass[classes[label]]
      counts.total++
      if (classify(model, row).label === classes[label]) counts.correct++
    }
    const correct = Object.values(perClass).reduce((sum, c) => sum + c.correct, 0)
    model.validationAccuracy = correct / validation.length

    return { model, perClass }
  } finally {
    tf.dispose([xTrain, yTrain, xVal, yVal])
    network.dispose()
  }
}

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}
