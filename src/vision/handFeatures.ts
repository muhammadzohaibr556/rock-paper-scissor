/** A 3D hand landmark (MediaPipe's world landmarks are in meters). */
export interface Point3 {
  x: number
  y: number
  z: number
}

const WRIST = 0
const MIDDLE_KNUCKLE = 9
const LANDMARKS = 21

/** 20 landmarks (the wrist is always the origin, so it's dropped) × x, y, z. */
export const FEATURE_COUNT = (LANDMARKS - 1) * 3

/**
 * Turns MediaPipe's 21 hand landmarks into numbers that describe only the hand's *shape*:
 * the same gesture gives (nearly) the same features wherever the hand is, however big it
 * looks, however it's rotated in the frame, and whichever hand makes it.
 */
export function handFeatures(landmarks: readonly Point3[], handedness: string | undefined): number[] {
  // Mirror left hands so they look like right hands.
  const mirror = handedness === 'Left' ? -1 : 1
  const wrist = landmarks[WRIST]
  const points = landmarks.map((p) => ({ x: (p.x - wrist.x) * mirror, y: p.y - wrist.y, z: p.z - wrist.z }))

  // Rotate in the image plane so the palm's main axis (wrist → middle knuckle) points straight up.
  // This is what makes tilted hands look the same as upright ones.
  const axis = points[MIDDLE_KNUCKLE]
  const angle = Math.atan2(axis.x, -axis.y)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  // Scale by palm length, so distance from the camera doesn't matter.
  const size = Math.hypot(axis.x, axis.y, axis.z) || 1

  const features: number[] = []
  for (let i = 1; i < LANDMARKS; i++) {
    const { x, y, z } = points[i]
    features.push((x * cos + y * sin) / size, (-x * sin + y * cos) / size, z / size)
  }
  return features
}
