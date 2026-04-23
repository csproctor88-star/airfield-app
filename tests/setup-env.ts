import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

// Load `.env.local` into `process.env` for env-gated tests
// (rls-smoke, permission-rpcs). Keeps tests skipping gracefully
// when the file isn't present (CI). Does not overwrite values
// that are already set.
const envPath = path.resolve(__dirname, '../.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    const [, k, rawV] = m
    if (process.env[k]) continue
    const v = rawV.replace(/^['"]|['"]$/g, '')
    process.env[k] = v
  }
}
