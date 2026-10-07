import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useEditor } from '../../store/editorStore'
import { exportBoard } from '../exportImage'
import type Konva from 'konva'

// Reset store state between tests
const resetStore = () => {
  const s = useEditor.getState()
  s.clearAll()
}

describe('stress tests', () => {
  beforeEach(() => {
    resetStore()
  })

  it('handles 100 photo elements', () => {
    const store = useEditor.getState()
    const start = performance.now()

    for (let i = 0; i < 100; i++) {
      store.addPhoto(
        `blob:mock-photo-${i}`,
        1920,
        1080,
        `photo-${i}`,
        {
          originalSrc: `blob:orig-${i}`,
          previewSrc: `blob:preview-${i}`,
          thumbSrc: `blob:thumb-${i}`,
        },
      )
    }

    const duration = performance.now() - start
    const state = useEditor.getState()

    expect(state.elements).toHaveLength(100)
    expect(state.elements.every((e) => e.type === 'photo')).toBe(true)
    expect(duration).toBeLessThan(5000) // should complete in under 5s
  })

  it('handles 500 text/sticker elements with acceptable performance', () => {
    const store = useEditor.getState()
    const start = performance.now()

    for (let i = 0; i < 250; i++) {
      store.addText()
      store.addSticker('⭐')
    }

    const duration = performance.now() - start
    const state = useEditor.getState()

    expect(state.elements).toHaveLength(500)
    const texts = state.elements.filter((e) => e.type === 'text')
    const stickers = state.elements.filter((e) => e.type === 'sticker')
    expect(texts).toHaveLength(250)
    expect(stickers).toHaveLength(250)
    expect(duration).toBeLessThan(5000)
  })

  it('exports at 4K resolution (3840×2160)', () => {
    const store = useEditor.getState()
    store.setBoardSize(3840, 2160)
    store.addPhoto('blob:mock-4k', 3840, 2160)

    const state = useEditor.getState()
    expect(state.boardWidth).toBe(3840)
    expect(state.boardHeight).toBe(2160)
    expect(state.elements).toHaveLength(1)

    // Mock Konva group for export
    const mockGroup = {
      x: vi.fn().mockReturnValue(0),
      y: vi.fn().mockReturnValue(0),
      scaleX: vi.fn().mockReturnValue(1),
      scaleY: vi.fn().mockReturnValue(1),
      rotation: vi.fn().mockReturnValue(0),
      setAttrs: vi.fn(),
      toDataURL: vi.fn().mockReturnValue('data:image/png;base64,MOCK'),
      find: vi.fn().mockReturnValue([]),
    } as unknown as Konva.Group

    const result = exportBoard(mockGroup, 3840, 2160, 'png', { pixelRatio: 1 })

    expect(mockGroup.setAttrs).toHaveBeenCalledWith(
      expect.objectContaining({ x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }),
    )
    expect(mockGroup.toDataURL).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 3840,
        height: 2160,
        pixelRatio: 1,
        mimeType: 'image/png',
      }),
    )
    expect(result).toBe('data:image/png;base64,MOCK')
  })

  it('cleans up memory after removing all elements', () => {
    const store = useEditor.getState()
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    // Populate with mixed content including blob URLs
    for (let i = 0; i < 50; i++) {
      store.addPhoto(`blob:photo-${i}`, 800, 600, `pid-${i}`, {
        originalSrc: `blob:orig-${i}`,
        previewSrc: `blob:preview-${i}`,
        thumbSrc: `blob:thumb-${i}`,
      })
    }
    for (let i = 0; i < 50; i++) {
      store.addText()
      store.addSticker('🔥')
    }

    let state = useEditor.getState()
    expect(state.elements).toHaveLength(150)

    store.clearAll()
    state = useEditor.getState()

    expect(state.elements).toHaveLength(0)
    expect(state.selectedId).toBeNull()
    expect(state.gridId).toBeNull()
    expect(state.mode).toBe('free')
    expect(revokeSpy).toHaveBeenCalled()

    revokeSpy.mockRestore()
  })
})
