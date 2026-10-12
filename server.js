// Hostinger's Node.js loader requires this entry file synchronously.
// Some Hostinger Express deployments skip the configured build command, so
// build the Vite frontend here before loading Express. Avoid top-level await.
import { spawnSync } from 'node:child_process'

console.log('Building Ireme AI frontend...')
const build = spawnSync('npm', ['run', 'build'], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
})

if (build.error) {
  console.error('Frontend build could not start:', build.error)
} else if (build.status !== 0) {
  console.error('Frontend build failed with status:', build.status)
} else {
  console.log('Frontend build completed.')
}

import('./server/index.js').catch((error) => {
  console.error('Failed to start Ireme AI server:', error)
  process.exitCode = 1
})
