import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Exercise, SetEntry } from '../../db/schema'
import { db } from '../../db/schema'
import { bestSetByEstimated1RM, detectPRs, estimate1RM } from '../../lib/records'
import { formatWeight } from '../../lib/units'
import { useSettings } from '../../app/SettingsProvider'

export default function ExercisesScreen() {
  const settings = useSettings()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), [], [])
  const allSets = useLiveQuery(() => db.setEntries.toArray(), [], [] as SetEntry[])

  const trainedCount = useMemo(() => {
    const counts = new Map<string, number>()
    for (const entry of allSets) {
      if (entry.completed) counts.set(entry.exerciseId, (counts.get(entry.exerciseId) ?? 0) + 1)
    }
    return counts
  }, [allSets])

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return exercises
    return exercises.filter(
      (ex: Exercise) =>
        ex.name.toLowerCase().includes(needle) ||
        ex.muscleGroups.some((group) => group.includes(needle)),
    )
  }, [exercises, query])

  const detail = selected ? exercises.find((ex: Exercise) => ex.id === selected) : null
  const detailSets = selected ? allSets.filter((s) => s.exerciseId === selected) : []
  const prs = detail ? detectPRs(detailSets) : null
  const best = detail ? bestSetByEstimated1RM(detailSets) : undefined

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="text-2xl font-semibold">Exercises</h1>

      <input
        className="mt-3 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 outline-none focus:border-sky-500"
        placeholder="Search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <ul className="mt-3 divide-y divide-slate-800">
        {matches.map((exercise: Exercise) => (
          <li key={exercise.id}>
            <button
              type="button"
              className="w-full py-3 text-left"
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

            {selected === exercise.id ? (
              <div className="pb-3 text-sm">
                {detailSets.length === 0 ? (
                  <p className="text-slate-500">Never logged.</p>
                ) : (
                  <>
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
      </ul>
    </div>
  )
}
