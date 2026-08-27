import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { BackupFile } from './backup'
import { BACKUP_SCHEMA_VERSION, exportBackup, importBackup, validateBackup } from './backup'
import { WorkoutDB } from '../db/schema'
import { seedDatabase } from '../db/seed'

type SetKindLike = 'warmup' | 'working' | 'dropset'

let db: WorkoutDB
let dbCount = 0

beforeEach(() => {
  dbCount += 1
  db = new WorkoutDB(`backup-test-${dbCount}-${Date.now()}`)
})

afterEach(async () => {
  db.close()
  await db.delete()
})

/** A minimal but complete, valid backup payload. */
function validBackup(overrides: Partial<BackupFile> = {}): BackupFile {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: 1_700_000_000_000,
    exercises: [
      {
        id: 'ex-1',
        name: 'Back Squat',
        modality: 'strength',
        muscleGroups: ['quads', 'glutes'],
        equipment: 'barbell',
        isCustom: false,
        updatedAt: 1,
      },
    ],
    sessions: [
      { id: 'ses-1', date: '2026-08-24', startedAt: 1_700_000_000_000, updatedAt: 1 },
    ],
    setEntries: [
      {
        id: 'set-1',
        sessionId: 'ses-1',
        exerciseId: 'ex-1',
        order: 0,
        kind: 'working',
        reps: 5,
        weightKg: 100,
        completed: true,
        updatedAt: 1,
      },
    ],
    cardioEntries: [
      {
        id: 'cardio-1',
        sessionId: 'ses-1',
        exerciseId: 'ex-1',
        order: 1,
        durationSec: 1200,
        distanceM: 4000,
        updatedAt: 1,
      },
    ],
    routines: [
      {
        id: 'rou-1',
        name: 'Lower A',
        blocks: [
          {
            exerciseId: 'ex-1',
            targetSets: 3,
            repRangeLow: 5,
            repRangeHigh: 8,
            progression: 'double-progression',
            incrementKg: 2.5,
          },
        ],
        updatedAt: 1,
      },
    ],
    bodyMetrics: [
      { id: 'bm-1', date: '2026-08-24', weightKg: 82.5, measurements: { waist: 84 }, updatedAt: 1 },
    ],
    settings: [
      {
        id: 'singleton',
        weightUnit: 'kg',
        distanceUnit: 'km',
        defaultRestSec: 120,
        theme: 'dark',
        updatedAt: 1,
      },
    ],
    programs: [
      {
        id: 'prog-1',
        name: 'Push Pull Legs',
        routineIds: ['rou-1'],
        updatedAt: 1,
      },
    ],
    ...overrides,
  }
}

describe('exportBackup', () => {
  it('captures every table plus provenance metadata', async () => {
    await seedDatabase(db)
    const backup = await exportBackup(db)

    expect(backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION)
    expect(backup.exportedAt).toBeGreaterThan(0)
    expect(backup.exercises.length).toBeGreaterThan(50)
    expect(backup.settings).toHaveLength(1)
    expect(backup.sessions).toEqual([])
    expect(backup.programs).toEqual([])
  })

  it('produces something JSON round-trippable that re-validates', async () => {
    await seedDatabase(db)
    const backup = await exportBackup(db)
    const reparsed: unknown = JSON.parse(JSON.stringify(backup))
    expect(() => validateBackup(reparsed)).not.toThrow()
  })
})

