import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/schema'
import { getActiveSession, nextRoutineInProgram, startSession, startSessionFromRoutine } from '../../db/repo'
import { sessionVolume, suggestNextTarget } from '../../lib/records'
import { formatWeight } from '../../lib/units'
import { useSettings } from '../../app/SettingsProvider'
import { useWrite } from '../../app/WriteErrorBoundary'
import Button from '../../components/Button'
import SessionScreen from './SessionScreen'

export default function TodayScreen() {
  const settings = useSettings()
  const write = useWrite()

  // Wrapped in an object so "still loading" (undefined) stays distinguishable
  // from "no session open" ({ session: undefined }) — useLiveQuery signals a
  // pending query with undefined, which is also a valid result here.
  const activeQuery = useLiveQuery(async () => ({ session: await getActiveSession() }), [])

  const activeProgramId = settings.activeProgramId
  // Same wrapping trick: `nextRoutineInProgram` legitimately resolves to
  // undefined (empty rotation, or no program at all), and that must not be
  // confused with the query still being pending — conflating the two here
  // was the exact bug that once left this screen blank forever.
  const nextQuery = useLiveQuery(
    async () => ({
      routine: activeProgramId ? await nextRoutineInProgram(activeProgramId) : undefined,
    }),
    [activeProgramId],
  )

  const exercises = useLiveQuery(() => db.exercises.toArray(), [], [])
  const history = useLiveQuery(() => db.setEntries.toArray(), [], [])
  const recent = useLiveQuery(
    () => db.sessions.orderBy('startedAt').reverse().limit(3).toArray(),
    [],
    [],
  )
  const recentSets = useLiveQuery(() => db.setEntries.toArray(), [], [])

  // Render nothing until the query resolves; showing the empty state first
  // would flash "no workout" at someone who is mid-session.
  if (activeQuery === undefined) return null
  if (activeQuery.session) return <SessionScreen sessionId={activeQuery.session.id} />

  const finished = recent.filter((s) => s.endedAt)
  const nextRoutine = nextQuery?.routine
  const exerciseById = new Map(exercises.map((ex) => [ex.id, ex]))

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="text-2xl font-semibold">Today</h1>

      {nextRoutine ? (
        <section className="mt-4 rounded-lg border border-slate-800 p-4">
          <h2 className="text-lg font-semibold text-slate-100">{nextRoutine.name}</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-400">
            {nextRoutine.blocks.map((block, index) => {
              const exerciseHistory = history.filter((h) => h.exerciseId === block.exerciseId)
              const target = suggestNextTarget(block, exerciseHistory)
              const label =
                target.weightKg > 0
                  ? `${block.targetSets} × ${target.reps} @ ${formatWeight(target.weightKg, settings.weightUnit)}`
                  : `${block.targetSets} × ${target.reps}`
              return (
                <li key={`${block.exerciseId}-${index}`}>
                  {exerciseById.get(block.exerciseId)?.name ?? 'Unknown exercise'} — {label}
                </li>
              )
            })}
          </ul>
          <Button
            variant="primary"
            className="mt-4 w-full"
            onClick={() => write(startSessionFromRoutine(nextRoutine.id), 'starting workout')}
          >
            Start {nextRoutine.name}
          </Button>
        </section>
      ) : (
        <p className="mt-1 text-sm text-slate-500">No workout in progress.</p>
      )}

      <Button
        variant={nextRoutine ? 'secondary' : 'primary'}
        className="mt-6 w-full"
        onClick={() => write(startSession(), 'starting workout')}
      >
        Start empty workout
      </Button>

      {finished.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Recent
          </h2>
          <ul className="mt-2 divide-y divide-slate-800">
            {finished.map((session) => {
              const sets = recentSets.filter((s) => s.sessionId === session.id)
              return (
                <li key={session.id} className="flex justify-between py-3 text-sm">
                  <span>{session.date}</span>
                  <span className="tabular-nums text-slate-500">
                    {sets.length} sets · {formatWeight(sessionVolume(sets), settings.weightUnit, 0)}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
