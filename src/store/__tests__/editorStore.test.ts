import { describe, it, expect, beforeEach } from 'vitest'
import { useEditor } from '../editorStore'
import type { PhotoElement, TextElement } from '../../types'

function resetStore() {
  const s = useEditor.getState()
  s.clearAll()
  useEditor.setState({ past: [], future: [] })
}

describe('editorStore', () => {
  beforeEach(() => {
    resetStore()
  })

  describe('addPhoto', () => {
    it('adds a photo element centred on the board', () => {
      const s = useEditor.getState()
      s.addPhoto('blob:fake', 800, 600)
      const state = useEditor.getState()
      expect(state.elements).toHaveLength(1)
      const photo = state.elements[0] as PhotoElement
      expect(photo.type).toBe('photo')
      expect(photo.src).toBe('blob:fake')
      expect(photo.x).toBeGreaterThan(0)
      expect(photo.y).toBeGreaterThan(0)
      expect(state.selectedId).toBe(photo.id)
    })

    it('keeps photo within board bounds', () => {
      const s = useEditor.getState()
      s.addPhoto('blob:fake', 800, 600)
      const photo = useEditor.getState().elements[0] as PhotoElement
      const { boardWidth, boardHeight } = useEditor.getState()
      expect(photo.x + photo.width).toBeLessThanOrEqual(boardWidth + 1)
      expect(photo.y + photo.height).toBeLessThanOrEqual(boardHeight + 1)
    })
  })

  describe('removeElement', () => {
    it('removes an element and clears selection', () => {
      const s = useEditor.getState()
      s.addPhoto('blob:fake', 800, 600)
      const id = useEditor.getState().elements[0].id
      s.removeElement(id)
      const state = useEditor.getState()
      expect(state.elements).toHaveLength(0)
      expect(state.selectedId).toBeNull()
    })

    it('records history before removal', () => {
      const s = useEditor.getState()
      s.addPhoto('blob:fake', 800, 600)
      expect(useEditor.getState().past.length).toBeGreaterThan(0)
      const id = useEditor.getState().elements[0].id
      s.removeElement(id)
      expect(useEditor.getState().past.length).toBeGreaterThan(1)
    })
  })

  describe('duplicateElement', () => {
    it('creates a copy offset by 40px', () => {
      const s = useEditor.getState()
      s.addPhoto('blob:fake', 800, 600)
      const orig = useEditor.getState().elements[0] as PhotoElement
      s.duplicateElement(orig.id)
      const state = useEditor.getState()
      expect(state.elements).toHaveLength(2)
      const copy = state.elements[1] as PhotoElement
      expect(copy.id).not.toBe(orig.id)
      expect(copy.x).toBe(orig.x + 40)
      expect(copy.y).toBe(orig.y + 40)
      expect(copy.src).toBe(orig.src)
    })

    it('selects the duplicated element', () => {
      const s = useEditor.getState()
      s.addPhoto('blob:fake', 800, 600)
      const orig = useEditor.getState().elements[0]
      s.duplicateElement(orig.id)
      const state = useEditor.getState()
      expect(state.selectedId).toBe(state.elements[1].id)
    })
  })

  describe('undo / redo', () => {
    it('undo restores previous state after addPhoto', () => {
      const s = useEditor.getState()
      s.addPhoto('blob:fake', 800, 600)
      expect(useEditor.getState().elements).toHaveLength(1)
      s.undo()
      const state = useEditor.getState()
      expect(state.elements).toHaveLength(0)
    })

    it('redo restores undone state', () => {
      const s = useEditor.getState()
      s.addPhoto('blob:fake', 800, 600)
      s.undo()
      expect(useEditor.getState().elements).toHaveLength(0)
      s.redo()
      expect(useEditor.getState().elements).toHaveLength(1)
    })

    it('clears future on new action', () => {
      const s = useEditor.getState()
      s.addPhoto('blob:fake', 800, 600)
      s.addText()
      s.undo()
      expect(useEditor.getState().future.length).toBe(1)
      s.addPhoto('blob:fake2', 400, 300)
      expect(useEditor.getState().future.length).toBe(0)
    })

    it('names each step after what it did', () => {
      const s = useEditor.getState()
      s.addPhoto('blob:fake', 800, 600)
      const id = useEditor.getState().elements[0].id
      s.updateElement(id, { x: 5, y: 5 })
      s.updateElement(id, { rotation: 30 })
      s.updateElement(id, { opacity: 0.5 })
      s.setBackground({ color: '#ff0000' })
      expect(useEditor.getState().past.map((e) => e.label)).toEqual([
        'history.addPhoto',
        'history.move',
        'history.transform',
        'history.edit',
        'history.background',
      ])
    })

    it("keeps a step's name as it moves between undo and redo", () => {
      const s = useEditor.getState()
      s.addText()
      s.setBackground({ color: '#ff0000' })
      s.undo()
      expect(useEditor.getState().future.map((e) => e.label)).toEqual(['history.background'])
      s.redo()
      expect(useEditor.getState().past.map((e) => e.label)).toEqual([
        'history.addText',
        'history.background',
      ])
    })

    it('travels several steps at once, and no further than the ends', () => {
      const s = useEditor.getState()
      s.addText()
      s.addText()
      s.addText()
      s.travel(-2)
      expect(useEditor.getState().elements).toHaveLength(1)
      expect(useEditor.getState().future).toHaveLength(2)
      s.travel(1)
      expect(useEditor.getState().elements).toHaveLength(2)
      s.travel(-99)
      expect(useEditor.getState().elements).toHaveLength(0)
      s.travel(99)
      expect(useEditor.getState().elements).toHaveLength(3)
      expect(useEditor.getState().past).toHaveLength(3)
    })

    it('undo is a no-op when past is empty', () => {
      const state = useEditor.getState()
      state.undo()
      expect(useEditor.getState().elements).toHaveLength(0)
    })

    it('redo is a no-op when future is empty', () => {
      const state = useEditor.getState()
      state.redo()
      expect(useEditor.getState().elements).toHaveLength(0)
    })
  })

  describe('multi-select', () => {
    const threeTexts = () => {
      const s = useEditor.getState()
      s.addText()
      s.addText()
      s.addText()
      return useEditor.getState().elements.map((e) => e.id)
    }

    it('shift-clicking a second element extends the plain selection', () => {
      const [a, b] = threeTexts()
      useEditor.getState().select(a)
      useEditor.getState().toggleMultiSelect(b)
      expect(useEditor.getState().multiSelected).toEqual([a, b])
      expect(useEditor.getState().selectedId).toBe(b)
    })

    it('shift-clicking a member removes it and drops to a single selection at one left', () => {
      const [a, b, c] = threeTexts()
      useEditor.getState().selectMany([a, b, c])
      useEditor.getState().toggleMultiSelect(c)
      expect(useEditor.getState().multiSelected).toEqual([a, b])
      expect(useEditor.getState().selectedId).toBe(b)
      useEditor.getState().toggleMultiSelect(b)
      expect(useEditor.getState().multiSelected).toEqual([])
      expect(useEditor.getState().selectedId).toBe(a)
    })

    it('never adds a locked element', () => {
      const [a, b] = threeTexts()
      useEditor.getState().setElementLocked(b, true)
      useEditor.getState().select(a)
      useEditor.getState().toggleMultiSelect(b)
      expect(useEditor.getState().multiSelected).toEqual([])
      expect(useEditor.getState().selectedId).toBe(a)
    })

    it('locking or hiding the selected element deselects it', () => {
      const [a, b, c] = threeTexts()
      useEditor.getState().select(a)
      useEditor.getState().setElementLocked(a, true)
      expect(useEditor.getState().selectedId).toBeNull()
      useEditor.getState().select(b)
      useEditor.getState().setElementHidden(b, true)
      expect(useEditor.getState().selectedId).toBeNull()
      useEditor.getState().select(c)
      useEditor.getState().setElementHidden(a, true)
      expect(useEditor.getState().selectedId).toBe(c)
    })

    it('selectMany skips locked and hidden elements and unknown ids', () => {
      const [a, b, c] = threeTexts()
      useEditor.getState().setElementLocked(a, true)
      useEditor.getState().updateElement(b, { hidden: true })
      useEditor.getState().selectMany([a, b, c, 'nope'])
      expect(useEditor.getState().multiSelected).toEqual([])
      expect(useEditor.getState().selectedId).toBe(c)
    })

    it('selectMany with nothing clears the selection', () => {
      const [a] = threeTexts()
      useEditor.getState().select(a)
      useEditor.getState().selectMany([])
      expect(useEditor.getState().selectedId).toBeNull()
      expect(useEditor.getState().multiSelected).toEqual([])
    })

    it('locking or hiding a member drops it from the group', () => {
      const [a, b, c] = threeTexts()
      useEditor.getState().selectMany([a, b, c])
      useEditor.getState().setElementLocked(c, true)
      expect(useEditor.getState().multiSelected).toEqual([a, b])
      expect(useEditor.getState().selectedId).toBe(b)
      useEditor.getState().setElementHidden(b, true)
      expect(useEditor.getState().multiSelected).toEqual([])
      expect(useEditor.getState().selectedId).toBe(a)
    })

    it('switching to a grid, undoing or redoing ends the group', () => {
      const [a, b] = threeTexts()
      useEditor.getState().selectMany([a, b])
      useEditor.getState().setGrid('2-v')
      expect(useEditor.getState().multiSelected).toEqual([])

      useEditor.getState().selectMany([a, b])
      useEditor.getState().undo()
      expect(useEditor.getState().multiSelected).toEqual([])

      useEditor.getState().selectMany([a, b])
      useEditor.getState().redo()
      expect(useEditor.getState().multiSelected).toEqual([])
    })

    it('removing a member keeps the rest grouped', () => {
      const [a, b, c] = threeTexts()
      useEditor.getState().selectMany([a, b, c])
      useEditor.getState().removeElement(c)
      expect(useEditor.getState().multiSelected).toEqual([a, b])
      expect(useEditor.getState().selectedId).toBe(b)
    })

    it('a plain select ends the multi-selection', () => {
      const [a, b, c] = threeTexts()
      useEditor.getState().selectMany([a, b])
      useEditor.getState().select(c)
      expect(useEditor.getState().multiSelected).toEqual([])
      expect(useEditor.getState().selectedId).toBe(c)
    })
  })

  describe('updateElements', () => {
    it('moves a group as one undo step', () => {
      const s = useEditor.getState()
      s.addText()
      s.addText()
      const [a, b] = useEditor.getState().elements
      useEditor.setState({ past: [], future: [] })

      useEditor.getState().updateElements({
        [a.id]: { x: a.x + 50, rotation: 30 },
        [b.id]: { x: b.x + 50, rotation: 30 },
      })
      const moved = useEditor.getState().elements
      expect(moved.map((e) => e.x)).toEqual([a.x + 50, b.x + 50])
      expect(moved.map((e) => e.rotation)).toEqual([30, 30])
      expect(useEditor.getState().past).toHaveLength(1)

      useEditor.getState().undo()
      expect(useEditor.getState().elements.map((e) => e.x)).toEqual([a.x, b.x])
    })

    it('leaves elements without a patch untouched', () => {
      const s = useEditor.getState()
      s.addText()
      s.addText()
      const [a, b] = useEditor.getState().elements
      useEditor.getState().updateElements({ [a.id]: { y: 1 } })
      expect(useEditor.getState().elements[1]).toBe(b)
    })

    it('is its own step even right after a single-element edit', () => {
      const s = useEditor.getState()
      s.addText()
      const [a] = useEditor.getState().elements
      useEditor.setState({ past: [], future: [] })
      useEditor.getState().updateElement(a.id, { x: 10 })
      useEditor.getState().updateElements({ [a.id]: { x: 20 } })
      useEditor.getState().updateElement(a.id, { x: 30 })
      expect(useEditor.getState().past).toHaveLength(3)
    })
  })

  describe('addText', () => {
    it('adds a text element and selects it', () => {
      const s = useEditor.getState()
      s.addText()
      const state = useEditor.getState()
      expect(state.elements).toHaveLength(1)
      const text = state.elements[0] as TextElement
      expect(text.type).toBe('text')
      expect(text.text).toBe('Tap to edit')
      expect(state.selectedId).toBe(text.id)
    })
  })

  describe('addShape', () => {
    it('adds a library shape with its path and library id, centred on the board', () => {
      useEditor
        .getState()
        .addShape('custom', '#ff0000', { path: 'M0,0 L120,0 L60,120 Z', libraryId: 'arrowRight' })
      const { elements, selectedId, boardWidth, boardHeight } = useEditor.getState()
      expect(elements[0]).toMatchObject({
        type: 'shape',
        shapeType: 'custom',
        fill: '#ff0000',
        path: 'M0,0 L120,0 L60,120 Z',
        libraryId: 'arrowRight',
        x: boardWidth / 2 - 60,
        y: boardHeight / 2 - 60,
      })
      expect(selectedId).toBe(elements[0].id)
    })
  })

  describe('setBoardSize', () => {
    const place = (patch: Partial<TextElement>) => {
      useEditor.setState({ boardWidth: 1000, boardHeight: 1000 })
      useEditor.getState().addText()
      const id = useEditor.getState().elements[0].id
      useEditor.getState().updateElement(id, { x: 500, y: 500, scaleX: 1, scaleY: 1, ...patch })
      useEditor.setState({ past: [], future: [] })
      return id
    }
    const el = () => useEditor.getState().elements[0]

    it('scales content to fit and centres it along the spare axis', () => {
      place({ x: 0, y: 0, scaleX: 2, scaleY: 1 })
      useEditor.getState().setBoardSize(2000, 4000)
      expect(useEditor.getState()).toMatchObject({ boardWidth: 2000, boardHeight: 4000 })
      expect(el()).toMatchObject({ x: 0, y: 1000, scaleX: 4, scaleY: 2 })
    })

    it('shrinks content so it stays on a smaller board', () => {
      place({ x: 1000, y: 500 })
      useEditor.getState().setBoardSize(500, 250)
      expect(el()).toMatchObject({ x: 375, y: 125, scaleX: 0.25, scaleY: 0.25 })
    })

    it('keeps rotation and leaves content alone when the size is unchanged', () => {
      place({ x: 120, y: 340, rotation: 30 })
      useEditor.getState().setBoardSize(1000, 1000)
      expect(el()).toMatchObject({ x: 120, y: 340, rotation: 30, scaleX: 1, scaleY: 1 })
    })

    it('undoes size and content placement in one step', () => {
      place({ x: 500, y: 500 })
      useEditor.getState().setBoardSize(2000, 1000)
      useEditor.getState().undo()
      expect(useEditor.getState()).toMatchObject({ boardWidth: 1000, boardHeight: 1000 })
      expect(el()).toMatchObject({ x: 500, y: 500, scaleX: 1, scaleY: 1 })
    })
  })

  describe('applyTemplate', () => {
    it('keeps the photos, replaces the rest, and undoes in one step', () => {
      const s = useEditor.getState()
      s.addPhoto('blob:a', 800, 600)
      s.addText()
      const before = useEditor.getState().boardHeight
      useEditor.getState().applyTemplate({
        boardWidth: 1080,
        boardHeight: 1920,
        background: { type: 'solid', color: '#fde68a' },
        gridId: 'film-4',
        gridGap: 12,
        gridRadius: 0,
        gridMargin: 0,
        frame: { style: 'none', color: '#ffffff', width: 0.04 },
        elements: [
          {
            type: 'text',
            text: 'Hi',
            fontFamily: 'Poppins',
            fontSize: 80,
            fill: '#000000',
            fontStyle: 'normal',
            x: 10,
            y: 20,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          },
        ],
      })
      const after = useEditor.getState()
      expect(after).toMatchObject({
        boardWidth: 1080,
        boardHeight: 1920,
        mode: 'grid',
        gridId: 'film-4',
        gridGap: 12,
        galleryDismissed: true,
        selectedId: null,
      })
      expect(after.background).toMatchObject({ type: 'solid', color: '#fde68a' })
      expect(after.elements.map((e) => e.type)).toEqual(['photo', 'text'])
      expect((after.elements[1] as TextElement).text).toBe('Hi')
      expect(after.elements[1].id).toBeTruthy()
      expect(after.past.at(-1)?.label).toBe('history.template')

      after.undo()
      const undone = useEditor.getState()
      expect(undone.boardHeight).toBe(before)
      expect(undone.elements.map((e) => e.type)).toEqual(['photo', 'text'])
      expect((undone.elements[1] as TextElement).text).toBe('Tap to edit')
    })
  })

  describe('canvas zoom floor', () => {
    it('clamps the zoom to 0.25 by default', () => {
      useEditor.getState().setCanvasZoom(0.05)
      expect(useEditor.getState().canvasZoom).toBe(0.25)
    })

    it('lets the floor down when the fit needs less than 0.25', () => {
      // fitToScreen calls this. Without it the floor overrides the fit and the
      // board renders larger than the space it was fitted into — on a phone
      // with a panel open, spilling out under the sheet.
      useEditor.getState().setMinCanvasZoom(0.18)
      useEditor.getState().setCanvasZoom(0.18)
      expect(useEditor.getState().canvasZoom).toBeCloseTo(0.18)
    })

    it('never raises the floor above 0.25, whatever the fit is', () => {
      useEditor.getState().setMinCanvasZoom(3)
      expect(useEditor.getState().minCanvasZoom).toBe(0.25)
    })

    it('still caps zoom at 4', () => {
      useEditor.getState().setCanvasZoom(99)
      expect(useEditor.getState().canvasZoom).toBe(4)
    })
  })

  describe('copy / paste style', () => {
    it('pastes onto every target as one undo step, keeping their content', () => {
      const s = useEditor.getState()
      s.addText()
      s.addText()
      s.addText()
      const [a, b, c] = useEditor.getState().elements.map((e) => e.id)
      s.updateElement(a, { fill: '#ff0000', fontFamily: 'Lobster', text: 'Source' })
      s.copyStyle(a)
      const before = useEditor.getState().past.length
      s.pasteStyle([b, c])
      const els = useEditor.getState().elements as TextElement[]
      expect(els.slice(1).map((e) => [e.fill, e.fontFamily, e.text === 'Source'])).toEqual([
        ['#ff0000', 'Lobster', false],
        ['#ff0000', 'Lobster', false],
      ])
      expect(useEditor.getState().past).toHaveLength(before + 1)
      expect(useEditor.getState().past.at(-1)?.label).toBe('history.pasteStyle')
      s.undo()
      expect((useEditor.getState().elements[1] as TextElement).fill).not.toBe('#ff0000')
    })

    it('does nothing before anything is copied', () => {
      const s = useEditor.getState()
      useEditor.setState({ copiedStyle: null })
      s.addText()
      const before = useEditor.getState()
      s.pasteStyle([before.elements[0].id])
      expect(useEditor.getState().elements).toBe(before.elements)
      expect(useEditor.getState().past).toBe(before.past)
    })
  })
})
