import { describe, it, expect, vi } from 'vitest'
import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ColorField, IconButton, PrimaryButton, Section, Slider, Chip } from '../ui'
import { MotionProvider } from '../motion'

const renderUi = (node: ReactNode) => render(<MotionProvider>{node}</MotionProvider>)

describe('Slider', () => {
  it('shows the label and the value rounded to two decimals', () => {
    renderUi(<Slider label="Brightness" min={0} max={1} step={0.001} value={0.12345} onChange={() => {}} />)
    expect(screen.getByText('Brightness')).toBeInTheDocument()
    expect(screen.getByText('0.12')).toBeInTheDocument()
  })

  it('reports a number, not the input string', () => {
    const onChange = vi.fn()
    renderUi(<Slider label="Size" min={0} max={100} value={10} onChange={onChange} />)
    fireEvent.change(screen.getByRole('slider', { name: /Size/ }), { target: { value: '42' } })
    expect(onChange).toHaveBeenCalledWith(42)
  })

  it('passes min, max and step through to the range input', () => {
    renderUi(<Slider label="Blur" min={-5} max={5} step={0.5} value={0} onChange={() => {}} />)
    const input = screen.getByRole('slider', { name: /Blur/ })
    expect(input).toHaveAttribute('min', '-5')
    expect(input).toHaveAttribute('max', '5')
    expect(input).toHaveAttribute('step', '0.5')
  })
})

describe('ColorField', () => {
  it('reports the picked colour', () => {
    const onChange = vi.fn()
    renderUi(<ColorField label="Fill" value="#000000" onChange={onChange} />)
    const input = screen.getByLabelText('Fill')
    expect(input).toHaveValue('#000000')
    fireEvent.input(input, { target: { value: '#ff8800' } })
    expect(onChange).toHaveBeenCalledWith('#ff8800')
  })
})

describe('Chip', () => {
  it('fires onClick and marks the active chip differently', async () => {
    const onClick = vi.fn()
    renderUi(
      <>
        <Chip active onClick={onClick}>On</Chip>
        <Chip onClick={() => {}}>Off</Chip>
      </>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'On' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'On' }).className).not.toBe(
      screen.getByRole('button', { name: 'Off' }).className,
    )
  })
})

describe('PrimaryButton', () => {
  it('does not fire while disabled', async () => {
    const onClick = vi.fn()
    renderUi(<PrimaryButton onClick={onClick} disabled>Go</PrimaryButton>)
    const button = screen.getByRole('button', { name: 'Go' })
    expect(button).toBeDisabled()
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders as a label bound to an input when asked', () => {
    renderUi(
      <>
        <PrimaryButton as="label" htmlFor="pick">Pick</PrimaryButton>
        <input id="pick" type="file" />
      </>,
    )
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Pick').tagName).toBe('LABEL')
    expect(screen.getByLabelText('Pick')).toHaveAttribute('type', 'file')
  })
})

describe('Section', () => {
  it('renders a heading only when titled', () => {
    const { rerender } = renderUi(<Section title="Colour">body</Section>)
    expect(screen.getByRole('heading', { name: 'Colour' })).toBeInTheDocument()
    rerender(
      <MotionProvider>
        <Section>body</Section>
      </MotionProvider>,
    )
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.getByText('body')).toBeInTheDocument()
  })
})

describe('IconButton', () => {
  it('is named by its label for assistive tech', async () => {
    const onClick = vi.fn()
    renderUi(<IconButton label="Undo" onClick={onClick}>↶</IconButton>)
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not fire while disabled', async () => {
    const onClick = vi.fn()
    renderUi(<IconButton label="Redo" onClick={onClick} disabled>↷</IconButton>)
    await userEvent.click(screen.getByRole('button', { name: 'Redo' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})
