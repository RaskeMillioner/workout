import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/schema'
import { createProgram, createRoutine, deleteProgram, deleteRoutine, saveSettings } from '../../db/repo'
import { useSettings } from '../../app/SettingsProvider'
import { useWrite } from '../../app/WriteErrorBoundary'
import Button from '../../components/Button'

/**
 * The hub for programs and routines: create/delete either, mark a program
 * active, and jump into RoutineEditor / ProgramEditor to edit one.
 */
export default function RoutinesScreen() {
  const navigate = useNavigate()
  const settings = useSettings()
  const write = useWrite()

  const programs = useLiveQuery(() => db.programs.orderBy('name').toArray(), [], [])
  const routines = useLiveQuery(() => db.routines.orderBy('name').toArray(), [], [])

  const routineName = useMemo(() => new Map(routines.map((r) => [r.id, r.name])), [routines])

  const handleNewRoutine = async () => {
    const id = await write(createRoutine('New routine'), 'creating a routine')
    if (id) navigate(`/plan/routines/${id}`)
  }

  const handleNewProgram = async () => {
    const id = await write(createProgram('New program'), 'creating a program')
    if (id) navigate(`/plan/programs/${id}`)
  }

  const handleDeleteRoutine = (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? It will also be removed from any program's rotation.`)) return
    write(deleteRoutine(id), 'deleting a routine')
  }

  const handleDeleteProgram = (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return
    write(deleteProgram(id), 'deleting a program')
  }

  return (
    <div className="mx-auto max-w-lg p-4 pb-24">
      <h1 className="text-2xl font-semibold">Plan</h1>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Programs</h2>
          {programs.length > 0 ? (
            <Button variant="secondary" onClick={handleNewProgram}>
              + New
            </Button>
          ) : null}
        </div>

        {programs.length === 0 ? (
          <div className="mt-4 text-center">
            <p className="text-sm text-slate-500">
              A program rotates a sequence of routines — e.g. Workout A → Workout B → A …
            </p>
            <Button variant="primary" className="mt-3" onClick={handleNewProgram}>
              New program
            </Button>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {programs.map((program) => {
              const isActive = settings.activeProgramId === program.id
              const summary =
                program.routineIds.length > 0
                  ? program.routineIds.map((id) => routineName.get(id) ?? 'Unknown').join(' → ')
                  : 'No routines yet'
              return (
                <li
                  key={program.id}
                  className={`rounded-lg border p-3 ${
                    isActive ? 'border-sky-600 bg-sky-950/30' : 'border-slate-800 bg-slate-900/40'
                  }`}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => navigate(`/plan/programs/${program.id}`)}
                  >
                    <span className="flex items-center justify-between">
                      <span className="font-medium">{program.name}</span>
                      {isActive ? (
                        <span className="text-xs font-semibold text-sky-400">Active</span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">{summary}</span>
                  </button>
                  <div className="mt-2 flex justify-end gap-2">
                    {!isActive ? (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          write(saveSettings({ activeProgramId: program.id }), 'setting the active program')
                        }
                      >
                        Make active
                      </Button>
                    ) : null}
                    <Button variant="danger" onClick={() => handleDeleteProgram(program.id, program.name)}>
                      Delete
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Routines</h2>
          {routines.length > 0 ? (
            <Button variant="secondary" onClick={handleNewRoutine}>
              + New
            </Button>
          ) : null}
        </div>

        {routines.length === 0 ? (
          <div className="mt-4 text-center">
            <p className="text-sm text-slate-500">
              A routine is an ordered list of exercises with set and rep targets — the plan for one
              workout.
            </p>
            <Button variant="primary" className="mt-3" onClick={handleNewRoutine}>
              New routine
            </Button>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {routines.map((routine) => (
              <li key={routine.id} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => navigate(`/plan/routines/${routine.id}`)}
                >
                  <span className="font-medium">{routine.name}</span>
                  <span className="block text-xs text-slate-500">
                    {routine.blocks.length} {routine.blocks.length === 1 ? 'exercise' : 'exercises'}
                  </span>
                </button>
                <div className="mt-2 flex justify-end">
                  <Button variant="danger" onClick={() => handleDeleteRoutine(routine.id, routine.name)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
