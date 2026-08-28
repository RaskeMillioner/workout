import type {
  BodyMetric,
  CardioEntry,
  Exercise,
  Program,
  Routine,
  Session,
  SetEntry,
  Settings,
  TableName,
  WorkoutDB,
} from '../db/schema'
import { MUSCLE_GROUPS, SETTINGS_ID, TABLE_NAMES } from '../db/schema'

/**
 * Whole-database export / restore as a single JSON file. This is the user's
 * only safety net (there is no server), so the import path validates the whole
 * file before it writes a single row: a malformed backup must fail loudly and
 * leave the existing data untouched, never half-restore.
 */

/** Bump alongside a `db.version(n)` bump that changes the exported shape. */
export const BACKUP_SCHEMA_VERSION = 2

export interface BackupFile {
  schemaVersion: number
  exportedAt: number
  exercises: Exercise[]
  sessions: Session[]
  setEntries: SetEntry[]
  cardioEntries: CardioEntry[]
  routines: Routine[]
  bodyMetrics: BodyMetric[]
  settings: Settings[]
  programs: Program[]
}

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupValidationError'
  }
}

const fail = (message: string): never => {
  throw new BackupValidationError(message)
}

// ── field checks ───────────────────────────────────────────────────────────

type Row = Record<string, unknown>

const isObject = (value: unknown): value is Row =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const where = (table: string, index: number, field: string): string =>
  `${table}[${index}].${field}`

