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

export default defineConfig({
  base: BASE,
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
        start_url: BASE,
        scope: BASE,
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
      },
    }),
  ],
})
