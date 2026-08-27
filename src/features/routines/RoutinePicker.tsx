import { useMemo, useState } from 'react'
import type { Routine } from '../../db/schema'
import Button from '../../components/Button'

type Props = {
  routines: Routine[]
  onPick: (routineId: string) => void
  onClose: () => void
}

/** Same fixed-sheet idiom as ExercisePicker, scoped to routines instead. */
export default function RoutinePicker({ routines, onPick, onClose }: Props) {
  const [query, setQuery] = useState('')

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return routines
    return routines.filter((routine) => routine.name.toLowerCase().includes(needle))
  }, [routines, query])

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-slate-950">
      <header className="flex items-center gap-2 border-b border-slate-800 p-3">
        <input
          autoFocus
          className="min-h-11 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 outline-none focus:border-sky-500"
          placeholder="Search routines"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </header>

      <ul className="flex-1 divide-y divide-slate-800 overflow-y-auto">
        {matches.map((routine) => (
          <li key={routine.id}>
            <button
              type="button"
              className="w-full px-4 py-3 text-left active:bg-slate-900"
              onClick={() => onPick(routine.id)}
            >
              <span className="block font-medium">{routine.name}</span>
              <span className="block text-xs text-slate-500">
                {routine.blocks.length} {routine.blocks.length === 1 ? 'exercise' : 'exercises'}
              </span>
            </button>
          </li>
        ))}
        {matches.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-slate-500">
            {routines.length === 0 ? 'No routines yet — create one first.' : `No routines match “${query}”.`}
          </li>
        ) : null}
      </ul>
    </div>
  )
}
