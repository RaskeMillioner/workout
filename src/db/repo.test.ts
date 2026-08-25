import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, newId, now } from './schema'
import {
  addCardio,
  addSet,
  deleteSession,
  finishSession,
  getActiveSession,
  lastWorkingSet,
  startSession,
  todayISO,
} from './repo'

beforeEach(async () => {
  await Promise.all([
    db.sessions.clear(),
    db.setEntries.clear(),
    db.cardioEntries.clear(),
    db.exercises.clear(),
  ])
})

afterEach(async () => {
  await Promise.all([db.sessions.clear(), db.setEntries.clear(), db.cardioEntries.clear()])
})

const EX = 'exercise-1'

describe('todayISO', () => {
  it('formats a date as yyyy-mm-dd', () => {
    expect(todayISO(new Date(2026, 0, 5, 9, 30))).toBe('2026-01-05')
  })

  it('uses the local calendar day, not UTC', () => {
    // A 22:00 session in a positive-offset zone is still today. Using
    // toISOString here would file it under tomorrow.
    const late = new Date(2026, 2, 14, 22, 45)
    expect(todayISO(late)).toBe('2026-03-14')
  })

  it('pads single-digit months and days', () => {
    expect(todayISO(new Date(2026, 8, 3))).toBe('2026-09-03')
  })
})

describe('session lifecycle', () => {
  it('returns the existing session rather than opening a second one', async () => {
    const first = await startSession()
    const second = await startSession()
    expect(second).toBe(first)
    expect(await db.sessions.count()).toBe(1)
  })

  it('reports no active session once finished', async () => {
    const id = await startSession()
    expect((await getActiveSession())?.id).toBe(id)

    await finishSession(id)
    expect(await getActiveSession()).toBeUndefined()
  })

  it('discards sets left unticked, keeping only work actually done', async () => {
    const id = await startSession()
    const doneId = await addSet(id, EX, { reps: 5, weightKg: 100 })
    await db.setEntries.update(doneId, { completed: true })
    await addSet(id, EX, { reps: 5, weightKg: 100 })

    await finishSession(id)

    const remaining = await db.setEntries.where('sessionId').equals(id).toArray()
    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.id).toBe(doneId)
  })

  it('records perceived effort when given', async () => {
    const id = await startSession()
    await finishSession(id, 8)
    expect((await db.sessions.get(id))?.perceivedEffort).toBe(8)
  })

  it('deleting a session takes its sets and cardio with it', async () => {
    const id = await startSession()
    await addSet(id, EX)
    await addCardio(id, EX, { durationSec: 600 })

    await deleteSession(id)

    expect(await db.sessions.get(id)).toBeUndefined()
    expect(await db.setEntries.where('sessionId').equals(id).count()).toBe(0)
    expect(await db.cardioEntries.where('sessionId').equals(id).count()).toBe(0)
  })
})

describe('addSet prefill', () => {
  it('falls back to sane defaults with no history at all', async () => {
    const id = await startSession()
    const setId = await addSet(id, EX)
    const entry = await db.setEntries.get(setId)
    expect(entry?.reps).toBe(8)
    expect(entry?.weightKg).toBe(0)
    expect(entry?.completed).toBe(false)
  })

  it('copies the previous set in the same session', async () => {
    const id = await startSession()
    await addSet(id, EX, { reps: 3, weightKg: 140 })
    const secondId = await addSet(id, EX)

    const second = await db.setEntries.get(secondId)
    expect(second?.reps).toBe(3)
    expect(second?.weightKg).toBe(140)
  })

  it('carries the last working set forward from a previous session', async () => {
    const older = await startSession()
    const setId = await addSet(older, EX, { reps: 6, weightKg: 92.5 })
    await db.setEntries.update(setId, { completed: true })
    await finishSession(older)

    const today = await startSession()
    const fresh = await db.setEntries.get(await addSet(today, EX))
    expect(fresh?.reps).toBe(6)
    expect(fresh?.weightKg).toBe(92.5)
  })

  it('prefers the most recent session over a recently edited old set', async () => {
    // An old set corrected today has a newer updatedAt than anything else;
    // recency must come from the session, not the write stamp.
    const old = await startSession()
    const oldSetId = await addSet(old, EX, { reps: 5, weightKg: 60 })
    await db.setEntries.update(oldSetId, { completed: true })
    await finishSession(old)
    await db.sessions.update(old, { startedAt: Date.now() - 180 * 86_400_000 })

    const recent = await startSession()
    const recentSetId = await addSet(recent, EX, { reps: 5, weightKg: 100 })
    await db.setEntries.update(recentSetId, { completed: true })
    await finishSession(recent)

    // Now edit the ancient set, giving it the newest updatedAt in the table.
    await db.setEntries.update(oldSetId, { weightKg: 62.5, updatedAt: Date.now() + 1000 })

    expect((await lastWorkingSet(EX))?.weightKg).toBe(100)
  })

  it('ignores sets whose session no longer exists', async () => {
    const orphaned = await startSession()
    const orphanId = await addSet(orphaned, EX, { reps: 5, weightKg: 200 })
    await db.setEntries.update(orphanId, { completed: true })
    await finishSession(orphaned)
    // Delete the session row but leave the set, simulating partial cleanup.
    await db.sessions.delete(orphaned)

    const live = await startSession()
    const liveId = await addSet(live, EX, { reps: 5, weightKg: 90 })
    await db.setEntries.update(liveId, { completed: true })
    await finishSession(live)

    expect((await lastWorkingSet(EX))?.weightKg).toBe(90)
  })

  it('never prefills from a warmup', async () => {
    await db.setEntries.add({
      id: newId(),
      sessionId: 'old-session',
      exerciseId: EX,
      order: 0,
      kind: 'warmup',
      reps: 12,
      weightKg: 20,
      completed: true,
      updatedAt: now(),
    })
    expect(await lastWorkingSet(EX)).toBeUndefined()
  })

  it('orders new entries after existing cardio, not on top of it', async () => {
    const id = await startSession()
    await addCardio(id, EX, { durationSec: 900 })
    const setId = await addSet(id, EX)
    expect((await db.setEntries.get(setId))?.order).toBe(1)
  })
})
