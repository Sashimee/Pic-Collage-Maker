import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type Konva from 'konva'
import {
  downloadDataURL,
  shareDataURL,
  shareImages,
  shareFileName,
  canShareImage,
  exportBoard,
  buildShareText,
  appUrl,
} from '../exportImage'

/**
 * A stand-in Konva board. `toCanvas` hands back a fake canvas whose 2D context
 * records what was drawn — jsdom has no real canvas, so the invariant we can
 * check here is *which API the export goes through*, not the pixels. The pixels
 * are covered end-to-end in e2e/export-watermark.spec.ts.
 */
function mockBoard() {
  const ctx = {
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 40 }),
    createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
  }
  const canvas = {
    width: 200,
    height: 250,
    getContext: vi.fn().mockReturnValue(ctx),
    toDataURL: vi.fn().mockReturnValue('data:image/png;base64,POSTPROCESSED'),
  }
  const board = {
    x: vi.fn().mockReturnValue(3),
    y: vi.fn().mockReturnValue(4),
    scaleX: vi.fn().mockReturnValue(2),
    scaleY: vi.fn().mockReturnValue(2),
    rotation: vi.fn().mockReturnValue(0),
    setAttrs: vi.fn(),
    toCanvas: vi.fn().mockReturnValue(canvas),
    toDataURL: vi.fn().mockReturnValue('data:image/png;base64,FASTPATH'),
  }
  return { board: board as unknown as Konva.Group, raw: board, canvas, ctx }
}

const WATERMARK = {
  enabled: true,
  text: 'Pic Collage',
  position: 'bottom-right' as const,
  opacity: 0.5,
  fontSize: 24,
  color: '#ffffff',
}

describe('exportBoard with overlays', () => {
  it('renders through a canvas, never through an undecoded Image', () => {
    // The bug this guards: the watermark pass used to do `img.src = dataUrl;
    // ctx.drawImage(img, …)`. Image decoding is asynchronous even for a data
    // URL, so drawImage drew nothing and every watermarked export came out
    // blank with only the watermark on it.
    const { board, raw, canvas, ctx } = mockBoard()

    const out = exportBoard(board, 100, 125, 'png', { pixelRatio: 2, watermark: WATERMARK })

    expect(raw.toCanvas).toHaveBeenCalledOnce()
    expect(raw.toDataURL).not.toHaveBeenCalled()
    expect(ctx.drawImage).not.toHaveBeenCalled()
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/png', 0.92)
    expect(out).toBe('data:image/png;base64,POSTPROCESSED')
  })

  it('drops Konva\'s pixelRatio transform before drawing the overlay', () => {
    // toCanvas() leaves scale(pixelRatio) on the context, but the overlay maths
    // is in device pixels — without the reset the watermark lands off-canvas.
    const { board, ctx } = mockBoard()
    exportBoard(board, 100, 125, 'png', { pixelRatio: 2, watermark: WATERMARK })
    expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0)
    expect(ctx.fillText).toHaveBeenCalled()
  })

  it('takes the plain fast path when no overlay is enabled', () => {
    const { board, raw } = mockBoard()
    const out = exportBoard(board, 100, 125, 'jpg', { pixelRatio: 2 })

    expect(raw.toDataURL).toHaveBeenCalledWith(
      expect.objectContaining({ width: 100, height: 125, pixelRatio: 2, mimeType: 'image/jpeg' }),
    )
    expect(raw.toCanvas).not.toHaveBeenCalled()
    expect(out).toBe('data:image/png;base64,FASTPATH')
  })

  it('restores the board transform on both paths', () => {
    for (const opts of [{ watermark: WATERMARK }, {}]) {
      const { board, raw } = mockBoard()
      exportBoard(board, 100, 125, 'png', opts)
      // Reset to identity for the snapshot, then put the view back as it was.
      expect(raw.setAttrs).toHaveBeenNthCalledWith(1, {
        x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0,
      })
      expect(raw.setAttrs).toHaveBeenNthCalledWith(2, {
        x: 3, y: 4, scaleX: 2, scaleY: 2, rotation: 0,
      })
    }
  })
})

