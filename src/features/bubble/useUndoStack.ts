import { useCallback, useEffect, useRef, useState } from 'react'

export type UndoEntry = { label: string; revert: () => Promise<void> }

const MAX_DEPTH = 20

/**
 * Multi-step undo: every action pushes an entry; the newest is offered in a toast for `timeoutMs`
 * (paused while hovered/focused) and stays reachable via `undo()` (Ctrl/Cmd+Z) after the toast hides.
 */
export function useUndoStack(timeoutMs = 5000) {
  const [stack, setStack] = useState<UndoEntry[]>([])
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<number | null>(null)

  const clearTimer = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }, [])
  const armTimer = useCallback(() => {
    clearTimer()
    timer.current = window.setTimeout(() => setVisible(false), timeoutMs)
  }, [clearTimer, timeoutMs])
  useEffect(() => clearTimer, [clearTimer])

  const push = useCallback(
    (entry: UndoEntry) => {
      setStack((s) => [...s.slice(-(MAX_DEPTH - 1)), entry])
      setError(null)
      setVisible(true)
      armTimer()
    },
    [armTimer],
  )

  const dismiss = useCallback(() => {
    clearTimer()
    setVisible(false)
  }, [clearTimer])

  /** Drops the newest entry without reverting (e.g. when the action it belongs to failed). */
  const discard = useCallback(() => {
    setStack((s) => s.slice(0, -1))
    dismiss()
  }, [dismiss])

  const undo = useCallback(async () => {
    const entry = stack.at(-1)
    if (!entry || busy) return
    setBusy(true)
    clearTimer()
    try {
      await entry.revert()
      setStack((s) => (s.at(-1) === entry ? s.slice(0, -1) : s))
      setVisible(false)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not undo.')
      setVisible(true)
    } finally {
      setBusy(false)
    }
  }, [stack, busy, clearTimer])

  return { latest: stack.at(-1) ?? null, depth: stack.length, visible, busy, error, push, undo, discard, dismiss, pause: clearTimer, resume: armTimer }
}
