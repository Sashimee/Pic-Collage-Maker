import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditor } from '../store/editorStore'
import { linkFile, linkedHandle, unlinkFile, writeFile } from './linkedFile'

const handle = (writable: Partial<FileSystemWritableFileStream>) =>
  ({
    name: 'trip.piccollage',
    createWritable: vi.fn(async () => writable),
  }) as unknown as FileSystemFileHandle

describe('linkedHandle', () => {
  beforeEach(() => unlinkFile())

  it('is the linked file while the same document is on the board', () => {
    const h = handle({})
    linkFile(h)
    useEditor.getState().addText()
    expect(linkedHandle()).toBe(h)
  })

  it('is dropped once New clears the board', () => {
    linkFile(handle({}))
    useEditor.getState().clearAll()
    expect(linkedHandle()).toBeNull()
  })

  it('is dropped once another document is loaded', () => {
    linkFile(handle({}))
    const s = useEditor.getState()
    s.loadDocument({
      boardWidth: s.boardWidth,
      boardHeight: s.boardHeight,
      background: s.background,
      mode: s.mode,
      gridId: s.gridId,
      gridGap: s.gridGap,
      gridRadius: s.gridRadius,
      gridMargin: s.gridMargin,
      frame: s.frame,
      elements: [],
    })
    expect(linkedHandle()).toBeNull()
  })

  it('is null when nothing was linked', () => {
    expect(linkedHandle()).toBeNull()
  })
})

describe('writeFile', () => {
  it('writes the blob and closes the stream', async () => {
    const writable = { write: vi.fn(async () => {}), close: vi.fn(async () => {}), abort: vi.fn() }
    const blob = new Blob(['{}'])
    await writeFile(handle(writable), async () => blob)
    expect(writable.write).toHaveBeenCalledWith(blob)
    expect(writable.close).toHaveBeenCalled()
    expect(writable.abort).not.toHaveBeenCalled()
  })

  it('aborts instead of closing when the write fails, leaving the file as it was', async () => {
    const writable = {
      write: vi.fn(async () => {
        throw new DOMException('disk full', 'QuotaExceededError')
      }),
      close: vi.fn(),
      abort: vi.fn(async () => {}),
    }
    await expect(writeFile(handle(writable), async () => new Blob(['{}']))).rejects.toThrow(
      'disk full',
    )
    expect(writable.abort).toHaveBeenCalled()
    expect(writable.close).not.toHaveBeenCalled()
  })

  it('opens the file before packing, so a permission prompt still has the click', async () => {
    const order: string[] = []
    const writable = { write: vi.fn(async () => {}), close: vi.fn(async () => {}), abort: vi.fn() }
    const h = handle(writable)
    vi.mocked(h.createWritable).mockImplementation(async () => {
      order.push('open')
      return writable as unknown as FileSystemWritableFileStream
    })
    await writeFile(h, async () => {
      order.push('pack')
      return new Blob(['{}'])
    })
    expect(order).toEqual(['open', 'pack'])
  })

  it('leaves the file untouched when packing fails', async () => {
    const writable = { write: vi.fn(), close: vi.fn(), abort: vi.fn(async () => {}) }
    await expect(
      writeFile(handle(writable), async () => {
        throw new Error('photo missing')
      }),
    ).rejects.toThrow('photo missing')
    expect(writable.write).not.toHaveBeenCalled()
    expect(writable.abort).toHaveBeenCalled()
    expect(writable.close).not.toHaveBeenCalled()
  })
})
