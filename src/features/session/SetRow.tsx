import type { SetEntry, WeightUnit } from '../../db/schema'
import { deleteSet, updateSet } from '../../db/repo'
import { useWrite } from '../../app/WriteErrorBoundary'
import { useNumericDraft } from '../../hooks/useNumericDraft'
import { fromDisplayWeight, toDisplayWeight } from '../../lib/units'

type Props = {
  entry: SetEntry
  index: number
  unit: WeightUnit
  isPR: boolean
  onComplete: () => void
}

const KIND_LABEL: Record<SetEntry['kind'], string> = {
  warmup: 'W',
  working: '',
  dropset: 'D',
}

/** Weight step matched to the smallest plate pair you are likely to have. */
const STEP = { kg: 2.5, lb: 5 } as const

export default function SetRow({ entry, index, unit, isPR, onComplete }: Props) {
  const save = useWrite()
  const displayWeight = toDisplayWeight(entry.weightKg, unit)
  const step = STEP[unit]

  const weightField = useNumericDraft({
    value: displayWeight,
    decimals: 1,
    onCommit: (next) =>
      save(updateSet(entry.id, { weightKg: fromDisplayWeight(next, unit) }), 'updating the weight'),
  })
  const repsField = useNumericDraft({
    value: entry.reps,
    decimals: 0,
    integer: true,
    onCommit: (next) => save(updateSet(entry.id, { reps: next }), 'updating the reps'),
  })

  const nudge = (delta: number) => {
    weightField.reset()
    save(
      updateSet(entry.id, { weightKg: fromDisplayWeight(Math.max(0, displayWeight + delta), unit) }),
      'updating the weight',
    )
  }

  const cycleKind = () => {
    const order: SetEntry['kind'][] = ['working', 'warmup', 'dropset']
    const next = order[(order.indexOf(entry.kind) + 1) % order.length] ?? 'working'
    save(updateSet(entry.id, { kind: next }), 'changing the set type')
  }

  return (
    <li
      className={`flex items-center gap-2 px-3 py-2 ${
        entry.completed ? 'bg-slate-900/60' : ''
      }`}
    >
      <button
        type="button"
        onClick={cycleKind}
        aria-label={`Set type: ${entry.kind}. Tap to change.`}
        className={`h-8 w-8 shrink-0 rounded-full text-xs font-bold ${
          entry.kind === 'working'
            ? 'bg-slate-800 text-slate-400'
            : 'bg-amber-500/20 text-amber-300'
        }`}
      >
        {KIND_LABEL[entry.kind] || index + 1}
      </button>

      <span className="flex flex-1 items-center gap-1">
        <button
          type="button"
          aria-label="Decrease weight"
          className="h-9 w-8 rounded text-slate-400 active:bg-slate-800"
          onClick={() => nudge(-step)}
        >
          −
        </button>
        <input
          ref={weightField.ref}
          inputMode="decimal"
          aria-label={`Set ${index + 1} weight`}
          className="w-16 rounded bg-slate-800 py-1.5 text-center tabular-nums outline-none focus:ring-1 focus:ring-sky-500"
          value={weightField.value}
          onChange={weightField.onChange}
          onFocus={weightField.onFocus}
          onBlur={weightField.onBlur}
        />
        <button
          type="button"
          aria-label="Increase weight"
          className="h-9 w-8 rounded text-slate-400 active:bg-slate-800"
          onClick={() => nudge(step)}
        >
          +
        </button>

        <span className="px-1 text-xs text-slate-600">×</span>

        <input
          ref={repsField.ref}
          inputMode="numeric"
          aria-label={`Set ${index + 1} reps`}
          className="w-12 rounded bg-slate-800 py-1.5 text-center tabular-nums outline-none focus:ring-1 focus:ring-sky-500"
          value={repsField.value}
          onChange={repsField.onChange}
          onFocus={repsField.onFocus}
          onBlur={repsField.onBlur}
        />
      </span>

      {isPR ? (
        <span
          className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300"
          title="Personal record"
        >
          PR
        </span>
      ) : null}

      <button
        type="button"
        aria-label={entry.completed ? `Mark set ${index + 1} incomplete` : `Complete set ${index + 1}`}
        aria-pressed={entry.completed}
        onClick={() => {
          const next = !entry.completed
          save(updateSet(entry.id, { completed: next }), 'completing the set')
          // Rest starts when a set is finished, not when it is un-finished.
          if (next) onComplete()
        }}
        className={`h-9 w-9 shrink-0 rounded-lg text-base font-bold ${
          entry.completed ? 'bg-sky-500 text-slate-950' : 'border border-slate-700 text-slate-600'
        }`}
      >
        ✓
      </button>

      <button
        type="button"
        aria-label={`Delete set ${index + 1}`}
        className="h-9 w-7 shrink-0 text-slate-600 active:text-red-400"
        onClick={() => save(deleteSet(entry.id), 'deleting the set')}
      >
        ×
      </button>
    </li>
  )
}
