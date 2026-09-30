// Duplicate detection. Two candidates are linked when:
//   1. their CV text is identical once whitespace/punctuation/case are ignored (same file, or re-saved copy), or
//   2. they have the same name AND the same email address (probably an updated CV from the same person).
// Names/emails alone are not used for (1) because personal details are stripped from the CV text before comparing.
import { createHash } from 'node:crypto'

export function normHash(cvText: string): string {
  const norm = cvText.toLowerCase().replace(/\[candidate\]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
  return createHash('sha256').update(norm).digest('hex')
}

export interface DupeInput {
  id: string
  cv_text: string
  name: string | null
  email: string | null
}

export interface DupeGroup {
  // identical: same CV text and same name. same-text: same CV text under DIFFERENT names (copied CV or reused template).
  // same-person: same name + email but the CV text differs (updated CV).
  reason: 'identical' | 'same-text' | 'same-person'
  ids: string[]
}

const clean = (s: string | null) => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()

export const cleanName = (s: string | null) => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()

export function findDuplicateGroups(rows: DupeInput[]): DupeGroup[] {
  const parent = new Map(rows.map(r => [r.id, r.id]))
  const find = (x: string): string => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)!)!)
      x = parent.get(x)!
    }
    return x
  }
  const union = (a: string, b: string) => parent.set(find(a), find(b))

  const byHash = new Map<string, string>()
  const byPerson = new Map<string, string>()
  const identicalPairs = new Set<string>()
  const nameOf = new Map(rows.map(r => [r.id, r.name]))

  for (const r of rows) {
    const h = normHash(r.cv_text)
    const seenH = byHash.get(h)
    if (seenH) {
      union(r.id, seenH)
      identicalPairs.add(r.id)
      identicalPairs.add(seenH)
    } else byHash.set(h, r.id)

    const name = clean(r.name)
    const email = clean(r.email)
    if (name && email) {
      const key = `${name}|${email}`
      const seenP = byPerson.get(key)
      if (seenP) union(r.id, seenP)
      else byPerson.set(key, r.id)
    }
  }

  const groups = new Map<string, string[]>()
  for (const r of rows) {
    const root = find(r.id)
    groups.set(root, [...(groups.get(root) ?? []), r.id])
  }
  return [...groups.values()]
    .filter(ids => ids.length > 1)
    .map(ids => {
      const hasSameText = ids.some(i => identicalPairs.has(i))
      const names = new Set(ids.map(i => cleanName(nameOf.get(i) ?? null)))
      const reason: DupeGroup['reason'] = !hasSameText ? 'same-person' : names.size > 1 ? 'same-text' : 'identical'
      return { ids, reason }
    })
}
