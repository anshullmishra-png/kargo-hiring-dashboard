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
  if (!res.ok || !j.id) throw new Error(`Resend ${res.status}: ${j?.message || JSON.stringify(j).slice(0, 200)}`)
  return { id: j.id as string, to }
}
