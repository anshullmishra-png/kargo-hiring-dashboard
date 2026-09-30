import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import { loadRubric, loadSettings } from '@/lib/rubric'
import { appliedScore, roleTitle } from '@/lib/types'
import type { Candidate, CandidatePii, RoleCode, ScoreRow } from '@/lib/types'
import CandidatePanel from '@/components/CandidatePanel'
import Shell from '@/components/Shell'
import { Breakdown, CritBar, ScoreRing } from '@/components/viz'

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
  const aboveLine = (total ?? 0) >= settings.threshold

  const table = (code: RoleCode) => (
    <ul className="space-y-4">
      {rubric[code].map(c => {
        const s = scores.find(x => x.criterion_id === c.id)
        return (
          <li key={c.id}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="font-semibold">{c.name}</span>
              <span className="rounded-full bg-sanddk px-2 py-0.5 text-[11px] font-semibold text-inkmut">weight {c.weight}%</span>
            </div>
            {s ? <CritBar score={s.score} weight={c.weight} /> : <p className="text-sm text-inkmut">Not scored</p>}
            {s && <p className="mt-1.5 text-[13.5px] leading-snug text-ink/75">{subst(s.reason)}</p>}
          </li>
        )
      })}
    </ul>
  )

  return (
    <Shell
      eyebrow={cand.role_auto ? `Best fit (auto-picked): ${roleTitle(cand.applied_role)}` : `Applied: ${roleTitle(cand.applied_role)}`}
      title={name}
      pill={
        <Link href="/" className="hover:text-terradk">
          ← All candidates
        </Link>
      }
    >
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12">
        <div className="space-y-6">
          {cand.status !== 'ready' && (
            <div className="card !border-red-200 !bg-red-50 text-sm text-red-800">
              {cand.status === 'processing' ? 'Scoring did not finish.' : `Scoring failed: ${cand.error}`} Use “Retry scoring” below.
            </div>
          )}

          {cand.status === 'ready' && (
            <section className="card space-y-6">
              <div>
                <h2 className="mb-3 text-lg font-bold tracking-tight">
                  {roleTitle(cand.applied_role)} rubric <span className="text-sm font-normal text-inkmut">· what they applied for</span>
                </h2>
                <div className="mb-5 rounded-xl border border-sanddk bg-white/60 p-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-inkmut">Where the {total} points came from</p>
                  <Breakdown
                    items={rubric[cand.applied_role].map(c => ({
                      name: c.name,
                      weight: c.weight,
                      score: scores.find(x => x.criterion_id === c.id)?.score ?? 0,
                    }))}
                  />
                </div>
                {table(cand.applied_role)}
              </div>
              <div>
                <h2 className="mb-3 text-lg font-bold tracking-tight">
                  {roleTitle(other)} rubric <span className="text-sm font-normal text-inkmut">· for reference</span>
                </h2>
                {table(other)}
              </div>
            </section>
          )}

          <CandidatePanel
            key={`${cand.applied_role}|${cand.status}|${cand.email_status}|${cand.email_subject}|${cand.email_body}|${pii.name}|${pii.email}|${pii.phone}`}
            id={cand.id}
            status={cand.status}
            role={cand.applied_role}
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
            <summary className="cursor-pointer font-semibold">What the AI saw (CV with personal details removed)</summary>
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-xs text-ink/80">{cand.cv_text}</pre>
          </details>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="overflow-hidden rounded-2xl bg-ink text-sand shadow-card">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <h2 className="text-base font-bold text-white">Summary</h2>
              {rank && (
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs">
                  #{rank} of {order.length}
                </span>
              )}
            </div>
            {cand.status === 'ready' && (
              <div className="space-y-4 border-b border-white/10 px-6 py-5 text-sm">
                <div className="flex items-center gap-5">
                  <ScoreRing value={total ?? 0} line={settings.threshold} size={112} dark label={`${cand.applied_role} rubric`} />
                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-sand/70">
                        <span>{other} rubric</span>
                        <span className="font-semibold text-sand/90">{other === 'PM' ? cand.score_pm : cand.score_spm}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-sand/60" style={{ width: `${Number((other === 'PM' ? cand.score_pm : cand.score_spm) ?? 0)}%` }} />
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-sand/70">
                      <span>The line</span>
                      <span className="font-semibold text-sand/90">{settings.threshold}</span>
                    </div>
                    <div className="flex justify-between text-xs text-sand/70">
                      <span>Gap to the line</span>
                      <span className="font-semibold text-sand/90">
                        {aboveLine ? '+' : ''}
                        {Math.round(((total ?? 0) - settings.threshold) * 10) / 10}
                      </span>
                    </div>
                  </div>
                </div>
                {cand.role_auto && cand.role_note && (
                  <p className="border-t border-white/10 pt-2 text-[13px] text-sand/70">Why {cand.applied_role}: {cand.role_note}</p>
                )}
                <p className={`pt-1 text-[13px] font-semibold ${aboveLine ? 'text-[#9ad4a3]' : 'text-[#e8b48f]'}`}>
                  {aboveLine ? 'Above the line: interview invite' : 'Below the line: rejection'}
                </p>
              </div>
            )}
            <div className="px-6 py-5">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-sand/60">Interview brief</h3>
              {cand.brief ? (
                <p className="text-[14.5px] leading-relaxed text-white/95">{subst(cand.brief)}</p>
              ) : (
                <p className="text-sm text-sand/60">
                  No brief. Briefs are written for the top {settings.topN} per role above the line, or use “Write brief” below.
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {prev ? <Link className="btn flex-1" href={`/candidates/${prev}`}>‹ Higher ranked</Link> : <span className="flex-1" />}
            {next ? <Link className="btn flex-1" href={`/candidates/${next}`}>Next ›</Link> : <span className="flex-1" />}
          </div>
        </aside>
      </div>
    </Shell>
  )
}
