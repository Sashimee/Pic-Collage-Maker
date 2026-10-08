#!/usr/bin/env node
// Writes THIRD-PARTY-NOTICES.txt into the build: the licence of every npm package
// the app ships and of the bundled fonts. Runs as `postbuild`, after every `npm run build`.
//
// Packages come from package-lock.json's production tree, not from what the bundler
// kept: a notice for a module that was tree-shaken away costs nothing, a missing one
// for a module that shipped is the thing to avoid. The service worker's Workbox is a
// devDependency of vite-plugin-pwa yet ships, so its modules are read off the runtime
// chunk, which tags each one as `workbox:<module>:<version>`.
//   node scripts/generate-notices.mjs [outDir=dist]
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const outDir = process.argv[2] ?? 'dist'
const RULE = '-'.repeat(78)

// Not in any font file's metadata the build keeps; from the Poppins OFL.txt.
const POPPINS = 'Copyright 2020 The Poppins Project Authors (https://github.com/itfoundry/Poppins)'

function licenseFile(dir) {
  const name = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.[a-z]+)?$/i.test(f))
  return name && readFileSync(join(dir, name), 'utf8').trim()
}

function workboxDirs() {
  const runtime = readdirSync(outDir).filter((f) => /^workbox-.*\.js$/.test(f))
  if (runtime.length === 0) {
    console.error(`generate-notices: no workbox-*.js in ${outDir}; run it after \`vite build\`.`)
    process.exit(1)
  }
  const modules = new Set(
    runtime.flatMap((f) =>
      [...readFileSync(join(outDir, f), 'utf8').matchAll(/workbox:([a-z-]+):/g)].map((m) => m[1]),
    ),
  )
  return [...modules].map((m) => join(root, 'node_modules', `workbox-${m}`))
}

function shippedPackages() {
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'))
  const production = Object.entries(lock.packages)
    .filter(([path, meta]) => path.startsWith('node_modules/') && !meta.dev && !meta.devOptional)
    .map(([path]) => join(root, path))
  return (
    [...production, ...workboxDirs()]
      // Optional platform builds for other systems are in the lockfile but not on disk.
      .filter((dir) => existsSync(join(dir, 'package.json')))
      .map((dir) => {
        const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
        const license = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type
        if (!license) {
          console.error(
            `generate-notices: ${pkg.name} declares no licence; check it before shipping it.`,
          )
          process.exit(1)
        }
        return { name: pkg.name, version: pkg.version, license, text: licenseFile(dir) }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  )
}

const packages = shippedPackages()
const fonts = readFileSync(join(root, 'src/assets/fonts/pack/OFL.txt'), 'utf8').trim()

const sections = [
  'Third-party software and fonts included in Pic Collage Maker.',
  [
    'Fonts',
    '',
    'poppins-400/600/700.woff2 (src/assets/fonts):',
    `${POPPINS}, licensed under the SIL Open Font License, Version 1.1 (text below).`,
    '',
    fonts,
  ].join('\n'),
  ...packages.map(({ name, version, license, text }) =>
    [
      `${name}@${version}`,
      `License: ${license}`,
      '',
      text ?? '(the package ships no licence file)',
    ].join('\n'),
  ),
]

writeFileSync(join(outDir, 'THIRD-PARTY-NOTICES.txt'), `${sections.join(`\n\n${RULE}\n\n`)}\n`)
console.log(
  `generate-notices: ${packages.length} packages + fonts → ${join(outDir, 'THIRD-PARTY-NOTICES.txt')}`,
)
