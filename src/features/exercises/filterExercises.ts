import type { Exercise, MuscleGroup } from '../../db/schema'

export interface ExerciseFilterCriteria {
  /** Free-text search over name and muscle groups — same matching the
   *  Exercises screen used before filters existed. */
  query?: string
  /** When true, only favourited exercises pass. */
  favouritesOnly?: boolean
  /** Equipment values to allow; selections within this group OR together.
   *  Empty/undefined means no restriction. */
  equipment?: readonly string[]
  /** Muscle groups to allow; selections within this group OR together (an
   *  exercise passes if it hits any one of them). Empty/undefined means no
   *  restriction. */
  muscleGroups?: readonly MuscleGroup[]
}

/**
 * Filters the exercise catalogue for the Exercises screen.
 *
 * The filter groups themselves combine with AND — favourites AND equipment
 * AND muscle group AND search all have to pass — while the choices inside
 * the equipment or muscle-group group combine with OR (selecting kettlebell
 * and dumbbell shows either, not neither).
 */
export function filterExercises(
  exercises: readonly Exercise[],
  criteria: ExerciseFilterCriteria,
): Exercise[] {
  const needle = (criteria.query ?? '').trim().toLowerCase()
  const equipmentFilter = new Set(criteria.equipment ?? [])
  const muscleFilter = new Set(criteria.muscleGroups ?? [])

  return exercises.filter((exercise) => {
    if (criteria.favouritesOnly && !exercise.isFavourite) return false
    if (equipmentFilter.size > 0 && !equipmentFilter.has(exercise.equipment)) return false
    if (muscleFilter.size > 0 && !exercise.muscleGroups.some((group) => muscleFilter.has(group))) {
      return false
    }
    if (needle) {
      const matchesText =
        exercise.name.toLowerCase().includes(needle) ||
        exercise.muscleGroups.some((group) => group.includes(needle))
      if (!matchesText) return false
    }
    return true
  })
}
