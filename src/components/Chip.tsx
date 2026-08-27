type Props = {
  label: string
  active: boolean
  onClick: () => void
}

/** A single filter chip — the pill styling shared by every chip row in the
 *  app (the exercise picker's modality row, and the Exercises screen's
 *  favourites/equipment/muscle-group rows) so they read as one system. */
export default function Chip({ label, active, onClick }: Props) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-medium ${
        active ? 'bg-sky-500 text-slate-950' : 'border border-slate-700 text-slate-300'
      }`}
    >
      {label}
    </button>
  )
}
