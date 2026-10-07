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

  it('ctrl+alt+c / ctrl+alt+v copy and paste style, by key code', () => {
    renderHook(() => useShortcuts())
    const [a, b] = ids()
    useEditor.getState().updateElement(a, { opacity: 0.3 })
    useEditor.getState().select(a)
    const code = (c: string, key: string) =>
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key, code: c, ctrlKey: true, altKey: true, bubbles: true }),
      )
    code('KeyC', 'ç')
    useEditor.getState().select(b)
    code('KeyV', '√')
    expect(useEditor.getState().elements[1].opacity).toBe(0.3)
  })

  it('ctrl+a selects every element', () => {
    renderHook(() => useShortcuts())
    press('a', { ctrl: true })
    expect(useEditor.getState().multiSelected).toEqual(ids())
  })

  it('delete removes the whole group as one undo step', () => {
    renderHook(() => useShortcuts())
    const [a, b, c] = ids()
    useEditor.getState().selectMany([a, b])
    useEditor.setState({ past: [] })
    press('Delete')
    expect(ids()).toEqual([c])
    expect(useEditor.getState().multiSelected).toEqual([])
    expect(useEditor.getState().past).toHaveLength(1)
  })

  it('an arrow key nudges the whole group and leaves the rest', () => {
    renderHook(() => useShortcuts())
    const [a, b] = ids()
    const before = useEditor.getState().elements.map((e) => e.x)
    useEditor.getState().selectMany([a, b])
    press('ArrowRight', { shift: true })
    expect(useEditor.getState().elements.map((e) => e.x)).toEqual([
      before[0] + 10,
      before[1] + 10,
      before[2],
    ])
    expect(useEditor.getState().selectedId).toBe(b)
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
