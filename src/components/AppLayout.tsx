import { NavLink, Outlet } from 'react-router-dom'

type Tab = { to: string; label: string; icon: string }

const TABS: Tab[] = [
  { to: '/', label: 'Today', icon: '🏋️' },
  { to: '/history', label: 'History', icon: '📅' },
  { to: '/plan', label: 'Plan', icon: '📋' },
  { to: '/exercises', label: 'Exercises', icon: '📖' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function AppLayout() {
  return (
    <div className="flex min-h-full flex-col">
      <main className="flex-1 pb-20">
        <Outlet />
      </main>

      {/* Bottom nav: thumb-reachable, and padded clear of the home indicator. */}
      <nav
        className="fixed inset-x-0 bottom-0 border-t border-slate-800 bg-slate-900/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="mx-auto flex max-w-lg">
          {TABS.map((tab) => (
            <li key={tab.to} className="flex-1">
              <NavLink
                to={tab.to}
                end={tab.to === '/'}
                className={({ isActive }) =>
                  [
                    'flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs',
                    isActive ? 'text-sky-400' : 'text-slate-400',
                  ].join(' ')
                }
              >
                <span aria-hidden className="text-lg leading-none">
                  {tab.icon}
                </span>
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
