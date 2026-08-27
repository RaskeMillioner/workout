import type { Exercise, WorkoutDB } from './schema'
import { MUSCLE_GROUPS, SETTINGS_ID, newId, now } from './schema'

export { MUSCLE_GROUPS }
export type { MuscleGroup } from './schema'

/** An exercise as it exists before it is written: id and updatedAt are assigned on insert. */
export type SeedExercise = Omit<Exercise, 'id' | 'updatedAt'>

/**
 * The current seed catalogue's version. Bump this whenever entries are added
 * to `SEED_EXERCISES` (see the `addedIn` tag on each entry, and the seeding
 * logic in `seedDatabase` below): 1 = the original 103-exercise catalogue,
 * 2 = adds the kettlebell catalogue.
 */
export const SEED_CATALOGUE_VERSION = 2

/**
 * A row in the seed catalogue plus the catalogue version that introduced it.
 * `addedIn` is seed metadata only — it is never a database column and is
 * stripped before anything reaches `exercises` or a backup.
 */
type CatalogueEntry = SeedExercise & { addedIn: number }

const e = (
  name: string,
  modality: Exercise['modality'],
  equipment: string,
  muscleGroups: Exercise['muscleGroups'],
  notes?: string,
  addedIn = 1,
): CatalogueEntry => ({
  name,
  modality,
  muscleGroups,
  equipment,
  isCustom: false,
  addedIn,
  ...(notes ? { notes } : {}),
})

/**
 * The starter catalogue. Every entry is a real, commonly programmed movement;
 * the first muscle group listed is the prime mover, the rest are meaningful
 * synergists (not "everything that fires").
 */
