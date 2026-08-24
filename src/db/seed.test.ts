import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MUSCLE_GROUPS, WorkoutDB } from './schema'
import { SEED_EXERCISES, seedDatabase } from './seed'

let db: WorkoutDB
let dbCount = 0

beforeEach(() => {
  dbCount += 1
  db = new WorkoutDB(`seed-test-${dbCount}-${Date.now()}`)
})

afterEach(async () => {
  db.close()
  await db.delete()
})

describe('SEED_EXERCISES', () => {
  it('covers every major muscle group and cardio', () => {
    const covered = new Set(SEED_EXERCISES.flatMap((ex) => ex.muscleGroups))
    for (const group of MUSCLE_GROUPS) {
      expect(covered, `no seeded exercise trains ${group}`).toContain(group)
    }
  })

  it('has unique names and is never marked custom', () => {
    const names = SEED_EXERCISES.map((ex) => ex.name)
    expect(new Set(names).size).toBe(names.length)
    expect(SEED_EXERCISES.every((ex) => ex.isCustom === false)).toBe(true)
  })

  it('includes the expected cardio modalities', () => {
    const cardio = SEED_EXERCISES.filter((ex) => ex.modality === 'cardio').map((ex) => ex.name)
    for (const needle of ['Run', 'Treadmill', 'Cycling', 'Indoor Bike', 'Rowing', 'Elliptical', 'Stair', 'Swim', 'Jump Rope', 'Ruck']) {
      expect(cardio.some((name) => name.includes(needle)), `missing ${needle}`).toBe(true)
    }
  })
})

describe('seedDatabase', () => {
  it('populates exercises and the settings singleton on first run', async () => {
    await seedDatabase(db)

    expect(await db.exercises.count()).toBe(SEED_EXERCISES.length)
    const settings = await db.settings.get('singleton')
    expect(settings).toMatchObject({
      weightUnit: 'kg',
      distanceUnit: 'km',
      defaultRestSec: 120,
      theme: 'dark',
    })
  })

  it('is idempotent across repeated app starts', async () => {
    await seedDatabase(db)
    await seedDatabase(db)
    await seedDatabase(db)

    expect(await db.exercises.count()).toBe(SEED_EXERCISES.length)
    expect(await db.settings.count()).toBe(1)
  })

  it('does not re-add seeds after the user deletes some, and never overwrites settings', async () => {
    await seedDatabase(db)
    const first = await db.exercises.orderBy('name').first()
    await db.exercises.delete(first!.id)
    await db.settings.update('singleton', { weightUnit: 'lb', theme: 'light' })

    await seedDatabase(db)

    expect(await db.exercises.count()).toBe(SEED_EXERCISES.length - 1)
    const settings = await db.settings.get('singleton')
    expect(settings?.weightUnit).toBe('lb')
    expect(settings?.theme).toBe('light')
  })

  it('gives every seeded row a uuid and a timestamp', async () => {
    await seedDatabase(db)
    const rows = await db.exercises.toArray()
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length)
    expect(rows.every((r) => /^[0-9a-f-]{36}$/i.test(r.id))).toBe(true)
    expect(rows.every((r) => r.updatedAt > 0)).toBe(true)
  })
})
