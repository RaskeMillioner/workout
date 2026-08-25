import { useRef, useState } from 'react'
import type { DistanceUnit, WeightUnit } from '../../db/schema'
import { db } from '../../db/schema'
import { saveSettings, todayISO } from '../../db/repo'
import { BackupValidationError, exportBackup, importBackup } from '../../lib/backup'
import { useSettings } from '../../app/SettingsProvider'
import NumberField from '../../components/NumberField'
import Button from '../../components/Button'

type Status = { tone: 'ok' | 'error'; message: string } | null

export default function SettingsScreen() {
  const settings = useSettings()
  const fileInput = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status>(null)

  const handleExport = async () => {
    try {
      const backup = await exportBackup(db)
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `workout-backup-${todayISO()}.json`
      link.click()
      URL.revokeObjectURL(url)

      await saveSettings({ lastExportAt: Date.now() })
      setStatus({ tone: 'ok', message: 'Backup downloaded.' })
    } catch (error) {
      setStatus({ tone: 'error', message: `Export failed: ${(error as Error).message}` })
    }
  }

  const handleImport = async (file: File) => {
    // Replacing everything is destructive and there is no undo, so make the
    // consequence explicit before touching the database.
    if (!confirm('Importing replaces all current data. Continue?')) return
    try {
      const parsed: unknown = JSON.parse(await file.text())
      const { imported } = await importBackup(db, parsed)
      const total = Object.values(imported).reduce((sum, count) => sum + count, 0)
      setStatus({ tone: 'ok', message: `Restored ${total} records.` })
    } catch (error) {
      const message =
        error instanceof BackupValidationError
          ? error.message
          : error instanceof SyntaxError
            ? 'That file is not valid JSON.'
            : (error as Error).message
      setStatus({ tone: 'error', message: `Import failed — nothing was changed. ${message}` })
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const daysSinceExport = settings.lastExportAt
    ? Math.floor((Date.now() - settings.lastExportAt) / 86_400_000)
    : null

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="mt-6">
        <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Units</h2>
        <div className="mt-2 flex gap-2">
          {(['kg', 'lb'] as WeightUnit[]).map((unit) => (
            <Button
              key={unit}
              variant={settings.weightUnit === unit ? 'primary' : 'secondary'}
              onClick={() => saveSettings({ weightUnit: unit })}
            >
              {unit}
            </Button>
          ))}
          {(['km', 'mi'] as DistanceUnit[]).map((unit) => (
            <Button
              key={unit}
              variant={settings.distanceUnit === unit ? 'primary' : 'secondary'}
              onClick={() => saveSettings({ distanceUnit: unit })}
            >
              {unit}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-600">
          Weights are always stored in kilograms — switching units only changes the display,
          never your logged data.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Rest timer</h2>
        <div className="mt-2 max-w-40">
          <NumberField
            label="Default rest (seconds)"
            value={settings.defaultRestSec}
            step={15}
            decimals={0}
            onChange={(value) => saveSettings({ defaultRestSec: Math.round(value) })}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Backup</h2>
        <p className="mt-2 text-sm text-slate-400">
          Everything lives on this device only. Clearing your browser data, or losing the phone,
          loses your training history — export regularly and keep the file somewhere safe.
        </p>

        {daysSinceExport === null ? (
          <p className="mt-2 rounded-lg border border-amber-800 bg-amber-950/40 p-2 text-xs text-amber-300">
            You have never exported a backup.
          </p>
        ) : daysSinceExport >= 30 ? (
          <p className="mt-2 rounded-lg border border-amber-800 bg-amber-950/40 p-2 text-xs text-amber-300">
            Last backup was {daysSinceExport} days ago.
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-600">
            Last backup {daysSinceExport === 0 ? 'today' : `${daysSinceExport} days ago`}.
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <Button variant="primary" onClick={handleExport}>
            Export JSON
          </Button>
          <Button onClick={() => fileInput.current?.click()}>Import</Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) handleImport(file)
            }}
          />
        </div>

        {status ? (
          <p
            role="status"
            className={`mt-3 text-sm ${status.tone === 'ok' ? 'text-sky-400' : 'text-red-400'}`}
          >
            {status.message}
          </p>
        ) : null}
      </section>
    </div>
  )
}
