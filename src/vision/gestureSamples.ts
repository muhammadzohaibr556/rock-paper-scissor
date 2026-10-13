import { GESTURE_CLASSES } from './gestureClasses.ts'
import { FEATURE_COUNT } from './handFeatures.ts'

/** Recorded hand features per gesture class id. */
export type GestureSamples = Record<string, number[][]>

const STORAGE_KEY = 'rps.gestureSamples'
const CLASS_IDS = new Set(GESTURE_CLASSES.map((c) => c.id))

/** Four decimals is plenty for normalized features, and keeps a few thousand samples well under 5 MB. */
export function roundFeatures(features: readonly number[]): number[] {
  return features.map((value) => Math.round(value * 10000) / 10000)
}

/** Validates untrusted JSON (localStorage or an imported file). Unknown classes and bad rows are dropped. */
export function parseSamples(value: unknown): GestureSamples | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const samples: GestureSamples = {}
  for (const [id, rows] of Object.entries(value)) {
    if (!CLASS_IDS.has(id) || !Array.isArray(rows)) continue
    samples[id] = rows.filter(
      (row): row is number[] => Array.isArray(row) && row.length === FEATURE_COUNT && row.every(Number.isFinite),
    )
  }
  return samples
}

export function loadSamples(): GestureSamples {
  try {
    return parseSamples(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')) ?? {}
  } catch {
    return {}
  }
}

/** Returns false if the browser refused (e.g. storage full or blocked); the samples still live in memory. */
export function saveSamples(samples: GestureSamples): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(samples))
    return true
  } catch {
    return false
  }
}
