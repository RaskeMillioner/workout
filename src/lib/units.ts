import type { DistanceUnit, WeightUnit } from '../db/schema'

/**
 * Pure conversion + display helpers. Storage is always kg / metres / seconds
 * (see src/db/schema.ts); these are the only place unit preference is applied.
 */

const LB_PER_KG = 2.20462262185
const METRES_PER_MILE = 1609.344

export const kgToLb = (kg: number): number => kg * LB_PER_KG
export const lbToKg = (lb: number): number => lb / LB_PER_KG
export const metresToKm = (m: number): number => m / 1000
export const metresToMiles = (m: number): number => m / METRES_PER_MILE
export const kmToMetres = (km: number): number => km * 1000
export const milesToMetres = (mi: number): number => mi * METRES_PER_MILE

/**
 * Round to `decimals` places and strip float noise, so 82.50000000001 prints
 * as "82.5" and 82.0 prints as "82" rather than "82.0".
 */
export function round(value: number, decimals = 1): number {
  if (!Number.isFinite(value)) return NaN
  // Number(...toFixed) rather than Math.round(v * 10**d) / 10**d: toFixed
  // rounds on the printed decimal form, which is what the user actually sees,
  // so 82.50000000001 collapses to 82.5 instead of surviving as float noise.
  return Number(value.toFixed(Math.max(0, Math.min(20, decimals))))
}

const trim = (value: number, decimals: number): string => String(round(value, decimals))

/** Convert a stored kg value into the user's unit, unrounded. */
export const toDisplayWeight = (kg: number, unit: WeightUnit): number =>
  unit === 'lb' ? kgToLb(kg) : kg

/** Convert a value the user typed in their unit back to kg for storage. */
export const fromDisplayWeight = (value: number, unit: WeightUnit): number =>
  unit === 'lb' ? lbToKg(value) : value

/** Convert stored metres into the user's unit, unrounded. */
export const toDisplayDistance = (metres: number, unit: DistanceUnit): number =>
  unit === 'mi' ? metresToMiles(metres) : metresToKm(metres)

/** Convert a distance the user typed in their unit back to metres for storage. */
export const fromDisplayDistance = (value: number, unit: DistanceUnit): number =>
  unit === 'mi' ? milesToMetres(value) : kmToMetres(value)

/** `formatWeight(82.5, 'kg')` → `"82.5 kg"`. Weights show at most 1 decimal. */
export function formatWeight(kg: number, unit: WeightUnit, decimals = 1): string {
  if (!Number.isFinite(kg)) return '—'
  return `${trim(toDisplayWeight(kg, unit), decimals)} ${unit}`
}

/** `formatDistance(5000, 'km')` → `"5 km"`. */
export function formatDistance(metres: number, unit: DistanceUnit, decimals = 2): string {
  if (!Number.isFinite(metres)) return '—'
  return `${trim(toDisplayDistance(metres, unit), decimals)} ${unit}`
}

/**
 * `formatDuration(330)` → `"5:30"`, `formatDuration(3930)` → `"1:05:30"`.
 * Minutes are zero-padded only once there is an hours field to align to.
 */
export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const total = Math.round(sec)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const ss = String(seconds).padStart(2, '0')
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`
  return `${minutes}:${ss}`
}

/**
 * `formatPace(1752, 6000, 'km')` → `"4:52 /km"`. Returns `"—"` when there is
 * no distance to divide by, since an infinite pace is not a useful display.
 */
export function formatPace(durationSec: number, distanceM: number, unit: DistanceUnit): string {
  if (!Number.isFinite(durationSec) || !Number.isFinite(distanceM)) return '—'
  const distance = toDisplayDistance(distanceM, unit)
  if (distance <= 0 || durationSec <= 0) return '—'
  return `${formatDuration(durationSec / distance)} /${unit}`
}

/** Speed in the user's unit per hour, e.g. for bike work. */
export function formatSpeed(durationSec: number, distanceM: number, unit: DistanceUnit): string {
  if (!Number.isFinite(durationSec) || !Number.isFinite(distanceM) || durationSec <= 0) return '—'
  const perHour = toDisplayDistance(distanceM, unit) * (3600 / durationSec)
  return `${trim(perHour, 1)} ${unit}/h`
}

/**
 * Smallest sensible weight step for the unit: 2.5 kg (a pair of small plates)
 * or 5 lb. Used as the default increment when a routine block has none.
 */
export const defaultIncrement = (unit: WeightUnit): number => (unit === 'lb' ? lbToKg(5) : 2.5)
