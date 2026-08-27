import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/schema'
import { saveSettings, updateProgram } from '../../db/repo'
import { useSettings } from '../../app/SettingsProvider'
import { useWrite } from '../../app/WriteErrorBoundary'
import Button from '../../components/Button'
import CommitTextField from './CommitTextField'
import RoutinePicker from './RoutinePicker'

export default function ProgramEditor() {
  const { programId = '' } = useParams<{ programId: string }>()
  const navigate = useNavigate()
  const write = useWrite()
  const settings = useSettings()
  const [picking, setPicking] = useState(false)

  // Wrapped so "still loading" (undefined) stays distinguishable from "no
  // such program" ({ program: undefined }).
  const query = useLiveQuery(async () => ({ program: await db.programs.get(programId) }), [programId])
  const routines = useLiveQuery(() => db.routines.orderBy('name').toArray(), [], [])
  const routineName = useMemo(() => new Map(routines.map((r) => [r.id, r.name])), [routines])

  if (query === undefined) return null
  const { program } = query

  if (!program) {
    return (
      <div className="mx-auto max-w-lg p-4">
        <p className="text-sm text-slate-500">That program no longer exists.</p>
        <Button className="mt-4" onClick={() => navigate('/plan')}>
          Back to Plan
        </Button>
      </div>
    )
  }

  const isActive = settings.activeProgramId === program.id

  const setRoutineIds = (routineIds: string[]) =>
    write(updateProgram(program.id, { routineIds }), 'updating the program')

  const addRoutine = (routineId: string) => {
    setRoutineIds([...program.routineIds, routineId])
    setPicking(false)
  }

  const removeRoutine = (index: number) => {
    setRoutineIds(program.routineIds.filter((_, i) => i !== index))
  }

  const moveRoutine = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= program.routineIds.length) return
    const ids = [...program.routineIds]
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    setRoutineIds(ids)
  }

  return (
    <div key={programId} className="mx-auto max-w-lg p-4 pb-24">
      <button type="button" onClick={() => navigate('/plan')} className="text-sm text-slate-400">
        ← Plan
      </button>
      <h1 className="mt-2 text-2xl font-semibold">Edit program</h1>

      <div className="mt-4">
        <CommitTextField
          label="Name"
          defaultValue={program.name}
          onCommit={(name) => {
            const trimmed = name.trim()
            if (trimmed && trimmed !== program.name) {
              write(updateProgram(program.id, { name: trimmed }), 'renaming the program')
            }
          }}
        />
      </div>

      <Button
        variant={isActive ? 'primary' : 'secondary'}
        className="mt-4 w-full"
        disabled={isActive}
        onClick={() => write(saveSettings({ activeProgramId: program.id }), 'setting the active program')}
      >
        {isActive ? 'Active program' : 'Make active'}
      </Button>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Rotation</h2>
          <Button variant="secondary" onClick={() => setPicking(true)}>
            + Add routine
          </Button>
        </div>

        {program.routineIds.length === 0 ? (
          <p className="mt-4 text-center text-sm text-slate-500">
            No routines in this rotation yet. Add one to get started.
          </p>
        ) : (
          <>
            {/* Makes the rotation order legible at a glance, e.g. "A → B → A …". */}
            <p className="mt-3 text-sm text-sky-400">
              {program.routineIds.map((id) => routineName.get(id) ?? 'Unknown').join(' → ')} → …
            </p>
            <ul className="mt-3 space-y-2">
              {program.routineIds.map((id, index) => (
                <li
                  key={`${id}-${index}`}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/40 p-3"
                >
                  <span>
                    <span className="mr-2 text-xs tabular-nums text-slate-500">{index + 1}.</span>
                    <span className="font-medium">{routineName.get(id) ?? 'Unknown routine'}</span>
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={index === 0}
                      className="min-h-11 min-w-11 text-slate-400 disabled:opacity-30"
                      onClick={() => moveRoutine(index, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={index === program.routineIds.length - 1}
                      className="min-h-11 min-w-11 text-slate-400 disabled:opacity-30"
                      onClick={() => moveRoutine(index, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      aria-label="Remove from rotation"
                      className="min-h-11 min-w-11 text-red-400"
                      onClick={() => removeRoutine(index)}
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {picking ? (
        <RoutinePicker routines={routines} onPick={addRoutine} onClose={() => setPicking(false)} />
      ) : null}
    </div>
  )
}
