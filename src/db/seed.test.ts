import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MUSCLE_GROUPS, SETTINGS_ID, WorkoutDB, newId, now } from './schema'
import { SEED_CATALOGUE_VERSION, SEED_EXERCISES, seedDatabase } from './seed'

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

  it('gives every kettlebell entry valid muscle groups, strength modality, and kettlebell equipment', () => {
    const kettlebells = SEED_EXERCISES.filter((ex) => ex.equipment === 'kettlebell')
    expect(kettlebells.length).toBeGreaterThanOrEqual(41)
    for (const ex of kettlebells) {
      expect(ex.modality, `${ex.name} modality`).toBe('strength')
      expect(ex.muscleGroups.length, `${ex.name} has no muscle groups`).toBeGreaterThan(0)
      for (const group of ex.muscleGroups) {
        expect(MUSCLE_GROUPS as readonly string[], `${ex.name} uses unknown group ${group}`).toContain(group)
      }
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

describe('seedDatabase catalogue versioning', () => {
  it('inserts the full catalogue and records the current seed version on a fresh install', async () => {
    await seedDatabase(db)

    expect(await db.exercises.count()).toBe(SEED_EXERCISES.length)
    const settings = await db.settings.get(SETTINGS_ID)
    expect(settings?.seedVersion).toBe(SEED_CATALOGUE_VERSION)
  })

  it('backfills only the new entries for a pre-versioning install, leaving existing rows untouched', async () => {
    // Simulate a phone that already has some v1 exercises and a settings row
    // written before seedVersion existed.
    const stamp = now()
    const preExisting = [
      { id: newId(), name: 'Barbell Bench Press', modality: 'strength' as const, muscleGroups: ['chest' as const], equipment: 'barbell', isCustom: false, notes: 'my bench notes', updatedAt: stamp },
      { id: newId(), name: 'Back Squat', modality: 'strength' as const, muscleGroups: ['quads' as const], equipment: 'barbell', isCustom: false, updatedAt: stamp },
    ]
    await db.exercises.bulkAdd(preExisting)
    await db.settings.put({
      id: SETTINGS_ID,
      weightUnit: 'kg',
      distanceUnit: 'km',
      defaultRestSec: 90,
      theme: 'system',
      updatedAt: stamp,
      // deliberately no seedVersion — a pre-versioning install
    })

    await seedDatabase(db)

    const rows = await db.exercises.toArray()
    const backfilledCount = SEED_EXERCISES.filter((ex) => ex.addedIn >= 2).length
    expect(rows.length).toBe(preExisting.length + backfilledCount)
    expect(rows.some((r) => r.name === 'Kettlebell Clean and Press')).toBe(true)
    expect(rows.some((r) => r.name === 'Kettlebell Swing')).toBe(false)

    for (const original of preExisting) {
      const stillThere = await db.exercises.get(original.id)
      expect(stillThere).toEqual(original)
    }

    const settings = await db.settings.get(SETTINGS_ID)
    expect(settings?.seedVersion).toBe(SEED_CATALOGUE_VERSION)
  })

  it('gains nothing on a re-run once already at the current seed version', async () => {
    await seedDatabase(db)
    const countAfterFirst = await db.exercises.count()

    await seedDatabase(db)

    expect(await db.exercises.count()).toBe(countAfterFirst)
  })

  it('never duplicates rows across repeated seeding', async () => {
    await seedDatabase(db)
    await seedDatabase(db)
    await seedDatabase(db)

    const rows = await db.exercises.toArray()
    const names = rows.map((r) => r.name)
    expect(new Set(names).size).toBe(names.length)
    expect(rows.length).toBe(SEED_EXERCISES.length)
  })

  it('never overwrites an edit the user made to a seeded row', async () => {
    await seedDatabase(db)
    const row = await db.exercises.where('name').equals('Kettlebell Goblet Squat').first()
    expect(row).toBeDefined()
    await db.exercises.update(row!.id, { notes: 'my custom cue', isFavourite: true })

    await seedDatabase(db)

    const after = await db.exercises.get(row!.id)
    expect(after?.notes).toBe('my custom cue')
    expect(after?.isFavourite).toBe(true)
  })

  it('does not duplicate or modify a custom exercise sharing a seed name', async () => {
    const stamp = now()
    const customId = newId()
    await db.exercises.add({
      id: customId,
      name: 'Kettlebell Clean',
      modality: 'strength',
      muscleGroups: ['glutes'],
      equipment: 'kettlebell',
      isCustom: true,
      notes: 'my own version',
      updatedAt: stamp,
    })

    await seedDatabase(db)

    const matches = await db.exercises.where('name').equals('Kettlebell Clean').toArray()
    expect(matches).toHaveLength(1)
    expect(matches[0]).toEqual({
      id: customId,
      name: 'Kettlebell Clean',
      modality: 'strength',
      muscleGroups: ['glutes'],
      equipment: 'kettlebell',
      isCustom: true,
      notes: 'my own version',
      updatedAt: stamp,
    })
  })

  it('repairs a pre-existing non-custom Kettlebell Swing filed under modality "other"', async () => {
    const stamp = now()
    const legacyId = newId()
    await db.exercises.add({
      id: legacyId,
      name: 'Kettlebell Swing',
      modality: 'other',
      muscleGroups: ['glutes', 'hamstrings', 'core'],
      equipment: 'kettlebell',
      isCustom: false,
      updatedAt: stamp,
    })
    const customId = newId()
    await db.exercises.add({
      id: customId,
      name: 'Kettlebell Swing',
      modality: 'other',
      muscleGroups: ['glutes'],
      equipment: 'kettlebell',
      isCustom: true,
      updatedAt: stamp,
    })

    await seedDatabase(db)

    expect((await db.exercises.get(legacyId))?.modality).toBe('strength')
    expect((await db.exercises.get(customId))?.modality).toBe('other')
  })

  it('strips the addedIn seed-metadata field before writing rows', async () => {
    await seedDatabase(db)
    const rows = await db.exercises.toArray()
    expect(rows.every((r) => !('addedIn' in r))).toBe(true)
  })
})
