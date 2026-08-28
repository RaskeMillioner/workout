import { describe, expect, it } from 'vitest'
import type { RoutineBlock, SetEntry } from '../db/schema'
import {
  bestRepsByWeight,
  bestSetByEstimated1RM,
  bestSetByVolume,
  detectPRs,
  estimate1RM,
  isPR,
  sessionVolume,
  suggestNextTarget,
} from './records'

let counter = 0

/** Terse set factory — only the fields a given test cares about are spelled out. */
function set(partial: Partial<SetEntry> = {}): SetEntry {
  counter += 1
  return {
    id: `set-${counter}`,
    sessionId: 'session-1',
    exerciseId: 'squat',
    order: counter,
    kind: 'working',
    reps: 5,
    weightKg: 100,
    completed: true,
    updatedAt: 1_000 + counter,
    ...partial,
  }
}

describe('estimate1RM', () => {
  it('returns the lifted weight for a single', () => {
    expect(estimate1RM(140, 1)).toBe(140)
  })

  it('treats sub-1 rep counts as a single rather than extrapolating downwards', () => {
    expect(estimate1RM(140, 0.5)).toBe(140)
  })

  it('applies Epley for multi-rep sets', () => {
    expect(estimate1RM(100, 5)).toBeCloseTo(116.667, 3)
    expect(estimate1RM(100, 10)).toBeCloseTo(133.333, 3)
  })

  it('refuses to guess above the 12-rep cap', () => {
    expect(estimate1RM(100, 12)).toBeCloseTo(140, 6)
    expect(estimate1RM(100, 13)).toBeNaN()
    expect(estimate1RM(100, 20)).toBeNaN()
  })

  it('returns NaN for zero or negative input instead of a plausible 0', () => {
    expect(estimate1RM(100, 0)).toBeNaN()
    expect(estimate1RM(0, 5)).toBeNaN()
    expect(estimate1RM(-100, 5)).toBeNaN()
    expect(estimate1RM(100, -3)).toBeNaN()
    expect(estimate1RM(NaN, 5)).toBeNaN()
  })

  it('is monotonic in both weight and reps inside the trusted range', () => {
    expect(estimate1RM(100, 6)).toBeGreaterThan(estimate1RM(100, 5))
    expect(estimate1RM(102.5, 5)).toBeGreaterThan(estimate1RM(100, 5))
  })
})

describe('sessionVolume', () => {
  it('sums reps * weight over completed work sets', () => {
    const volume = sessionVolume([
      set({ reps: 5, weightKg: 100 }),
      set({ reps: 5, weightKg: 100 }),
      set({ reps: 8, weightKg: 60 }),
    ])
    expect(volume).toBe(1480)
  })

  it('excludes warmups even when they are completed', () => {
    expect(
      sessionVolume([
        set({ kind: 'warmup', reps: 10, weightKg: 60 }),
        set({ reps: 5, weightKg: 100 }),
      ]),
    ).toBe(500)
  })

  it('excludes incomplete sets even when they are working sets', () => {
    expect(
      sessionVolume([
        set({ reps: 5, weightKg: 100, completed: false }),
        set({ reps: 5, weightKg: 100 }),
      ]),
    ).toBe(500)
  })

  it('counts dropsets — they are work, not preparation', () => {
    expect(
      sessionVolume([set({ kind: 'dropset', reps: 10, weightKg: 40 })]),
    ).toBe(400)
  })

  it('is zero for an empty list and for bodyweight-only work', () => {
    expect(sessionVolume([])).toBe(0)
    expect(sessionVolume([set({ weightKg: 0, reps: 12 })])).toBe(0)
  })
})

describe('bestSetByEstimated1RM', () => {
  it('prefers the higher estimate, not the heavier bar', () => {
    const heavyLowRep = set({ weightKg: 120, reps: 2 }) // 128
    const lightHighRep = set({ weightKg: 110, reps: 6 }) // 132
    expect(bestSetByEstimated1RM([heavyLowRep, lightHighRep])).toBe(lightHighRep)
  })

  it('ignores warmups, incomplete sets and out-of-range rep counts', () => {
    const working = set({ weightKg: 100, reps: 5 })
    expect(
      bestSetByEstimated1RM([
        set({ kind: 'warmup', weightKg: 200, reps: 5 }),
        set({ weightKg: 300, reps: 5, completed: false }),
        set({ weightKg: 90, reps: 20 }),
        working,
      ]),
    ).toBe(working)
  })

  it('returns undefined when nothing qualifies', () => {
    expect(bestSetByEstimated1RM([])).toBeUndefined()
    expect(bestSetByEstimated1RM([set({ kind: 'warmup' })])).toBeUndefined()
  })
})

