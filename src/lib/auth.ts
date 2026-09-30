// Single shared-password gate. The cookie holds SHA-256(password), so the password itself is never stored client-side.
export const COOKIE = 'hd_auth'

export async function tokenFor(password: string): Promise<string> {
  const data = new TextEncoder().encode(`kargo-hiring-dashboard:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
