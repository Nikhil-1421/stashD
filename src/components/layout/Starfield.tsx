import { useEffect, useRef } from 'react'
import { createStars, projectStar, starCount, STAR_TONES } from './starfield-model'

/** Units of depth per second. Slow on purpose: a star takes well over a minute to drift past. */
const SPEED = 16
const FRAME_MS = 1000 / 30

/**
 * Fixed, decorative background: a slow flight through a black field of brand-gold stars. Sits at
 * z-index -1 behind every page (the page ground is on <html>, <body> is transparent), ignores
 * pointer events, pauses when the tab is hidden, and renders a single still frame when the user
 * prefers reduced motion.
 */
export function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext?.('2d') ?? null
    if (!canvas || !ctx) return

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const state = { width: 0, height: 0, stars: createStars(0), camZ: 0, time: 0, last: 0, frame: 0 }

    const draw = () => {
      const { width, height, stars, camZ, time } = state
      // A barely-there sway keeps the flight from feeling like a straight zoom.
      const camX = Math.sin(time * 0.05) * 46
      const camY = Math.sin(time * 0.037 + 1.1) * 30
      ctx.clearRect(0, 0, width, height)
      for (const star of stars) {
        const p = projectStar(star, camZ, camX, camY, width, height)
        if (!p) continue
        const twinkle = reduceMotion ? 1 : 0.82 + 0.18 * Math.sin(time * 0.7 + star.phase)
        ctx.fillStyle = `rgba(${STAR_TONES[star.tone]},${(p.alpha * twinkle * 0.9).toFixed(3)})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const resize = () => {
      state.width = window.innerWidth
      state.height = window.innerHeight
      canvas.width = Math.round(state.width * dpr)
      canvas.height = Math.round(state.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const wanted = starCount(state.width, state.height)
      if (wanted !== state.stars.length) state.stars = createStars(wanted)
      draw()
    }

    const tick = (now: number) => {
      state.frame = window.requestAnimationFrame(tick)
      const elapsed = now - state.last
      if (elapsed < FRAME_MS) return
      // Clamp long gaps (tab was hidden, device slept) so the field never lurches forward.
      const dt = Math.min(elapsed, 100) / 1000
      state.last = now
      state.time += dt
      state.camZ += SPEED * dt
      draw()
    }
    const start = () => {
      if (reduceMotion || state.frame !== 0) return
      state.last = performance.now()
      state.frame = window.requestAnimationFrame(tick)
    }
    const stop = () => {
      if (state.frame !== 0) window.cancelAnimationFrame(state.frame)
      state.frame = 0
    }
    const onVisibility = () => (document.hidden ? stop() : start())

    resize()
    start()
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 h-full w-full" />
}
