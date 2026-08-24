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
  const clamp = (next: number) => Math.max(min, Number(next.toFixed(decimals)))
  const display = Number.isFinite(value) ? String(Number(value.toFixed(decimals))) : ''

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <span className="flex items-stretch overflow-hidden rounded-lg border border-slate-700 bg-slate-800">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          className="w-11 shrink-0 text-lg text-slate-300 active:bg-slate-700"
          onClick={() => onChange(clamp(value - step))}
        >
          −
        </button>
        <input
          className="min-w-0 flex-1 bg-transparent py-2.5 text-center tabular-nums outline-none"
          // "decimal" gives the numeric pad while still allowing 82.5.
          inputMode="decimal"
          value={display}
          aria-label={label}
          onChange={(event) => {
            const next = Number(event.target.value.replace(',', '.'))
            if (Number.isFinite(next)) onChange(Math.max(min, next))
          }}
          onFocus={(event) => event.target.select()}
        />
        {suffix ? (
          <span className="self-center pr-1 text-xs text-slate-500">{suffix}</span>
        ) : null}
        <button
          type="button"
          aria-label={`Increase ${label}`}
          className="w-11 shrink-0 text-lg text-slate-300 active:bg-slate-700"
          onClick={() => onChange(clamp(value + step))}
        >
          +
        </button>
      </span>
    </label>
  )
}
