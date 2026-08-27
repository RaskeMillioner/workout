import { useRef } from 'react'

type Props = {
  label: string
  defaultValue: string
  placeholder?: string
  onCommit: (value: string) => void
}

/**
 * Free text bound to the database on blur (or Enter), not on every
 * keystroke. Uncontrolled on purpose: binding an <input> directly to a
 * live-queried value fights the cursor the instant a write round-trips
 * through Dexie and the query re-renders — see NumberField/useNumericDraft
 * for the numeric-field version of this problem.
 */
export default function CommitTextField({ label, defaultValue, placeholder, onCommit }: Props) {
  const ref = useRef<HTMLInputElement>(null)

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <input
        ref={ref}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 outline-none focus:border-sky-500"
        onBlur={(event) => onCommit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
    </label>
  )
}
