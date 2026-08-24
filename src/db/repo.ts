import type { CardioEntry, Session, SetEntry, SetKind, Settings } from './schema'
import { SETTINGS_ID, db, newId, now } from './schema'

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
 */
export async function lastWorkingSet(exerciseId: string): Promise<SetEntry | undefined> {
  const entries = await db.setEntries.where('exerciseId').equals(exerciseId).toArray()
  return entries
    .filter((e) => e.completed && e.kind !== 'warmup')
    .sort((a, b) => b.updatedAt - a.updatedAt)[0]
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