describe('importBackup', () => {
  it('restores every table and reports the counts', async () => {
    const { imported } = await importBackup(db, validBackup())

    expect(imported).toEqual({
      exercises: 1,
      sessions: 1,
      setEntries: 1,
      cardioEntries: 1,
      routines: 1,
      bodyMetrics: 1,
      settings: 1,
      programs: 1,
    })
    expect(await db.exercises.count()).toBe(1)
    const routine = await db.routines.get('rou-1')
    expect(routine?.blocks[0].progression).toBe('double-progression')
    const metric = await db.bodyMetrics.get('bm-1')
    expect(metric?.measurements.waist).toBe(84)
  })

  it('replaces existing data instead of merging it', async () => {
    await seedDatabase(db) // ~100 seeded exercises + a settings row
    const seededCount = await db.exercises.count()
    expect(seededCount).toBeGreaterThan(1)

    await importBackup(db, validBackup())

    expect(await db.exercises.count()).toBe(1)
    expect(await db.exercises.get('ex-1')).toBeDefined()
    const settings = await db.settings.toArray()
    expect(settings).toHaveLength(1)
  })

  it('survives a full export -> wipe -> import cycle unchanged', async () => {
    await seedDatabase(db)
    await db.sessions.add({
      id: 'ses-x',
      date: '2026-08-01',
      startedAt: 111,
      notes: 'leg day',
      updatedAt: 222,
    })
    const before = await exportBackup(db)

    await importBackup(db, JSON.parse(JSON.stringify(before)))
    const after = await exportBackup(db)

    expect(after.exercises).toEqual(before.exercises)
    expect(after.sessions).toEqual(before.sessions)
    expect(after.settings).toEqual(before.settings)
  })

  it('round-trips a favourited exercise through export and import', async () => {
    await importBackup(db, validBackup({
      exercises: [
        {
          id: 'ex-1',
          name: 'Kettlebell Goblet Squat',
          modality: 'strength',
          muscleGroups: ['quads', 'glutes'],
          equipment: 'kettlebell',
          isCustom: false,
          isFavourite: true,
          updatedAt: 1,
        },
      ],
    }))

    const exported = await exportBackup(db)
    expect(exported.exercises[0]?.isFavourite).toBe(true)

    await importBackup(db, JSON.parse(JSON.stringify(exported)))
    expect((await db.exercises.get('ex-1'))?.isFavourite).toBe(true)
  })

  it('indexes imported rows so exercise history queries still work', async () => {
    await importBackup(db, validBackup())
    const bySession = await db.setEntries
      .where('[exerciseId+sessionId]')
      .equals(['ex-1', 'ses-1'])
      .toArray()
    expect(bySession).toHaveLength(1)
  })

  it('preserves row counts across a full round trip, including programs', async () => {
    const { imported: firstImport } = await importBackup(db, validBackup())
    expect(firstImport.programs).toBe(1)
    expect(await db.programs.count()).toBe(1)

    const exported = await exportBackup(db)
    const { imported: secondImport } = await importBackup(db, JSON.parse(JSON.stringify(exported)))

    expect(secondImport).toEqual(firstImport)
    expect(await db.programs.count()).toBe(1)
    const program = await db.programs.get('prog-1')
    expect(program?.routineIds).toEqual(['rou-1'])
  })
})

