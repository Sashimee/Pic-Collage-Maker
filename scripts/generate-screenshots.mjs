// Captures the install-dialog screenshots listed in the web app manifest
// (vite.config.ts → manifest.screenshots): one wide for desktop, one narrow for
// phones. Build-time only — it starts the dev server and drives the Chromium
// that ships with @playwright/test, then writes public/screenshots/*.jpg.
//
// Run with: npm run generate:screenshots
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'public', 'screenshots')

const SHOTS = [
  { file: 'wide.jpg', viewport: { width: 1280, height: 800 }, scale: 1, mobile: false },
  { file: 'narrow.jpg', viewport: { width: 412, height: 892 }, scale: 2, mobile: true },
]

// Generated stand-ins for photos: bundling real ones would add megabytes to the
// repo for a picture nobody inspects closely.
const PALETTES = [
  ['#fbbf24', '#f97316', '#7c2d12'],
  ['#38bdf8', '#6366f1', '#1e1b4b'],
  ['#34d399', '#0ea5e9', '#064e3b'],
  ['#f472b6', '#a855f7', '#3b0764'],
]

async function photoFiles(page) {
  const files = await page.evaluate(async (palettes) => {
    const out = []
    for (const [i, [a, b, c]] of palettes.entries()) {
      const canvas = document.createElement('canvas')
      canvas.width = 1200
      canvas.height = 1200
      const ctx = canvas.getContext('2d')
      const sky = ctx.createLinearGradient(0, 0, 0, 1200)
      sky.addColorStop(0, a)
      sky.addColorStop(1, b)
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, 1200, 1200)
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.beginPath()
      ctx.arc(300 + i * 160, 340, 130, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.moveTo(0, 1200)
      ctx.lineTo(0, 820)
      ctx.lineTo(380, 560 + i * 30)
      ctx.lineTo(760, 800)
      ctx.lineTo(1200, 600 - i * 20)
      ctx.lineTo(1200, 1200)
      ctx.fill()
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.9))
      const bytes = new Uint8Array(await blob.arrayBuffer())
      let bin = ''
      for (const byte of bytes) bin += String.fromCharCode(byte)
      out.push(btoa(bin))
    }
    return out
  }, PALETTES)
  return files.map((b64, i) => ({
    name: `photo-${i + 1}.jpg`,
    mimeType: 'image/jpeg',
    buffer: Buffer.from(b64, 'base64'),
  }))
}

const server = await createServer({ root: ROOT, server: { port: 5181, strictPort: true } })
await server.listen()
const url = `http://localhost:5181${server.config.base}`
const browser = await chromium.launch()
try {
  for (const shot of SHOTS) {
    const page = await browser.newPage({
      viewport: shot.viewport,
      deviceScaleFactor: shot.scale,
      isMobile: shot.mobile,
      hasTouch: shot.mobile,
      colorScheme: 'dark',
    })
    await page.addInitScript(() => {
      localStorage.setItem(
        'pic-collage-tips-v1',
        JSON.stringify(
          Object.fromEntries(
            ['welcome', 'pinch', 'draw', 'layout', 'layers', 'cellZoom'].map((id) => [id, 1]),
          ),
        ),
      )
      localStorage.setItem('lang', 'en')
    })
    await page.goto(url)
    await page.waitForFunction(() => !!window.__editor)
    await page.locator('#empty-gallery-input').setInputFiles(await photoFiles(page))
    await page.waitForFunction(
      () => window.__editor.getState().elements.filter((e) => e.type === 'photo').length >= 4,
    )
    await page.evaluate(() => {
      const editor = window.__editor.getState()
      editor.setMode('grid')
      editor.setGrid('4-grid')
      editor.select(null)
    })
    await page.waitForTimeout(1500)
    await page.screenshot({ path: resolve(OUT, shot.file), type: 'jpeg', quality: 82 })
    await page.close()
  }
} finally {
  await browser.close()
  await server.close()
}
