import { createContext, use, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Settings } from '../db/schema'
import { SETTINGS_ID, db } from '../db/schema'
import { DEFAULT_SETTINGS } from '../db/seed'

const SettingsContext = createContext<Settings | null>(null)

/**
 * Settings are read once here and shared, rather than each screen running its
 * own live query for the same single row.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const settings = useLiveQuery(() => db.settings.get(SETTINGS_ID), [])
  // Until the row loads, fall back to defaults so nothing renders unit-less.
  const value: Settings = settings ?? { ...DEFAULT_SETTINGS, id: SETTINGS_ID, updatedAt: 0 }
  return <SettingsContext value={value}>{children}</SettingsContext>
}

export function useSettings(): Settings {
  const value = use(SettingsContext)
  if (!value) throw new Error('useSettings must be used inside SettingsProvider')
  return value
}
