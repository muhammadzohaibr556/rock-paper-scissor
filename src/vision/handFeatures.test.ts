import { describe, expect, it } from 'vitest'
import { FEATURE_COUNT, handFeatures, type Point3 } from './handFeatures.ts'

// A made-up but hand-like set of 21 points (meters).
const HAND: Point3[] = Array.from({ length: 21 }, (_, i) => ({
  x: Math.sin(i * 1.7) * 0.04,
  y: -0.01 * i + Math.cos(i * 0.9) * 0.02,
  z: Math.sin(i * 0.5) * 0.015,
}))

function transform(hand: Point3[], { dx = 0, dy = 0, dz = 0, scale = 1, angle = 0, mirror = false }) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return hand.map(({ x, y, z }) => {
    const mx = mirror ? -x : x
    return {
      x: (mx * cos - y * sin) * scale + dx,
      y: (mx * sin + y * cos) * scale + dy,
      z: z * scale + dz,
    }
  })
}

function expectSameFeatures(a: number[], b: number[]) {
  expect(a).toHaveLength(b.length)
  a.forEach((value, i) => expect(value).toBeCloseTo(b[i], 9))
}

describe('handFeatures', () => {
  const base = handFeatures(HAND, 'Right')

  it('describes the 20 non-wrist landmarks in 3D', () => {
    expect(base).toHaveLength(FEATURE_COUNT)
    expect(FEATURE_COUNT).toBe(60)
  })

  it('ignores where the hand is', () => {
    expectSameFeatures(handFeatures(transform(HAND, { dx: 0.3, dy: -0.2, dz: 0.1 }), 'Right'), base)
  })

  it('ignores how big the hand looks', () => {
    expectSameFeatures(handFeatures(transform(HAND, { scale: 2.5 }), 'Right'), base)
  })

  it('ignores tilting the hand in the image plane', () => {
    for (const angle of [0.4, -1.2, Math.PI / 2, 3]) {
      expectSameFeatures(handFeatures(transform(HAND, { angle }), 'Right'), base)
    }
  })

  it('treats a left hand like the mirror image of a right hand', () => {
    expectSameFeatures(handFeatures(transform(HAND, { mirror: true }), 'Left'), base)
  })

  it('still tells different shapes apart', () => {
    const other = HAND.map((p, i) => (i >= 17 ? { ...p, y: p.y + 0.03 } : p)) // pinky curled differently
    const diff = handFeatures(other, 'Right').reduce((sum, value, i) => sum + Math.abs(value - base[i]), 0)
    expect(diff).toBeGreaterThan(0.1)
  })
})
