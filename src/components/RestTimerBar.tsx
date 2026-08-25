import type { RestTimer } from '../hooks/useRestTimer'
import { formatDuration } from '../lib/units'

/**
 * Sticky rest countdown. Sits above the bottom nav so it stays visible while
 * scrolling the exercise list, which is where you actually are while resting.
 */
export default function RestTimerBar({ timer }: { timer: RestTimer }) {
  if (!timer.running) return null

  const { remainingSec, overrun, durationSec } = timer
  const elapsed = durationSec - remainingSec
  const progress = durationSec > 0 ? Math.min(1, Math.max(0, elapsed / durationSec)) : 1

  return (
    <div
      className="fixed inset-x-0 bottom-14 z-10 border-t border-slate-800 bg-slate-900"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      role="status"
      aria-live="polite"
    >
      <div className="h-0.5 bg-slate-800">
        <div
          className={overrun ? 'h-full bg-amber-400' : 'h-full bg-sky-500'}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-2">
        <span
          className={`min-w-16 text-xl font-semibold tabular-nums ${
            overrun ? 'text-amber-400' : 'text-sky-400'
          }`}
        >
          {overrun ? `+${formatDuration(-remainingSec)}` : formatDuration(remainingSec)}
        </span>
        <span className="flex-1 text-xs text-slate-500">
          {overrun ? 'Rest complete' : 'Resting'}
        </span>
        <button
          type="button"
          className="min-h-9 rounded-md border border-slate-700 px-2 text-xs text-slate-300"
          onClick={() => timer.adjust(30)}
        >
          +30s
        </button>
        <button
          type="button"
          className="min-h-9 rounded-md bg-slate-800 px-3 text-xs font-semibold text-slate-200"
          onClick={timer.stop}
        >
          Skip
        </button>
      </div>
    </div>
  )
}