describe('bestSetByVolume', () => {
  it('picks the highest reps * weight, not the heaviest weight', () => {
    const highVolume = set({ weightKg: 24, reps: 30 }) // 720
    const heavyLowVolume = set({ weightKg: 40, reps: 10 }) // 400
    expect(bestSetByVolume([heavyLowVolume, highVolume])).toBe(highVolume)
  })

  it('excludes warmups and incomplete sets', () => {
    const working = set({ weightKg: 24, reps: 20 })
    expect(
      bestSetByVolume([
        set({ kind: 'warmup', weightKg: 100, reps: 30 }),
        set({ weightKg: 100, reps: 30, completed: false }),
        working,
      ]),
    ).toBe(working)
  })

  it('keeps the earlier set on a tie in volume', () => {
    const first = set({ weightKg: 24, reps: 30 })
    const tie = set({ weightKg: 30, reps: 24 })
    expect(bestSetByVolume([first, tie])).toBe(first)
  })

  it('returns undefined for empty input and for all-warmup input', () => {
    expect(bestSetByVolume([])).toBeUndefined()
    expect(bestSetByVolume([set({ kind: 'warmup' })])).toBeUndefined()
  })
})

describe('bestRepsByWeight', () => {
  it('maps each distinct load to its highest-rep set', () => {
    const twentyFour30 = set({ weightKg: 24, reps: 30 })
    const twentyFour25 = set({ weightKg: 24, reps: 25 })
    const twentyEight20 = set({ weightKg: 28, reps: 20 })
    const map = bestRepsByWeight([twentyFour30, twentyFour25, twentyEight20])
    expect(map.get(24)).toBe(twentyFour30)
    expect(map.get(28)).toBe(twentyEight20)
    expect(map.size).toBe(2)
  })

  it('excludes warmups and incomplete sets', () => {
    const working = set({ weightKg: 24, reps: 20 })
    const map = bestRepsByWeight([
      set({ kind: 'warmup', weightKg: 24, reps: 40 }),
      set({ weightKg: 24, reps: 40, completed: false }),
      working,
    ])
    expect(map.get(24)).toBe(working)
    expect(map.size).toBe(1)
  })

  it('keeps the earlier set on a tie in reps at the same load', () => {
    const first = set({ weightKg: 24, reps: 20 })
    const tie = set({ weightKg: 24, reps: 20 })
    expect(bestRepsByWeight([first, tie]).get(24)).toBe(first)
  })

  it('returns an empty map for empty input', () => {
    expect(bestRepsByWeight([]).size).toBe(0)
  })

  it('a swings-only high-rep history yields volume and reps-by-weight records while the 1RM stays undefined', () => {
    const history = [
      set({ weightKg: 24, reps: 30 }),
      set({ weightKg: 24, reps: 25 }),
      set({ weightKg: 28, reps: 20 }),
    ]
    expect(bestSetByVolume(history)).toBe(history[0])
    const map = bestRepsByWeight(history)
    expect(map.get(24)).toBe(history[0])
    expect(map.get(28)).toBe(history[2])
    expect(bestSetByEstimated1RM(history)).toBeUndefined()
  })

  it('a normal low-rep history still produces an estimated 1RM exactly as before', () => {
    const history = [set({ weightKg: 100, reps: 5 }), set({ weightKg: 120, reps: 2 })]
    expect(bestSetByEstimated1RM(history)).toBe(history[1])
  })
})

describe('detectPRs', () => {
  it('keeps the heaviest set at each rep count', () => {
    const light = set({ reps: 5, weightKg: 100 })
    const heavy = set({ reps: 5, weightKg: 105 })
    const eights = set({ reps: 8, weightKg: 80 })
    const { bestByReps } = detectPRs([light, heavy, eights])
    expect(bestByReps.get(5)).toBe(heavy)
    expect(bestByReps.get(8)).toBe(eights)
    expect(bestByReps.size).toBe(2)
  })

  it('keeps the earlier set on a tie — matching a record is not setting one', () => {
    const first = set({ reps: 5, weightKg: 100 })
    const tie = set({ reps: 5, weightKg: 100 })
    expect(detectPRs([first, tie]).bestByReps.get(5)).toBe(first)
  })

  it('skips warmups and incomplete sets', () => {
    const { bestByReps, bestEstimated1RM } = detectPRs([
      set({ kind: 'warmup', reps: 3, weightKg: 200 }),
      set({ reps: 3, weightKg: 300, completed: false }),
    ])
    expect(bestByReps.size).toBe(0)
    expect(bestEstimated1RM).toBeUndefined()
  })

  it('reports the best estimated 1RM alongside the rep table', () => {
    const best = set({ reps: 3, weightKg: 130 })
    const { bestEstimated1RM } = detectPRs([set({ reps: 5, weightKg: 100 }), best])
    expect(bestEstimated1RM).toBe(best)
  })
})