export const SEED_EXERCISES: CatalogueEntry[] = [
  // ── Chest ────────────────────────────────────────────────────────────────
  e('Barbell Bench Press', 'strength', 'barbell', ['chest', 'triceps', 'shoulders']),
  e('Barbell Incline Bench Press', 'strength', 'barbell', ['chest', 'shoulders', 'triceps']),
  e('Barbell Close-Grip Bench Press', 'strength', 'barbell', ['triceps', 'chest', 'shoulders']),
  e('Dumbbell Bench Press', 'strength', 'dumbbell', ['chest', 'triceps', 'shoulders']),
  e('Dumbbell Incline Bench Press', 'strength', 'dumbbell', ['chest', 'shoulders', 'triceps']),
  e('Dumbbell Fly', 'strength', 'dumbbell', ['chest']),
  e('Cable Chest Fly', 'strength', 'cable', ['chest']),
  e('Machine Chest Press', 'strength', 'machine', ['chest', 'triceps', 'shoulders']),
  e('Pec Deck', 'strength', 'machine', ['chest']),
  e('Push-Up', 'strength', 'bodyweight', ['chest', 'triceps', 'core']),
  e('Weighted Dip', 'strength', 'bodyweight', ['chest', 'triceps', 'shoulders'], 'Lean forward for chest, stay upright for triceps.'),

  // ── Back ─────────────────────────────────────────────────────────────────
  e('Deadlift', 'strength', 'barbell', ['lower-back', 'glutes', 'hamstrings', 'traps']),
  e('Barbell Row', 'strength', 'barbell', ['back', 'lats', 'biceps']),
  e('Pendlay Row', 'strength', 'barbell', ['back', 'lats', 'traps']),
  e('T-Bar Row', 'strength', 'barbell', ['back', 'lats', 'biceps']),
  e('Dumbbell Row', 'strength', 'dumbbell', ['lats', 'back', 'biceps']),
  e('Chest-Supported Dumbbell Row', 'strength', 'dumbbell', ['back', 'rear-delts', 'lats']),
  e('Seated Cable Row', 'strength', 'cable', ['back', 'lats', 'biceps']),
  e('Lat Pulldown', 'strength', 'cable', ['lats', 'biceps', 'back']),
  e('Straight-Arm Pulldown', 'strength', 'cable', ['lats', 'core']),
  e('Pull-Up', 'strength', 'bodyweight', ['lats', 'biceps', 'back']),
  e('Chin-Up', 'strength', 'bodyweight', ['lats', 'biceps']),
  e('Inverted Row', 'strength', 'bodyweight', ['back', 'lats', 'biceps']),
  e('Machine Row', 'strength', 'machine', ['back', 'lats', 'biceps']),
  e('Barbell Shrug', 'strength', 'barbell', ['traps']),
  e('Dumbbell Shrug', 'strength', 'dumbbell', ['traps']),
  e('Back Extension', 'strength', 'bodyweight', ['lower-back', 'glutes', 'hamstrings']),
  e('Rack Pull', 'strength', 'barbell', ['traps', 'lower-back', 'glutes']),

  // ── Shoulders ────────────────────────────────────────────────────────────
  e('Overhead Press', 'strength', 'barbell', ['shoulders', 'triceps', 'core']),
  e('Push Press', 'strength', 'barbell', ['shoulders', 'triceps', 'quads']),
  e('Seated Dumbbell Shoulder Press', 'strength', 'dumbbell', ['shoulders', 'triceps']),
  e('Arnold Press', 'strength', 'dumbbell', ['shoulders', 'triceps']),
  e('Dumbbell Lateral Raise', 'strength', 'dumbbell', ['shoulders']),
  e('Cable Lateral Raise', 'strength', 'cable', ['shoulders']),
  e('Dumbbell Rear-Delt Fly', 'strength', 'dumbbell', ['rear-delts', 'back']),
  e('Face Pull', 'strength', 'cable', ['rear-delts', 'traps', 'shoulders']),
  e('Machine Shoulder Press', 'strength', 'machine', ['shoulders', 'triceps']),
  e('Upright Row', 'strength', 'barbell', ['shoulders', 'traps']),

  // ── Quads ────────────────────────────────────────────────────────────────
  e('Back Squat', 'strength', 'barbell', ['quads', 'glutes', 'core']),
  e('Front Squat', 'strength', 'barbell', ['quads', 'core', 'glutes']),
  e('Pause Squat', 'strength', 'barbell', ['quads', 'glutes']),
  e('Hack Squat', 'strength', 'machine', ['quads', 'glutes']),
  e('Leg Press', 'strength', 'machine', ['quads', 'glutes', 'hamstrings']),
  e('Leg Extension', 'strength', 'machine', ['quads']),
  e('Goblet Squat', 'strength', 'dumbbell', ['quads', 'glutes', 'core']),
  e('Bulgarian Split Squat', 'strength', 'dumbbell', ['quads', 'glutes', 'adductors']),
  e('Walking Lunge', 'strength', 'dumbbell', ['quads', 'glutes', 'hamstrings']),
  e('Step-Up', 'strength', 'dumbbell', ['quads', 'glutes']),
  e('Bodyweight Squat', 'strength', 'bodyweight', ['quads', 'glutes']),

  // ── Hamstrings & glutes ──────────────────────────────────────────────────
  e('Romanian Deadlift', 'strength', 'barbell', ['hamstrings', 'glutes', 'lower-back']),
  e('Dumbbell Romanian Deadlift', 'strength', 'dumbbell', ['hamstrings', 'glutes']),
  e('Stiff-Leg Deadlift', 'strength', 'barbell', ['hamstrings', 'lower-back', 'glutes']),
  e('Sumo Deadlift', 'strength', 'barbell', ['glutes', 'quads', 'adductors', 'lower-back']),
  e('Lying Leg Curl', 'strength', 'machine', ['hamstrings']),
  e('Seated Leg Curl', 'strength', 'machine', ['hamstrings']),
  e('Nordic Curl', 'strength', 'bodyweight', ['hamstrings']),
  e('Hip Thrust', 'strength', 'barbell', ['glutes', 'hamstrings']),
  e('Glute Bridge', 'strength', 'bodyweight', ['glutes', 'hamstrings']),
  e('Cable Pull-Through', 'strength', 'cable', ['glutes', 'hamstrings']),
  e('Cable Hip Abduction', 'strength', 'cable', ['abductors', 'glutes']),
  e('Hip Adduction Machine', 'strength', 'machine', ['adductors']),
  e('Good Morning', 'strength', 'barbell', ['hamstrings', 'lower-back', 'glutes']),

  // ── Calves ───────────────────────────────────────────────────────────────
  e('Standing Calf Raise', 'strength', 'machine', ['calves']),
  e('Seated Calf Raise', 'strength', 'machine', ['calves'], 'Bent knee biases soleus.'),
  e('Dumbbell Calf Raise', 'strength', 'dumbbell', ['calves']),

  // ── Biceps ───────────────────────────────────────────────────────────────
  e('Barbell Curl', 'strength', 'barbell', ['biceps', 'forearms']),
  e('EZ-Bar Curl', 'strength', 'barbell', ['biceps', 'forearms']),
  e('Dumbbell Curl', 'strength', 'dumbbell', ['biceps']),
  e('Incline Dumbbell Curl', 'strength', 'dumbbell', ['biceps']),
  e('Hammer Curl', 'strength', 'dumbbell', ['biceps', 'forearms']),
  e('Cable Curl', 'strength', 'cable', ['biceps']),
  e('Preacher Curl', 'strength', 'machine', ['biceps']),

  // ── Triceps ──────────────────────────────────────────────────────────────
  e('Cable Triceps Pushdown', 'strength', 'cable', ['triceps']),
  e('Rope Overhead Triceps Extension', 'strength', 'cable', ['triceps']),
  e('Skull Crusher', 'strength', 'barbell', ['triceps']),
  e('Dumbbell Overhead Triceps Extension', 'strength', 'dumbbell', ['triceps']),
  e('Bench Dip', 'strength', 'bodyweight', ['triceps', 'chest']),

  // ── Forearms ─────────────────────────────────────────────────────────────
  e('Wrist Curl', 'strength', 'dumbbell', ['forearms']),
  e('Farmer Carry', 'strength', 'dumbbell', ['forearms', 'traps', 'core']),

  // ── Core ─────────────────────────────────────────────────────────────────
  e('Plank', 'strength', 'bodyweight', ['core'], 'Log seconds held as reps, or track as cardio-style duration.'),
  e('Hanging Leg Raise', 'strength', 'bodyweight', ['core', 'hip-flexors']),
  e('Cable Crunch', 'strength', 'cable', ['core']),
  e('Ab Wheel Rollout', 'strength', 'other', ['core', 'lats']),
  e('Russian Twist', 'strength', 'other', ['obliques', 'core']),
  e('Side Plank', 'strength', 'bodyweight', ['obliques', 'core']),
  e('Pallof Press', 'strength', 'cable', ['obliques', 'core']),
  e('Dead Bug', 'strength', 'bodyweight', ['core']),

  // ── Cardio ───────────────────────────────────────────────────────────────
  e('Run (Outdoor)', 'cardio', 'none', ['cardiovascular', 'quads', 'calves']),
  e('Treadmill Run', 'cardio', 'treadmill', ['cardiovascular', 'quads', 'calves']),
  e('Cycling (Outdoor)', 'cardio', 'bicycle', ['cardiovascular', 'quads', 'glutes']),
  e('Indoor Bike', 'cardio', 'stationary bike', ['cardiovascular', 'quads', 'glutes']),
  e('Rowing Machine', 'cardio', 'rower', ['cardiovascular', 'back', 'quads', 'lats']),
  e('Elliptical', 'cardio', 'elliptical', ['cardiovascular', 'quads', 'glutes']),
  e('Stair Climber', 'cardio', 'stair climber', ['cardiovascular', 'glutes', 'quads', 'calves']),
  e('Swimming', 'cardio', 'pool', ['cardiovascular', 'lats', 'shoulders', 'full-body']),
  e('Jump Rope', 'cardio', 'jump rope', ['cardiovascular', 'calves', 'shoulders']),
  e('Ruck', 'cardio', 'weighted pack', ['cardiovascular', 'quads', 'glutes', 'lower-back']),
  e('Incline Treadmill Walk', 'cardio', 'treadmill', ['cardiovascular', 'glutes', 'calves']),
  e('Assault Bike', 'cardio', 'air bike', ['cardiovascular', 'full-body']),

  // ── Other ────────────────────────────────────────────────────────────────
  e('Power Clean', 'other', 'barbell', ['full-body', 'traps', 'quads']),
  e('Sled Push', 'other', 'sled', ['quads', 'glutes', 'cardiovascular']),
  e('Mobility / Stretching', 'other', 'none', ['full-body']),

  // ── Kettlebell ───────────────────────────────────────────────────────────
  // Was originally seeded under modality 'other', which hid it from Strength
  // filters — the entry itself has always been part of the catalogue, so it
  // stays addedIn: 1 even though its modality is corrected here.
  e('Kettlebell Swing', 'strength', 'kettlebell', ['glutes', 'hamstrings', 'core']),
  e('Kettlebell Single-Arm Swing', 'strength', 'kettlebell', ['glutes', 'hamstrings', 'core'], undefined, 2),
  e('Kettlebell Clean', 'strength', 'kettlebell', ['glutes', 'hamstrings', 'traps', 'forearms'], undefined, 2),
  e('Kettlebell Snatch', 'strength', 'kettlebell', ['glutes', 'hamstrings', 'shoulders', 'traps'], undefined, 2),
  e('Kettlebell High Pull', 'strength', 'kettlebell', ['traps', 'shoulders', 'glutes'], undefined, 2),
  e('Kettlebell Strict Press', 'strength', 'kettlebell', ['shoulders', 'triceps'], undefined, 2),
  e('Kettlebell Push Press', 'strength', 'kettlebell', ['shoulders', 'triceps', 'quads'], undefined, 2),
  e('Kettlebell Jerk', 'strength', 'kettlebell', ['shoulders', 'triceps', 'quads'], undefined, 2),
  e(
    'Kettlebell Bottoms-Up Press',
    'strength',
    'kettlebell',
    ['shoulders', 'forearms', 'core'],
    'Grip crushes the handle to keep the bell stacked overhead; drop the weight if it wobbles.',
    2,
  ),
  e('Kettlebell Floor Press', 'strength', 'kettlebell', ['chest', 'triceps', 'shoulders'], undefined, 2),
  e('Kettlebell Goblet Squat', 'strength', 'kettlebell', ['quads', 'glutes', 'core'], undefined, 2),
  e('Kettlebell Front Squat', 'strength', 'kettlebell', ['quads', 'glutes', 'core'], undefined, 2),
  e('Kettlebell Overhead Squat', 'strength', 'kettlebell', ['quads', 'glutes', 'shoulders', 'core'], undefined, 2),
  e(
    'Kettlebell Pistol Squat',
    'strength',
    'kettlebell',
    ['quads', 'glutes', 'core'],
    'Counterbalance with the bell held out front; regress by squatting to a box behind you.',
    2,
  ),
  e('Kettlebell Deadlift', 'strength', 'kettlebell', ['glutes', 'hamstrings', 'lower-back'], undefined, 2),
  e('Kettlebell Sumo Deadlift', 'strength', 'kettlebell', ['glutes', 'hamstrings', 'adductors'], undefined, 2),
  e('Kettlebell Single-Leg Deadlift', 'strength', 'kettlebell', ['hamstrings', 'glutes', 'core'], undefined, 2),
  e('Kettlebell Lunge', 'strength', 'kettlebell', ['quads', 'glutes', 'hamstrings'], undefined, 2),
  e('Kettlebell Reverse Lunge', 'strength', 'kettlebell', ['quads', 'glutes'], undefined, 2),
  e('Kettlebell Bulgarian Split Squat', 'strength', 'kettlebell', ['quads', 'glutes'], undefined, 2),
  e('Kettlebell Thruster', 'strength', 'kettlebell', ['quads', 'shoulders', 'glutes'], undefined, 2),
  e('Kettlebell Row', 'strength', 'kettlebell', ['lats', 'back', 'biceps'], undefined, 2),
  e('Kettlebell Renegade Row', 'strength', 'kettlebell', ['back', 'core', 'lats'], undefined, 2),
  e('Kettlebell Pullover', 'strength', 'kettlebell', ['lats', 'chest', 'core'], undefined, 2),
  e(
    'Kettlebell Turkish Get-Up',
    'strength',
    'kettlebell',
    ['full-body', 'shoulders', 'core'],
    'Slow floor-to-standing sequence; keep the wrist stacked and the eyes on the bell throughout.',
    2,
  ),
  e(
    'Kettlebell Windmill',
    'strength',
    'kettlebell',
    ['obliques', 'shoulders', 'hamstrings'],
    'Eyes stay on the overhead bell; hinge at the hip rather than rounding the low back.',
    2,
  ),
  e(
    'Kettlebell Bent Press',
    'strength',
    'kettlebell',
    ['obliques', 'shoulders', 'core'],
    'Drive the body away from the bell rather than pressing the bell away from the body.',
    2,
  ),
  e('Kettlebell Halo', 'strength', 'kettlebell', ['shoulders', 'core'], undefined, 2),
  e('Kettlebell Russian Twist', 'strength', 'kettlebell', ['obliques', 'core'], undefined, 2),
  e('Kettlebell Farmer\'s Carry', 'strength', 'kettlebell', ['forearms', 'traps', 'core'], undefined, 2),
  e('Kettlebell Suitcase Carry', 'strength', 'kettlebell', ['obliques', 'forearms', 'core'], undefined, 2),
  e('Kettlebell Rack Carry', 'strength', 'kettlebell', ['core', 'shoulders', 'forearms'], undefined, 2),
  e('Kettlebell Overhead Carry', 'strength', 'kettlebell', ['shoulders', 'core', 'traps'], undefined, 2),

  // ── Kettlebell flows ─────────────────────────────────────────────────────
  // Continuous chains of movements rather than a single lift — log each as
  // rounds completed, not individual reps.
  e(
    'Kettlebell Clean and Press',
    'strength',
    'kettlebell',
    ['shoulders', 'glutes', 'triceps'],
    'Continuous chain — clean into press. Log as rounds, not individual reps.',
    2,
  ),
  e(
    'Kettlebell Clean and Jerk',
    'strength',
    'kettlebell',
    ['shoulders', 'glutes', 'quads'],
    'Continuous chain — clean into jerk. Log as rounds, not individual reps.',
    2,
  ),
  e(
    'Kettlebell Squat Clean and Press',
    'strength',
    'kettlebell',
    ['full-body', 'quads', 'shoulders'],
    'Continuous chain — squat clean into press. Log as rounds, not individual reps.',
    2,
  ),
  e(
    'Kettlebell Figure 8',
    'strength',
    'kettlebell',
    ['core', 'glutes', 'forearms'],
    'Continuous chain — pass the bell in a figure-8 between the legs. Log as rounds, not individual reps.',
    2,
  ),
  e(
    'Kettlebell Around-the-Body Pass',
    'strength',
    'kettlebell',
    ['core', 'obliques', 'shoulders'],
    'Continuous chain — circle the bell around the torso. Log as rounds, not individual reps.',
    2,
  ),
  e(
    'Kettlebell Halo to Squat',
    'strength',
    'kettlebell',
    ['shoulders', 'quads', 'core'],
    'Continuous chain — halo into squat. Log as rounds, not individual reps.',
    2,
  ),
  e(
    'Kettlebell Swing to Squat',
    'strength',
    'kettlebell',
    ['glutes', 'quads', 'hamstrings'],
    'Continuous chain — swing into squat. Log as rounds, not individual reps.',
    2,
  ),
  e(
    'Kettlebell Flow',
    'strength',
    'kettlebell',
    ['full-body', 'core'],
    'Freeform continuous sequence of kettlebell movements. Log as rounds, not individual reps.',
    2,
  ),
]

