import { pageSizePt, type BookPage, type BookPageSize } from './photoBook'

const ROOT_ID = 'print-root'

/**
 * `@page` sets the sheet the print dialog defaults to; margin 0 because the
 * pages already carry their own margins from being contained onto the sheet.
 */
export function printCss(size: BookPageSize): string {
  const w = `${size.widthMm}mm`
  const h = `${size.heightMm}mm`
  const { heightPt } = pageSizePt(size)
  return `
@page { size: ${w} ${h}; margin: 0; }
@media screen { #${ROOT_ID} { display: none; } }
@media print {
  html, body {
    margin: 0; padding: 0; background: #fff;
    height: auto !important; overflow: visible !important;
  }
  body > :not(#${ROOT_ID}) { display: none !important; }
  #${ROOT_ID} .sheet {
    position: relative; width: ${w}; height: calc(${h} - 1px); overflow: hidden;
    display: flex; align-items: center; justify-content: center;
    break-after: page; page-break-after: always;
  }
  #${ROOT_ID} .sheet:last-child { break-after: auto; page-break-after: auto; }
  #${ROOT_ID} img { max-width: 100%; max-height: 100%; object-fit: contain; }
  #${ROOT_ID} .page-number {
    position: absolute; bottom: ${Math.max(6, heightPt * 0.02)}pt; left: 0; right: 0;
    text-align: center; color: #666; line-height: 1;
    font: ${Math.max(7, heightPt * 0.014)}pt Helvetica, Arial, sans-serif;
  }
}`
}

/**
 * Print the rendered pages through the browser's own dialog, one page per sheet.
 *
 * The pages go into the live document behind a print-only stylesheet rather
 * than into an iframe or a PDF tab: printing a frame is unreliable on iOS
 * Safari, and a PDF needs a viewer the device may not have.
 */
export async function printBook(pages: BookPage[], size: BookPageSize): Promise<void> {
  document.getElementById(ROOT_ID)?.remove()

  const root = document.createElement('div')
  root.id = ROOT_ID
  const style = document.createElement('style')
  style.textContent = printCss(size)
  root.append(style)

  const images = pages.map((page) => {
    const sheet = document.createElement('div')
    sheet.className = 'sheet'
    const img = document.createElement('img')
    img.src = page.dataUrl
    img.alt = ''
    sheet.append(img)
    if (page.pageNumber != null) {
      const number = document.createElement('div')
      number.className = 'page-number'
      number.textContent = String(page.pageNumber)
      sheet.append(number)
    }
    root.append(sheet)
    return img
  })
  document.body.append(root)

  // A page whose image has not loaded yet prints blank. Waiting on load rather
  // than decode(): decoding every 300 DPI page at once is ~35 MB each, which
  // is the crash on a phone that renderPages goes one page at a time to avoid.
  try {
    await Promise.all(images.map(loaded))
  } catch (err) {
    root.remove()
    throw err
  }

  // Safari returns from print() before the dialog closes, so cleanup waits for afterprint.
  window.addEventListener('afterprint', () => root.remove(), { once: true })
  window.print()
}

function loaded(img: HTMLImageElement): Promise<void> {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    img.addEventListener('load', () => resolve(), { once: true })
    const fail = () => reject(new Error('A book page failed to load for printing'))
    img.addEventListener('error', fail, { once: true })
  })
}
