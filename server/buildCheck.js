import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

// Directories to skip — not source files, shouldn't trigger stale detection
const SKIP_DIRS = new Set(['node_modules', 'dist', 'local_data', '.git'])

function newestMtime(dir) {
  let newest = 0
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        newest = Math.max(newest, newestMtime(full))
      } else {
        // Skip log files and non-source files
        if (entry.name.endsWith('.log')) continue
        newest = Math.max(newest, fs.statSync(full).mtimeMs)
      }
    }
  } catch {
    /* directory doesn't exist */
  }
  return newest
}

let _stale = false

try {
  const markerPath = path.join(ROOT, '.last-build')
  const buildTime = parseInt(fs.readFileSync(markerPath, 'utf8'), 10)
  const srcTime = Math.max(
    newestMtime(path.join(ROOT, 'src')),
    newestMtime(path.join(ROOT, 'server'))
  )
  _stale = srcTime > buildTime
  if (_stale) {
    console.warn(
      '⚠ Build is stale — source files changed since last build. Run: npm run restart:pm2'
    )
  }
} catch {
  _stale = false
}

export const buildStale = _stale