describe('isPR', () => {
  const history = [
    set({ reps: 5, weightKg: 100 }),
    set({ reps: 8, weightKg: 80 }),
    set({ reps: 3, weightKg: 120 }),
  ]

  it('is true when the candidate beats the best at its rep count', () => {
    expect(isPR(set({ reps: 5, weightKg: 102.5 }), history)).toBe(true)
  })

  it('is false on a tie', () => {
    expect(isPR(set({ reps: 5, weightKg: 100 }), history)).toBe(false)
  })

  it('is false when lighter, even if it beats other rep counts', () => {
    expect(isPR(set({ reps: 5, weightKg: 95 }), history)).toBe(false)
  })

  it('compares only within the same rep count', () => {
    // 6 reps has no history at all, so any completed set is a record.
    expect(isPR(set({ reps: 6, weightKg: 60 }), history)).toBe(true)
  })

  it('ignores the candidate itself if it is already in the history array', () => {
    const candidate = set({ reps: 5, weightKg: 102.5 })
    expect(isPR(candidate, [...history, candidate])).toBe(true)
  })

  it('ignores warmup and incomplete history entries', () => {
    expect(
      isPR(set({ reps: 5, weightKg: 90 }), [
        set({ reps: 5, weightKg: 200, kind: 'warmup' }),
        set({ reps: 5, weightKg: 200, completed: false }),
      ]),
    ).toBe(true)
  })

  it('is never a PR when the candidate is a warmup or was not completed', () => {
    expect(isPR(set({ reps: 5, weightKg: 500, kind: 'warmup' }), history)).toBe(false)
    expect(isPR(set({ reps: 5, weightKg: 500, completed: false }), history)).toBe(false)
  })
})

describe('suggestNextTarget', () => {
  const block = (overrides: Partial<RoutineBlock> = {}): RoutineBlock => ({
    exerciseId: 'squat',
    targetSets: 3,
    repRangeLow: 8,
    repRangeHigh: 12,
    progression: 'double-progression',
    incrementKg: 2.5,
    ...overrides,
  })

  const session = (id: string, weightKg: number, reps: number[], stampBase: number): SetEntry[] =>
    reps.map((r, i) =>
      set({ sessionId: id, weightKg, reps: r, updatedAt: stampBase + i }),
    )

  it('starts from the bottom of the range with no history', () => {
    expect(suggestNextTarget(block(), [])).toEqual({ weightKg: 0, reps: 8 })
  })

  it('double progression: adds a rep while below the top of the range', () => {
    const history = session('s1', 60, [8, 8, 8], 100)
    expect(suggestNextTarget(block(), history)).toEqual({ weightKg: 60, reps: 9 })
  })

  it('double progression: chases the weakest set, not the best one', () => {
    const history = session('s1', 60, [12, 10, 9], 100)
    expect(suggestNextTarget(block(), history)).toEqual({ weightKg: 60, reps: 10 })
  })

  it('double progression: rolls over to more weight at the top of the range', () => {
    const history = session('s1', 60, [12, 12, 12], 100)
    expect(suggestNextTarget(block(), history)).toEqual({ weightKg: 62.5, reps: 8 })
  })

  it('double progression: does not roll over until every target set is done', () => {
    const history = session('s1', 60, [12, 12], 100) // only 2 of 3 sets
    expect(suggestNextTarget(block(), history)).toEqual({ weightKg: 60, reps: 12 })
  })

  it('only looks at the most recent session', () => {
    const history = [
      ...session('old', 50, [12, 12, 12], 100),
      ...session('recent', 60, [8, 8, 8], 500),
    ]
    expect(suggestNextTarget(block(), history)).toEqual({ weightKg: 60, reps: 9 })
  })

  it('is not fooled by the order the history array happens to be in', () => {
    const history = [
      ...session('recent', 60, [8, 8, 8], 500),
      ...session('old', 50, [12, 12, 12], 100),
    ]
    expect(suggestNextTarget(block(), history)).toEqual({ weightKg: 60, reps: 9 })
  })

  it('ignores warmups when reading the last session', () => {
    const history = [
      set({ sessionId: 's1', kind: 'warmup', weightKg: 20, reps: 10, updatedAt: 100 }),
      ...session('s1', 60, [8, 8, 8], 200),
    ]
    expect(suggestNextTarget(block(), history)).toEqual({ weightKg: 60, reps: 9 })
  })

  it('linear: adds the increment every session and pins reps to the bottom', () => {
    const history = session('s1', 100, [5, 5, 5], 100)
    expect(
      suggestNextTarget(
        block({ progression: 'linear', repRangeLow: 5, repRangeHigh: 5, incrementKg: 5 }),
        history,
      ),
    ).toEqual({ weightKg: 105, reps: 5 })
  })

  it('linear: falls back to a 2.5 kg step when the block has no increment', () => {
    const history = session('s1', 100, [5, 5, 5], 100)
    expect(
      suggestNextTarget(
        block({ progression: 'linear', incrementKg: undefined }),
        history,
      ).weightKg,
    ).toBe(102.5)
  })

  it('none: repeats what was done last time', () => {
    const history = session('s1', 70, [10, 9, 8], 100)
    expect(suggestNextTarget(block({ progression: 'none' }), history)).toEqual({
      weightKg: 70,
      reps: 8,
    })
  })

  it('never suggests reps outside the configured range', () => {
    // Last session overshot the top of the range; the suggestion stays capped.
    const history = session('s1', 60, [15, 15, 15], 100)
    const next = suggestNextTarget(block(), history)
    expect(next).toEqual({ weightKg: 62.5, reps: 8 })
  })
})
