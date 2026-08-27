import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { db } from './db/schema'
import { seedDatabase } from './db/seed'
import { SettingsProvider } from './app/SettingsProvider'
import { WriteErrorProvider } from './app/WriteErrorBoundary'
import AppLayout from './components/AppLayout'
import TodayScreen from './features/session/TodayScreen'
import HistoryScreen from './features/history/HistoryScreen'
import ExercisesScreen from './features/exercises/ExercisesScreen'
import SettingsScreen from './features/settings/SettingsScreen'
import RoutinesScreen from './features/routines/RoutinesScreen'
import RoutineEditor from './features/routines/RoutineEditor'
import ProgramEditor from './features/routines/ProgramEditor'

export default function App() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // First-run seeding. Idempotent, so it is safe on every start; nothing
  // renders until it resolves, or screens would query an empty catalogue.
  useEffect(() => {
    seedDatabase(db)
      .then(() => setReady(true))
      .catch((cause: unknown) => setError((cause as Error).message))
  }, [])

  if (error) {
    return (
      <main className="p-6">
        <h1 className="text-lg font-semibold text-red-400">Could not open the database</h1>
        <p className="mt-2 text-sm text-slate-400">{error}</p>
        <p className="mt-4 text-sm text-slate-500">
          Private browsing modes block IndexedDB. Opening the app in a normal window usually
          fixes this.
        </p>
      </main>
    )
  }

  if (!ready) return null

  return (
    <SettingsProvider>
      <WriteErrorProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<TodayScreen />} />
            <Route path="history" element={<HistoryScreen />} />
            <Route path="plan" element={<RoutinesScreen />} />
            <Route path="plan/routines/:routineId" element={<RoutineEditor />} />
            <Route path="plan/programs/:programId" element={<ProgramEditor />} />
            <Route path="exercises" element={<ExercisesScreen />} />
            <Route path="settings" element={<SettingsScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </WriteErrorProvider>
    </SettingsProvider>
  )
}
