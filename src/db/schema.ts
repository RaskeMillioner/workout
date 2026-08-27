import Dexie from 'dexie'
import type { EntityTable } from 'dexie'

/**
 * Canonical storage units — everything on disk is stored in these, and only
 * converted at the edges for display (see src/lib/units.ts):
 *   weight   → kilograms
 *   distance → metres
 *   duration → seconds
 *
 * Every record carries a string `id` (crypto.randomUUID()) and an `updatedAt`
 * epoch-ms stamp so a later cloud-sync layer can do last-write-wins merging
 * without a schema migration.
 */

export type Modality = 'strength' | 'cardio' | 'other'

/**
 * The muscle-group vocabulary. Kept closed on purpose: a fixed list is what
 * makes "show me everything that hits hamstrings" and per-group volume
 * tracking work. Extending it is a code change, not a data change.
 */
export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'lats',
  'traps',
  'lower-back',
  'shoulders',
  'rear-delts',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'adductors',
  'abductors',
  'calves',
  'core',
  'obliques',
  'hip-flexors',
  'full-body',
  'cardiovascular',
] as const

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]
export type SetKind = 'warmup' | 'working' | 'dropset'
export type ProgressionScheme = 'linear' | 'double-progression' | 'none'
export type WeightUnit = 'kg' | 'lb'
export type DistanceUnit = 'km' | 'mi'
export type Theme = 'dark' | 'light' | 'system'

export interface Exercise {
  id: string
  name: string
  modality: Modality
  muscleGroups: MuscleGroup[]
  equipment: string
  isCustom: boolean
  notes?: string
  updatedAt: number
}

export interface Session {
  id: string
  /** ISO calendar day, `yyyy-mm-dd`. Indexed — the calendar view queries on it. */
  date: string
  startedAt: number
  endedAt?: number
  routineId?: string
  notes?: string
  /** Session RPE, 1–10. */
  perceivedEffort?: number
  updatedAt: number
}

export interface SetEntry {
  id: string
  sessionId: string
  exerciseId: string
  /** Position within the session, ascending. */
  order: number
  kind: SetKind
  reps: number
  weightKg: number
  rpe?: number
  completed: boolean
  restSec?: number
  updatedAt: number
}

export interface CardioEntry {
  id: string
  sessionId: string
  exerciseId: string
  order: number
  durationSec: number
  distanceM?: number
  avgHr?: number
  notes?: string
  updatedAt: number
}

export interface RoutineBlock {
  exerciseId: string
  targetSets: number
  repRangeLow: number
  repRangeHigh: number
  progression: ProgressionScheme
  /** Step size for linear / double progression, in kg. */
  incrementKg?: number
  notes?: string
}

export interface Routine {
  id: string
  name: string
  blocks: RoutineBlock[]
  updatedAt: number
}

export interface BodyMetric {
  id: string
  /** ISO calendar day, `yyyy-mm-dd`. Indexed. */
  date: string
  weightKg?: number
  bodyFatPct?: number
  /** Free-form tape measurements in cm, keyed by site ("waist", "chest", …). */
  measurements: Record<string, number>
  updatedAt: number
}

export interface Program {
  id: string
  name: string
  /** Ordered rotation: the next session is the one after whatever you last did. */
  routineIds: string[]
  updatedAt: number
}

export const SETTINGS_ID = 'singleton'

export interface Settings {
  /** Always the literal `'singleton'` — this table holds exactly one row. */
  id: typeof SETTINGS_ID
  weightUnit: WeightUnit
  distanceUnit: DistanceUnit
  defaultRestSec: number
  theme: Theme
  lastExportAt?: number
  /** The program currently being followed, if any. Drives which routine comes next. */
  activeProgramId?: string
  updatedAt: number
}

/**
 * Migration policy
 * ----------------
 * The `version(1)` block below is frozen: never edit its store strings, and
 * never rewrite the shape of data it produced. To change the schema in a later
 * phase, append a new block —
 *
 *     db.version(2).stores({ setEntries: '...new index string...' })
 *       .upgrade(async (tx) => { ...backfill/transform rows here... })
 *
 * — and leave every earlier version untouched. Dexie replays the chain for
 * users still on an old version, so mutating v1 silently corrupts their data.
 * Adding an optional field needs no version bump at all (IndexedDB is
 * schemaless outside of indexes); only index changes and data rewrites do.
 */
export class WorkoutDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  sessions!: EntityTable<Session, 'id'>
  setEntries!: EntityTable<SetEntry, 'id'>
  cardioEntries!: EntityTable<CardioEntry, 'id'>
  routines!: EntityTable<Routine, 'id'>
  bodyMetrics!: EntityTable<BodyMetric, 'id'>
  settings!: EntityTable<Settings, 'id'>
  programs!: EntityTable<Program, 'id'>

  constructor(name = 'workout') {
    super(name)
    this.version(1).stores({
      exercises: 'id, name, modality, equipment, isCustom, *muscleGroups, updatedAt',
      sessions: 'id, date, startedAt, routineId, updatedAt',
      // [exerciseId+sessionId] backs "history for this exercise" lookups and
      // keeps per-session slices of that history cheap; exerciseId alone backs
      // the all-time PR scan.
      setEntries:
        'id, sessionId, exerciseId, [exerciseId+sessionId], [sessionId+order], updatedAt',
      cardioEntries:
        'id, sessionId, exerciseId, [exerciseId+sessionId], [sessionId+order], updatedAt',
      routines: 'id, name, updatedAt',
      bodyMetrics: 'id, date, updatedAt',
      settings: 'id, updatedAt',
    })
    this.version(2).stores({
      programs: 'id, name, updatedAt',
    })
  }
}

/** Names of the tables that participate in backup/restore, in dependency order. */
export const TABLE_NAMES = [
  'exercises',
  'sessions',
  'setEntries',
  'cardioEntries',
  'routines',
  'bodyMetrics',
  'settings',
  'programs',
] as const

export type TableName = (typeof TABLE_NAMES)[number]

/** Epoch-ms stamp helper, so every write site agrees on the shape. */
export const now = (): number => Date.now()

export const newId = (): string => crypto.randomUUID()

export const db = new WorkoutDB()
