import { describe, it, expect, vi, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ColorField, IconButton, PrimaryButton, Section, Slider, Chip } from '../ui'
import { MotionProvider } from '../motion'
import { useColours } from '../../lib/palette'
import { useToast } from '../../store/toastStore'

const renderUi = (node: ReactNode) => render(<MotionProvider>{node}</MotionProvider>)

afterEach(() => {
  vi.unstubAllGlobals()
  delete (HTMLInputElement.prototype as Partial<HTMLInputElement>).showPicker
  useColours.setState({ recent: [], saved: [], boardPick: null })
  useToast.setState({ toasts: [] })
  localStorage.clear()
})

describe('Slider', () => {
  it('shows the label and the value rounded to two decimals', () => {
    renderUi(
      <Slider
        label="Brightness"
        min={0}
        max={1}
        step={0.001}
        value={0.12345}
        onChange={() => {}}
      />,
    )
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

  it('remembers a colour once it is committed, and offers it again', async () => {
    const onChange = vi.fn()
    renderUi(<ColorField label="Fill" value="#000000" onChange={onChange} />)
    const input = screen.getByLabelText('Fill')
    fireEvent.input(input, { target: { value: '#123456' } })
    fireEvent.change(input, { target: { value: '#123456' } })
    expect(useColours.getState().recent[0]).toBe('#123456')

    const toggle = screen.getByRole('button', { name: /Fill: / })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(await screen.findByRole('button', { name: 'Color #123456' }))
    expect(onChange).toHaveBeenLastCalledWith('#123456')
  })

  it('saves the current colour as a swatch', async () => {
    renderUi(<ColorField label="Fill" value="#abcdef" onChange={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /Fill: / }))
    const save = await screen.findByRole('button', { name: /save/i })
    await userEvent.click(save)
    expect(save).toHaveAttribute('aria-pressed', 'true')
    expect(useColours.getState().saved).toContain('#abcdef')
  })

  it('picks with the EyeDropper API where the browser has one', async () => {
    const open = vi.fn().mockResolvedValue({ sRGBHex: '#FF0000' })
    vi.stubGlobal(
      'EyeDropper',
      class {
        open = open
      },
    )
    const onChange = vi.fn()
    renderUi(<ColorField label="Fill" value="#000000" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /Fill: / }))
    await userEvent.click(await screen.findByRole('button', { name: /screen/i }))
    expect(onChange).toHaveBeenCalledWith('#ff0000')
    expect(useColours.getState().boardPick).toBeNull()
  })

  it('falls back to picking from the board without it', async () => {
    const onChange = vi.fn()
    renderUi(<ColorField label="Fill" value="#000000" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /Fill: / }))
    await userEvent.click(await screen.findByRole('button', { name: /screen/i }))
    const pick = useColours.getState().boardPick
    expect(pick).toBeTypeOf('function')
    pick!('#00ff00')
    expect(onChange).toHaveBeenCalledWith('#00ff00')
    useColours.getState().endBoardPick()
  })

  it('ends the board pick when pressed again, or when its toast goes away', async () => {
    renderUi(<ColorField label="Fill" value="#000000" onChange={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /Fill: / }))
    const eyedropper = await screen.findByRole('button', { name: /screen/i })
    await userEvent.click(eyedropper)
    expect(eyedropper).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(eyedropper)
    expect(useColours.getState().boardPick).toBeNull()
    expect(useToast.getState().toasts).toHaveLength(0)

    await userEvent.click(eyedropper)
    const [toast] = useToast.getState().toasts
    act(() => useToast.getState().remove(toast.id))
    expect(useColours.getState().boardPick).toBeNull()
    expect(eyedropper).toHaveAttribute('aria-pressed', 'false')
  })

  it('opens the browser picker instead when the eyedropper is pressed from the keyboard', async () => {
    const showPicker = vi.fn()
    HTMLInputElement.prototype.showPicker = showPicker
    renderUi(<ColorField label="Fill" value="#000000" onChange={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /Fill: / }))
    fireEvent.click(await screen.findByRole('button', { name: /screen/i }), { detail: 0 })
    expect(showPicker).toHaveBeenCalledTimes(1)
    expect(useColours.getState().boardPick).toBeNull()
  })

  it('disarms its board pick when the tools close, and picks for the latest target', async () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderUi(<ColorField label="Fill" value="#000000" onChange={first} />)
    const toggle = screen.getByRole('button', { name: /Fill: / })
    await userEvent.click(toggle)
    await userEvent.click(await screen.findByRole('button', { name: /screen/i }))
    rerender(
      <MotionProvider>
        <ColorField label="Fill" value="#000000" onChange={second} />
      </MotionProvider>,
    )
    useColours.getState().boardPick!('#00ff00')
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith('#00ff00')

    await userEvent.click(screen.getByRole('button', { name: /screen/i }))
    await userEvent.click(toggle)
    expect(useColours.getState().boardPick).toBeNull()
  })

  it('is still named when its field has no label', () => {
    renderUi(<ColorField label="" value="#000000" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Color tools' })).toBeInTheDocument()
  })
})

describe('Chip', () => {
  it('fires onClick and marks the active chip differently', async () => {
    const onClick = vi.fn()
    renderUi(
      <>
        <Chip active onClick={onClick}>
          On
        </Chip>
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
    renderUi(
      <PrimaryButton onClick={onClick} disabled>
        Go
      </PrimaryButton>,
    )
    const button = screen.getByRole('button', { name: 'Go' })
    expect(button).toBeDisabled()
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders as a label bound to an input when asked', () => {
    renderUi(
      <>
        <PrimaryButton as="label" htmlFor="pick">
          Pick
        </PrimaryButton>
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
    renderUi(
      <IconButton label="Undo" onClick={onClick}>
        ↶
      </IconButton>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not fire while disabled', async () => {
    const onClick = vi.fn()
    renderUi(
      <IconButton label="Redo" onClick={onClick} disabled>
        ↷
      </IconButton>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Redo' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})
