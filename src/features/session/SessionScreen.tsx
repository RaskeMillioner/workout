import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import type { Exercise, SetEntry } from '../../db/schema'
import { db } from '../../db/schema'
import { addCardio, addSet, deleteSession, finishSession } from '../../db/repo'
import { isPR, sessionVolume } from '../../lib/records'
import { formatWeight } from '../../lib/units'
import { useSettings } from '../../app/SettingsProvider'
import { useRestTimer } from '../../hooks/useRestTimer'
import Button from '../../components/Button'
import RestTimerBar from '../../components/RestTimerBar'
import ExercisePicker from './ExercisePicker'
import SetRow from './SetRow'
import CardioForm from './CardioForm'

export default function SessionScreen({ sessionId }: { sessionId: string }) {
  const settings = useSettings()
  const navigate = useNavigate()
  const timer = useRestTimer()
  const [picking, setPicking] = useState(false)

  const sets = useLiveQuery(
    () => db.setEntries.where('sessionId').equals(sessionId).toArray(),
    [sessionId],
    [] as SetEntry[],
  )
  const cardio = useLiveQuery(
    () => db.cardioEntries.where('sessionId').equals(sessionId).toArray(),
    [sessionId],
    [],
  )
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], [])

  // All-time history, so a PR badge means an actual lifetime best rather than
  // "best today".
  const history = useLiveQuery(() => db.setEntries.toArray(), [], [] as SetEntry[])

  const byId = useMemo(
    () => new Map(exercises.map((ex: Exercise) => [ex.id, ex])),
    [exercises],
  )

  /** Exercises in the order they were first added to this session. */
  const groups = useMemo(() => {
    const order: string[] = []
    const setsFor = new Map<string, SetEntry[]>()
    for (const entry of [...sets].sort((a, b) => a.order - b.order)) {
      if (!setsFor.has(entry.exerciseId)) {
        setsFor.set(entry.exerciseId, [])
        order.push(entry.exerciseId)
      }
      setsFor.get(entry.exerciseId)!.push(entry)
    }
    return order.map((id) => ({ exerciseId: id, entries: setsFor.get(id)! }))
  }, [sets])

  const volume = sessionVolume(sets)
  const completedCount = sets.filter((s) => s.completed).length

  const addExercise = async (exercise: Exercise) => {
    setPicking(false)
    if (exercise.modality === 'cardio') {
      await addCardio(sessionId, exercise.id, { durationSec: 0 })
    } else {
      await addSet(sessionId, exercise.id)
    }
  }

  const finish = async () => {
    if (completedCount === 0) {
      // Nothing was ticked off, so there is no workout to keep.
      if (!confirm('No completed sets — discard this session?')) return
      await deleteSession(sessionId)
    } else {
      await finishSession(sessionId)
    }
    timer.stop()
    navigate('/history')
  }

  return (
    <div className="mx-auto max-w-lg">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Workout</h1>
          <p className="text-xs text-slate-500 tabular-nums">
            {completedCount} {completedCount === 1 ? 'set' : 'sets'} ·{' '}
            {formatWeight(volume, settings.weightUnit, 0)} volume
          </p>
        </div>
        <Button variant="primary" onClick={finish}>
          Finish
        </Button>
      </header>

      {groups.length === 0 && cardio.length === 0 ? (
        <p className="px-4 py-16 text-center text-sm text-slate-500">
          Nothing logged yet. Add your first exercise below.
        </p>
      ) : null}

      {groups.map(({ exerciseId, entries }) => {
        const exercise = byId.get(exerciseId)
        const priorHistory = history.filter(
          (h) => h.exerciseId === exerciseId && !entries.some((e) => e.id === h.id),
        )
        // Three identical sets all beat the same history, so badging every
        // qualifying set turns a record into wallpaper. Badge one per rep
        // count — the heaviest, earliest set — while genuinely different rep
        // counts still each earn their own.
        const badged = new Set<string>()
        const bestPerReps = new Map<string, SetEntry>()
        for (const entry of entries) {
          if (!isPR(entry, priorHistory)) continue
          const incumbent = bestPerReps.get(String(entry.reps))
          if (!incumbent || entry.weightKg > incumbent.weightKg) {
            bestPerReps.set(String(entry.reps), entry)
          }
        }
        for (const entry of bestPerReps.values()) badged.add(entry.id)
        return (
          <section key={exerciseId} className="border-b border-slate-800 py-2">
            <h2 className="px-3 pb-1 text-sm font-semibold text-slate-200">
              {exercise?.name ?? 'Unknown exercise'}
            </h2>
            <ul>
              {entries.map((entry, index) => (
                <SetRow
                  key={entry.id}
                  entry={entry}
                  index={index}
                  unit={settings.weightUnit}
                  isPR={badged.has(entry.id)}
                  onComplete={() => timer.start(settings.defaultRestSec)}
                />
              ))}
            </ul>
            <div className="px-3 pt-1">
              <button
                type="button"
                className="min-h-9 text-xs font-semibold text-sky-400"
                onClick={() => addSet(sessionId, exerciseId)}
              >
                + Add set
              </button>
            </div>
          </section>
        )
      })}

      {cardio.map((entry) => (
        <section key={entry.id} className="border-b border-slate-800 py-2">
          <h2 className="px-3 pb-1 text-sm font-semibold text-slate-200">
            {byId.get(entry.exerciseId)?.name ?? 'Cardio'}
          </h2>
          <CardioForm entry={entry} unit={settings.distanceUnit} />
        </section>
      ))}

      <div className="p-4">
        <Button className="w-full" onClick={() => setPicking(true)}>
          + Add exercise
        </Button>
      </div>

      <RestTimerBar timer={timer} />
      {picking ? (
        <ExercisePicker onPick={addExercise} onClose={() => setPicking(false)} />
      ) : null}
    </div>
  )
}
