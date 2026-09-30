import { getDb, must } from './db'
import type { Criterion, RoleCode, ScoreRow, Settings } from './types'

export async function loadRubric(): Promise<Record<RoleCode, Criterion[]>> {
  const rows = must(
    await getDb().from('rubric_criteria').select('*').order('role_code').order('sort'),
    'load rubric',
  ) as Criterion[]
  const out: Record<RoleCode, Criterion[]> = { PM: [], SPM: [] }
  for (const r of rows) out[r.role_code].push(r)
  if (!out.PM.length || !out.SPM.length) throw new Error('Rubric is empty — run the database setup (npm run db:setup)')
  return out
}

export async function loadSettings(): Promise<Settings> {
  const rows = must(await getDb().from('settings').select('*'), 'load settings') as { key: string; value: string }[]
  const m = Object.fromEntries(rows.map(r => [r.key, r.value]))
  return {
    threshold: Number(m.threshold ?? 1),
    topN: Number(m.top_n ?? 5),
    scoringNotes: m.scoring_notes ?? '',
    patterns: m.patterns ?? '',
  }
}

// Weighted total on a 0–100 scale: each criterion is scored 0–10 and contributes weight% of the total.
export function weightedTotal(criteria: Criterion[], scores: Pick<ScoreRow, 'criterion_id' | 'score'>[]): number {
  const byId = new Map(scores.map(s => [s.criterion_id, s.score]))
  const total = criteria.reduce((sum, c) => sum + ((byId.get(c.id) ?? 0) / 10) * c.weight, 0)
  return Math.round(total * 10) / 10
}
