import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'workout.restTimer'

type PersistedTimer = {
  /** Epoch ms when the rest period started. */
  startedAt: number
  /** Target rest duration in seconds. */
  durationSec: number
}

export type RestTimer = {
  /** Whole seconds remaining; negative once the timer has overrun. */
  remainingSec: number
  running: boolean
  /** True once the target has elapsed but the user hasn't dismissed it. */
  overrun: boolean
  durationSec: number
  start: (durationSec: number) => void
  stop: () => void
  /** Nudge the target up or down mid-rest, e.g. +30s on a heavy set. */
  adjust: (deltaSec: number) => void
}

function read(): PersistedTimer | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedTimer>
    if (typeof parsed?.startedAt !== 'number' || typeof parsed?.durationSec !== 'number') {
      return null
    }
    return { startedAt: parsed.startedAt, durationSec: parsed.durationSec }
  } catch {
    // A corrupt or unavailable store must never break the logging screen.
    return null
  }
}

function write(value: PersistedTimer | null) {
  try {
    if (value === null) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Private mode / quota: the timer degrades to in-memory only.
  }
}

function remainingFrom(timer: PersistedTimer, now: number): number {
  return Math.ceil((timer.startedAt + timer.durationSec * 1000 - now) / 1000)
}

/**
 * Rest timer that stays correct across screen lock and app suspension.
 *
 * Background tabs get their timers throttled or frozen entirely — on iOS a
 * locked screen suspends the page — so elapsed time is always recomputed from
 * a persisted start timestamp rather than accumulated tick by tick. The
 * interval only drives re-renders; it is never the source of truth.
 */
export function useRestTimer(): RestTimer {
  const [timer, setTimer] = useState<PersistedTimer | null>(() => read())
  const [now, setNow] = useState(() => Date.now())
  const timerRef = useRef(timer)
  timerRef.current = timer

  useEffect(() => {
    if (!timer) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [timer])

  // Resync the moment the page comes back to the foreground, so the display is
  // already correct on the first paint rather than up to a tick stale.
  useEffect(() => {
    const resync = () => {
      if (document.visibilityState === 'visible') setNow(Date.now())
    }
    document.addEventListener('visibilitychange', resync)
    window.addEventListener('focus', resync)
    return () => {
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('focus', resync)
    }
  }, [])

  const start = useCallback((durationSec: number) => {
    const next = { startedAt: Date.now(), durationSec }
    write(next)
    setTimer(next)
    setNow(Date.now())
  }, [])

  const stop = useCallback(() => {
    write(null)
    setTimer(null)
  }, [])

  const adjust = useCallback((deltaSec: number) => {
    const current = timerRef.current
    if (!current) return
    const next = {
      ...current,
      durationSec: Math.max(0, current.durationSec + deltaSec),
    }
    write(next)
    setTimer(next)
    // Refresh `now` alongside the target, or the next paint uses a stale
    // clock and briefly shows the wrong remaining time.
    setNow(Date.now())
  }, [])

  const remainingSec = timer ? remainingFrom(timer, now) : 0

  return {
    remainingSec,
    running: timer !== null,
    overrun: timer !== null && remainingSec <= 0,
    durationSec: timer?.durationSec ?? 0,
    start,
    stop,
    adjust,
  }
}

export const __testing = { remainingFrom, STORAGE_KEY }
