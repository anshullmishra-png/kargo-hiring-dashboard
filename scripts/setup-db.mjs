// Creates the tables and loads the rubric + JDs into Supabase.
// Usage: put DATABASE_URL in .env.local (Supabase → Project Settings → Database → Connection string → URI), then: npm run db:setup
// No DATABASE_URL? Paste supabase/schema.sql and then supabase/seed.sql into the Supabase SQL editor instead.
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..')

function loadEnv(file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadEnv(path.join(root, '.env.local'))

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Add it to .env.local, or paste supabase/schema.sql then supabase/seed.sql into the Supabase SQL editor.')
  process.exit(1)
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  for (const f of ['schema.sql', 'seed.sql']) {
    await client.query(fs.readFileSync(path.join(root, 'supabase', f), 'utf8'))
    console.log('applied', f)
  }
  const { rows } = await client.query(
    "select role_code, count(*) as criteria, sum(weight) as total_weight from rubric_criteria group by role_code order by role_code",
  )
  console.table(rows)
} finally {
  await client.end()
}
