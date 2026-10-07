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

  describe('clipboard', () => {
    const paste = (data: { files?: File[]; text?: string }, target: EventTarget = window) => {
      const event = Object.assign(new Event('paste', { bubbles: true, cancelable: true }), {
        clipboardData: { files: data.files ?? [], getData: () => data.text ?? '' },
      })
      target.dispatchEvent(event)
      return event
    }
    const png = new File(['x'], 'shot.png', { type: 'image/png' })

    it('hands pasted image files to onPasteImages', () => {
      const onPasteImages = vi.fn()
      renderHook(() => useShortcuts({ onPasteImages }))
      const event = paste({ files: [png] })
      expect(onPasteImages).toHaveBeenCalledWith([png])
      expect(event.defaultPrevented).toBe(true)
    })

    it('leaves a paste into a text field to the field', () => {
      const onPasteImages = vi.fn()
      renderHook(() => useShortcuts({ onPasteImages }))
      const input = document.body.appendChild(document.createElement('input'))
      const event = paste({ files: [png] }, input)
      input.remove()
      expect(onPasteImages).not.toHaveBeenCalled()
      expect(event.defaultPrevented).toBe(false)
    })

    it('pastes a copied element as a new element with its own id', () => {
      renderHook(() => useShortcuts())
      const original = useEditor.getState().elements[0]
      paste({ text: JSON.stringify(original) })
      const { elements, selectedId } = useEditor.getState()
      expect(elements).toHaveLength(4)
      expect(new Set(elements.map((e) => e.id)).size).toBe(4)
      expect(elements[3]).toMatchObject({ x: original.x + 20, y: original.y + 20 })
      expect(selectedId).toBe(elements[3].id)
    })

    it('ignores pasted text that is not an element', () => {
      renderHook(() => useShortcuts())
      const event = paste({ text: 'hello' })
      expect(useEditor.getState().elements).toHaveLength(3)
      expect(event.defaultPrevented).toBe(false)
    })

    it('ctrl+c with nothing selected copies the board image', () => {
      const onCopyImage = vi.fn()
      renderHook(() => useShortcuts({ onCopyImage }))
      useEditor.getState().select(null)
      press('c', { ctrl: true })
      expect(onCopyImage).toHaveBeenCalledOnce()
    })

    it('ctrl+c with an element selected copies the element, not the board', () => {
      const onCopyImage = vi.fn()
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
      renderHook(() => useShortcuts({ onCopyImage }))
      const [a] = ids()
      useEditor.getState().select(a)
      press('c', { ctrl: true })
      expect(onCopyImage).not.toHaveBeenCalled()
      expect(JSON.parse(writeText.mock.calls[0][0])).toMatchObject({ id: a })
    })
  })
})
