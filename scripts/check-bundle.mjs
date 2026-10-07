#!/usr/bin/env node
// Fails when the eager JS (what index.html loads before first paint) outgrows
// its budget, or when a module that is meant to load on demand ends up in it.
//
// Needs a build with hidden sourcemaps — the maps are how we see which modules
// went into each chunk:
//   npm run build -- --sourcemap hidden && npm run check:bundle
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

// Eager JS at roadmap item 0.7 (2026-10-07) was 208.5 kB gzip; budget is +5 %.
// Raise it deliberately, in its own commit, when an eager addition is worth it.
const BUDGET_GZIP_KB = 218.9

const MUST_BE_LAZY = [
  { name: 'pdf-lib', test: /node_modules\/(@pdf-lib|pdf-lib)\// },
  { name: 'jszip', test: /node_modules\/jszip\// },
  { name: 'AI tools (src/ai/)', test: /(^|\/)src\/ai\// },
]

const dist = process.argv[2] ?? 'dist'
const html = readFileSync(join(dist, 'index.html'), 'utf8')
const base = html.match(/<script[^>]+src="([^"]*?)assets\//)?.[1]
if (base === undefined) {
  console.error(`check-bundle: no entry <script> under assets/ in ${dist}/index.html — run a build first.`)
  process.exit(1)
}

const eager = [
  ...html.matchAll(/<script[^>]+type="module"[^>]+src="[^"]*?(assets\/[^"]+\.js)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="[^"]*?(assets\/[^"]+\.js)"/g),
].map((m) => m[1])

let failed = false
let totalGzip = 0
const rows = []

for (const file of eager) {
  const code = readFileSync(join(dist, file))
  const gz = gzipSync(code).length
  totalGzip += gz
  rows.push(`  ${file.padEnd(44)} ${(code.length / 1024).toFixed(1).padStart(7)} kB  ${(gz / 1024).toFixed(1).padStart(6)} kB gzip`)

  // The bundler's own runtime helpers are generated code with no sources or map.
  if (/^assets\/(rolldown-runtime|preload-helper)-/.test(file)) continue
  const mapPath = join(dist, `${file}.map`)
  if (!existsSync(mapPath)) {
    console.error(`check-bundle: ${mapPath} is missing — build with \`npm run build -- --sourcemap hidden\`.`)
    process.exit(1)
  }
  const { sources } = JSON.parse(readFileSync(mapPath, 'utf8'))
  for (const rule of MUST_BE_LAZY) {
    const hits = sources.filter((s) => rule.test.test(s))
    if (hits.length) {
      failed = true
      console.error(`✗ ${rule.name} is in the eager chunk ${file}:\n    ${hits.join('\n    ')}`)
    }
  }
}

const totalKb = totalGzip / 1024
console.log(`Eager JS (${eager.length} files):\n${rows.join('\n')}`)
console.log(`Total ${totalKb.toFixed(1)} kB gzip / budget ${BUDGET_GZIP_KB} kB`)

if (totalKb > BUDGET_GZIP_KB) {
  failed = true
  console.error(
    `✗ Eager JS is over budget by ${(totalKb - BUDGET_GZIP_KB).toFixed(1)} kB gzip. ` +
      'Lazy-load the new code (dynamic import) or, if it must be eager, raise BUDGET_GZIP_KB in its own commit.',
  )
}

// Font-pack files load on first use; the service worker must not precache them.
const packFonts = readdirSync(join(dist, 'assets')).filter((f) => /^pack-.+\.woff2$/.test(f))
if (!packFonts.length) {
  failed = true
  console.error('✗ No font-pack files (assets/pack-*.woff2) in the build — were they inlined or renamed?')
}
const swPath = join(dist, 'sw.js')
if (!existsSync(swPath)) {
  failed = true
  console.error(`✗ ${swPath} is missing — the PWA build did not run.`)
} else {
  const sw = readFileSync(swPath, 'utf8')
  const precached = packFonts.filter((f) => sw.includes(`assets/${f}`))
  if (precached.length) {
    failed = true
    console.error(`✗ Font-pack files are in the service-worker precache:\n    ${precached.join('\n    ')}`)
  } else {
    console.log(`Font pack: ${packFonts.length} files, none precached`)
  }
}

process.exit(failed ? 1 : 0)