describe('importBackup validation', () => {
  const expectRejection = async (payload: unknown, matcher: RegExp) => {
    await expect(importBackup(db, payload)).rejects.toThrow(matcher)
  }

  it('rejects non-objects', async () => {
    await expectRejection(null, /must be a JSON object/)
    await expectRejection('{}', /must be a JSON object/)
    await expectRejection([], /must be a JSON object/)
  })

  it('rejects a missing or non-integer schemaVersion', async () => {
    await expectRejection(validBackup({ schemaVersion: undefined as unknown as number }), /schemaVersion/)
    await expectRejection(validBackup({ schemaVersion: 1.5 }), /schemaVersion/)
  })

  it('rejects a backup from a newer app version with an actionable message', async () => {
    await expectRejection(
      validBackup({ schemaVersion: BACKUP_SCHEMA_VERSION + 1 }),
      /newer version of the app/,
    )
  })

  it('rejects a missing table', async () => {
    const payload = validBackup() as unknown as Record<string, unknown>
    delete payload.routines
    await expectRejection(payload, /backup\.routines must be an array/)
  })

  it('treats a schemaVersion 1 backup with no programs key as having an empty programs table', async () => {
    const payload = validBackup({ schemaVersion: 1 }) as unknown as Record<string, unknown>
    delete payload.programs
    const { imported } = await importBackup(db, payload)
    expect(imported.programs).toBe(0)
    expect(await db.programs.count()).toBe(0)
  })

  it('rejects a schemaVersion 2 backup with no programs key', async () => {
    const payload = validBackup() as unknown as Record<string, unknown>
    delete payload.programs
    await expectRejection(payload, /backup\.programs must be an array/)
  })

  it('still rejects a schemaVersion 1 backup missing a table that existed in v1', async () => {
    const payload = validBackup({ schemaVersion: 1 }) as unknown as Record<string, unknown>
    delete payload.programs
    delete payload.sessions
    await expectRejection(payload, /backup\.sessions must be an array/)
  })

  it('still validates rows in a schemaVersion 1 backup', async () => {
    const payload = validBackup({ schemaVersion: 1 }) as unknown as Record<string, unknown>
    delete payload.programs
    const setEntries = payload.setEntries as Record<string, unknown>[]
    setEntries[0].reps = 'five'
    await expectRejection(payload, /setEntries\[0\]\.reps must be a finite number, got "five"/)
  })

  it('names the offending row and field', async () => {
    const payload = validBackup()
    payload.setEntries[0].reps = 'five' as unknown as number
    await expectRejection(payload, /setEntries\[0\]\.reps must be a finite number, got "five"/)
  })

  it('rejects an unknown enum value', async () => {
    const payload = validBackup()
    payload.setEntries[0].kind = 'megaset' as SetKindLike
    await expectRejection(payload, /setEntries\[0\]\.kind must be one of/)
  })

  it('rejects a row missing its id or updatedAt', async () => {
    const payload = validBackup() as unknown as Record<string, Record<string, unknown>[]>
    delete payload.sessions[0].updatedAt
    await expectRejection(payload, /sessions\[0\]\.updatedAt/)
  })

  it('rejects a malformed date', async () => {
    await expectRejection(
      validBackup({ sessions: [{ id: 's', date: '24/08/2026', startedAt: 1, updatedAt: 1 }] }),
      /sessions\[0\]\.date must be an ISO yyyy-mm-dd date/,
    )
  })

  it('rejects a non-boolean isFavourite', async () => {
    const payload = validBackup()
    payload.exercises[0].isFavourite = 'yes' as unknown as boolean
    await expectRejection(payload, /exercises\[0\]\.isFavourite must be a boolean, got "yes"/)
  })

  it('rejects a non-number settings.seedVersion', async () => {
    const payload = validBackup()
    payload.settings[0].seedVersion = 'two' as unknown as number
    await expectRejection(payload, /settings\[0\]\.seedVersion must be a finite number, got "two"/)
  })

  it('rejects an unknown muscle group', async () => {
    const payload = validBackup()
    payload.exercises[0].muscleGroups = ['delts' as never]
    await expectRejection(payload, /muscleGroups contains unknown group "delts"/)
  })

  it('rejects duplicate ids that would collide on insert', async () => {
    const payload = validBackup()
    payload.exercises = [payload.exercises[0], { ...payload.exercises[0] }]
    await expectRejection(payload, /exercises contains duplicate id "ex-1"/)
  })

  it('rejects a settings row that is not the singleton', async () => {
    const payload = validBackup()
    payload.settings[0].id = 'default' as typeof payload.settings[0]['id']
    await expectRejection(payload, /settings\[0\]\.id must be "singleton"/)
  })

  it('rejects more than one settings row', async () => {
    const payload = validBackup()
    payload.settings = [payload.settings[0], { ...payload.settings[0] }]
    // Duplicate ids are caught first; distinct ids would fail the singleton check.
    await expectRejection(payload, /duplicate id|at most one row/)
  })

  it('rejects a malformed nested routine block', async () => {
    const payload = validBackup()
    payload.routines[0].blocks[0].progression = 'magic' as never
    await expectRejection(payload, /routines\[0\]\.blocks\[0\]\.progression must be one of/)
  })

  it('rejects a programs row with a non-array routineIds', async () => {
    const payload = validBackup()
    payload.programs[0].routineIds = 'rou-1' as unknown as string[]
    await expectRejection(payload, /programs\[0\]\.routineIds must be an array of strings/)
  })

  it('rejects a programs row with a non-string entry in routineIds', async () => {
    const payload = validBackup()
    payload.programs[0].routineIds = [42 as unknown as string]
    await expectRejection(payload, /programs\[0\]\.routineIds must be an array of strings/)
  })

  it('leaves the database untouched when validation fails', async () => {
    await seedDatabase(db)
    const before = await db.exercises.count()

    const payload = validBackup()
    payload.setEntries[0].weightKg = null as unknown as number
    await expect(importBackup(db, payload)).rejects.toThrow(/setEntries\[0\]\.weightKg/)

    expect(await db.exercises.count()).toBe(before)
    expect(await db.setEntries.count()).toBe(0)
  })
})
