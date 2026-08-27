import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Exercise, ProgressionScheme, RoutineBlock } from '../../db/schema'
import { db } from '../../db/schema'
import { updateRoutine } from '../../db/repo'
import { useWrite } from '../../app/WriteErrorBoundary'
import Button from '../../components/Button'
import NumberField from '../../components/NumberField'
import ExercisePicker from '../session/ExercisePicker'
import CommitTextField from './CommitTextField'

const PROGRESSIONS: { value: ProgressionScheme; label: string }[] = [
  { value: 'double-progression', label: 'Double' },
  { value: 'linear', label: 'Linear' },
  { value: 'none', label: 'None' },
]

/** Sensible starting point for a freshly added block. */
const DEFAULT_BLOCK: Omit<RoutineBlock, 'exerciseId'> = {
  targetSets: 3,
  repRangeLow: 5,
  repRangeHigh: 8,
  progression: 'double-progression',
  incrementKg: 2.5,
}

export default function RoutineEditor() {
  const { routineId = '' } = useParams<{ routineId: string }>()
  const navigate = useNavigate()
  const write = useWrite()
  const [picking, setPicking] = useState(false)

  // Wrapped so "still loading" (undefined) stays distinguishable from "no
  // such routine" ({ routine: undefined }).
  const query = useLiveQuery(async () => ({ routine: await db.routines.get(routineId) }), [routineId])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], [] as Exercise[])
  const exerciseName = useMemo(() => new Map(exercises.map((ex) => [ex.id, ex.name])), [exercises])

  if (query === undefined) return null
  const { routine } = query

  if (!routine) {
    return (
      <div className="mx-auto max-w-lg p-4">
        <p className="text-sm text-slate-500">That routine no longer exists.</p>
        <Button className="mt-4" onClick={() => navigate('/plan')}>
          Back to Plan
        </Button>
      </div>
    )
  }

  const setBlocks = (blocks: RoutineBlock[]) =>
    write(updateRoutine(routine.id, { blocks }), 'updating the routine')

  const updateBlock = (index: number, changes: Partial<RoutineBlock>) => {
    setBlocks(routine.blocks.map((block, i) => (i === index ? { ...block, ...changes } : block)))
  }

  const removeBlock = (index: number) => {
    setBlocks(routine.blocks.filter((_, i) => i !== index))
  }

  const moveBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= routine.blocks.length) return
    const blocks = [...routine.blocks]
    ;[blocks[index], blocks[target]] = [blocks[target], blocks[index]]
    setBlocks(blocks)
  }

  const addBlock = (exercise: Exercise) => {
    setBlocks([...routine.blocks, { exerciseId: exercise.id, ...DEFAULT_BLOCK }])
    setPicking(false)
  }

  return (
    <div key={routineId} className="mx-auto max-w-lg p-4 pb-24">
      <button type="button" onClick={() => navigate('/plan')} className="text-sm text-slate-400">
        ← Plan
      </button>
      <h1 className="mt-2 text-2xl font-semibold">Edit routine</h1>

      <div className="mt-4">
        <CommitTextField
          label="Name"
          defaultValue={routine.name}
          onCommit={(name) => {
            const trimmed = name.trim()
            if (trimmed && trimmed !== routine.name) {
              write(updateRoutine(routine.id, { name: trimmed }), 'renaming the routine')
            }
          }}
        />
      </div>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Exercises</h2>
          <Button variant="secondary" onClick={() => setPicking(true)}>
            + Add exercise
          </Button>
        </div>

        {routine.blocks.length === 0 ? (
          <p className="mt-4 text-center text-sm text-slate-500">
            No exercises yet. Add one to build this routine.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {routine.blocks.map((block, index) => (
              <li
                key={`${block.exerciseId}-${index}`}
                className="rounded-lg border border-slate-800 bg-slate-900/40 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {exerciseName.get(block.exerciseId) ?? 'Unknown exercise'}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={index === 0}
                      className="min-h-11 min-w-11 text-slate-400 disabled:opacity-30"
                      onClick={() => moveBlock(index, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={index === routine.blocks.length - 1}
                      className="min-h-11 min-w-11 text-slate-400 disabled:opacity-30"
                      onClick={() => moveBlock(index, 1)}
                    >
                      ↓
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <NumberField
                    label="Sets"
                    value={block.targetSets}
                    decimals={0}
                    min={1}
                    onChange={(value) => updateBlock(index, { targetSets: Math.round(value) })}
                  />
                  <NumberField
                    label="Increment"
                    value={block.incrementKg ?? 0}
                    decimals={2}
                    step={0.5}
                    suffix="kg"
                    onChange={(value) => updateBlock(index, { incrementKg: value })}
                  />
                  <NumberField
                    label="Reps low"
                    value={block.repRangeLow}
                    decimals={0}
                    min={1}
                    onChange={(value) => updateBlock(index, { repRangeLow: Math.round(value) })}
                  />
                  <NumberField
                    label="Reps high"
                    value={block.repRangeHigh}
                    decimals={0}
                    min={1}
                    onChange={(value) => updateBlock(index, { repRangeHigh: Math.round(value) })}
                  />
                </div>

                <div className="mt-3">
                  <span className="text-xs font-medium text-slate-400">Progression</span>
                  <div className="mt-1 flex gap-2">
                    {PROGRESSIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateBlock(index, { progression: option.value })}
                        className={`min-h-9 flex-1 rounded-full text-xs font-medium ${
                          block.progression === option.value
                            ? 'bg-sky-500 text-slate-950'
                            : 'border border-slate-700 text-slate-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3">
                  <CommitTextField
                    label="Notes"
                    defaultValue={block.notes ?? ''}
                    placeholder="Optional"
                    onCommit={(notes) => updateBlock(index, { notes: notes.trim() || undefined })}
                  />
                </div>

                <div className="mt-3 flex justify-end">
                  <Button variant="danger" onClick={() => removeBlock(index)}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {picking ? <ExercisePicker onPick={addBlock} onClose={() => setPicking(false)} /> : null}
    </div>
  )
}
