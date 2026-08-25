import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/schema'
import { getActiveSession, startSession } from '../../db/repo'
import { sessionVolume } from '../../lib/records'
import { formatWeight } from '../../lib/units'
import { useSettings } from '../../app/SettingsProvider'
import Button from '../../components/Button'
import SessionScreen from './SessionScreen'

export default function TodayScreen() {
  const settings = useSettings()
  // Wrapped in an object so "still loading" (undefined) stays distinguishable
  // from "no session open" ({ session: undefined }) — useLiveQuery signals a
  // pending query with undefined, which is also a valid result here.
  const activeQuery = useLiveQuery(async () => ({ session: await getActiveSession() }), [])
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

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="text-2xl font-semibold">Today</h1>
      <p className="mt-1 text-sm text-slate-500">No workout in progress.</p>

      <Button variant="primary" className="mt-6 w-full" onClick={() => startSession()}>
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