/** Strips catalogue-only metadata (`addedIn`) and assigns the fields Dexie needs. */
function toExerciseRow(entry: CatalogueEntry, stamp: number): Exercise {
  const seedExercise: SeedExercise = {
    name: entry.name,
    modality: entry.modality,
    muscleGroups: entry.muscleGroups,
    equipment: entry.equipment,
    isCustom: entry.isCustom,
    ...(entry.notes ? { notes: entry.notes } : {}),
    ...(entry.isFavourite !== undefined ? { isFavourite: entry.isFavourite } : {}),
  }
  return { ...seedExercise, id: newId(), updatedAt: stamp }
}

export const DEFAULT_SETTINGS = {
  weightUnit: 'kg',
  distanceUnit: 'km',
  defaultRestSec: 120,
  theme: 'dark',
} as const

/**
 * Idempotent first-run (and first-upgrade) setup. Safe to call on every app
 * start:
 *
 *  - a brand-new install (no exercises, no recorded seed version) gets the
 *    whole catalogue;
 *  - an install that predates catalogue versioning (already has exercises,
 *    but `settings.seedVersion` was never recorded) gets only the entries
 *    added since v1, so it is brought current without duplicating anything
 *    it already has;
 *  - an install already at `SEED_CATALOGUE_VERSION` gets nothing;
 *  - as a belt-and-braces safety net on top of all of that, a candidate row
 *    is never inserted if an exercise with the same name (trimmed,
 *    case-insensitive) already exists, seeded or custom.
 *
 * `settings.seedVersion` is then advanced to `SEED_CATALOGUE_VERSION` so the
 * next call is a no-op. Nothing the user has already changed is ever
 * overwritten — with one narrow, targeted exception: a pre-existing,
 * non-custom `Kettlebell Swing` row that was seeded with the old, wrong
 * `modality: 'other'` is corrected to `'strength'` so it surfaces under
 * Strength filters. No other seed row is ever resynced.
 */
