import { describe, expect, it } from 'vitest'
import type { Exercise } from '../../db/schema'
import { filterExercises } from './filterExercises'

function ex(overrides: Partial<Exercise> & { id: string; name: string }): Exercise {
  return {
    modality: 'strength',
    muscleGroups: [],
    equipment: 'kettlebell',
    isCustom: false,
    updatedAt: 0,
    ...overrides,
  }
}

const CATALOGUE: Exercise[] = [
  ex({ id: '1', name: 'Kettlebell Swing', equipment: 'kettlebell', muscleGroups: ['glutes', 'core'] }),
  ex({ id: '2', name: 'Goblet Squat', equipment: 'kettlebell', muscleGroups: ['quads', 'core'] }),
  ex({ id: '3', name: 'Dumbbell Row', equipment: 'dumbbell', muscleGroups: ['back'] }),
  ex({ id: '4', name: 'Barbell Bench Press', equipment: 'barbell', muscleGroups: ['chest'], isFavourite: true }),
  ex({ id: '5', name: 'Kettlebell Press', equipment: 'kettlebell', muscleGroups: ['shoulders'], isFavourite: true }),
]

describe('filterExercises', () => {
  it('returns everything when no criteria are set', () => {
    expect(filterExercises(CATALOGUE, {})).toHaveLength(CATALOGUE.length)
  })

  it('filters by a single equipment value', () => {
    const result = filterExercises(CATALOGUE, { equipment: ['kettlebell'] })
    expect(result.map((e) => e.id)).toEqual(['1', '2', '5'])
  })

  it('ORs multiple equipment selections within the group', () => {
    const result = filterExercises(CATALOGUE, { equipment: ['kettlebell', 'dumbbell'] })
    expect(result.map((e) => e.id)).toEqual(['1', '2', '3', '5'])
  })

  it('ORs multiple muscle-group selections within the group', () => {
    const result = filterExercises(CATALOGUE, { muscleGroups: ['back', 'chest'] })
    expect(result.map((e) => e.id)).toEqual(['3', '4'])
  })

  it('ANDs equipment and muscle group across groups', () => {
    const result = filterExercises(CATALOGUE, { equipment: ['kettlebell'], muscleGroups: ['core'] })
    expect(result.map((e) => e.id)).toEqual(['1', '2'])
  })

  it('narrows to favourites only', () => {
    const result = filterExercises(CATALOGUE, { favouritesOnly: true })
    expect(result.map((e) => e.id)).toEqual(['4', '5'])
  })

  it('combines favourites with equipment and muscle group (AND)', () => {
    const result = filterExercises(CATALOGUE, {
      favouritesOnly: true,
      equipment: ['kettlebell'],
      muscleGroups: ['shoulders'],
    })
    expect(result.map((e) => e.id)).toEqual(['5'])
  })

  it('matches search text against name', () => {
    const result = filterExercises(CATALOGUE, { query: 'swing' })
    expect(result.map((e) => e.id)).toEqual(['1'])
  })

  it('matches search text against muscle groups', () => {
    const result = filterExercises(CATALOGUE, { query: 'glutes' })
    expect(result.map((e) => e.id)).toEqual(['1'])
  })

  it('combines search with chip filters', () => {
    const result = filterExercises(CATALOGUE, { query: 'press', equipment: ['kettlebell'] })
    expect(result.map((e) => e.id)).toEqual(['5'])
  })

  it('returns an empty array when nothing matches', () => {
    const result = filterExercises(CATALOGUE, { equipment: ['barbell'], muscleGroups: ['glutes'] })
    expect(result).toEqual([])
  })

  it('ignores an empty equipment/muscleGroups array as no restriction', () => {
    const result = filterExercises(CATALOGUE, { equipment: [], muscleGroups: [] })
    expect(result).toHaveLength(CATALOGUE.length)
  })
})
