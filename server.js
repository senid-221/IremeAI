// Hostinger can start this file directly without running npm start.
// Build the frontend here only when the install/build step did not create it.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const indexFile = path.join(root, 'dist', 'index.html')
const viteCli = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')

if (!existsSync(indexFile)) {
  console.log('Ireme AI: dist/index.html is missing; attempting production build.')

  if (!existsSync(viteCli)) {
    console.error('Ireme AI startup blocked: Vite is missing. Ensure Hostinger installs dependencies and runs npm install.')
    process.exit(1)
  }

  const result = spawnSync(process.execPath, [viteCli, 'build'], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  })

  if (result.error) {
    console.error('Ireme AI frontend build could not start:', result.error.message)
    process.exit(1)
  }

  if (result.status !== 0) {
    console.error('Ireme AI frontend build failed. Fix the build error above before restarting.')
    process.exit(typeof result.status === 'number' ? result.status : 1)
  }
}

if (!existsSync(indexFile)) {
  console.error('Ireme AI startup blocked: dist/index.html was not created by the build.')
  process.exit(1)
}

console.log('Ireme AI: frontend files are ready.')
import('./server/index.js').catch((error) => {
  console.error('Ireme AI server failed to load:', error)
  process.exitCode = 1
})
