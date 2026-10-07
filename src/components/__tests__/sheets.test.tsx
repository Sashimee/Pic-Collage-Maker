import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActionCancel, ActionItem, ActionSheet } from '../ActionSheet'
import { BottomSheet } from '../BottomSheet'
import { MotionProvider } from '../motion'

// jsdom has no ResizeObserver; ActionSheet's scroll fades only need it to exist.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

afterEach(() => {
  document.body.style.overflow = ''
})

describe('ActionSheet', () => {
  it('renders nothing while closed', () => {
    render(
      <MotionProvider>
        <ActionSheet open={false} onClose={() => {}} title="Export">
          <p>body</p>
        </ActionSheet>
      </MotionProvider>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens as a modal dialog with its title and content', () => {
    render(
      <MotionProvider>
        <ActionSheet open onClose={() => {}} title="Export">
          <p>body</p>
        </ActionSheet>
      </MotionProvider>,
    )
    expect(screen.getByRole('dialog', { name: 'Export' })).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('heading', { name: 'Export' })).toBeInTheDocument()
    expect(screen.getByText('body')).toBeInTheDocument()
  })

  it('closes on Escape, and stops listening once closed', async () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <MotionProvider>
        <ActionSheet open onClose={onClose}>
          <p>body</p>
        </ActionSheet>
      </MotionProvider>,
    )
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)

    rerender(
      <MotionProvider>
        <ActionSheet open={false} onClose={onClose}>
          <p>body</p>
        </ActionSheet>
      </MotionProvider>,
    )
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('locks page scroll while open and restores it after', async () => {
    document.body.style.overflow = 'auto'
    const { rerender } = render(
      <MotionProvider>
        <ActionSheet open onClose={() => {}}>
          <p>body</p>
        </ActionSheet>
      </MotionProvider>,
    )
    expect(document.body.style.overflow).toBe('hidden')
    rerender(
      <MotionProvider>
        <ActionSheet open={false} onClose={() => {}}>
          <p>body</p>
        </ActionSheet>
      </MotionProvider>,
    )
    await waitFor(() => expect(document.body.style.overflow).toBe('auto'))
  })

  it('wires its items and cancel button', async () => {
    const onItem = vi.fn()
    const onCancel = vi.fn()
    render(
      <MotionProvider>
        <ActionSheet open onClose={() => {}}>
          <ActionItem icon="★" label="Duplicate" onClick={onItem} />
          <ActionItem icon="✕" label="Delete" onClick={onItem} disabled />
          <ActionCancel label="Cancel" onClick={onCancel} />
        </ActionSheet>
      </MotionProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: /Duplicate/ }))
    await userEvent.click(screen.getByRole('button', { name: /Delete/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onItem).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

describe('BottomSheet', () => {
  it('shows its title and content only while open', () => {
    const { rerender } = render(
      <MotionProvider>
        <BottomSheet open title="Filters" onClose={() => {}}>
          <p>sliders</p>
        </BottomSheet>
      </MotionProvider>,
    )
    expect(screen.getByRole('heading', { name: 'Filters' })).toBeInTheDocument()
    expect(screen.getByText('sliders')).toBeInTheDocument()

    rerender(
      <MotionProvider>
        <BottomSheet open={false} title="Filters" onClose={() => {}}>
          <p>sliders</p>
        </BottomSheet>
      </MotionProvider>,
    )
    return waitFor(() => expect(screen.queryByText('sliders')).toBeNull())
  })

  it('closes from its close button', async () => {
    const onClose = vi.fn()
    render(
      <MotionProvider>
        <BottomSheet open title="Text" onClose={onClose}>
          <p>body</p>
        </BottomSheet>
      </MotionProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
