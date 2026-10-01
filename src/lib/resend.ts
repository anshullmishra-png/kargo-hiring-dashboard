export interface SendResult {
  id: string
  to: string
}

// Sends one plain-text email through Resend. If TEST_RECIPIENT is set, everything is redirected there.
export async function sendViaResend(opts: {
  to: string
  subject: string
  text: string
  idempotencyKey: string
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY is not set')
  const test = process.env.TEST_RECIPIENT?.trim()

  // Safety: this is a case-study system, so only allow sending to approved test recipients (default: the MESA test addresses).
  // An entry is either a whole domain ("pg27.mesaschool.co") or one exact address ("someone@gmail.com").
  // Nothing can reach anyone else unless the allowlist is deliberately changed.
  const allowed = (process.env.ALLOWED_RECIPIENT_DOMAINS ?? 'pg27.mesaschool.co')
    .split(',')
    .map(d => d.trim().toLowerCase())
    .filter(Boolean)
  const target = (test || opts.to).toLowerCase()
  const domain = target.split('@')[1] ?? ''
  if (allowed.length && !allowed.includes(domain) && !allowed.includes(target)) {
    throw new Error(`Blocked: ${target} is not on the approved recipient list (${allowed.join(', ')}). Nothing was sent.`)
  }
  const to = test || opts.to
  const subject = test ? `[TEST for ${opts.to}] ${opts.subject}` : opts.subject

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      'idempotency-key': opts.idempotencyKey,
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || 'Kargo Hiring <onboarding@resend.dev>',
      to: [to],
      subject,
      text: opts.text,
      ...(process.env.FOUNDER_EMAIL ? { reply_to: process.env.FOUNDER_EMAIL } : {}),
    }),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || !j.id) {
    const msg: string = j?.message || JSON.stringify(j).slice(0, 200)
    const hint = /own email|verify a domain|testing emails/i.test(msg)
      ? ' (Resend is in test mode: verify a sending domain in Resend, or set TEST_RECIPIENT to your own Resend account email.)'
      : ''
    throw new Error(`Resend ${res.status}: ${msg}${hint}`)
  }
  return { id: j.id as string, to }
}
