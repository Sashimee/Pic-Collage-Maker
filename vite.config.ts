import { execSync } from 'node:child_process'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Repo is served from https://<user>.github.io/Pic-Collage-Maker/
const BASE = '/Pic-Collage-Maker/'

// A per-deploy id: prefer the CI commit SHA, fall back to the local git HEAD,
// then a timestamp so `npm run build` still works outside of git (e.g. a
// tarball checkout). Baked into index.html and dist/version.json so the app
// can detect a new deployment even if the service worker never updates.
const BUILD_ID =
  process.env.GITHUB_SHA?.slice(0, 8) ??
  (() => {
    try {
      return execSync('git rev-parse --short HEAD').toString().trim()
    } catch {
      return Date.now().toString(36)
    }
  })()

// Stamps index.html with the build id and emits version.json next to it so
// runtime code can poll for a mismatch (see src/hooks/useVersionCheck.ts).
function buildVersionPlugin(): Plugin {
  return {
    name: 'build-version',
    transformIndexHtml(html) {
      return html.replace(
        '</head>',
        `    <meta name="app-build" content="${BUILD_ID}" />\n  </head>`,
      )
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ build: BUILD_ID }),
      })
    },
  }
}

// The analytics host in src/lib/analytics.ts; count.js comes from gc.zgo.at and
// reports with sendBeacon, falling back to an image.
const GOATCOUNTER = 'https://sashimee.goatcounter.com'

/**
 * The page's Content-Security-Policy, as a <meta> because GitHub Pages cannot send
 * headers. Scripts are held to this origin and count.js. Styles allow inline: the app
 * shell's <style> and the print-book sheet (src/lib/printBook.ts) are both inline,
 * and CSS cannot run code. blob:/data: are how photos, fonts and exports move around.
 *
 * The dev server needs inline scripts (React refresh) and a websocket (HMR); the rest
 * of the policy is the same, so the e2e suite still trips on anything new it lacks.
 */
function csp(dev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' https://gc.zgo.at${dev ? " 'unsafe-inline'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${GOATCOUNTER}`,
    `connect-src 'self' blob: data: ${GOATCOUNTER}${dev ? ' ws: wss:' : ''}`,
    "font-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ')
}

function securityHeadersPlugin(): Plugin {
  let dev = false
  return {
    name: 'security-headers',
    configResolved(config) {
      dev = config.command === 'serve'
    },
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: csp(dev) },
          injectTo: 'head-prepend',
        },
        { tag: 'meta', attrs: { name: 'referrer', content: 'strict-origin' }, injectTo: 'head' },
      ]
    },
  }
}

/**
 * piexif sniffs for a browser with `new Function`, which the policy above refuses
 * (no 'unsafe-eval') at import time, so the whole app failed to start. Rewritten in
 * the build and in dev pre-bundling; a piexif that changes the sniff fails the build
 * rather than quietly shipping the eval again.
 */
const PIEXIF_SNIFF = "new Function('try {return this===window;}catch(e){ return false;}')()"

function piexifWithoutEval(): Plugin {
  return {
    name: 'piexif-without-eval',
    transform(code, id) {
      if (!id.includes('/node_modules/piexif/')) return
      if (!code.includes(PIEXIF_SNIFF))
        this.error(`piexif no longer sniffs with ${PIEXIF_SNIFF}; update piexifWithoutEval`)
      return code.replace(PIEXIF_SNIFF, "typeof window !== 'undefined'")
    },
  }
}

export default defineConfig({
  base: BASE,
  optimizeDeps: { rolldownOptions: { plugins: [piexifWithoutEval()] } },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Deliberately no rule for konva/react-konva: they are reached only
          // through lazily loaded components, so letting the bundler emit them
          // as dynamic-only chunks keeps them off the critical path. Naming
          // them a manual chunk made that chunk the home for shared runtime
          // helpers, which pulled all ~317 kB of it into the initial load.
          if (id.includes('node_modules/react-konva') || id.includes('node_modules/konva')) return
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/zustand')) return 'vendor'
          if (id.includes('node_modules/lucide-react') || id.includes('node_modules/framer-motion')) return 'ui'
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    buildVersionPlugin(),
    securityHeadersPlugin(),
    piexifWithoutEval(),
    VitePWA({
      // 'autoUpdate' makes vite-plugin-pwa set workbox.skipWaiting +
      // clientsClaim to true (below, explicit for clarity). Without
      // clientsClaim the new worker never claims the *already open* tab, so
      // its 'controllerchange' never fires and the page never reloads — that
      // was the root cause of updates only landing after a manual refresh.
      registerType: 'autoUpdate',
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 50 * 1024 * 1024, // 50MB for WASM models
        globPatterns: ['**/*.{js,css,html,png,jpg,svg,ico,woff2}'],
        // The font pack is cached when a text first uses a family, not at install.
        // Likewise the install-dialog screenshots: only the browser's install UI fetches them.
        globIgnores: ['**/assets/pack-*.woff2', '**/screenshots/**'],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/pack-[^/]+\.woff2$/,
            handler: 'CacheFirst',
            options: { cacheName: 'font-pack', cacheableResponse: { statuses: [200] } },
          },
        ],
      },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'og-image.png'],
      manifest: {
        name: 'Pic Collage Maker',
        short_name: 'Collage Maker',
        description:
          'Create photo collages right in your browser. No account, nothing uploaded — everything stays on your device.',
        theme_color: '#131a2e',
        background_color: '#080b18',
        display: 'standalone',
        orientation: 'portrait',
        // The id browsers already derived from start_url, so existing installs stay the same app.
        id: BASE,
        start_url: BASE,
        scope: BASE,
        categories: ['photo', 'productivity'],
        // Every window keeps its own editor. Reusing a window would hand a launched file to an
        // editor that may have a project open, whose autosave would then write it over that project.
        launch_handler: { client_mode: 'navigate-new' },
        file_handlers: [
          {
            action: BASE,
            accept: {
              'application/x-piccollage': ['.piccollage'],
              'image/jpeg': ['.jpg', '.jpeg'],
              'image/png': ['.png'],
              'image/webp': ['.webp'],
              'image/gif': ['.gif'],
              'image/avif': ['.avif'],
              'image/heic': ['.heic'],
              'image/heif': ['.heif'],
            },
          },
        ],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        // Regenerate with `npm run generate:screenshots`.
        screenshots: [
          {
            src: 'screenshots/wide.jpg',
            sizes: '1280x800',
            type: 'image/jpeg',
            form_factor: 'wide',
            label: 'A four-photo grid collage in the desktop editor',
          },
          {
            src: 'screenshots/narrow.jpg',
            sizes: '824x1784',
            type: 'image/jpeg',
            form_factor: 'narrow',
            label: 'A four-photo grid collage in the phone editor',
          },
        ],
      },
    }),
  ],
})
