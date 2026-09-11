# 🎨 Pic Collage Maker

**▶️ Try it: <https://sashimee.github.io/Pic-Collage-Maker/>**

A photo collage maker & editor that runs **entirely in your browser** —
no account, no backend, nothing uploaded. Installable on iPhone and Android as a
PWA, deployed as static files to GitHub Pages.

## Testing it

Open the link on your phone — no install needed. To keep it around, use
**Share → Add to Home Screen** (iOS) or **⋮ → Install app** (Android); it then
works offline like a native app.

Your photos never leave the device: everything is decoded, edited and exported
in the browser, and projects are stored locally in IndexedDB. Clearing site data
deletes them, so export anything you want to keep.

The only thing sent anywhere is an anonymous, cookieless page count via
[GoatCounter](https://www.goatcounter.com) — a path, a country and a referrer,
with no identifiers and nothing that can be tied back to you, which is why
there's no cookie banner. It honours **Do Not Track** and **Global Privacy
Control**, so switching either on in your browser stops it making any request at
all. See [`src/lib/analytics.ts`](./src/lib/analytics.ts).

Found a bug or want something added?
[Open an issue](https://github.com/Sashimee/Pic-Collage-Maker/issues/new) — a
screenshot plus your browser and phone model is plenty to go on.

## Features

- 📷 Import multiple photos from gallery or camera
- 🧩 Preset collage grids **and draw-your-own custom layouts** — plus a free canvas
- ✋ Move, resize, rotate, reorder, duplicate, group, layer every element
- 🔤 Text (custom fonts, rich styling) · 😊 emoji stickers · 🔺 shapes & freehand draw
- 🎨 Backgrounds: solid, gradient, pattern or a full-board photo
- ✨ Filters (brightness, contrast, saturation, hue, temperature, tint, blur,
  vignette + presets) and artistic styles (oil, sketch, pop-art)
- 🪄 On-device photo tools: auto-enhance, background removal, portrait retouch,
  smart crop, caption suggestions — nothing leaves your device
- ↩️ Undo/redo · snapping guides · watermark & print marks · autosave & projects
- 💾 Export to PNG / JPG / SVG / PDF / ZIP and share via the Web Share API
- 🌍 Six languages (EN / DE / ES / FR / IT / PT), light & dark themes
- 🔒 No cookies, no accounts, no tracking of you — just an anonymous visit count
- 📱 Mobile-first touch UI with pinch-to-zoom — installable to the home screen

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build → dist/
npm run preview    # preview the production build
npm run test       # unit tests (vitest)
npm run lint       # type-check only

npm run generate:icons  # redraw the PWA PNG icons from scripts/generate-icons.mjs
npm run generate:og     # redraw public/og-image.png (the link preview card)
```

The icon and the social card are generated, not hand-edited: the mark lives in
`public/favicon.svg`, is mirrored by the rasteriser in
`scripts/generate-icons.mjs` and by `BrandMark` in `src/components/HeaderBar.tsx`
— change one, change all three.

## Deployment

Pushing to `main` builds and deploys to GitHub Pages automatically
(`.github/workflows/deploy.yml`). One-time setup: **Settings → Pages → Source →
GitHub Actions**. The app is served from the `/Pic-Collage-Maker/` subpath — see
`base` in `vite.config.ts`. The Open Graph tags in `index.html` hardcode the
absolute live URL (crawlers don't resolve relative paths), so a repo rename means
updating `base`, the meta tags and the links here together.

## Analytics

Anonymous usage counts live at <https://sashimee.goatcounter.com>. `npm run dev`
sessions are excluded (localhost is skipped), as are visitors with Do Not Track
or Global Privacy Control enabled. Beyond page views, five funnel events are
recorded so it's possible to tell whether people actually finish a collage:
`photo-added`, `layout-preset`, `layout-custom-applied`, `layout-split`,
`export-*` and `pwa-installed`.

## Tech

React 19 + Vite + TypeScript · react-konva (Konva.js) · Tailwind v4 · zustand ·
framer-motion · lucide · vite-plugin-pwa · pdf-lib / jszip (export). Structured so
[Capacitor](https://capacitorjs.com/) can be added later for native App Store /
Play Store builds.

See [`CLAUDE.md`](./CLAUDE.md) for architecture notes and the full roadmap.