function requireString(row: Row, table: string, index: number, field: string): void {
  const value = row[field]
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${where(table, index, field)} must be a non-empty string, got ${describe(value)}`)
  }
}

function requireNumber(row: Row, table: string, index: number, field: string): void {
  const value = row[field]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`${where(table, index, field)} must be a finite number, got ${describe(value)}`)
  }
}

function requireBoolean(row: Row, table: string, index: number, field: string): void {
  if (typeof row[field] !== 'boolean') {
    fail(`${where(table, index, field)} must be a boolean, got ${describe(row[field])}`)
  }
}

function requireEnum(
  row: Row,
  table: string,
  index: number,
  field: string,
  allowed: readonly string[],
): void {
  const value = row[field]
  if (typeof value !== 'string' || !allowed.includes(value)) {
    fail(
      `${where(table, index, field)} must be one of ${allowed.join(' | ')}, got ${describe(value)}`,
    )
  }
}

function optional(row: Row, field: string, check: () => void): void {
  const value = row[field]
  if (value === undefined || value === null) return
  check()
}

function describe(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  if (typeof value === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) return `array(${value.length})`
  if (typeof value === 'object') return 'object'
  return String(value)
}

// ── per-table row validation ───────────────────────────────────────────────

type RowValidator = (row: Row, table: string, index: number) => void

const validateCommon: RowValidator = (row, table, index) => {
  requireString(row, table, index, 'id')
  requireNumber(row, table, index, 'updatedAt')
}

const ROW_VALIDATORS: Record<TableName, RowValidator> = {
  exercises: (row, table, index) => {
    validateCommon(row, table, index)
    requireString(row, table, index, 'name')
    requireEnum(row, table, index, 'modality', ['strength', 'cardio', 'other'])
    requireString(row, table, index, 'equipment')
    requireBoolean(row, table, index, 'isCustom')
    const groups = row.muscleGroups
    if (!Array.isArray(groups)) {
      fail(`${where(table, index, 'muscleGroups')} must be an array, got ${describe(groups)}`)
      return
    }
    for (const group of groups) {
      if (typeof group !== 'string' || !(MUSCLE_GROUPS as readonly string[]).includes(group)) {
        fail(`${where(table, index, 'muscleGroups')} contains unknown group ${describe(group)}`)
      }
    }
    optional(row, 'notes', () => requireString(row, table, index, 'notes'))
    optional(row, 'isFavourite', () => requireBoolean(row, table, index, 'isFavourite'))
  },

  sessions: (row, table, index) => {
    validateCommon(row, table, index)
    requireString(row, table, index, 'date')
    if (typeof row.date === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      fail(`${where(table, index, 'date')} must be an ISO yyyy-mm-dd date, got ${describe(row.date)}`)
    }
    requireNumber(row, table, index, 'startedAt')
    optional(row, 'endedAt', () => requireNumber(row, table, index, 'endedAt'))
    optional(row, 'routineId', () => requireString(row, table, index, 'routineId'))
    optional(row, 'notes', () => requireString(row, table, index, 'notes'))
    optional(row, 'perceivedEffort', () => requireNumber(row, table, index, 'perceivedEffort'))
  },

  setEntries: (row, table, index) => {
    validateCommon(row, table, index)
    requireString(row, table, index, 'sessionId')
    requireString(row, table, index, 'exerciseId')
    requireNumber(row, table, index, 'order')
    requireEnum(row, table, index, 'kind', ['warmup', 'working', 'dropset'])
    requireNumber(row, table, index, 'reps')
    requireNumber(row, table, index, 'weightKg')
    requireBoolean(row, table, index, 'completed')
    optional(row, 'rpe', () => requireNumber(row, table, index, 'rpe'))
    optional(row, 'restSec', () => requireNumber(row, table, index, 'restSec'))
  },

  cardioEntries: (row, table, index) => {
    validateCommon(row, table, index)
    requireString(row, table, index, 'sessionId')
    requireString(row, table, index, 'exerciseId')
    requireNumber(row, table, index, 'order')
    requireNumber(row, table, index, 'durationSec')
    optional(row, 'distanceM', () => requireNumber(row, table, index, 'distanceM'))
    optional(row, 'avgHr', () => requireNumber(row, table, index, 'avgHr'))
    optional(row, 'notes', () => requireString(row, table, index, 'notes'))
  },

  routines: (row, table, index) => {
    validateCommon(row, table, index)
    requireString(row, table, index, 'name')
    const blocks = row.blocks
    if (!Array.isArray(blocks)) {
      fail(`${where(table, index, 'blocks')} must be an array, got ${describe(blocks)}`)
      return
    }
    blocks.forEach((block, blockIndex) => {
      const label = `routines[${index}].blocks`
      if (!isObject(block)) {
        fail(`${label}[${blockIndex}] must be an object, got ${describe(block)}`)
        return
      }
      requireString(block, label, blockIndex, 'exerciseId')
      requireNumber(block, label, blockIndex, 'targetSets')
      requireNumber(block, label, blockIndex, 'repRangeLow')
      requireNumber(block, label, blockIndex, 'repRangeHigh')
      requireEnum(block, label, blockIndex, 'progression', ['linear', 'double-progression', 'none'])
      optional(block, 'incrementKg', () => requireNumber(block, label, blockIndex, 'incrementKg'))
      optional(block, 'notes', () => requireString(block, label, blockIndex, 'notes'))
    })
  },

  bodyMetrics: (row, table, index) => {
    validateCommon(row, table, index)
    requireString(row, table, index, 'date')
    optional(row, 'weightKg', () => requireNumber(row, table, index, 'weightKg'))
    optional(row, 'bodyFatPct', () => requireNumber(row, table, index, 'bodyFatPct'))
    const measurements = row.measurements
    if (!isObject(measurements)) {
      fail(
        `${where(table, index, 'measurements')} must be an object, got ${describe(measurements)}`,
      )
      return
    }
    for (const [key, value] of Object.entries(measurements)) {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        fail(
          `${where(table, index, 'measurements')}.${key} must be a finite number, got ${describe(value)}`,
        )
      }
    }
  },

  settings: (row, table, index) => {
    validateCommon(row, table, index)
    if (row.id !== SETTINGS_ID) {
      fail(`${where(table, index, 'id')} must be "${SETTINGS_ID}", got ${describe(row.id)}`)
    }
    requireEnum(row, table, index, 'weightUnit', ['kg', 'lb'])
    requireEnum(row, table, index, 'distanceUnit', ['km', 'mi'])
    requireNumber(row, table, index, 'defaultRestSec')
    requireEnum(row, table, index, 'theme', ['dark', 'light', 'system'])
    optional(row, 'lastExportAt', () => requireNumber(row, table, index, 'lastExportAt'))
    optional(row, 'seedVersion', () => requireNumber(row, table, index, 'seedVersion'))
  },

  programs: (row, table, index) => {
    validateCommon(row, table, index)
    requireString(row, table, index, 'name')
    const routineIds = row.routineIds
    if (!Array.isArray(routineIds)) {
      fail(`${where(table, index, 'routineIds')} must be an array of strings, got ${describe(routineIds)}`)
      return
    }
    for (const routineId of routineIds) {
      if (typeof routineId !== 'string' || routineId.length === 0) {
        fail(
          `${where(table, index, 'routineIds')} must be an array of strings, got ${describe(routineId)}`,
        )
      }
    }
  },
}

/**
 * The backup schemaVersion in which each table first appeared. A table is only
 * required in files at or above its introducing version; older files predate it
 * and are treated as empty rather than rejected, so backups exported before the
 * table existed stay restorable.
 */
const TABLES_ADDED_IN: Partial<Record<TableName, number>> = { programs: 2 }

/**
 * Full structural validation of an untrusted backup payload. Throws a
 * `BackupValidationError` naming the exact field that is wrong; returns the
 * value narrowed to `BackupFile` on success.
 */
export function validateBackup(data: unknown): BackupFile {
  if (!isObject(data)) {
    fail(`backup must be a JSON object, got ${describe(data)}`)
  }
  const file = data as Row

  if (typeof file.schemaVersion !== 'number' || !Number.isInteger(file.schemaVersion)) {
    fail(`backup.schemaVersion must be an integer, got ${describe(file.schemaVersion)}`)
  }
  if ((file.schemaVersion as number) > BACKUP_SCHEMA_VERSION) {
    fail(
      `backup.schemaVersion ${file.schemaVersion} was written by a newer version of the app ` +
        `(this build understands up to ${BACKUP_SCHEMA_VERSION}) — update the app before restoring`,
    )
  }
  if (typeof file.exportedAt !== 'number' || !Number.isFinite(file.exportedAt)) {
    fail(`backup.exportedAt must be a timestamp in epoch ms, got ${describe(file.exportedAt)}`)
  }

  const fileVersion = file.schemaVersion as number
  const normalised: Row = { ...file }

  for (const table of TABLE_NAMES) {
    const rows = file[table]
    const addedIn = TABLES_ADDED_IN[table] ?? 1
    if (rows === undefined && fileVersion < addedIn) {
      // This table didn't exist yet when the file was exported — treat it as
      // empty rather than rejecting a backup that predates the table.
      normalised[table] = []
      continue
    }
    if (!Array.isArray(rows)) {
      fail(`backup.${table} must be an array, got ${describe(rows)}`)
      continue
    }
    const validate = ROW_VALIDATORS[table]
    const seenIds = new Set<string>()
    rows.forEach((row, index) => {
      if (!isObject(row)) {
        fail(`${table}[${index}] must be an object, got ${describe(row)}`)
        return
      }
      validate(row, table, index)
      const id = row.id as string
      if (seenIds.has(id)) fail(`${table} contains duplicate id ${JSON.stringify(id)}`)
      seenIds.add(id)
    })
    normalised[table] = rows
  }

  const settingsRows = normalised.settings as unknown[]
  if (settingsRows.length > 1) {
    fail(`backup.settings must hold at most one row, got ${settingsRows.length}`)
  }

  return normalised as unknown as BackupFile
}

/** Snapshot every table into a plain JSON-serialisable object. */
export async function exportBackup(database: WorkoutDB): Promise<BackupFile> {
  const [exercises, sessions, setEntries, cardioEntries, routines, bodyMetrics, settings, programs] =
    await database.transaction('r', database.tables, () =>
      Promise.all([
        database.exercises.toArray(),
        database.sessions.toArray(),
        database.setEntries.toArray(),
        database.cardioEntries.toArray(),
        database.routines.toArray(),
        database.bodyMetrics.toArray(),
        database.settings.toArray(),
        database.programs.toArray(),
      ]),
    )

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: Date.now(),
    exercises,
    sessions,
    setEntries,
    cardioEntries,
    routines,
    bodyMetrics,
    settings,
    programs,
  }
}

/**
 * Restore a backup, replacing everything currently stored. Validation happens
 * first and in full; the write then runs in one transaction, so a failure
 * part-way rolls the database back to where it was.
 */
export async function importBackup(
  database: WorkoutDB,
  data: unknown,
): Promise<{ imported: Record<TableName, number> }> {
  const file = validateBackup(data)

  const imported = {} as Record<TableName, number>

  await database.transaction('rw', database.tables, async () => {
    for (const table of TABLE_NAMES) {
      const rows = file[table] as unknown[]
      await database.table(table).clear()
      if (rows.length > 0) await database.table(table).bulkAdd(rows)
      imported[table] = rows.length
    }
  })

  return { imported }
}
