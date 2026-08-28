import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Exercise, MuscleGroup, SetEntry } from '../../db/schema'
import { db, MUSCLE_GROUPS } from '../../db/schema'
import { setExerciseFavourite } from '../../db/repo'
import {
  bestRepsByWeight,
  bestSetByEstimated1RM,
  bestSetByVolume,
  detectPRs,
  estimate1RM,
} from '../../lib/records'
import { formatWeight } from '../../lib/units'
import { useSettings } from '../../app/SettingsProvider'
import { useWrite } from '../../app/WriteErrorBoundary'
import Chip from '../../components/Chip'
import { filterExercises } from './filterExercises'

function toggled<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

export default function ExercisesScreen() {
  const settings = useSettings()
  const save = useWrite()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [favouritesOnly, setFavouritesOnly] = useState(false)
  const [equipmentFilter, setEquipmentFilter] = useState<Set<string>>(new Set())
  const [muscleFilter, setMuscleFilter] = useState<Set<MuscleGroup>>(new Set())

  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), [], [])
  const allSets = useLiveQuery(() => db.setEntries.toArray(), [], [] as SetEntry[])

  const trainedCount = useMemo(() => {
    const counts = new Map<string, number>()
    for (const entry of allSets) {
      if (entry.completed) counts.set(entry.exerciseId, (counts.get(entry.exerciseId) ?? 0) + 1)
    }
    return counts
  }, [allSets])

  const equipmentOptions = useMemo(
    () => [...new Set(exercises.map((ex) => ex.equipment))].sort(),
    [exercises],
  )

  const matches = useMemo(
    () =>
      filterExercises(exercises, {
        query,
        favouritesOnly,
        equipment: [...equipmentFilter],
        muscleGroups: [...muscleFilter],
      }),
    [exercises, query, favouritesOnly, equipmentFilter, muscleFilter],
  )

  const anyFilterActive =
    favouritesOnly || equipmentFilter.size > 0 || muscleFilter.size > 0 || query.trim().length > 0

  function clearFilters() {
    setQuery('')
    setFavouritesOnly(false)
    setEquipmentFilter(new Set())
    setMuscleFilter(new Set())
  }

  const detail = selected ? exercises.find((ex: Exercise) => ex.id === selected) : null
  const detailSets = selected ? allSets.filter((s) => s.exerciseId === selected) : []
  const prs = detail ? detectPRs(detailSets) : null
  const best = detail ? bestSetByEstimated1RM(detailSets) : undefined
  const bestVolumeSet = detail ? bestSetByVolume(detailSets) : undefined
  const repsByWeight = detail ? bestRepsByWeight(detailSets) : undefined

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="text-2xl font-semibold">Exercises</h1>

      <input
        className="mt-3 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 outline-none focus:border-sky-500"
        placeholder="Search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="mt-3 space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Chip
            label="★ Favourites"
            active={favouritesOnly}
            onClick={() => setFavouritesOnly((value) => !value)}
          />
        </div>

        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Equipment
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {equipmentOptions.map((equipment) => (
              <Chip
                key={equipment}
                label={equipment}
                active={equipmentFilter.has(equipment)}
                onClick={() => setEquipmentFilter((prev) => toggled(prev, equipment))}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Muscle group
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {MUSCLE_GROUPS.map((group) => (
              <Chip
                key={group}
                label={group}
                active={muscleFilter.has(group)}
                onClick={() => setMuscleFilter((prev) => toggled(prev, group))}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span className="tabular-nums">
          {matches.length} of {exercises.length}
        </span>
        {anyFilterActive ? (
          <button
            type="button"
            className="min-h-9 px-2 font-medium text-sky-400"
            onClick={clearFilters}
          >
            Clear
          </button>
        ) : null}
      </div>

      <ul className="mt-2 divide-y divide-slate-800">
        {matches.map((exercise: Exercise) => (
          <li key={exercise.id}>
            <div className="flex items-center">
              <button
                type="button"
                className="min-h-11 flex-1 py-3 text-left"
                onClick={() => setSelected(selected === exercise.id ? null : exercise.id)}
              >
                <span className="flex justify-between">
                  <span className="font-medium">{exercise.name}</span>
                  <span className="text-xs tabular-nums text-slate-500">
                    {trainedCount.get(exercise.id) ?? 0} sets
                  </span>
                </span>
                <span className="block text-xs text-slate-500">
                  {exercise.equipment} · {exercise.muscleGroups.join(', ')}
                </span>
              </button>
              <button
                type="button"
                aria-pressed={!!exercise.isFavourite}
                aria-label={exercise.isFavourite ? 'Remove from favourites' : 'Add to favourites'}
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-xl"
                onClick={(event) => {
                  event.stopPropagation()
                  void save(
                    setExerciseFavourite(exercise.id, !exercise.isFavourite),
                    'updating favourites',
                  )
                }}
              >
                <span className={exercise.isFavourite ? 'text-sky-400' : 'text-slate-600'}>
                  {exercise.isFavourite ? '★' : '☆'}
                </span>
              </button>
            </div>

            {selected === exercise.id ? (
              <div className="pb-3 text-sm">
                {detailSets.length === 0 ? (
                  <p className="text-slate-500">Never logged.</p>
                ) : (
                  <>
                    {bestVolumeSet ? (
                      <p className="text-slate-400">
                        Best set:{' '}
                        <span className="font-semibold text-sky-400 tabular-nums">
                          {formatWeight(bestVolumeSet.weightKg, settings.weightUnit)} ×{' '}
                          {bestVolumeSet.reps}
                        </span>{' '}
                        <span className="text-xs text-slate-600">
                          (
                          {formatWeight(
                            bestVolumeSet.weightKg * bestVolumeSet.reps,
                            settings.weightUnit,
                          )}
                          )
                        </span>
                      </p>
                    ) : null}
                    {best ? (
                      <p className="text-slate-400">
                        Best est. 1RM:{' '}
                        <span className="font-semibold text-sky-400 tabular-nums">
                          {formatWeight(
                            estimate1RM(best.weightKg, best.reps),
                            settings.weightUnit,
                          )}
                        </span>{' '}
                        <span className="text-xs text-slate-600">
                          (from {Number(best.weightKg.toFixed(1))}×{best.reps})
                        </span>
                      </p>
                    ) : null}
                    {repsByWeight && repsByWeight.size > 0 ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Reps by load:{' '}
                        {[...repsByWeight.entries()]
                          .sort((a, b) => b[0] - a[0])
                          .slice(0, 5)
                          .map(
                            ([weightKg, entry]) =>
                              `${formatWeight(weightKg, settings.weightUnit)} × ${entry.reps}`,
                          )
                          .join(' · ')}
                      </p>
                    ) : null}
                    {prs && prs.bestByReps.size > 0 ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Rep maxes:{' '}
                        {[...prs.bestByReps.entries()]
                          .sort((a, b) => a[0] - b[0])
                          .slice(0, 8)
                          .map(([reps, entry]) => `${Number(entry.weightKg.toFixed(1))}×${reps}`)
                          .join(' · ')}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </li>
        ))}
        {matches.length === 0 ? (
          <li className="px-1 py-8 text-center text-sm text-slate-500">
            No exercises match your filters.
          </li>
        ) : null}
      </ul>
    </div>
  )
}
