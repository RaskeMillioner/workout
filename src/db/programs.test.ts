import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { RoutineBlock } from './schema'
import { db, newId, now } from './schema'
import { createProgram, createRoutine, nextRoutineInProgram, startSessionFromRoutine } from './repo'
import { suggestNextTarget } from '../lib/records'

beforeEach(async () => {
  await Promise.all([db.sessions.clear(), db.setEntries.clear(), db.routines.clear(), db.programs.clear()])
})

const EX = 'exercise-1'
const EX2 = 'exercise-2'

/** Insert a finished session directly, bypassing startSession, so tests can
 *  control routineId/startedAt/endedAt precisely. */
async function addFinishedSession(routineId: string, startedAt: number): Promise<string> {
  const id = newId()
  await db.sessions.add({
    id,
    date: '2026-01-01',
    startedAt,
    endedAt: startedAt + 3600_000,
    routineId,
    updatedAt: now(),
  })
  return id
}

describe('nextRoutineInProgram', () => {
  it('returns undefined when the program does not exist', async () => {
    expect(await nextRoutineInProgram('does-not-exist')).toBeUndefined()
  })

  it('returns undefined when the program has no routines', async () => {
    const programId = await createProgram('Empty', [])
    expect(await nextRoutineInProgram(programId)).toBeUndefined()
  })

  it('starts at the first routine with no session history', async () => {
    const a = await createRoutine('A')
    const b = await createRoutine('B')
    const programId = await createProgram('A/B', [a, b])

    expect((await nextRoutineInProgram(programId))?.id).toBe(a)
  })

  it('advances to the routine after the most recent finished session', async () => {
    const a = await createRoutine('A')
    const b = await createRoutine('B')
    const programId = await createProgram('A/B', [a, b])
    await addFinishedSession(a, Date.now())

    expect((await nextRoutineInProgram(programId))?.id).toBe(b)
  })

  it('wraps the rotation: after the last routine, the next is the first', async () => {
    const a = await createRoutine('A')
    const b = await createRoutine('B')
    const programId = await createProgram('A/B', [a, b])
    await addFinishedSession(b, Date.now())

    expect((await nextRoutineInProgram(programId))?.id).toBe(a)
  })

  it('restarts at the first routine when the last session routine has left the rotation', async () => {
    const a = await createRoutine('A')
    const b = await createRoutine('B')
    const c = await createRoutine('C')
    const programId = await createProgram('A/B', [a, b]) // c is not part of this rotation
    await addFinishedSession(c, Date.now())

    expect((await nextRoutineInProgram(programId))?.id).toBe(a)
    // sanity: c really was in the DB and really is not in the rotation
    expect((await db.routines.get(c))?.id).toBe(c)
  })

  it('uses the most recent finished session, not the earliest', async () => {
    const a = await createRoutine('A')
    const b = await createRoutine('B')
    const programId = await createProgram('A/B', [a, b])
    await addFinishedSession(a, Date.now() - 2 * 86_400_000)
    await addFinishedSession(b, Date.now() - 86_400_000)
    await addFinishedSession(a, Date.now())

    // Most recent finished session was routine A, so next is B.
    expect((await nextRoutineInProgram(programId))?.id).toBe(b)
  })

  it('ignores sessions whose routine belongs to a different program', async () => {
    const a = await createRoutine('A')
    const b = await createRoutine('B')
    const programId = await createProgram('A/B', [a, b])

    const otherRoutine = await createRoutine('Other')
    await createProgram('Other Program', [otherRoutine])
    await addFinishedSession(otherRoutine, Date.now())

    // The other program's session must not influence this program's rotation.
    expect((await nextRoutineInProgram(programId))?.id).toBe(a)
  })

  it('does not let an unfinished session advance the rotation', async () => {
    const a = await createRoutine('A')
    const b = await createRoutine('B')
    const programId = await createProgram('A/B', [a, b])
    // A finished session for A puts the rotation at B...
    await addFinishedSession(a, Date.now() - 10_000)
    // ...and a later, still-open session for B must be ignored entirely, or
    // it would wrongly advance the rotation back around to A.
    await db.sessions.add({
      id: newId(),
      date: '2026-01-01',
      startedAt: Date.now(),
      routineId: b,
      updatedAt: now(),
    })

    expect((await nextRoutineInProgram(programId))?.id).toBe(b)
  })

  it('returns undefined if the resolved routine no longer exists', async () => {
    const a = await createRoutine('A')
    const b = await createRoutine('B')
    const programId = await createProgram('A/B', [a, b])
    await addFinishedSession(a, Date.now())
    await db.routines.delete(b)

    expect(await nextRoutineInProgram(programId)).toBeUndefined()
  })
})