describe('downloadDataURL', () => {
  let clickSpy: ReturnType<typeof vi.spyOn>
  let removeSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    removeSpy = vi.spyOn(HTMLAnchorElement.prototype, 'remove').mockImplementation(() => {})
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => document.createElement('a'))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates an anchor and triggers click with default filename', () => {
    const dataURL = 'data:image/png;base64,iVBORw0KGgo='
    downloadDataURL(dataURL, 'png')
    expect(clickSpy).toHaveBeenCalledOnce()
    expect(removeSpy).toHaveBeenCalledOnce()
  })

  it('uses provided filename', () => {
    const dataURL = 'data:image/png;base64,iVBORw0KGgo='
    downloadDataURL(dataURL, 'png', 'my-collage.png')
    expect(clickSpy).toHaveBeenCalledOnce()
  })

  it('uses correct extension for jpg', () => {
    const dataURL = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
    downloadDataURL(dataURL, 'jpg')
    expect(clickSpy).toHaveBeenCalledOnce()
  })

  it('uses correct extension for webp', () => {
    const dataURL = 'data:image/webp;base64,UklGRiQ='
    downloadDataURL(dataURL, 'webp')
    expect(clickSpy).toHaveBeenCalledOnce()
  })
})

describe('canShareImage', () => {
  it('returns false when navigator.share is missing', () => {
    vi.stubGlobal('navigator', { canShare: undefined, share: undefined })
    expect(canShareImage()).toBe(false)
    vi.unstubAllGlobals()
  })

  it('returns true when navigator.canShare and navigator.share exist', () => {
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: async () => {},
    })
    expect(canShareImage()).toBe(true)
    vi.unstubAllGlobals()
  })
})

describe('shareDataURL', () => {
  it('reports unsupported when sharing is missing entirely', async () => {
    vi.stubGlobal('navigator', { canShare: undefined, share: undefined })
    const result = await shareDataURL('data:image/png;base64,abc', 'png')
    expect(result).toBe('unsupported')
    vi.unstubAllGlobals()
  })

  it('reports unsupported when canShare rejects files', async () => {
    vi.stubGlobal('navigator', {
      canShare: () => false,
      share: async () => {},
    })
    const result = await shareDataURL('data:image/png;base64,abc', 'png')
    expect(result).toBe('unsupported')
    vi.unstubAllGlobals()
  })

  it('reports shared on success', async () => {
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: async () => {},
    })
    const result = await shareDataURL('data:image/png;base64,iVBORw0KGgo=', 'png')
    expect(result).toBe('shared')
    vi.unstubAllGlobals()
  })

  it('reports cancelled — not failure — when the user dismisses the sheet', async () => {
    // The distinction is the whole point: a cancel used to look like a failure,
    // so the caller "helpfully" downloaded the file the user had just declined
    // to share, which on iOS pops an "open in Preview" sheet.
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: async () => {
        throw new DOMException('Share canceled', 'AbortError')
      },
    })
    const result = await shareDataURL('data:image/png;base64,iVBORw0KGgo=', 'png')
    expect(result).toBe('cancelled')
    vi.unstubAllGlobals()
  })

  it('hands the target a correctly named and typed file', async () => {
    // The share path exports JPEG (smaller, and Android targets reject large
    // PNGs), so the file the target receives has to say so.
    let shared: { files?: File[] } | undefined
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: async (data: { files?: File[] }) => {
        shared = data
      },
    })
    await shareDataURL('data:image/jpeg;base64,/9j/4AAQ', 'jpg', 'My Collage')
    expect(shared?.files?.[0].name).toBe('collage.jpg')
    expect(shared?.files?.[0].type).toBe('image/jpeg')
    vi.unstubAllGlobals()
  })

  it('treats a non-Abort failure as unsupported, so the download fallback runs', async () => {
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: async () => {
        throw new Error('transport exploded')
      },
    })
    const result = await shareDataURL('data:image/png;base64,iVBORw0KGgo=', 'png')
    expect(result).toBe('unsupported')
    vi.unstubAllGlobals()
  })
})

