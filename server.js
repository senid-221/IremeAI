// Hostinger may load this entry directly instead of running npm start.
// Build the Vite frontend with the current Node executable, then start Express.
// Avoid top-level await because Hostinger's loader uses require() internally.
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { existsSync } from 'node:fs'

const root = process.cwd()
const viteCli = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')
const builtIndex = path.join(root, 'dist', 'index.html')

if (!existsSync(builtIndex)) {
  console.log('Ireme AI frontend is missing; running Vite production build...')
  if (!existsSync(viteCli)) {
    console.error('Cannot build Ireme AI frontend: Vite is not installed at', viteCli)
    process.exit(1)
  }

  const build = spawnSync(process.execPath, [viteCli, 'build'], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  })

  if (build.error) {
    console.error('Could not start Vite build:', build.error.message)
    process.exit(1)
  }
  if (build.status !== 0) {
    console.error('Vite frontend build failed; stopping startup so the cause is visible in Hostinger logs.')
    process.exit(build.status || 1)
  }
}

if (!existsSync(builtIndex)) {
  console.error('Vite reported success, but dist/index.html is still missing. Check Hostinger application root and output directory.')
  process.exit(1)
}

console.log('Ireme AI frontend build is ready.')
import('./server/index.js').catch((error) => {
  console.error('Failed to start Ireme AI server:', error)
  process.exitCode = 1
})
