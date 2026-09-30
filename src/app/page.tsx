import Link from 'next/link'
import { getDb, must } from '@/lib/db'
import { loadSettings } from '@/lib/rubric'
import SettingsBar from '@/components/SettingsBar'
import Shell from '@/components/Shell'
import { appliedScore, roleTitle } from '@/lib/types'
import type { Candidate, CandidatePii, RoleCode } from '@/lib/types'

export const dynamic = 'force-dynamic'

const otherScore = (c: Candidate) => (c.applied_role === 'PM' ? c.score_spm : c.score_pm)

export default async function Dashboard() {
  const db = getDb()
  const [settings, cands, pii] = await Promise.all([
    loadSettings(),
    db.from('candidates').select('*').then(r => must(r, 'load candidates') as Candidate[]),
    db.from('candidate_pii').select('candidate_id,name').then(r => must(r, 'load names') as Pick<CandidatePii, 'candidate_id' | 'name'>[]),
  ])
  const names = new Map(pii.map(p => [p.candidate_id, p.name]))
  const ready = cands.filter(c => c.status === 'ready')
  const attention = cands.filter(c => c.status !== 'ready')
  const toSend = ready.filter(c => c.email_status === 'draft' && c.email_body).length
  const sent = ready.filter(c => c.email_status === 'sent').length

  return (
    <Shell
      eyebrow="Kargo · Hiring"
      title="Candidates, ranked."
      sub="Scored against the rubric, briefed, and drafted. Nothing goes out until you press send."
      pill={
        <>
          <span className="text-terra">●</span> {ready.length} scored · {toSend} emails waiting · {sent} sent
        </>
      }
    >
    <div className="space-y-8">

      <SettingsBar threshold={settings.threshold} topN={settings.topN} />

      {cands.length === 0 && (
        <div className="card text-sm text-inkmut">
          No candidates yet. <Link className="text-terradk underline" href="/upload">Upload CVs</Link> to get started.
        </div>
      )}

      {(['PM', 'SPM'] as RoleCode[]).map(role => {
        const list = ready
          .filter(c => c.applied_role === role)
          .sort((a, b) => (appliedScore(b) ?? 0) - (appliedScore(a) ?? 0))
        if (!list.length) return null
        const firstBelow = list.findIndex(c => (appliedScore(c) ?? 0) < settings.threshold)
        return (
          <section key={role}>
            <h2 className="mb-3 text-lg font-bold tracking-tight">
              {roleTitle(role)} <span className="text-sm font-normal text-inkmut">· ranked on the {role} rubric</span>
            </h2>
            <div className="card overflow-x-auto !p-0">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-sanddk/40 text-xs uppercase tracking-wider text-inkmut">
                  <tr>
                    <th className="w-10 px-3 py-2">#</th>
                    <th className="px-3 py-2">Candidate</th>
                    <th className="w-24 px-3 py-2">{role} score</th>
                    <th className="w-24 px-3 py-2">{role === 'PM' ? 'SPM' : 'PM'} score</th>
                    <th className="w-40 px-3 py-2">Email</th>
                    <th className="w-16 px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((c, i) => {
                    const s = appliedScore(c) ?? 0
                    const name = names.get(c.id) || 'Unknown'
                    return (
                      <RowGroup key={c.id} showLine={i === firstBelow} threshold={settings.threshold}>
                        <tr className="border-t border-line/60 align-top hover:bg-sand/50">
                          <td className="px-3 py-2 text-inkmut">{i + 1}</td>
                          <td className="px-3 py-2">
                            <Link href={`/candidates/${c.id}`} className="font-medium text-terradk hover:underline">
                              {name}
                            </Link>
                            {c.role_auto && (
                              <span className="badge ml-2 bg-terra/10 text-terradk" title={c.role_note ?? 'Role picked by the system'}>
                                role auto-picked
                              </span>
                            )}
                            {c.brief && <p className="mt-1 max-w-3xl text-inkmut">{c.brief.replaceAll('[CANDIDATE]', name)}</p>}
                          </td>
                          <td className="px-3 py-2 font-semibold">
                            <span className={s >= settings.threshold ? 'text-green-700' : 'text-inkmut'}>{s}</span>
                          </td>
                          <td className="px-3 py-2 text-inkmut">{otherScore(c) ?? '—'}</td>
                          <td className="px-3 py-2">
                            <EmailBadge c={c} />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Link href={`/candidates/${c.id}`} className="btn">
                              Open
                            </Link>
                          </td>
                        </tr>
                      </RowGroup>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}

      {attention.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold tracking-tight">Needs attention</h2>
          <ul className="card divide-y divide-line/60 !p-0 text-sm">
            {attention.map(c => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-2">
                <Link href={`/candidates/${c.id}`} className="font-medium text-terradk hover:underline">
                  {names.get(c.id) || c.filename || 'Unknown'}
                </Link>
                <span className="text-inkmut">{roleTitle(c.applied_role)}</span>
                <span className="text-red-600">{c.status === 'processing' ? 'Not finished (open to retry)' : c.error}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
    </Shell>
  )
}

function RowGroup({ showLine, threshold, children }: { showLine: boolean; threshold: number; children: React.ReactNode }) {
  return (
    <>
      {showLine && (
        <tr className="bg-terra/10">
          <td colSpan={6} className="px-3 py-1 text-center text-xs font-medium text-terradk">
            — the line ({threshold}): below this get a rejection draft —
          </td>
        </tr>
      )}
      {children}
    </>
  )
}

function EmailBadge({ c }: { c: Candidate }) {
  if (c.email_status === 'sent') return <span className="badge bg-sanddk text-ink/80">{c.email_kind === 'invite' ? 'Invite' : 'Rejection'} sent</span>
  if (!c.email_body) return <span className="badge bg-red-100 text-red-700">No draft</span>
  return c.email_kind === 'invite' ? (
    <span className="badge bg-green-100 text-green-800">Invite draft</span>
  ) : (
    <span className="badge bg-amber-100 text-amber-800">Rejection draft</span>
  )
}
