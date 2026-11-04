/**
 * Geometry for the background starfield: a slow forward flight through a wrapped 3D volume of
 * gold points with perspective. Pure and deterministic (seeded) so the sky is the same on every
 * load and the maths is testable without a canvas.
 */
export type Star = {
  x: number
  y: number
  z: number
  /** Base radius in px at scale 1. */
  size: number
  /** 0 = Metallic Gold, 1 = Gold Highlight, 2 = Gold Shadow (brand palette). */
  tone: 0 | 1 | 2
  /** Twinkle phase offset in radians. */
  phase: number
}

export const FIELD = { depth: 1600, near: 60, focal: 520, spreadX: 1700, spreadY: 1100 } as const

/** Brand golds as rgb triplets for `rgba()` strings. */
export const STAR_TONES: readonly [string, string, string] = ['212,175,55', '227,200,110', '186,151,46']

export function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Star count scaled to the viewport area, bounded so phones stay cheap and big screens stay sparse. */
export function starCount(width: number, height: number): number {
  return Math.max(200, Math.min(800, Math.round((width * height) / 2300)))
}

export function createStars(count: number, seed = 20261104): Star[] {
  const rand = mulberry32(seed)
  return Array.from({ length: count }, () => {
    const pick = rand()
    return {
      x: (rand() - 0.5) * 2 * FIELD.spreadX,
      y: (rand() - 0.5) * 2 * FIELD.spreadY,
      z: rand() * FIELD.depth,
      size: 0.6 + rand() * 0.9,
      tone: pick < 0.7 ? 0 : pick < 0.9 ? 1 : 2,
      phase: rand() * Math.PI * 2,
    }
  })
}

/** Depth relative to the camera, wrapped into the volume so the flight loops without popping. */
export function relativeDepth(z: number, camZ: number): number {
  let rz = (z - camZ) % FIELD.depth
  if (rz < 0) rz += FIELD.depth
  return rz < FIELD.near ? rz + FIELD.depth : rz
}

/** Fade in from the far plane and out just before the camera, so nothing appears or vanishes abruptly. */
export function depthAlpha(rz: number): number {
  const far = 1 - Math.max(0, (rz - FIELD.depth * 0.7) / (FIELD.depth * 0.3))
  const near = Math.min(1, (rz - FIELD.near) / 260)
  return Math.max(0, Math.min(far, near))
}

export type Projected = { x: number; y: number; radius: number; alpha: number }

/** Screen position, radius and opacity of a star, or null when it is off-screen or fully faded. */
export function projectStar(star: Star, camZ: number, camX: number, camY: number, width: number, height: number): Projected | null {
  const rz = relativeDepth(star.z, camZ)
  const alpha = depthAlpha(rz)
  if (alpha <= 0) return null
  const scale = FIELD.focal / rz
  const x = (star.x - camX) * scale + width / 2
  const y = (star.y - camY) * scale + height / 2
  if (x < -4 || x > width + 4 || y < -4 || y > height + 4) return null
  return { x, y, radius: Math.max(0.35, Math.min(2.2, star.size * scale)), alpha }
}
