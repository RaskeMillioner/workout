import { useState } from 'react'
import type { CardioEntry, DistanceUnit } from '../../db/schema'
import { deleteCardio, updateCardio } from '../../db/repo'
import { fromDisplayDistance, formatPace, toDisplayDistance } from '../../lib/units'
import NumberField from '../../components/NumberField'
import Button from '../../components/Button'

type Props = { entry: CardioEntry; unit: DistanceUnit }

export default function CardioForm({ entry, unit }: Props) {
  const [open, setOpen] = useState(false)
  const minutes = Math.floor(entry.durationSec / 60)
  const seconds = entry.durationSec % 60
  const distance = toDisplayDistance(entry.distanceM ?? 0, unit)

  const setDuration = (mins: number, secs: number) =>
    updateCardio(entry.id, { durationSec: Math.max(0, Math.round(mins) * 60 + Math.round(secs)) })

  return (
    <div className="px-3 py-2">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span className="text-sm tabular-nums text-slate-300">
          {minutes}m {seconds ? `${seconds}s` : ''}
          {entry.distanceM ? ` · ${toDisplayDistance(entry.distanceM, unit).toFixed(2)} ${unit}` : ''}
        </span>
        <span className="text-xs text-slate-500">
          {entry.distanceM && entry.durationSec
            ? formatPace(entry.durationSec, entry.distanceM, unit)
            : 'Tap to edit'}
        </span>
      </button>

      {open ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <NumberField
            label="Minutes"
            value={minutes}
            decimals={0}
            onChange={(value) => setDuration(value, seconds)}
          />
          <NumberField
            label="Seconds"
            value={seconds}
            decimals={0}
            step={5}
            onChange={(value) => setDuration(minutes, value)}
          />
          <NumberField
            label={`Distance (${unit})`}
            value={distance}
            step={0.5}
            decimals={2}
            onChange={(value) =>
              updateCardio(entry.id, { distanceM: fromDisplayDistance(value, unit) })
            }
          />
          <NumberField
            label="Avg HR"
            value={entry.avgHr ?? 0}
            decimals={0}
            step={5}
            onChange={(value) => updateCardio(entry.id, { avgHr: value || undefined })}
          />
          <div className="col-span-2 flex justify-end">
            <Button variant="danger" onClick={() => deleteCardio(entry.id)}>
              Remove
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
