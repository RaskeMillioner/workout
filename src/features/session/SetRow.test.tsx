import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLiveQuery } from 'dexie-react-hooks'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, newId, now } from '../../db/schema'
import SetRow from './SetRow'

const SESSION = 'session-1'
const EXERCISE = 'exercise-1'
let setId: string

beforeEach(async () => {
  await db.setEntries.clear()
  setId = newId()
  await db.setEntries.add({
    id: setId,
    sessionId: SESSION,
    exerciseId: EXERCISE,
    order: 0,
    kind: 'working',
    reps: 8,
    weightKg: 80,
    completed: false,
    updatedAt: now(),
  })
})

afterEach(async () => {
  await db.setEntries.clear()
})

/**
 * Renders against the real database through a live query, so every keystroke
 * triggers the write-then-re-render cycle that used to eat the decimal point.
 */
function Harness() {
  const entry = useLiveQuery(() => db.setEntries.get(setId), [])
  if (!entry) return null
  return <SetRow entry={entry} index={0} unit="kg" isPR={false} onComplete={() => {}} />
}

describe('SetRow numeric entry', () => {
  it('stores a typed decimal weight rather than dropping the point', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const input = await screen.findByLabelText('Set 1 weight')

    await user.clear(input)
    await user.type(input, '82.5')

    await waitFor(async () => {
      expect((await db.setEntries.get(setId))?.weightKg).toBe(82.5)
    })
  })

  it('does not let the live-query refresh overwrite in-progress text', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const input = await screen.findByLabelText('Set 1 weight')

    await user.clear(input)
    await user.type(input, '100.')

    // Mid-entry the field must still show the trailing separator.
    expect(input).toHaveValue('100.')
  })

  it('rounds typed reps to whole numbers', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const input = await screen.findByLabelText('Set 1 reps')

    await user.clear(input)
    await user.type(input, '12')

    await waitFor(async () => {
      expect((await db.setEntries.get(setId))?.reps).toBe(12)
    })
  })

  it('steps the weight by a plate pair', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await screen.findByLabelText('Set 1 weight')

    await user.click(screen.getByLabelText('Increase weight'))

    await waitFor(async () => {
      expect((await db.setEntries.get(setId))?.weightKg).toBe(82.5)
    })
  })

  it('marks a set complete and reports it', async () => {
    const user = userEvent.setup()
    let completed = 0
    const entry = await db.setEntries.get(setId)
    render(
      <SetRow entry={entry!} index={0} unit="kg" isPR={false} onComplete={() => (completed += 1)} />,
    )

    await user.click(screen.getByLabelText('Complete set 1'))

    expect(completed).toBe(1)
    await waitFor(async () => {
      expect((await db.setEntries.get(setId))?.completed).toBe(true)
    })
  })
})
