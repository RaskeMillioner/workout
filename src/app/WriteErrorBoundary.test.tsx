import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WriteErrorProvider, useWrite } from './WriteErrorBoundary'

function Failing({ rejection }: { rejection: unknown }) {
  const save = useWrite()
  return (
    <button type="button" onClick={() => save(Promise.reject(rejection), 'logging a set')}>
      Save
    </button>
  )
}

function Succeeding() {
  const save = useWrite()
  return (
    <button type="button" onClick={() => save(Promise.resolve('ok'), 'logging a set')}>
      Save
    </button>
  )
}

describe('WriteErrorProvider', () => {
  it('shows an alert naming the action when a write rejects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    render(
      <WriteErrorProvider>
        <Failing rejection={new DOMException('Quota exceeded', 'QuotaExceededError')} />
      </WriteErrorProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Save' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('logging a set')
    expect(alert).toHaveTextContent('Quota exceeded')
    // The user must be told the change did not land, not just that something broke.
    expect(alert).toHaveTextContent('was not recorded')
  })

  it('handles a non-Error rejection without crashing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    render(
      <WriteErrorProvider>
        <Failing rejection="database closed" />
      </WriteErrorProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('database closed')
  })

  it('stays quiet when the write succeeds', async () => {
    const user = userEvent.setup()
    render(
      <WriteErrorProvider>
        <Succeeding />
      </WriteErrorProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('can be dismissed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    render(
      <WriteErrorProvider>
        <Failing rejection={new Error('nope')} />
      </WriteErrorProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('resolves instead of rejecting, so callers never see an unhandled promise', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    let outcome: unknown = 'not settled'

    function Probe() {
      const save = useWrite()
      return (
        <button
          type="button"
          onClick={async () => {
            outcome = await save(Promise.reject(new Error('nope')), 'logging a set')
          }}
        >
          Save
        </button>
      )
    }

    render(
      <WriteErrorProvider>
        <Probe />
      </WriteErrorProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('alert')

    expect(outcome).toBeUndefined()
  })
})
