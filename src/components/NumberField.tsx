import { useNumericDraft } from '../hooks/useNumericDraft'

type Props = {
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  /** Shown after the value, e.g. "kg". */
  suffix?: string
  decimals?: number
}

/**
 * Numeric entry with tap targets either side. Typing a weight on a phone
 * keyboard mid-set is slow and error-prone, so the steppers are the primary
 * control and the input is the escape hatch.
 *
 * While the field has focus the raw text is authoritative, not the parsed
 * number — see useNumericDraft for why.
 */
export default function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  suffix,
  decimals = 1,
}: Props) {
  const field = useNumericDraft({ value, onCommit: onChange, decimals, min })

  const clamp = (next: number) => Math.max(min, Number(next.toFixed(decimals)))
  const nudge = (delta: number) => {
    field.reset()
    onChange(clamp(value + delta))
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <span className="flex items-stretch overflow-hidden rounded-lg border border-slate-700 bg-slate-800">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          className="w-11 shrink-0 text-lg text-slate-300 active:bg-slate-700"
          onClick={() => nudge(-step)}
        >
          −
        </button>
        <input
          ref={field.ref}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-center tabular-nums outline-none"
          // "decimal" gives the numeric pad while still allowing 82.5.
          inputMode="decimal"
          aria-label={label}
          value={field.value}
          onChange={field.onChange}
          onFocus={field.onFocus}
          onBlur={field.onBlur}
        />
        {suffix ? (
          <span className="self-center pr-1 text-xs text-slate-500">{suffix}</span>
        ) : null}
        <button
          type="button"
          aria-label={`Increase ${label}`}
          className="w-11 shrink-0 text-lg text-slate-300 active:bg-slate-700"
          onClick={() => nudge(step)}
        >
          +
        </button>
      </span>
    </label>
  )
}
