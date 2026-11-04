import { useCallback, useState } from 'react'

/**
 * `useState` persisted to localStorage. Storage failures (private mode, quota) are ignored
 * so UI preferences never break the app.
 */
export function useLocalStorageState<T>(key: string, initial: T, isValid: (v: unknown) => v is T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw)
        if (isValid(parsed)) return parsed
      }
    } catch {
      /* ignore */
    }
    return initial
  })

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved))
        } catch {
          /* ignore */
        }
        return resolved
      })
    },
    [key],
  )

  return [value, set] as const
}
