import type { CardioEntry, Program, Routine, RoutineBlock, Session, SetEntry, SetKind, Settings } from './schema'
import { SETTINGS_ID, db, newId, now } from './schema'
import { suggestNextTarget } from '../lib/records'

/** Local calendar day as `yyyy-mm-dd`. Never use toISOString here — that is UTC,
 *  and a 22:00 session would file itself under tomorrow. */
export function todayISO(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** The session still in progress, if any. Only one may be open at a time. */
export async function getActiveSession(): Promise<Session | undefined> {
  const open = await db.sessions.filter((s) => s.endedAt === undefined).toArray()
  // Defensive: if a crash ever left two open, the most recent one wins.
  return open.sort((a, b) => b.startedAt - a.startedAt)[0]
}

export async function startSession(routineId?: string): Promise<string> {
  const existing = await getActiveSession()
  if (existing) return existing.id

  const session: Session = {
    id: newId(),
    date: todayISO(),
    startedAt: now(),
    ...(routineId ? { routineId } : {}),
    updatedAt: now(),
  }
  await db.sessions.add(session)
  return session.id
}

export async function finishSession(sessionId: string, perceivedEffort?: number): Promise<void> {
  // Drop sets the user added but never ticked off, so history reflects work
  // actually done rather than intentions.
  await db.transaction('rw', db.sessions, db.setEntries, async () => {
    await db.setEntries.where('sessionId').equals(sessionId).filter((s) => !s.completed).delete()
    await db.sessions.update(sessionId, {
      endedAt: now(),
      updatedAt: now(),
      ...(perceivedEffort ? { perceivedEffort } : {}),
    })
  })
}

/** Discard a session and everything logged under it. */
export async function deleteSession(sessionId: string): Promise<void> {
  await db.transaction('rw', db.sessions, db.setEntries, db.cardioEntries, async () => {
    await db.setEntries.where('sessionId').equals(sessionId).delete()
    await db.cardioEntries.where('sessionId').equals(sessionId).delete()
    await db.sessions.delete(sessionId)
  })
}

async function nextOrder(sessionId: string): Promise<number> {
  const [sets, cardio] = await Promise.all([
    db.setEntries.where('sessionId').equals(sessionId).toArray(),
    db.cardioEntries.where('sessionId').equals(sessionId).toArray(),
  ])
  const orders = [...sets, ...cardio].map((e) => e.order)
  return orders.length ? Math.max(...orders) + 1 : 0
}

/**
 * The most recent completed working set for an exercise, used to prefill the
 * next one. Typing weight and reps from scratch for every set is the single
 * biggest source of friction on the gym floor.
 *
 * Recency is the session's start time, not the set's `updatedAt`: correcting a
 * typo in a set from six months ago bumps its write stamp, and ordering by that
 * would make the ancient set the template for today.
 */
export async function lastWorkingSet(exerciseId: string): Promise<SetEntry | undefined> {
  const entries = await db.setEntries.where('exerciseId').equals(exerciseId).toArray()
  const working = entries.filter((e) => e.completed && e.kind !== 'warmup')
  if (working.length === 0) return undefined

  const sessionIds = [...new Set(working.map((e) => e.sessionId))]
  const sessions = await db.sessions.bulkGet(sessionIds)
  const startedAt = new Map<string, number>()
  for (const session of sessions) {
    if (session) startedAt.set(session.id, session.startedAt)
  }

  return working.sort((a, b) => {
    // A set whose session has been deleted sorts last rather than winning by
    // default; it is orphaned data, not a recent workout.
    const sessionDelta = (startedAt.get(b.sessionId) ?? -Infinity) - (startedAt.get(a.sessionId) ?? -Infinity)
    if (sessionDelta !== 0) return sessionDelta
    return b.order - a.order
  })[0]
}

export async function addSet(
  sessionId: string,
  exerciseId: string,
  overrides: Partial<Pick<SetEntry, 'reps' | 'weightKg' | 'kind' | 'rpe'>> = {},
): Promise<string> {
  // Prefill from the last set of this exercise in this session, falling back to
  // the last time it was trained at all.
  const inSession = await db.setEntries
    .where('[exerciseId+sessionId]')
    .equals([exerciseId, sessionId])
    .toArray()
  const template =
    inSession.sort((a, b) => b.order - a.order)[0] ?? (await lastWorkingSet(exerciseId))

  const entry: SetEntry = {
    id: newId(),
    sessionId,
    exerciseId,
    order: await nextOrder(sessionId),
    kind: overrides.kind ?? 'working',
    reps: overrides.reps ?? template?.reps ?? 8,
    weightKg: overrides.weightKg ?? template?.weightKg ?? 0,
    completed: false,
    ...(overrides.rpe !== undefined ? { rpe: overrides.rpe } : {}),
    updatedAt: now(),
  }
  await db.setEntries.add(entry)
  return entry.id
}

export async function updateSet(id: string, changes: Partial<SetEntry>): Promise<void> {
  await db.setEntries.update(id, { ...changes, updatedAt: now() })
}

export async function deleteSet(id: string): Promise<void> {
  await db.setEntries.delete(id)
}

export async function setKind(id: string, kind: SetKind): Promise<void> {
  await updateSet(id, { kind })
}

export async function addCardio(
  sessionId: string,
  exerciseId: string,
  values: Pick<CardioEntry, 'durationSec'> & Partial<CardioEntry>,
): Promise<string> {
  const entry: CardioEntry = {
    id: newId(),
    sessionId,
    exerciseId,
    order: await nextOrder(sessionId),
    durationSec: values.durationSec,
    ...(values.distanceM !== undefined ? { distanceM: values.distanceM } : {}),
    ...(values.avgHr !== undefined ? { avgHr: values.avgHr } : {}),
    ...(values.notes ? { notes: values.notes } : {}),
    updatedAt: now(),
  }
  await db.cardioEntries.add(entry)
  return entry.id
}

export async function updateCardio(id: string, changes: Partial<CardioEntry>): Promise<void> {
  await db.cardioEntries.update(id, { ...changes, updatedAt: now() })
}

export async function deleteCardio(id: string): Promise<void> {
  await db.cardioEntries.delete(id)
}

export async function saveSettings(changes: Partial<Settings>): Promise<void> {
  await db.settings.update(SETTINGS_ID, { ...changes, updatedAt: now() })
}

export async function addCustomExercise(
  input: Pick<Parameters<typeof db.exercises.add>[0], 'name' | 'modality' | 'muscleGroups' | 'equipment'>,
): Promise<string> {
  const id = newId()
  await db.exercises.add({ ...input, id, isCustom: true, updatedAt: now() })
  return id
}

export async function setExerciseFavourite(id: string, isFavourite: boolean): Promise<void> {
  await db.exercises.update(id, { isFavourite, updatedAt: now() })
}

export async function createRoutine(name: string, blocks: RoutineBlock[] = []): Promise<string> {
  const id = newId()
  await db.routines.add({ id, name, blocks, updatedAt: now() })
  return id
}

export async function updateRoutine(id: string, changes: Partial<Routine>): Promise<void> {
  await db.routines.update(id, { ...changes, updatedAt: now() })
}

/** Deleting a routine also strips it from every program's rotation, so no
 *  program is left pointing at a routine that no longer exists. */
export async function deleteRoutine(id: string): Promise<void> {
  await db.transaction('rw', db.routines, db.programs, async () => {
    await db.routines.delete(id)
    const affected = await db.programs.filter((p) => p.routineIds.includes(id)).toArray()
    await Promise.all(
      affected.map((program) =>
        db.programs.update(program.id, {
          routineIds: program.routineIds.filter((routineId) => routineId !== id),
          updatedAt: now(),
        }),
      ),
    )
  })
}

export async function createProgram(name: string, routineIds: string[] = []): Promise<string> {
  const id = newId()
  await db.programs.add({ id, name, routineIds, updatedAt: now() })
  return id
}

export async function updateProgram(id: string, changes: Partial<Program>): Promise<void> {
  await db.programs.update(id, { ...changes, updatedAt: now() })
}

/** Deleting a program also clears `settings.activeProgramId` when it pointed
 *  at the deleted program, so the app never keeps "following" a program that
 *  no longer exists. */
export async function deleteProgram(id: string): Promise<void> {
  await db.transaction('rw', db.programs, db.settings, async () => {
    await db.programs.delete(id)
    const settings = await db.settings.get(SETTINGS_ID)
    if (settings?.activeProgramId === id) {
      await db.settings.update(SETTINGS_ID, { activeProgramId: undefined, updatedAt: now() })
    }
  })
}

/**
 * The routine that comes next in a program's rotation. Always derived, never
 * stored: a saved cursor would drift the moment a day is skipped, a session
 * is logged out of order, or a backup is restored.
 *
 * Looks at the most recent *finished* session whose routine belongs to this
 * program and advances one slot past it; with no such session (or if that
 * routine has since left the rotation) the rotation restarts at the top.
 */
export async function nextRoutineInProgram(programId: string): Promise<Routine | undefined> {
  const program = await db.programs.get(programId)
  if (!program || program.routineIds.length === 0) return undefined

  const candidates = (await db.sessions.where('routineId').anyOf(program.routineIds).toArray()).filter(
    (s) => s.endedAt !== undefined,
  )
  const last = candidates.sort((a, b) => b.startedAt - a.startedAt)[0]

  let nextRoutineId: string
  if (!last) {
    nextRoutineId = program.routineIds[0]
  } else {
    // `last.routineId` is guaranteed set here (that's what `anyOf` matched
    // on); the fallback only exists to satisfy the optional-field type.
    const lastRoutineId = last.routineId ?? program.routineIds[0]
    const idx = program.routineIds.indexOf(lastRoutineId)
    nextRoutineId = idx === -1 ? program.routineIds[0] : program.routineIds[(idx + 1) % program.routineIds.length]
  }

  return db.routines.get(nextRoutineId)
}

/**
 * Start a session prefilled from a routine: one 'working' entry per
 * `targetSets` in each block, in block order, seeded with the weight/reps
 * `suggestNextTarget` recommends from that exercise's full history.
 *
 * Respects the single-open-session rule (see `startSession`): if a session
 * is already open, it is returned as-is rather than opening a second one.
 */
export async function startSessionFromRoutine(routineId: string): Promise<string> {
  const existing = await getActiveSession()
  if (existing) return existing.id

  const routine = await db.routines.get(routineId)
  if (!routine) throw new Error(`Routine ${routineId} not found`)

  const sessionId = newId()
  await db.transaction('rw', db.sessions, db.setEntries, async () => {
    const session: Session = {
      id: sessionId,
      date: todayISO(),
      startedAt: now(),
      routineId,
      updatedAt: now(),
    }
    await db.sessions.add(session)

    let order = 0
    for (const block of routine.blocks) {
      const history = await db.setEntries.where('exerciseId').equals(block.exerciseId).toArray()
      const target = suggestNextTarget(block, history)
      for (let i = 0; i < block.targetSets; i++) {
        await db.setEntries.add({
          id: newId(),
          sessionId,
          exerciseId: block.exerciseId,
          order: order++,
          kind: 'working',
          reps: target.reps,
          weightKg: target.weightKg,
          completed: false,
          updatedAt: now(),
        })
      }
    }
  })

  return sessionId
}
