import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __testing, useRestTimer } from './useRestTimer'

const { remainingFrom, STORAGE_KEY } = __testing

describe('remainingFrom', () => {
  const start = 1_000_000

  it('reports the full duration at the moment of starting', () => {
    expect(remainingFrom({ startedAt: start, durationSec: 90 }, start)).toBe(90)
  })

  it('counts down in whole seconds', () => {
    expect(remainingFrom({ startedAt: start, durationSec: 90 }, start + 30_000)).toBe(60)
  })

  it('goes negative once the target has passed rather than clamping', () => {
    expect(remainingFrom({ startedAt: start, durationSec: 90 }, start + 100_000)).toBe(-10)
  })

  it('is correct after a long suspension, not just a short tick', () => {
    // The whole point: an hour asleep must not leave the timer thinking
    // only a few frames elapsed.
    expect(remainingFrom({ startedAt: start, durationSec: 120 }, start + 3_600_000)).toBe(-3480)
  })
})

describe('useRestTimer', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(1_000_000)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts idle when nothing is persisted', () => {
    const { result } = renderHook(() => useRestTimer())
    expect(result.current.running).toBe(false)
    expect(result.current.overrun).toBe(false)
  })

  it('persists across a remount, which is what a killed tab looks like', () => {
    const first = renderHook(() => useRestTimer())
    act(() => first.result.current.start(120))
    first.unmount()

    vi.setSystemTime(1_000_000 + 45_000)
    const second = renderHook(() => useRestTimer())
    expect(second.result.current.running).toBe(true)
    expect(second.result.current.remainingSec).toBe(75)
  })

  it('reports overrun after the target elapses', () => {
    const { result } = renderHook(() => useRestTimer())
    act(() => result.current.start(60))
    expect(result.current.overrun).toBe(false)

    act(() => {
      vi.setSystemTime(1_000_000 + 61_000)
      vi.advanceTimersByTime(300)
    })
    expect(result.current.overrun).toBe(true)
    expect(result.current.remainingSec).toBeLessThan(0)
  })

  it('clears persisted state on stop', () => {
    const { result } = renderHook(() => useRestTimer())
    act(() => result.current.start(90))
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()

    act(() => result.current.stop())
    expect(result.current.running).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('extends the target without restarting the countdown', () => {
    const { result } = renderHook(() => useRestTimer())
    act(() => result.current.start(60))

    act(() => {
      vi.setSystemTime(1_000_000 + 20_000)
      result.current.adjust(30)
    })
    // 90s target, 20s elapsed — the clock keeps running, it does not reset.
    expect(result.current.remainingSec).toBe(70)
  })

  it('ignores a corrupt persisted value instead of throwing', () => {
    localStorage.setItem(STORAGE_KEY, '{ not json')
    const { result } = renderHook(() => useRestTimer())
    expect(result.current.running).toBe(false)
  })
})
