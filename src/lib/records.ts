import type { RoutineBlock, SetEntry } from '../db/schema'

/**
 * Pure analysis over arrays of set entries. Nothing here touches the DB, so
 * every rule is testable in isolation and safe to run inside a render.
 */

/** Above this many reps the Epley formula drifts badly, so we refuse to guess. */
export const EPLEY_REP_CAP = 12

/** Fallback weight step when a routine block does not specify one, in kg. */
export const DEFAULT_INCREMENT_KG = 2.5

/**
 * Epley estimated one-rep max: `w * (1 + reps / 30)`.
 *
 * - `reps <= 1` returns the lifted weight itself (a single *is* the max).
 * - `reps > EPLEY_REP_CAP` returns `NaN`: past ~12 reps the linear Epley term
 *   overestimates badly (it is fitted to low-rep sets), and a wrong number
 *   shown as a PR is worse than no number at all. Callers should skip NaN.
 * - Non-positive reps or weight return `NaN` rather than 0, so bad input never
 *   silently becomes a legitimate-looking "0 kg" record.
 */
export function estimate1RM(weightKg: number, reps: number): number {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps)) return NaN
  if (weightKg <= 0 || reps <= 0) return NaN
  if (reps > EPLEY_REP_CAP) return NaN
  if (reps <= 1) return weightKg
  return weightKg * (1 + reps / 30)
}

/** A set that counts as work: completed, and not a warmup. */
const isWorkingSet = (entry: SetEntry): boolean => entry.completed && entry.kind !== 'warmup'

/**
 * Total tonnage for a list of sets: `reps * weightKg` summed over completed
 * work sets. Warmups and unchecked sets contribute nothing. Dropsets count —
 * they are real work, and the only thing being filtered out is preparation.
 */
export function sessionVolume(entries: SetEntry[]): number {
  return entries.reduce(
    (total, entry) => (isWorkingSet(entry) ? total + entry.reps * entry.weightKg : total),
    0,
  )
}

/**
 * The set with the highest estimated 1RM. Sets outside the Epley range (and
 * warmups, and unchecked sets) are ignored; ties go to the heavier set, then
 * to the one that happened first.
 */
export function bestSetByEstimated1RM(entries: SetEntry[]): SetEntry | undefined {
  let best: SetEntry | undefined
  let bestScore = -Infinity
  for (const entry of entries) {
    if (!isWorkingSet(entry)) continue
    const score = estimate1RM(entry.weightKg, entry.reps)
    if (!Number.isFinite(score)) continue
    if (score > bestScore || (score === bestScore && best !== undefined && entry.weightKg > best.weightKg)) {
      best = entry
      bestScore = score
    }
  }
  return best
}

/**
 * Rep-max table for a list of sets: the heaviest completed work set at each
 * rep count, plus the best estimated 1RM overall. A tie keeps the earlier set,
 * because matching a record is not setting one.
 */
export function detectPRs(entries: SetEntry[]): {
  bestByReps: Map<number, SetEntry>
  bestEstimated1RM: SetEntry | undefined
} {
  const bestByReps = new Map<number, SetEntry>()
  for (const entry of entries) {
    if (!isWorkingSet(entry) || entry.reps <= 0 || entry.weightKg <= 0) continue
    const incumbent = bestByReps.get(entry.reps)
    if (!incumbent || entry.weightKg > incumbent.weightKg) {
      bestByReps.set(entry.reps, entry)
    }
  }
  return { bestByReps, bestEstimated1RM: bestSetByEstimated1RM(entries) }
}

/**
 * Is `candidate` a personal record at its own rep count? Strictly greater than
 * everything in `history` — equalling a previous best is not a PR. An unchecked
 * or warmup candidate is never a PR.
 */
export function isPR(candidate: SetEntry, history: SetEntry[]): boolean {
  if (!isWorkingSet(candidate) || candidate.reps <= 0 || candidate.weightKg <= 0) return false
  for (const entry of history) {
    if (entry.id === candidate.id) continue
    if (!isWorkingSet(entry) || entry.reps !== candidate.reps) continue
    if (entry.weightKg >= candidate.weightKg) return false
  }
  return true
}

/** Work sets belonging to the most recent session represented in `history`. */
function lastSessionWorkSets(history: SetEntry[]): SetEntry[] {
  const working = history.filter(isWorkingSet)
  if (working.length === 0) return []
  // Sessions are identified by id; recency is the latest write stamp in each,
  // which is what the UI orders history by too.
  const latestBySession = new Map<string, number>()
  for (const entry of working) {
    const seen = latestBySession.get(entry.sessionId) ?? -Infinity
    if (entry.updatedAt > seen) latestBySession.set(entry.sessionId, entry.updatedAt)
  }
  let latestSessionId = working[0].sessionId
  let latestStamp = -Infinity
  for (const [sessionId, stamp] of latestBySession) {
    if (stamp > latestStamp) {
      latestStamp = stamp
      latestSessionId = sessionId
    }
  }
  return working.filter((entry) => entry.sessionId === latestSessionId)
}

/**
 * The progressive-overload nudge: what to aim for next time on this block.
 *
 * - `double-progression`: hold the weight and chase one more rep until every
 *   target set is at the top of the range, then add `incrementKg` and drop
 *   back to the bottom of the range.
 * - `linear`: add `incrementKg` every session, reps pinned to the bottom of
 *   the range (the classic 5x5 style prescription).
 * - `none`: repeat what was done last time.
 *
 * With no history it returns a bare starting point (0 kg at the bottom of the
 * range) — the app asks the user for a working weight on the first session
 * rather than inventing one.
 */
export function suggestNextTarget(
  block: RoutineBlock,
  history: SetEntry[],
): { weightKg: number; reps: number } {
  const increment = block.incrementKg ?? DEFAULT_INCREMENT_KG
  const low = Math.min(block.repRangeLow, block.repRangeHigh)
  const high = Math.max(block.repRangeLow, block.repRangeHigh)

  const lastSets = lastSessionWorkSets(history)
  if (lastSets.length === 0) return { weightKg: 0, reps: low }

  const topWeight = Math.max(...lastSets.map((entry) => entry.weightKg))
  const setsAtTopWeight = lastSets.filter((entry) => entry.weightKg === topWeight)
  const minRepsAtTopWeight = Math.min(...setsAtTopWeight.map((entry) => entry.reps))

  switch (block.progression) {
    case 'linear':
      return { weightKg: topWeight + increment, reps: low }
    case 'double-progression': {
      const clearedEverySet =
        setsAtTopWeight.length >= block.targetSets && minRepsAtTopWeight >= high
      if (clearedEverySet) return { weightKg: topWeight + increment, reps: low }
      return { weightKg: topWeight, reps: Math.min(Math.max(minRepsAtTopWeight + 1, low), high) }
    }
    case 'none':
      return { weightKg: topWeight, reps: minRepsAtTopWeight }
  }
}
