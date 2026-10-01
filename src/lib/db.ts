import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _db: SupabaseClient | null = null

/**
 * Supabase occasionally rejects a request with "JWT issued at future": a brief clock disagreement between its
 * own servers when it turns the secret key into a short-lived token. The request is refused before it runs, so
 * retrying after a moment is safe (even for inserts) and fixes it. Any other response is returned untouched.
 */
export function withClockSkewRetry(base: typeof fetch, waitMs = 400): typeof fetch {
  return async (input, init) => {
    for (let attempt = 0; ; attempt++) {
      const res = await base(input, init)
      if (attempt >= 4 || (res.status !== 401 && res.status !== 403)) return res
      const text = await res.clone().text().catch(() => '')
      if (!/issued at future/i.test(text)) return res
      await new Promise(r => setTimeout(r, waitMs * (attempt + 1)))
    }
  }
}

// Server-only client using the service-role key. RLS has no policies, so this is the only way in.
export function getDb(): SupabaseClient {
  if (_db) return _db
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  _db = createClient(url, key, {
    auth: { persistSession: false },
    // Next.js caches fetch() by default; database reads must always be live.
    global: { fetch: withClockSkewRetry((input, init) => fetch(input, { ...init, cache: 'no-store' })) },
  })
  return _db
}

export function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data as T
}
