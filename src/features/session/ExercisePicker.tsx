import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Exercise, Modality } from '../../db/schema'
import { db } from '../../db/schema'
import Button from '../../components/Button'

type Props = {
  onPick: (exercise: Exercise) => void
  onClose: () => void
}

const FILTERS: { label: string; value: Modality | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Strength', value: 'strength' },
  { label: 'Cardio', value: 'cardio' },
  { label: 'Other', value: 'other' },
]

export default function ExercisePicker({ onPick, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [modality, setModality] = useState<Modality | 'all'>('all')
  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), [])

  const matches = useMemo(() => {
    if (!exercises) return []
    const needle = query.trim().toLowerCase()
    return exercises.filter((ex) => {
      if (modality !== 'all' && ex.modality !== modality) return false
      if (!needle) return true
      return (
        ex.name.toLowerCase().includes(needle) ||
        ex.equipment.toLowerCase().includes(needle) ||
        ex.muscleGroups.some((group) => group.includes(needle))
      )
    })
  }, [exercises, query, modality])

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-slate-950">
      <header className="flex items-center gap-2 border-b border-slate-800 p-3">
        <input
          autoFocus
          className="min-h-11 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 outline-none focus:border-sky-500"
          placeholder="Search exercises"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </header>

      <div className="flex gap-2 overflow-x-auto border-b border-slate-800 px-3 py-2">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setModality(filter.value)}
            className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-medium ${
              modality === filter.value
                ? 'bg-sky-500 text-slate-950'
                : 'border border-slate-700 text-slate-300'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <ul className="flex-1 divide-y divide-slate-800 overflow-y-auto">
        {matches.map((exercise) => (
          <li key={exercise.id}>
            <button
              type="button"
              className="w-full px-4 py-3 text-left active:bg-slate-900"
              onClick={() => onPick(exercise)}
            >
              <span className="block font-medium">{exercise.name}</span>
              <span className="block text-xs text-slate-500">
                {exercise.equipment} · {exercise.muscleGroups.slice(0, 3).join(', ')}
              </span>
            </button>
          </li>
        ))}
        {exercises && matches.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-slate-500">
            No exercises match “{query}”.
          </li>
        ) : null}
      </ul>
    </div>
  )
}
