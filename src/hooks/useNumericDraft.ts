import { useEffect, useRef, useState } from 'react'

/** Strip float noise without changing what the user typed: 82.50000001 → "82.5". */
export const formatNumeric = (value: number, decimals: number): string =>
  Number.isFinite(value) ? String(Number(value.toFixed(decimals))) : ''

type Options = {
  value: number
  onCommit: (value: number) => void
  decimals?: number
  min?: number
  /** Round committed values to whole numbers (reps). */
  integer?: boolean
}

/**
 * Keeps the raw text authoritative while a numeric field has focus.
 *
 * Deriving the displayed string from the parsed number on every keystroke
 * destroys any input that is only part-way to being valid: typing "82.5" parses
 * "82." to 82, re-renders as "82", and the next keystroke silently yields 825.
 * The draft holds what was actually typed until focus leaves.
 */
export function useNumericDraft({ value, onCommit, decimals = 1, min = 0, integer }: Options) {
  const [draft, setDraft] = useState<string | null>(null)
  const ref = useRef<HTMLInputElement>(null)

  // Adopt external changes (steppers, unit switches, a live-query refresh) only
  // while not editing, so nothing yanks text out from under the cursor.
  useEffect(() => {
    if (draft === null) return
    if (document.activeElement !== ref.current) setDraft(null)
  }, [value, draft])

  return {
    ref,
    value: draft ?? formatNumeric(value, decimals),
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      const text = event.target.value
      setDraft(text)
      const parsed = Number(text.replace(',', '.'))
      // "82." and "" are valid things to be typing, but not values to store.
      if (text.trim() === '' || !Number.isFinite(parsed)) return
      onCommit(Math.max(min, integer ? Math.round(parsed) : parsed))
    },
    onFocus: (event: React.FocusEvent<HTMLInputElement>) => event.target.select(),
    onBlur: () => setDraft(null),
    /** Call before a programmatic change so the draft does not mask it. */
    reset: () => setDraft(null),
  }
}
