import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Exercise, SetEntry } from '../../db/schema'
import { db } from '../../db/schema'
import { deleteSession } from '../../db/repo'
import { sessionVolume } from '../../lib/records'
import { formatDuration, formatWeight } from '../../lib/units'
import { useSettings } from '../../app/SettingsProvider'
import Button from '../../components/Button'

export default function HistoryScreen() {
  const settings = useSettings()
  const [expanded, setExpanded] = useState<string | null>(null)

  const sessions = useLiveQuery(
    () => db.sessions.orderBy('startedAt').reverse().toArray(),
    [],
    [],
  )
  const sets = useLiveQuery(() => db.setEntries.toArray(), [], [] as SetEntry[])
  const cardio = useLiveQuery(() => db.cardioEntries.toArray(), [], [])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], [])

  const byId = useMemo(
    () => new Map(exercises.map((ex: Exercise) => [ex.id, ex])),
    [exercises],
  )

  const finished = sessions.filter((s) => s.endedAt)

  if (finished.length === 0) {
    return (
      <div className="mx-auto max-w-lg p-4">
        <h1 className="text-2xl font-semibold">History</h1>
        <p className="mt-16 text-center text-sm text-slate-500">
          Finished workouts show up here.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="text-2xl font-semibold">History</h1>

      <ul className="mt-4 space-y-2">
        {finished.map((session) => {
          const mySets = sets.filter((s) => s.sessionId === session.id)
          const myCardio = cardio.filter((c) => c.sessionId === session.id)
          const isOpen = expanded === session.id
          const duration = session.endedAt ? (session.endedAt - session.startedAt) / 1000 : 0

          return (
            <li key={session.id} className="rounded-lg border border-slate-800 bg-slate-900/40">
              <button
                type="button"
                className="flex w-full items-center justify-between p-3 text-left"
                onClick={() => setExpanded(isOpen ? null : session.id)}
                aria-expanded={isOpen}
              >
                <span>
                  <span className="block font-medium">{session.date}</span>
                  <span className="block text-xs tabular-nums text-slate-500">
                    {mySets.length} sets · {formatWeight(sessionVolume(mySets), settings.weightUnit, 0)}
                    {duration > 0 ? ` · ${formatDuration(duration)}` : ''}
                  </span>
                </span>
                <span className="text-slate-600">{isOpen ? '−' : '+'}</span>
              </button>

              {isOpen ? (
                <div className="border-t border-slate-800 p-3 text-sm">
                  {mySets.length === 0 && myCardio.length === 0 ? (
                    <p className="text-slate-500">Nothing recorded.</p>
                  ) : null}

                  <ul className="space-y-1">
                    {Object.entries(
                      mySets.reduce<Record<string, SetEntry[]>>((acc, entry) => {
                        ;(acc[entry.exerciseId] ??= []).push(entry)
                        return acc
                      }, {}),
                    ).map(([exerciseId, entries]) => (
                      <li key={exerciseId}>
                        <span className="font-medium text-slate-300">
                          {byId.get(exerciseId)?.name ?? 'Unknown'}
                        </span>
                        <span className="ml-2 tabular-nums text-slate-500">
                          {entries
                            .map(
                              (e) =>
                                `${Number(e.weightKg.toFixed(1))}×${e.reps}${
                                  e.kind === 'warmup' ? ' (w)' : ''
                                }`,
                            )
                            .join(', ')}
                        </span>
                      </li>
                    ))}
                    {myCardio.map((entry) => (
                      <li key={entry.id}>
                        <span className="font-medium text-slate-300">
                          {byId.get(entry.exerciseId)?.name ?? 'Cardio'}
                        </span>
                        <span className="ml-2 tabular-nums text-slate-500">
                          {formatDuration(entry.durationSec)}
                          {entry.distanceM ? ` · ${(entry.distanceM / 1000).toFixed(2)} km` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {session.notes ? (
                    <p className="mt-2 text-slate-400 italic">{session.notes}</p>
                  ) : null}

                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="danger"
                      onClick={() => {
                        if (confirm(`Delete the workout on ${session.date}?`)) {
                          deleteSession(session.id)
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
