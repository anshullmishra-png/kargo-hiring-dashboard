import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _db: SupabaseClient | null = null

// Server-only client using the service-role key. RLS has no policies, so this is the only way in.
export function getDb(): SupabaseClient {
  if (_db) return _db
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  _db = createClient(url, key, {
    auth: { persistSession: false },
    // Next.js caches fetch() by default; database reads must always be live.
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  })
  return _db
}

export function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data as T
}
