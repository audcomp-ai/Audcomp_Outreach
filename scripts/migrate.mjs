#!/usr/bin/env node
/**
 * migrate.mjs — Auto-run SQL migrations against Supabase
 *
 * Usage:
 *   node scripts/migrate.mjs schema.sql
 *   node scripts/migrate.mjs schema_scraper.sql
 *
 * Requires SUPABASE_MANAGEMENT_TOKEN in .env.local
 * Get one at: https://supabase.com/dashboard/account/tokens
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir  = dirname(fileURLToPath(import.meta.url))
const root   = resolve(__dir, '..')

// ── Load .env.local ───────────────────────────────────────────
function loadEnv() {
  const envPath = resolve(root, '.env.local')
  if (!existsSync(envPath)) return
  const lines = readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}
loadEnv()

const PROJECT_REF      = 'ilzetzqqeuasklfpbkzr'
const MANAGEMENT_TOKEN = process.env.SUPABASE_MANAGEMENT_TOKEN
const SERVICE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY

// ── Validate ──────────────────────────────────────────────────
const sqlFile = process.argv[2]
if (!sqlFile) {
  console.error('Usage: node scripts/migrate.mjs <file.sql>')
  process.exit(1)
}

const sqlPath = resolve(root, sqlFile)
if (!existsSync(sqlPath)) {
  console.error(`File not found: ${sqlPath}`)
  process.exit(1)
}

const sql = readFileSync(sqlPath, 'utf8').trim()
if (!sql) { console.error('SQL file is empty'); process.exit(1) }

// ── Run via Management API (needs SUPABASE_MANAGEMENT_TOKEN) ──
async function runViaMgmtApi(sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MANAGEMENT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  )
  const body = await res.json()
  if (!res.ok) throw new Error(JSON.stringify(body))
  return body
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log(`\nRunning migration: ${sqlFile}`)
  console.log(`SQL length: ${sql.length} chars\n`)

  if (!MANAGEMENT_TOKEN) {
    console.error('❌  SUPABASE_MANAGEMENT_TOKEN is not set in .env.local')
    console.error('')
    console.error('To fix:')
    console.error('  1. Go to https://supabase.com/dashboard/account/tokens')
    console.error('  2. Create a new token (e.g. "leads-dashboard-migration")')
    console.error('  3. Add it to .env.local:')
    console.error('     SUPABASE_MANAGEMENT_TOKEN=sbp_xxxxxxxxxxxxxxxx')
    console.error('')
    process.exit(1)
  }

  try {
    const result = await runViaMgmtApi(sql)
    console.log('✓ Migration succeeded')
    if (Array.isArray(result) && result.length > 0) {
      console.log('Result:', JSON.stringify(result, null, 2))
    }
  } catch (err) {
    console.error('✗ Migration failed:', err.message)
    process.exit(1)
  }
}

main()
