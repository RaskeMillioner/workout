import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'

function Placeholder({ title }: { title: string }) {
  return (
    <section className="p-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-slate-400">Coming up in this phase.</p>
    </section>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Placeholder title="Today" />} />
        <Route path="history" element={<Placeholder title="History" />} />
        <Route path="exercises" element={<Placeholder title="Exercises" />} />
        <Route path="settings" element={<Placeholder title="Settings" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