export async function seedDatabase(database: WorkoutDB): Promise<void> {
  const [existingExercises, existingSettings] = await Promise.all([
    database.exercises.toArray(),
    database.settings.get(SETTINGS_ID),
  ])

  const recordedVersion = existingSettings?.seedVersion
  // No recorded version and an empty table = fresh install, take everything.
  // No recorded version but existing rows = a pre-versioning install that
  // already has the v1 catalogue, so only backfill what came after it.
  const minAddedIn =
    recordedVersion !== undefined ? recordedVersion + 1 : existingExercises.length === 0 ? 1 : 2

  const existingNames = new Set(existingExercises.map((ex) => ex.name.trim().toLowerCase()))
  const candidates = SEED_EXERCISES.filter(
    (ex) => ex.addedIn >= minAddedIn && !existingNames.has(ex.name.trim().toLowerCase()),
  )

  if (candidates.length > 0) {
    const stamp = now()
    await database.exercises.bulkAdd(candidates.map((ex) => toExerciseRow(ex, stamp)))
  }

  // Targeted repair: a swing seeded before this catalogue version filed it
  // under 'other'. Only touch a non-custom row with exactly that shape.
  const swing = existingExercises.find(
    (ex) => !ex.isCustom && ex.name === 'Kettlebell Swing' && ex.modality === 'other',
  )
  if (swing) {
    await database.exercises.update(swing.id, { modality: 'strength', updatedAt: now() })
  }

  if (!existingSettings) {
    await database.settings.put({
      id: SETTINGS_ID,
      ...DEFAULT_SETTINGS,
      seedVersion: SEED_CATALOGUE_VERSION,
      updatedAt: now(),
    })
  } else if (recordedVersion !== SEED_CATALOGUE_VERSION) {
    await database.settings.update(SETTINGS_ID, {
      seedVersion: SEED_CATALOGUE_VERSION,
      updatedAt: now(),
    })
  }
}
