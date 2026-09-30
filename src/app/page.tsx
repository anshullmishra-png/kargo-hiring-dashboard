import Link from 'next/link'
import { getDb, must } from '@/lib/db'
import { loadSettings } from '@/lib/rubric'
import SettingsBar from '@/components/SettingsBar'
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold">Candidates</h1>
        <p className="text-sm text-gray-600">
          {ready.length} scored · {toSend} emails waiting for you · {sent} sent
        </p>
      </div>

      <SettingsBar threshold={settings.threshold} topN={settings.topN} />

      {cands.length === 0 && (
        <div className="card text-sm text-gray-600">
          No candidates yet. <Link className="text-blue-700 underline" href="/upload">Upload CVs</Link> to get started.
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
            <h2 className="mb-2 font-medium">
              {roleTitle(role)} <span className="text-sm font-normal text-gray-500">· ranked on the {role} rubric</span>
            </h2>
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
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
                        <tr className="border-t border-gray-100 align-top hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                          <td className="px-3 py-2">
                            <Link href={`/candidates/${c.id}`} className="font-medium text-blue-800 hover:underline">
                              {name}
                            </Link>
                            {c.brief && <p className="mt-1 max-w-3xl text-gray-600">{c.brief.replaceAll('[CANDIDATE]', name)}</p>}
                          </td>
                          <td className="px-3 py-2 font-semibold">
                            <span className={s >= settings.threshold ? 'text-green-700' : 'text-gray-500'}>{s}</span>
                          </td>
                          <td className="px-3 py-2 text-gray-500">{otherScore(c) ?? '—'}</td>
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
          <h2 className="mb-2 font-medium">Needs attention</h2>
          <ul className="card divide-y divide-gray-100 p-0 text-sm">
            {attention.map(c => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-2">
                <Link href={`/candidates/${c.id}`} className="font-medium text-blue-800 hover:underline">
                  {names.get(c.id) || c.filename || 'Unknown'}
                </Link>
                <span className="text-gray-500">{roleTitle(c.applied_role)}</span>
                <span className="text-red-600">{c.status === 'processing' ? 'Not finished (open to retry)' : c.error}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function RowGroup({ showLine, threshold, children }: { showLine: boolean; threshold: number; children: React.ReactNode }) {
  return (
    <>
      {showLine && (
        <tr className="bg-amber-50">
          <td colSpan={6} className="px-3 py-1 text-center text-xs font-medium text-amber-800">
            — the line ({threshold}): below this get a rejection draft —
          </td>
        </tr>
      )}
      {children}
    </>
  )
}

function EmailBadge({ c }: { c: Candidate }) {
  if (c.email_status === 'sent') return <span className="badge bg-gray-200 text-gray-700">{c.email_kind === 'invite' ? 'Invite' : 'Rejection'} sent</span>
  if (!c.email_body) return <span className="badge bg-red-100 text-red-700">No draft</span>
  return c.email_kind === 'invite' ? (
    <span className="badge bg-green-100 text-green-800">Invite draft</span>
  ) : (
    <span className="badge bg-amber-100 text-amber-800">Rejection draft</span>
  )
}
