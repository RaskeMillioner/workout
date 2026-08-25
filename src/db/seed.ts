import type { Exercise, WorkoutDB } from './schema'
import { MUSCLE_GROUPS, SETTINGS_ID, newId, now } from './schema'

export { MUSCLE_GROUPS }
export type { MuscleGroup } from './schema'

/** An exercise as it exists before it is written: id and updatedAt are assigned on insert. */
export type SeedExercise = Omit<Exercise, 'id' | 'updatedAt'>

const e = (
  name: string,
  modality: Exercise['modality'],
  equipment: string,
  muscleGroups: Exercise['muscleGroups'],
  notes?: string,
): SeedExercise => ({ name, modality, muscleGroups, equipment, isCustom: false, ...(notes ? { notes } : {}) })

/**
 * The starter catalogue. Every entry is a real, commonly programmed movement;
 * the first muscle group listed is the prime mover, the rest are meaningful
 * synergists (not "everything that fires").
 */
export const SEED_EXERCISES: SeedExercise[] = [
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
  e('Kettlebell Swing', 'other', 'kettlebell', ['glutes', 'hamstrings', 'core']),
  e('Power Clean', 'other', 'barbell', ['full-body', 'traps', 'quads']),
  e('Sled Push', 'other', 'sled', ['quads', 'glutes', 'cardiovascular']),
  e('Mobility / Stretching', 'other', 'none', ['full-body']),
]

export const DEFAULT_SETTINGS = {
  weightUnit: 'kg',
  distanceUnit: 'km',
  defaultRestSec: 120,
  theme: 'dark',
} as const

/**
 * Idempotent first-run setup. Safe to call on every app start: it only fills
 * gaps, and never overwrites anything the user has already changed.
 */
export async function seedDatabase(database: WorkoutDB): Promise<void> {
  const exerciseCount = await database.exercises.count()
  if (exerciseCount === 0) {
    const stamp = now()
    await database.exercises.bulkAdd(
      SEED_EXERCISES.map((ex) => ({ ...ex, id: newId(), updatedAt: stamp })),
    )
  }

  const existingSettings = await database.settings.get(SETTINGS_ID)
  if (!existingSettings) {
    await database.settings.put({
      id: SETTINGS_ID,
      ...DEFAULT_SETTINGS,
      updatedAt: now(),
    })
  }
}
