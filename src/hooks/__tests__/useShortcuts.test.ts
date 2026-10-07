import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useShortcuts } from '../useShortcuts'
import { useEditor } from '../../store/editorStore'

const press = (key: string, mods: { ctrl?: boolean; shift?: boolean } = {}) =>
  window.dispatchEvent(
    new KeyboardEvent('keydown', { key, ctrlKey: !!mods.ctrl, shiftKey: !!mods.shift, bubbles: true }),
  )

const ids = () => useEditor.getState().elements.map((e) => e.id)

describe('useShortcuts', () => {
  beforeEach(() => {
    useEditor.getState().clearAll()
    useEditor.setState({ past: [], future: [] })
    const s = useEditor.getState()
    s.addText()
    s.addText()
    s.addText()
  })

  afterEach(() => vi.restoreAllMocks())

  it('one undo press steps back exactly one edit', () => {
    renderHook(() => useShortcuts())
    press('z', { ctrl: true })
    expect(useEditor.getState().elements).toHaveLength(2)
  })

  it('one duplicate press adds exactly one element', () => {
    renderHook(() => useShortcuts())
    useEditor.getState().select(ids()[0])
    press('d', { ctrl: true })
    expect(useEditor.getState().elements).toHaveLength(4)
  })

  it('ctrl+] brings the selection forward one step', () => {
    renderHook(() => useShortcuts())
    const [a, b, c] = ids()
    useEditor.getState().select(a)
    press(']', { ctrl: true })
    expect(ids()).toEqual([b, a, c])
  })

  it('ctrl+[ sends the selection backward one step', () => {
    renderHook(() => useShortcuts())
    const [a, b, c] = ids()
    useEditor.getState().select(c)
    press('[', { ctrl: true })
    expect(ids()).toEqual([a, c, b])
  })

  it('ctrl+shift+c clears the canvas once confirmed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderHook(() => useShortcuts())
    press('C', { ctrl: true, shift: true })
    expect(window.confirm).toHaveBeenCalledOnce()
    expect(useEditor.getState().elements).toHaveLength(0)
  })

  it('ctrl+shift+c leaves the canvas alone when the confirm is declined', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderHook(() => useShortcuts())
    press('C', { ctrl: true, shift: true })
    expect(useEditor.getState().elements).toHaveLength(3)
  })

  it('ignores shortcuts typed into a text field', () => {
    renderHook(() => useShortcuts())
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))
    input.remove()
    expect(useEditor.getState().elements).toHaveLength(3)
  })
})
