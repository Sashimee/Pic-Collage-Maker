import { StrictMode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  CommandOverlay,
  CommandPalette,
  ShortcutHelp,
  formatKeys,
  matches,
  type Command,
} from '../CommandPalette'
import { PANEL_TABS } from '../panels.config'
import { useEditor } from '../../store/editorStore'

const command = (id: string, label: string, extra: Partial<Command> = {}): Command => ({
  id,
  label,
  run: vi.fn(),
  ...extra,
})

describe('formatKeys', () => {
  it('spells modifiers out off a Mac', () => {
    expect(formatKeys(['Mod', 'Shift', 'Z'], false)).toBe('Ctrl+Shift+Z')
  })

  it('uses the Mac symbols on a Mac', () => {
    expect(formatKeys(['Mod', 'Alt', 'C'], true)).toBe('⌘⌥C')
  })
})

describe('matches', () => {
  it('matches every word anywhere, ignoring case', () => {
    expect(matches('Download PNG', 'png down')).toBe(true)
    expect(matches('Download PNG', 'jpg')).toBe(false)
    expect(matches('Download PNG', '')).toBe(true)
  })
})

describe('CommandPalette', () => {
  const setup = (commands: Command[]) => {
    const onClose = vi.fn()
    render(<CommandPalette commands={commands} onClose={onClose} />)
    return { onClose, input: screen.getByRole('combobox') }
  }

  it('opens as a modal dialog with the search field focused', () => {
    const { input } = setup([command('a', 'Alpha')])
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    expect(input).toHaveFocus()
  })

  it('narrows the list as you type and runs the highlighted command on Enter', async () => {
    const png = command('png', 'Download PNG')
    const jpg = command('jpg', 'Download JPG')
    const { onClose } = setup([png, jpg, command('undo', 'Undo')])
    await userEvent.keyboard('download')
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Download PNG',
      'Download JPG',
    ])
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(jpg.run).toHaveBeenCalledOnce()
    expect(png.run).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('wraps the highlight around both ends', async () => {
    const last = command('c', 'Gamma')
    setup([command('a', 'Alpha'), command('b', 'Beta'), last])
    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent('Gamma')
    expect(screen.getByRole('combobox')).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { selected: true }).id,
    )
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent('Alpha')
  })

  it('leaves out commands that cannot run right now', () => {
    setup([command('a', 'Alpha'), command('b', 'Beta', { enabled: false })])
    expect(screen.getAllByRole('option')).toHaveLength(1)
  })

  it('says so when nothing matches, and Enter does nothing', async () => {
    const a = command('a', 'Alpha')
    const { onClose } = setup([a])
    await userEvent.keyboard('zzz{Enter}')
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByRole('status')).toHaveTextContent('No matching commands')
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false')
    expect(a.run).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('names an option by its label and announces its keys separately', () => {
    setup([command('d', 'Duplicate', { keys: ['Mod', 'D'] })])
    const option = screen.getByRole('option', { name: 'Duplicate' })
    expect(option).toHaveAttribute('aria-keyshortcuts', 'Control+D')
  })

  it('leaves Enter alone while an input method is composing', () => {
    const a = command('a', 'Alpha')
    const { input } = setup([a])
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    expect(a.run).not.toHaveBeenCalled()
  })

  it('runs a command on click', async () => {
    const a = command('a', 'Alpha')
    setup([command('z', 'Zeta'), a])
    await userEvent.click(screen.getByText('Alpha'))
    expect(a.run).toHaveBeenCalledOnce()
  })

  it('closes on Escape without the editor behind it seeing the key', async () => {
    const behind = vi.fn()
    window.addEventListener('keydown', behind)
    const { onClose } = setup([command('a', 'Alpha')])
    await userEvent.keyboard('{Escape}')
    window.removeEventListener('keydown', behind)
    expect(onClose).toHaveBeenCalledOnce()
    expect(behind).not.toHaveBeenCalled()
  })
})

describe('ShortcutHelp', () => {
  it('lists every shortcut, including ones that cannot run right now', () => {
    render(
      <ShortcutHelp
        commands={[
          command('undo', 'Undo', { keys: ['Mod', 'Z'], enabled: false }),
          command('jpg', 'Download JPG'),
        ]}
        onClose={() => {}}
      />,
    )
    const terms = screen.getAllByRole('term').map((t) => t.textContent)
    expect(terms).toContain('Undo')
    expect(terms).not.toContain('Download JPG')
    expect(terms).toContain('Command palette')
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
  })

  it('lets Tab reach the list once it scrolls, and wraps back', async () => {
    const scrollHeight = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(900)
    render(<ShortcutHelp commands={[]} onClose={() => {}} />)
    scrollHeight.mockRestore()
    await userEvent.tab()
    expect(document.querySelector('dl')).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
  })

  it('keeps Tab on the close button while the list fits', async () => {
    render(<ShortcutHelp commands={[]} onClose={() => {}} />)
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
  })

  it('switches to the palette on Ctrl+K', async () => {
    const onPalette = vi.fn()
    render(<ShortcutHelp commands={[]} onClose={() => {}} onPalette={onPalette} />)
    await userEvent.keyboard('{Control>}k{/Control}')
    expect(onPalette).toHaveBeenCalledOnce()
  })
})

describe('CommandOverlay', () => {
  beforeEach(() => {
    useEditor.getState().clearAll()
    useEditor.setState({ past: [], future: [] })
  })

  const overlay = (onOpenPanel = vi.fn()) =>
    render(
      <CommandOverlay
        view="palette"
        tabs={PANEL_TABS.slice(0, 2)}
        onClose={() => {}}
        onExport={() => {}}
        onExportSVG={() => {}}
        onOpenPanel={onOpenPanel}
        onShortcutHelp={() => {}}
        onPalette={() => {}}
      />,
    )

  it('gives focus back to its opener on close, even after switching to the shortcut list', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()
    const onClose = vi.fn()
    const view = (v: 'palette' | 'shortcuts') => (
      <StrictMode>
        <CommandOverlay
          view={v}
          tabs={[]}
          onClose={onClose}
          onExport={() => {}}
          onExportSVG={() => {}}
          onOpenPanel={() => {}}
          onShortcutHelp={() => {}}
          onPalette={() => {}}
        />
      </StrictMode>
    )
    const { rerender } = render(view('palette'))
    expect(screen.getByRole('combobox')).toHaveFocus()
    rerender(view('shortcuts'))
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
    expect(trigger).toHaveFocus()
    trigger.remove()
  })

  it('keeps focus in the search field when the dialog itself is pressed', async () => {
    overlay()
    await userEvent.click(screen.getByRole('dialog'))
    expect(screen.getByRole('combobox')).toHaveFocus()
  })

  it('offers the selection commands only with something selected', () => {
    overlay()
    expect(document.querySelector('[data-command="delete"]')).toBeNull()
  })

  it('deletes the selected element', async () => {
    useEditor.getState().addText()
    const [el] = useEditor.getState().elements
    useEditor.getState().select(el.id)
    overlay()
    await userEvent.click(document.querySelector('[data-command="delete"]')!)
    expect(useEditor.getState().elements).toHaveLength(0)
  })

  it('opens a panel by id, only for the tabs it was given', async () => {
    const onOpenPanel = vi.fn()
    overlay(onOpenPanel)
    expect(document.querySelector(`[data-command="panel-${PANEL_TABS[2].id}"]`)).toBeNull()
    await userEvent.click(document.querySelector(`[data-command="panel-${PANEL_TABS[1].id}"]`)!)
    expect(onOpenPanel).toHaveBeenCalledWith(PANEL_TABS[1].id)
  })
})
