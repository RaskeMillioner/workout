import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import NumberField from './NumberField'

/**
 * Drives the component the way a parent does: state lives outside, so a value
 * that round-trips through the parent is what the field re-renders from. That
 * round-trip is exactly what used to eat the decimal point.
 */
function Harness({ initial = 0, decimals = 1 }: { initial?: number; decimals?: number }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <NumberField label="Weight" value={value} onChange={setValue} decimals={decimals} />
      <output data-testid="committed">{String(value)}</output>
    </>
  )
}

describe('NumberField decimal entry', () => {
  it('accepts a typed decimal weight', async () => {
    const user = userEvent.setup()
    render(<Harness initial={80} />)
    const input = screen.getByRole('textbox', { name: 'Weight' })

    await user.clear(input)
    await user.type(input, '82.5')

    expect(screen.getByTestId('committed')).toHaveTextContent('82.5')
    expect(input).toHaveValue('82.5')
  })

  it('accepts a two-decimal distance', async () => {
    const user = userEvent.setup()
    render(<Harness initial={0} decimals={2} />)
    const input = screen.getByRole('textbox', { name: 'Weight' })

    await user.clear(input)
    await user.type(input, '5.5')

    expect(screen.getByTestId('committed')).toHaveTextContent('5.5')
  })

  it('accepts a comma as the decimal separator', async () => {
    const user = userEvent.setup()
    render(<Harness initial={0} />)
    const input = screen.getByRole('textbox', { name: 'Weight' })

    await user.clear(input)
    await user.type(input, '82,5')

    expect(screen.getByTestId('committed')).toHaveTextContent('82.5')
  })

  it('can be cleared without snapping back to zero', async () => {
    const user = userEvent.setup()
    render(<Harness initial={80} />)
    const input = screen.getByRole('textbox', { name: 'Weight' })

    await user.clear(input)

    expect(input).toHaveValue('')
  })

  it('falls back to the committed value when left blank', async () => {
    const user = userEvent.setup()
    render(<Harness initial={80} />)
    const input = screen.getByRole('textbox', { name: 'Weight' })

    await user.clear(input)
    await user.tab()

    // Blurring an empty field restores what was there rather than storing 0.
    expect(input).toHaveValue('80')
  })

  it('still works via the steppers', async () => {
    const user = userEvent.setup()
    render(<Harness initial={80} />)

    await user.click(screen.getByLabelText('Increase Weight'))
    expect(screen.getByTestId('committed')).toHaveTextContent('81')
  })

  it('reflects an external change made while unfocused', async () => {
    const user = userEvent.setup()
    render(<Harness initial={80} />)
    const input = screen.getByRole('textbox', { name: 'Weight' })

    await user.click(screen.getByLabelText('Increase Weight'))
    expect(input).toHaveValue('81')
  })
})
