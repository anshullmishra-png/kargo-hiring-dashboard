import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import { loadRubric, loadSettings } from '@/lib/rubric'
import { appliedScore, roleTitle } from '@/lib/types'
import type { Candidate, CandidatePii, RoleCode, ScoreRow } from '@/lib/types'
import CandidatePanel from '@/components/CandidatePanel'

export const dynamic = 'force-dynamic'

export default async function CandidatePage({ params }: { params: { id: string } }) {
  const db = getDb()
  const { data: candRow } = await db.from('candidates').select('*').eq('id', params.id).maybeSingle()
  if (!candRow) notFound()
  const cand = candRow as Candidate

  const [{ data: piiRow }, { data: scoreRows }, rubric, settings, { data: siblings }] = await Promise.all([
    db.from('candidate_pii').select('*').eq('candidate_id', cand.id).maybeSingle(),
    db.from('candidate_scores').select('*').eq('candidate_id', cand.id),
    loadRubric(),
    loadSettings(),
    db.from('candidates').select('id,score_pm,score_spm,applied_role').eq('applied_role', cand.applied_role).eq('status', 'ready'),
  ])
  const pii = (piiRow ?? { name: null, email: null, phone: null }) as CandidatePii
  const scores = (scoreRows ?? []) as ScoreRow[]
  const name = pii.name || 'Unknown candidate'

  // Prev / next in the same ranked list the dashboard shows.
  const order = ((siblings ?? []) as Candidate[]).sort((a, b) => (appliedScore(b) ?? 0) - (appliedScore(a) ?? 0)).map(s => s.id)
  const at = order.indexOf(cand.id)
  const prev = at > 0 ? order[at - 1] : null
  const next = at >= 0 && at < order.length - 1 ? order[at + 1] : null
  const rank = at >= 0 ? at + 1 : null

  let cvUrl: string | null = null
  if (cand.cv_path) {
    const { data } = await db.storage.from('cvs').createSignedUrl(cand.cv_path, 3600)
    cvUrl = data?.signedUrl ?? null
  }

  const other: RoleCode = cand.applied_role === 'PM' ? 'SPM' : 'PM'
  const subst = (s: string) => s.replaceAll('[CANDIDATE]', name)
  const total = appliedScore(cand)

  const table = (code: RoleCode) => (
    <table className="w-full text-left text-sm">
      <thead className="border-b border-gray-200 text-xs uppercase text-gray-500">
        <tr>
          <th className="py-1.5 pr-3">Criterion</th>
          <th className="w-14 py-1.5 pr-3">Weight</th>
          <th className="w-14 py-1.5 pr-3">Score</th>
          <th className="py-1.5">Why</th>
        </tr>
      </thead>
      <tbody>
        {rubric[code].map(c => {
          const s = scores.find(x => x.criterion_id === c.id)
          return (
            <tr key={c.id} className="border-t border-gray-100 align-top">
              <td className="py-1.5 pr-3 font-medium">{c.name}</td>
              <td className="py-1.5 pr-3 text-gray-500">{c.weight}%</td>
              <td className="py-1.5 pr-3 font-semibold">{s ? `${s.score}/10` : '—'}</td>
              <td className="py-1.5 text-gray-700">{s ? subst(s.reason) : ''}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between text-sm">
        <Link href="/" className="text-blue-700 hover:underline">← All candidates</Link>
        <div className="flex gap-2">
          {prev ? <Link className="btn" href={`/candidates/${prev}`}>‹ Higher ranked</Link> : <span />}
          {next ? <Link className="btn" href={`/candidates/${next}`}>Next ›</Link> : <span />}
        </div>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-xl font-semibold">{name}</h1>
        <span className="text-gray-600">Applied: {roleTitle(cand.applied_role)}</span>
        {cand.status === 'ready' && (
          <>
            <span className="font-semibold">
              <span className={(total ?? 0) >= settings.threshold ? 'text-green-700' : 'text-gray-600'}>{total}/100</span>
              {rank && <span className="font-normal text-gray-500"> · #{rank} of {order.length}</span>}
            </span>
            <span className="text-gray-500">
              {other} rubric: {other === 'PM' ? cand.score_pm : cand.score_spm}/100
            </span>
          </>
        )}
      </div>

      {cand.status !== 'ready' && (
        <div className="card border-red-200 bg-red-50 text-sm text-red-800">
          {cand.status === 'processing' ? 'Scoring did not finish.' : `Scoring failed: ${cand.error}`} Use “Retry scoring” below.
        </div>
      )}

      {cand.brief && (
        <section className="card">
          <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-gray-500">Interview brief</h2>
          <p className="text-[15px] leading-relaxed">{subst(cand.brief)}</p>
        </section>
      )}

      {cand.status === 'ready' && (
        <section className="card space-y-5">
          <div>
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-gray-500">{roleTitle(cand.applied_role)} rubric (what they applied for)</h2>
            {table(cand.applied_role)}
          </div>
          <div>
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-gray-500">{roleTitle(other)} rubric (for reference)</h2>
            {table(other)}
          </div>
        </section>
      )}

      <CandidatePanel
        key={`${cand.status}|${cand.email_status}|${cand.email_subject}|${cand.email_body}|${pii.name}|${pii.email}|${pii.phone}`}
        id={cand.id}
        status={cand.status}
        details={{ name: pii.name ?? '', email: pii.email ?? '', phone: pii.phone ?? '' }}
        email={{
          kind: cand.email_kind,
          subject: cand.email_subject ?? '',
          body: cand.email_body ?? '',
          status: cand.email_status,
          sentAt: cand.sent_at,
          sentTo: cand.email_to,
          error: cand.email_error,
        }}
        hasBrief={!!cand.brief}
        cvUrl={cvUrl}
      />

      <details className="card text-sm">
        <summary className="cursor-pointer font-medium">What the AI saw (CV with personal details removed)</summary>
        <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-xs text-gray-700">{cand.cv_text}</pre>
      </details>
    </div>
  )
}
