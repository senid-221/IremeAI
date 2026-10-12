// Hostinger may launch this file directly without running the package start script.
// Build the Vite frontend at startup so dist/index.html exists in the deployed version.
import { spawnSync } from 'node:child_process'

const build = spawnSync('npm', ['run', 'build'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: process.env,
})

if (build.error) {
  console.error('Could not start the frontend build:', build.error.message)
} else if (build.status !== 0) {
  console.error('Frontend build failed with exit code:', build.status)
} else {
  console.log('Frontend build completed before server startup.')
}

await import('./server/index.js')
