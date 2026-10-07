import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDeleteUndo } from '../useDeleteUndo'
import { useEditor } from '../../store/editorStore'
import { useToast } from '../../store/toastStore'

const editor = () => useEditor.getState()
const ids = () => editor().elements.map((e) => e.id)
const toasts = () => useToast.getState().toasts
const pressUndo = () => toasts()[toasts().length - 1].action!.onClick()

describe('useDeleteUndo', () => {
  beforeEach(() => {
    editor().clearAll()
    useToast.setState({ toasts: [] })
    editor().addText()
    editor().addText()
    renderHook(() => useDeleteUndo())
  })

  it('offers an undo after a delete, which brings the element back', () => {
    const [first] = ids()
    editor().removeElement(first)

    expect(toasts()).toHaveLength(1)
    expect(toasts()[0].message).toBe('Deleted.')
    expect(toasts()[0].action?.label).toBe('Undo')

    pressUndo()
    expect(ids()).toContain(first)
    expect(toasts()).toHaveLength(0)
  })

  it('covers deleting several at once', () => {
    editor().removeElements(ids())
    expect(toasts()).toHaveLength(1)
    pressUndo()
    expect(ids()).toHaveLength(2)
  })

  it('stays quiet for edits that are not deletes', () => {
    editor().addText()
    editor().duplicateElement(ids()[0])
    expect(toasts()).toHaveLength(0)
  })

  it('does not offer a delete again when undo steps back onto it', () => {
    editor().removeElement(ids()[0])
    editor().addText()
    useToast.setState({ toasts: [] })

    editor().undo()
    expect(toasts()).toHaveLength(0)
  })

  it('leaves later edits alone once the delete is no longer the last step', () => {
    const [first] = ids()
    editor().removeElement(first)
    const undoButton = toasts()[0].action!
    editor().addText()
    const before = ids()

    undoButton.onClick()
    expect(ids()).toEqual(before)
  })

  it('undoes once, however often the button is pressed', () => {
    editor().removeElement(ids()[0])
    editor().removeElement(ids()[0])
    const second = toasts()[1].action!
    second.onClick()
    second.onClick()
    expect(ids()).toHaveLength(1)
  })
})
