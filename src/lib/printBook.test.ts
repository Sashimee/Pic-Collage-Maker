import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BOOK_PAGE_SIZES, bookSizeById, type BookPage } from './photoBook'
import { printBook, printCss } from './printBook'

const a4 = bookSizeById('a4-portrait')
const page = (pageNumber: number | null) => ({ dataUrl: 'data:image/jpeg;base64,AAAA', pageNumber })

describe('printCss', () => {
  it.each(BOOK_PAGE_SIZES)('sets the sheet to $id in millimetres', (size) => {
    expect(printCss(size)).toContain(
      `@page { size: ${size.widthMm}mm ${size.heightMm}mm; margin: 0; }`,
    )
  })
})

describe('printBook', () => {
  const pending = () => [...document.querySelectorAll<HTMLImageElement>('#print-root img')]
  const settle = async (event: 'load' | 'error') => {
    await Promise.resolve()
    for (const img of pending()) img.dispatchEvent(new Event(event))
  }
  const print = async (pages: BookPage[]) => {
    const printing = printBook(pages, a4)
    await settle('load')
    await printing
  }

  beforeEach(() => {
    window.print = vi.fn()
  })

  afterEach(() => document.getElementById('print-root')?.remove())

  it('puts one sheet per page in the document, then opens the print dialog', async () => {
    await print([page(null), page(1), page(2)])
    const root = document.getElementById('print-root')!
    expect(root.querySelectorAll('.sheet img')).toHaveLength(3)
    expect([...root.querySelectorAll('.page-number')].map((n) => n.textContent)).toEqual(['1', '2'])
    expect(window.print).toHaveBeenCalledOnce()
  })

  it('waits for every page image to load before printing', async () => {
    const printing = printBook([page(null), page(1)], a4)
    await Promise.resolve()
    pending()[0].dispatchEvent(new Event('load'))
    await Promise.resolve()
    expect(window.print).not.toHaveBeenCalled()
    pending()[1].dispatchEvent(new Event('load'))
    await printing
    expect(window.print).toHaveBeenCalledOnce()
  })

  it('removes the pages once the dialog closes', async () => {
    await print([page(null)])
    window.dispatchEvent(new Event('afterprint'))
    expect(document.getElementById('print-root')).toBeNull()
  })

  it('replaces the pages of an earlier print that never fired afterprint', async () => {
    await print([page(null), page(1)])
    await print([page(null)])
    expect(document.querySelectorAll('#print-root')).toHaveLength(1)
    expect(document.querySelectorAll('#print-root .sheet')).toHaveLength(1)
  })

  it('does not print, and cleans up, when a page fails to load', async () => {
    const printing = printBook([page(null)], a4)
    await settle('error')
    await expect(printing).rejects.toThrow('failed to load')
    expect(window.print).not.toHaveBeenCalled()
    expect(document.getElementById('print-root')).toBeNull()
  })
})
