import { describe, expect, it } from 'vitest'
import { createStars, depthAlpha, FIELD, projectStar, relativeDepth, starCount } from './starfield-model'

describe('starfield model', () => {
  it('is deterministic for a seed and stays inside the volume', () => {
    const a = createStars(50, 7)
    expect(createStars(50, 7)).toEqual(a)
    expect(createStars(50, 8)).not.toEqual(a)
    for (const s of a) {
      expect(Math.abs(s.x)).toBeLessThanOrEqual(FIELD.spreadX)
      expect(Math.abs(s.y)).toBeLessThanOrEqual(FIELD.spreadY)
      expect(s.z).toBeGreaterThanOrEqual(0)
      expect(s.z).toBeLessThan(FIELD.depth)
    }
  })

  it('scales the star count with the viewport and clamps it', () => {
    expect(starCount(360, 640)).toBe(240)
    expect(starCount(1440, 900)).toBe(682)
    expect(starCount(3840, 2160)).toBe(960)
  })

  it('wraps depth so a star behind the camera reappears at the far plane', () => {
    expect(relativeDepth(500, 100)).toBe(400)
    expect(relativeDepth(100, 500)).toBe(FIELD.depth - 400)
    expect(relativeDepth(110, 100)).toBe(FIELD.depth + 10) // inside the near plane → pushed a full lap away
  })

  it('fades stars in at the far plane and out at the near plane', () => {
    expect(depthAlpha(FIELD.depth)).toBe(0)
    expect(depthAlpha(FIELD.near)).toBe(0)
    expect(depthAlpha(FIELD.depth * 0.5)).toBe(1)
  })

  it('projects with perspective: nearer stars sit further from the centre and draw larger', () => {
    const star = { x: 200, y: 0, z: 0, size: 1, tone: 0 as const, phase: 0 }
    const far = projectStar(star, -1000, 0, 0, 1000, 800)
    const near = projectStar(star, -400, 0, 0, 1000, 800)
    expect(far && near).toBeTruthy()
    expect(near!.x - 500).toBeGreaterThan(far!.x - 500)
    expect(near!.radius).toBeGreaterThan(far!.radius)
    expect(projectStar({ ...star, x: 5000 }, -400, 0, 0, 1000, 800)).toBeNull()
  })
})
