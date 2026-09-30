// Separates personal details (name, email, phone, profile links) from a CV.
// Deterministic code only — no AI is involved, and the redacted text is the ONLY thing later steps see.

export interface Pii {
  name: string | null
  email: string | null
  phone: string | null
}

const NOT_NAME_WORDS = new Set([
  'resume', 'curriculum', 'vitae', 'cv', 'profile', 'summary', 'objective', 'contact', 'experience',
  'education', 'skills', 'product', 'manager', 'senior', 'associate', 'lead', 'head', 'director',
  'engineer', 'analyst', 'consultant', 'operations', 'strategy', 'leader', 'professional', 'final',
  'updated', 'new', 'copy', 'page', 'mumbai', 'delhi', 'bangalore', 'bengaluru', 'pune', 'india',
  'linkedin', 'email', 'phone', 'mobile', 'address', 'work', 'projects', 'certifications', 'core',
  'competencies', 'key', 'and', 'of', 'the', 'university', 'institute', 'college', 'school', 'technological',
  'technology', 'engineering', 'science', 'business', 'management', 'technical', 'career', 'personal', 'details',
])

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const PHONE_RUN_RE = /\+?\(?\d[\d\s().-]{8,}\d/g
const URL_RES = [
  /(?:https?:\/\/|www\.)\S+/gi,
  /\b(?:[a-z]{2,3}\.)?(?:linkedin|github|gitlab|twitter|x|behance|medium|dribbble|notion)\.(?:com|so|site)\/\S*/gi,
]

const isYearGroup = (g: string) => /^(19|20)\d{2}$/.test(g)

function digitsOf(s: string) {
  return s.replace(/\D/g, '')
}

// A run of digits/separators is a phone number if it has 10+ digits and is not just a chain of years.
function isPhoneRun(run: string) {
  const groups = run.split(/[^\d]+/).filter(Boolean)
  if (groups.length && groups.every(isYearGroup)) return false
  return digitsOf(run).length >= 10
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase())
}

function looksLikeNameWord(w: string) {
  return /^[A-Z][a-z'.-]+$/.test(w) || /^[A-Z]{2,}$/.test(w) || /^[A-Z]\.?$/.test(w)
}

function nameFromLines(text: string): string | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 8)
  for (const line of lines) {
    const words = line.split(/\s+/)
    if (words.length < 2 || words.length > 4) continue
    if (!words.every(looksLikeNameWord)) continue
    if (words.some(w => NOT_NAME_WORDS.has(w.toLowerCase().replace(/[^a-z]/g, '')))) continue
    // Two-letter all-caps "words" are usually PDF artefacts, not name parts.
    if (words.some(w => /^[A-Z]{2}$/.test(w))) continue
    return words.map(w => (/^[A-Z]{2,}$/.test(w) ? titleCase(w) : w)).join(' ')
  }
  return null
}

function nameFromFilename(filename: string): string | null {
  const base = filename.replace(/\.[a-z0-9]+$/i, '')
  const cleaned = base.replace(/^(?:(?:pm|spm)_)?\d+[_\s-]+/i, '').replace(/[_-]+/g, ' ').trim()
  const words = cleaned.split(/\s+/).filter(w => /^[A-Za-z][A-Za-z'.]+$/.test(w))
  if (words.length < 2 || words.length > 4) return null
  if (words.some(w => NOT_NAME_WORDS.has(w.toLowerCase()))) return null
  return words.map(titleCase).join(' ')
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function separatePii(rawText: string, filename: string): { pii: Pii; redacted: string } {
  let text = rawText.replace(/\r/g, '').replace(/ /g, ' ')

  // Overlapping PDF text can glue a scrambled name in front of the address ("REDDYsquad_5@…") — drop a leading ALL-CAPS run.
  const emailRaw = (text.match(EMAIL_RE) || [])[0] || null
  const email = emailRaw ? emailRaw.replace(/^[A-Z]{3,}(?=[a-z])/, '') : null
  const runs = (text.match(PHONE_RUN_RE) || []).filter(isPhoneRun)
  const phoneRaw = runs[0]?.trim() || null
  // Garbled/overlapping digit runs are not stored as a phone number — the founder can fill it in.
  const phone = phoneRaw && digitsOf(phoneRaw).length <= 13 ? phoneRaw : null

  // Two independent sources for the name: the top lines of the CV and the file name. If they agree the file
  // name is in the text, trust it; and redact BOTH candidates so a wrong guess can never leave the real name in.
  const lineName = nameFromLines(text)
  const fileName = nameFromFilename(filename)
  const fileNameInText = !!fileName && fileName.split(/\s+/).every(t => new RegExp(`\\b${escapeRe(t)}\\b`, 'i').test(text))
  const name = fileNameInText ? fileName : lineName || fileName
  const redactNames = [...new Set([name, lineName, fileName].filter((n): n is string => !!n))]

  // ── redact ──
  text = text.replace(EMAIL_RE, ' ')
  for (const r of URL_RES) text = text.replace(r, ' ')
  text = text.replace(PHONE_RUN_RE, m => (isPhoneRun(m) ? ' ' : m))

  // Garbled tokens from overlapping PDF text (e.g. "ROohHaAnNMMehEtHa") are often a scrambled name — drop them.
  text = text.replace(/\b[A-Za-z]{8,}\b/g, w => ((w.match(/[a-z][A-Z]/g) || []).length >= 3 ? ' ' : w))

  for (const n of redactNames) {
    const full = n.split(/\s+/).map(escapeRe).join('\\s+')
    text = text.replace(new RegExp(`\\b${full}\\b`, 'gi'), '[CANDIDATE]')
  }
  for (const tok of redactNames.flatMap(n => n.split(/\s+/))) {
    if (tok.replace(/[^A-Za-z]/g, '').length >= 3 && !NOT_NAME_WORDS.has(tok.toLowerCase())) {
      text = text.replace(new RegExp(`\\b${escapeRe(tok)}\\b`, 'gi'), '[CANDIDATE]')
    }
  }

  const redacted = text
    .split('\n')
    .map(l => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { pii: { name, email, phone }, redacted }
}

// Fail-closed check: throws if anything that looks like personal data survived redaction.
export function assertClean(redacted: string, pii: Pii) {
  const problems: string[] = []
  if ((redacted.match(EMAIL_RE) || []).length) problems.push('email')
  if ((redacted.match(PHONE_RUN_RE) || []).some(isPhoneRun)) problems.push('phone')
  if (pii.email && redacted.toLowerCase().includes(pii.email.toLowerCase())) problems.push('email')
  if (pii.name) {
    for (const tok of pii.name.split(/\s+/)) {
      if (tok.replace(/[^A-Za-z]/g, '').length >= 3 && new RegExp(`\\b${escapeRe(tok)}\\b`, 'i').test(redacted)) {
        problems.push('name')
        break
      }
    }
  }
  if (problems.length) throw new Error(`Redaction failed (${[...new Set(problems)].join(', ')}) — nothing was sent to AI`)
}

export function firstNameOf(name: string | null) {
  return name ? name.trim().split(/\s+/)[0] : ''
}
