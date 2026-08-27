import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WorkoutDB } from './schema'

let db: WorkoutDB
let dbName: string
let dbCount = 0

beforeEach(() => {
  dbCount += 1
  dbName = `schema-test-${dbCount}-${Date.now()}`
  db = new WorkoutDB(dbName)
})

afterEach(async () => {
  db.close()
  await db.delete()
})

describe('WorkoutDB migrations', () => {
  it('opens at version 2 with a usable programs table', async () => {
    await db.open()
    expect(db.verno).toBe(2)

    await db.programs.add({
      id: 'prog-1',
      name: 'Push Pull Legs',
      routineIds: ['rou-1', 'rou-2'],
      updatedAt: 1,
    })
    const program = await db.programs.get('prog-1')
    expect(program?.routineIds).toEqual(['rou-1', 'rou-2'])
  })

  it('retains data from earlier tables and gains programs when the DB is closed and reopened', async () => {
    await db.exercises.add({
      id: 'ex-1',
      name: 'Back Squat',
      modality: 'strength',
      muscleGroups: ['quads', 'glutes'],
      equipment: 'barbell',
      isCustom: false,
      updatedAt: 1,
    })
    await db.routines.add({
      id: 'rou-1',
      name: 'Lower A',
      blocks: [],
      updatedAt: 1,
    })
    db.close()

    const reopened = new WorkoutDB(dbName)
    await reopened.open()

    expect(await reopened.exercises.get('ex-1')).toMatchObject({ name: 'Back Squat' })
    expect(await reopened.routines.get('rou-1')).toMatchObject({ name: 'Lower A' })
    expect(await reopened.programs.count()).toBe(0)

    await reopened.programs.add({
      id: 'prog-1',
      name: 'PPL',
      routineIds: ['rou-1'],
      updatedAt: 2,
    })
    expect(await reopened.programs.count()).toBe(1)

    reopened.close()
    await reopened.delete()
  })

  it('indexes programs by name and updatedAt', async () => {
    await db.programs.bulkAdd([
      { id: 'prog-1', name: 'Alpha', routineIds: [], updatedAt: 10 },
      { id: 'prog-2', name: 'Beta', routineIds: [], updatedAt: 20 },
    ])

    const byName = await db.programs.orderBy('name').toArray()
    expect(byName.map((p) => p.name)).toEqual(['Alpha', 'Beta'])

    const byUpdatedAt = await db.programs.orderBy('updatedAt').last()
    expect(byUpdatedAt?.id).toBe('prog-2')
  })
})
