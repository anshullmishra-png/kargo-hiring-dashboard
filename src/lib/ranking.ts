// Who gets an interview invite and a brief: the top N per role (ranked on the score for the role they
// applied for), provided their score reaches the minimum. Everyone else gets a warm rejection draft.
import { appliedScore } from './types'
import type { Candidate, RoleCode, Settings } from './types'

/** Ready candidates of one role, best first (ties: earlier upload first). */
export function rankRole(all: Candidate[], role: RoleCode): Candidate[] {
  return all
    .filter(c => c.status === 'ready' && c.applied_role === role)
    .sort((a, b) => (appliedScore(b) ?? 0) - (appliedScore(a) ?? 0) || a.created_at.localeCompare(b.created_at))
}

export function isInvited(rankIndex: number, score: number, s: Pick<Settings, 'topN' | 'threshold'>): boolean {
  return rankIndex < s.topN && score >= s.threshold
}

/** Ids of every candidate (both roles) who should receive an invite. */
export function inviteIds(all: Candidate[], s: Pick<Settings, 'topN' | 'threshold'>): Set<string> {
  const ids = new Set<string>()
  for (const role of ['PM', 'SPM'] as RoleCode[]) {
    rankRole(all, role).forEach((c, i) => {
      if (isInvited(i, appliedScore(c) ?? 0, s)) ids.add(c.id)
    })
  }
  return ids
}

/** Score to draw as "the line" on charts for one ranked role: the lowest score that still gets an invite. */
export function lineScore(ranked: Candidate[], s: Pick<Settings, 'topN' | 'threshold'>): number {
  const invited = ranked.filter((c, i) => isInvited(i, appliedScore(c) ?? 0, s))
  if (!invited.length) return Math.max(s.threshold, ranked.length ? (appliedScore(ranked[0]) ?? 0) + 1 : s.threshold)
  return Math.min(...invited.map(c => appliedScore(c) ?? 0))
}