describe('shareImages', () => {
  // Base64 has to be valid — atob throws otherwise, and the pages only need
  // to be distinguishable by position here, not by content.
  const jpg = (n: number) =>
    Array.from({ length: n }, () => 'data:image/jpeg;base64,/9j/4AAQ')

  it('hands the target every page, numbered', async () => {
    // The reported bug: a project with several pages shared only the one on
    // screen. Facebook and Instagram take a multi-image post; the app simply
    // never passed more than one file.
    let shared: { files?: File[] } | undefined
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: async (data: { files?: File[] }) => {
        shared = data
      },
    })
    const result = await shareImages(jpg(3), 'jpg')
    expect(result).toBe('shared')
    expect(shared?.files).toHaveLength(3)
    expect(shared?.files?.map((f) => f.name)).toEqual([
      'collage-1.jpg',
      'collage-2.jpg',
      'collage-3.jpg',
    ])
    vi.unstubAllGlobals()
  })

  it('leaves a single page named exactly as it always was', async () => {
    let shared: { files?: File[] } | undefined
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: async (data: { files?: File[] }) => {
        shared = data
      },
    })
    await shareImages(jpg(1), 'jpg')
    expect(shared?.files?.[0].name).toBe('collage.jpg')
    vi.unstubAllGlobals()
  })

  it('probes canShare with the whole set, not just the first file', async () => {
    // Targets do accept one file and reject several. Probing with one would
    // pass here and then throw at share() time.
    let probed = 0
    vi.stubGlobal('navigator', {
      canShare: (data: { files?: File[] }) => {
        probed = data.files?.length ?? 0
        return true
      },
      share: async () => {},
    })
    await shareImages(jpg(4), 'jpg')
    expect(probed).toBe(4)
    vi.unstubAllGlobals()
  })

  it('reports unsupported when the target refuses the set, so every page is saved instead', async () => {
    vi.stubGlobal('navigator', {
      canShare: (data: { files?: File[] }) => (data.files?.length ?? 0) < 2,
      share: async () => {},
    })
    expect(await shareImages(jpg(3), 'jpg')).toBe('unsupported')
    // The single-page case still goes through.
    expect(await shareImages(jpg(1), 'jpg')).toBe('shared')
    vi.unstubAllGlobals()
  })

  it('is unsupported with nothing to share rather than opening an empty sheet', async () => {
    vi.stubGlobal('navigator', { canShare: () => true, share: async () => {} })
    expect(await shareImages([], 'jpg')).toBe('unsupported')
    vi.unstubAllGlobals()
  })

  it('carries the caption and the app link in the shared text', async () => {
    let shared: { text?: string } | undefined
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: async (data: { text?: string }) => {
        shared = data
      },
    })
    await shareImages(jpg(1), 'jpg', 'My Collage', 'Made with Pic Collage Maker —')
    expect(shared?.text).toBe(`Made with Pic Collage Maker — ${appUrl()}`)
    vi.unstubAllGlobals()
  })

  it('shares the link even when the caller passes no caption', async () => {
    let shared: { text?: string } | undefined
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: async (data: { text?: string }) => {
        shared = data
      },
    })
    await shareImages(jpg(1), 'jpg')
    expect(shared?.text).toBe(appUrl())
    vi.unstubAllGlobals()
  })

  it('drops the text, not the picture, when a target refuses text with files', async () => {
    let shared: { text?: string; files?: File[] } | undefined
    vi.stubGlobal('navigator', {
      canShare: (data: { text?: string }) => !data.text,
      share: async (data: { text?: string; files?: File[] }) => {
        shared = data
      },
    })
    expect(await shareImages(jpg(2), 'jpg')).toBe('shared')
    expect(shared?.text).toBeUndefined()
    expect(shared?.files).toHaveLength(2)
    vi.unstubAllGlobals()
  })
})

describe('buildShareText', () => {
  it('is the bare link when there is no caption to lead with', () => {
    expect(buildShareText()).toBe(appUrl())
    expect(buildShareText('   ')).toBe(appUrl())
  })

  it('puts the caption first and the link last', () => {
    expect(buildShareText('Hello')).toBe(`Hello ${appUrl()}`)
  })

  it('falls back to the published URL rather than sharing a localhost address', () => {
    // jsdom serves the tests from localhost, which is exactly the case the
    // fallback exists for.
    expect(appUrl()).toBe('https://sashimee.github.io/Pic-Collage-Maker/')
  })
})

describe('shareFileName', () => {
  it('numbers only when there is more than one page', () => {
    expect(shareFileName('jpg')).toBe('collage.jpg')
    expect(shareFileName('png', 0, 1)).toBe('collage.png')
    expect(shareFileName('jpg', 0, 2)).toBe('collage-1.jpg')
    expect(shareFileName('jpg', 1, 2)).toBe('collage-2.jpg')
  })
})