describe('startSessionFromRoutine', () => {
  it('creates targetSets entries per block, in block order, seeded from suggestNextTarget history', async () => {
    const blockA: RoutineBlock = {
      exerciseId: EX,
      targetSets: 3,
      repRangeLow: 8,
      repRangeHigh: 12,
      progression: 'double-progression',
      incrementKg: 2.5,
    }
    const blockB: RoutineBlock = {
      exerciseId: EX2,
      targetSets: 2,
      repRangeLow: 5,
      repRangeHigh: 8,
      progression: 'linear',
      incrementKg: 5,
    }
    const routineId = await createRoutine('Push', [blockA, blockB])

    // History for EX only: a prior finished session with three work sets.
    const priorSessionId = await addFinishedSession(routineId, Date.now() - 86_400_000)
    for (const reps of [12, 12, 10]) {
      await db.setEntries.add({
        id: newId(),
        sessionId: priorSessionId,
        exerciseId: EX,
        order: 0,
        kind: 'working',
        reps,
        weightKg: 60,
        completed: true,
        updatedAt: now(),
      })
    }

    const historyEX = await db.setEntries.where('exerciseId').equals(EX).toArray()
    const expectedEX = suggestNextTarget(blockA, historyEX)
    const expectedEX2 = suggestNextTarget(blockB, [])

    const sessionId = await startSessionFromRoutine(routineId)

    expect((await db.sessions.get(sessionId))?.routineId).toBe(routineId)

    const entries = (await db.setEntries.where('sessionId').equals(sessionId).toArray()).sort(
      (a, b) => a.order - b.order,
    )
    expect(entries).toHaveLength(5)
    expect(entries.map((e) => e.order)).toEqual([0, 1, 2, 3, 4])
    for (const entry of entries) {
      expect(entry.kind).toBe('working')
      expect(entry.completed).toBe(false)
    }

    const exEntries = entries.slice(0, 3)
    for (const entry of exEntries) {
      expect(entry.exerciseId).toBe(EX)
      expect(entry.weightKg).toBe(expectedEX.weightKg)
      expect(entry.reps).toBe(expectedEX.reps)
    }

    const ex2Entries = entries.slice(3, 5)
    for (const entry of ex2Entries) {
      expect(entry.exerciseId).toBe(EX2)
      expect(entry.weightKg).toBe(expectedEX2.weightKg)
      expect(entry.reps).toBe(expectedEX2.reps)
    }
  })

  it('produces entries with no history, matching what suggestNextTarget returns for an empty history', async () => {
    const block: RoutineBlock = {
      exerciseId: EX,
      targetSets: 4,
      repRangeLow: 6,
      repRangeHigh: 10,
      progression: 'double-progression',
    }
    const routineId = await createRoutine('Fresh', [block])
    const expected = suggestNextTarget(block, [])

    const sessionId = await startSessionFromRoutine(routineId)
    const entries = await db.setEntries.where('sessionId').equals(sessionId).toArray()

    expect(entries).toHaveLength(4)
    for (const entry of entries) {
      expect(entry.weightKg).toBe(expected.weightKg)
      expect(entry.reps).toBe(expected.reps)
      expect(entry.completed).toBe(false)
    }
  })

  it('returns the existing open session rather than starting a second one', async () => {
    const block: RoutineBlock = {
      exerciseId: EX,
      targetSets: 3,
      repRangeLow: 8,
      repRangeHigh: 12,
      progression: 'none',
    }
    const routineId = await createRoutine('Push', [block])
    const otherRoutineId = await createRoutine('Pull', [block])

    const first = await startSessionFromRoutine(routineId)
    const second = await startSessionFromRoutine(otherRoutineId)

    expect(second).toBe(first)
    expect(await db.sessions.count()).toBe(1)
  })
})
