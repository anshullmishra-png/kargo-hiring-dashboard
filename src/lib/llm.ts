// Minimal provider-agnostic JSON completion. Uses Gemini if GEMINI_API_KEY is set, else Anthropic.

type Provider = 'gemini' | 'anthropic'

function provider(): Provider {
  const forced = process.env.LLM_PROVIDER
  if (forced === 'gemini' || forced === 'anthropic') return forced
  if (process.env.GEMINI_API_KEY) return 'gemini'
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic'
  throw new Error('No AI key configured — set GEMINI_API_KEY or ANTHROPIC_API_KEY')
}

const GEMINI_PRIMARY = 'gemini-3.5-flash'
const GEMINI_FALLBACK = 'gemini-3.1-flash-lite' // used when the primary is overloaded (503)

async function callGemini(system: string, user: string, attempt: number): Promise<string> {
  const primary = process.env.LLM_MODEL || GEMINI_PRIMARY
  const model = attempt >= 2 ? GEMINI_FALLBACK : primary
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          maxOutputTokens: 8192,
          // Gemini 3 "thinks" for minutes by default; scoring against a written rubric doesn't need it.
          ...(model.includes('gemini-3') ? { thinkingConfig: { thinkingLevel: 'minimal' } } : {}),
        },
      }),
    },
  )
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const j = await res.json()
  const text = j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('')
  if (!text) throw new Error('Gemini returned no text')
  return text
}

async function callAnthropic(system: string, user: string): Promise<string> {
  const model = process.env.LLM_MODEL || 'claude-sonnet-5-5'
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature: 0.2,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const j = await res.json()
  const text = j?.content?.map((b: { text?: string }) => b.text ?? '').join('')
  if (!text) throw new Error('Anthropic returned no text')
  return text
}

function parseJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('No JSON object in model output')
  return JSON.parse(text.slice(start, end + 1))
}

// Calls the model and validates the result; retries once on transport errors or invalid output.
export async function llmJson<T>(system: string, user: string, validate: (raw: unknown) => T): Promise<T> {
  const p = provider()
  let lastErr: unknown
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const text = p === 'gemini' ? await callGemini(system, user, attempt) : await callAnthropic(system, user)
      return validate(parseJson(text))
    } catch (e) {
      lastErr = e
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1))) // brief backoff between tries
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}
