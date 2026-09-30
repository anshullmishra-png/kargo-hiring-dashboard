import Link from 'next/link'
import { getDb, must } from '@/lib/db'
import { loadRubric, loadSettings } from '@/lib/rubric'
import SettingsBar from '@/components/SettingsBar'
import Shell from '@/components/Shell'
import { GOOD, Kpi, MiniBreakdown, ScoreBar, ScoreRing, Spread } from '@/components/viz'
import DuplicatesPanel from '@/components/DuplicatesPanel'
import { findDuplicateGroups } from '@/lib/dupes'
import { inviteIds, lineScore, rankRole } from '@/lib/ranking'
import { appliedScore, roleTitle } from '@/lib/types'
import type { Candidate, CandidatePii, Criterion, RoleCode, ScoreRow } from '@/lib/types'

export const dynamic = 'force-dynamic'

const PAGE_ROWS = 12
const otherScore = (c: Candidate) => (c.applied_role === 'PM' ? c.score_spm : c.score_pm)

export default async function Dashboard({ searchParams }: { searchParams: { role?: string; q?: string; all?: string; dupes?: string } }) {
  const db = getDb()
  const [settings, rubric, cands, pii, scoreRows] = await Promise.all([
    loadSettings(),
    loadRubric(),
    db.from('candidates').select('*').then(r => must(r, 'load candidates') as Candidate[]),
    db.from('candidate_pii').select('candidate_id,name,email').then(r => must(r, 'load names') as Pick<CandidatePii, 'candidate_id' | 'name' | 'email'>[]),
    db.from('candidate_scores').select('candidate_id,criterion_id,score').then(r => must(r, 'load scores') as Pick<ScoreRow, 'candidate_id' | 'criterion_id' | 'score'>[]),
  ])
  const names = new Map(pii.map(p => [p.candidate_id, p.name]))
  const emails = new Map(pii.map(p => [p.candidate_id, p.email]))
  const byId = new Map(cands.map(c => [c.id, c]))
  const scoreOf = new Map(scoreRows.map(s => [`${s.candidate_id}:${s.criterion_id}`, s.score]))

  const dupeGroups = findDuplicateGroups(cands.map(c => ({ id: c.id, cv_text: c.cv_text, name: names.get(c.id) ?? null, email: emails.get(c.id) ?? null })))
  const dupeIds = new Set(dupeGroups.flatMap(g => g.ids))
  const dupeViews = dupeGroups.map(g => ({
    reason: g.reason,
    members: g.ids
      .map(id => byId.get(id)!)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(c => ({
        id: c.id,
        name: names.get(c.id) || 'Unknown',
        role: c.applied_role,
        score: appliedScore(c),
        createdAt: c.created_at,
        sent: c.email_status !== 'draft',
        filename: c.filename,
      })),
  }))

  const ready = cands.filter(c => c.status === 'ready')
  const attention = cands.filter(c => c.status !== 'ready')
  const drafts = ready.filter(c => c.email_status === 'draft' && c.email_body)
  const toSend = drafts.length
  const invitesWaiting = drafts.filter(c => c.email_kind === 'invite').length
  const sent = ready.filter(c => c.email_status === 'sent').length
  const invited = inviteIds(ready, settings)

  // Which role tab is showing.
  const counts: Record<RoleCode, number> = { PM: ready.filter(c => c.applied_role === 'PM').length, SPM: ready.filter(c => c.applied_role === 'SPM').length }
  const role: RoleCode = searchParams.role === 'SPM' || searchParams.role === 'PM' ? searchParams.role : counts.PM || !counts.SPM ? 'PM' : 'SPM'
  const q = (searchParams.q ?? '').trim().toLowerCase()
  const showAll = searchParams.all === '1'

  const ranked = rankRole(ready, role)
  const line = lineScore(ranked, settings)
  const matches = (c: Candidate) => !q || (names.get(c.id) ?? '').toLowerCase().includes(q)
  const shortlist = ranked.map((c, i) => ({ c, rank: i + 1 })).filter(x => invited.has(x.c.id) && matches(x.c))
  const rest = ranked.map((c, i) => ({ c, rank: i + 1 })).filter(x => !invited.has(x.c.id) && matches(x.c))
  const restShown = showAll || q ? rest : rest.slice(0, PAGE_ROWS)

  const items = (c: Candidate) => rubric[role].map(k => ({ name: k.name, weight: k.weight, score: scoreOf.get(`${c.id}:${k.id}`) ?? 0 }))
  const href = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    const merged = { role, q: searchParams.q, all: searchParams.all, dupes: searchParams.dupes, ...over }
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v)
    return `/?${p.toString()}`
  }

  return (
    <Shell
      compact
      eyebrow="Kargo · Hiring"
      title="Candidates"
      pill={
        <>
          <span className="text-terra">●</span> {ready.length} scored · {toSend} emails waiting · {sent} sent
        </>
      }
    >
      <div className="space-y-6">
        {ready.length > 0 && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Scored" value={ready.length} of={cands.length} hint={attention.length ? `${attention.length} need attention` : 'all processed'} />
            <Kpi label="Invited" value={invited.size} of={ready.length} accent={GOOD} hint={`top ${settings.topN} per role`} />
            <Kpi label="Emails waiting" value={toSend} of={ready.length} hint={`${invitesWaiting} invites · ${toSend - invitesWaiting} rejections`} />
            <Kpi label="Sent" value={sent} of={ready.length} accent={GOOD} hint="nothing sends on its own" />
          </div>
        )}

        {cands.length === 0 && (
          <div className="card text-sm text-inkmut">
            No candidates yet. <Link className="text-terradk underline" href="/upload">Upload CVs</Link> to get started.
          </div>
        )}

        {cands.length > 0 && (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            {/* ───────── main column ───────── */}
            <div className="min-w-0 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <nav className="flex gap-1 rounded-2xl border border-sanddk bg-sandlt p-1 shadow-soft" aria-label="Role">
                  {(['PM', 'SPM'] as RoleCode[]).map(r => (
                    <Link
                      key={r}
                      href={href({ role: r, all: undefined })}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                        r === role ? 'bg-terradk text-white shadow-btn' : 'text-inkmut hover:bg-white/70 hover:text-ink'
                      }`}
                    >
                      {roleTitle(r)} <span className={r === role ? 'text-white/75' : 'text-inkmut'}>· {counts[r]}</span>
                    </Link>
                  ))}
                </nav>
                <form action="/" method="get" className="flex gap-2">
                  <input type="hidden" name="role" value={role} />
                  <input className="input !w-48 !py-2" name="q" defaultValue={searchParams.q ?? ''} placeholder="Search name..." />
                  {q && (
                    <Link className="btn" href={href({ q: undefined })}>
                      Clear
                    </Link>
                  )}
                </form>
              </div>

              {/* shortlist: the invited top N as cards */}
              <section>
                <h2 className="mb-3 flex items-baseline gap-2 text-lg font-bold tracking-tight">
                  Shortlist <span className="text-sm font-normal text-inkmut">· top {settings.topN} get an invite + brief</span>
                </h2>
                {shortlist.length === 0 ? (
                  <div className="card text-sm text-inkmut">{q ? 'No shortlisted candidate matches that name.' : 'Nobody qualifies yet for this role.'}</div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {shortlist.map(({ c, rank }) => {
                      const name = names.get(c.id) || 'Unknown'
                      return (
                        <article key={c.id} className="flex flex-col rounded-2xl border border-sanddk bg-sandlt p-4 shadow-soft">
                          <div className="flex items-start gap-3">
                            <ScoreRing value={appliedScore(c) ?? 0} line={line} size={68} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-inkmut">#{rank}</span>
                                <EmailBadge c={c} />
                              </div>
                              <Link href={`/candidates/${c.id}`} className="block truncate text-base font-bold text-ink hover:text-terradk">
                                {name}
                              </Link>
                              <Flags c={c} dupe={dupeIds.has(c.id)} />
                            </div>
                          </div>
                          <div className="mt-3">
                            <MiniBreakdown items={items(c)} labels />
                          </div>
                          {c.brief && (
                            <details className="group mt-3 text-sm">
                              <summary className="cursor-pointer select-none font-semibold text-terradk">Read brief</summary>
                              <p className="mt-2 leading-relaxed text-ink/80">{c.brief.replaceAll('[CANDIDATE]', name)}</p>
                            </details>
                          )}
                          <Link href={`/candidates/${c.id}`} className="btn btn-primary mt-4 w-full">
                            Review &amp; send
                          </Link>
                        </article>
                      )
                    })}
                  </div>
                )}
              </section>

              {/* everyone else: compact table */}
              {rest.length > 0 && (
                <section>
                  <h2 className="mb-3 flex items-baseline gap-2 text-lg font-bold tracking-tight">
                    Everyone else <span className="text-sm font-normal text-inkmut">· {rest.length} get a rejection draft</span>
                  </h2>
                  <div className="card overflow-x-auto !p-0">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-line bg-sanddk/40 text-xs uppercase tracking-wider text-inkmut">
                        <tr>
                          <th className="w-10 px-3 py-2">#</th>
                          <th className="px-3 py-2">Candidate</th>
                          <th className="w-48 px-3 py-2">{role} score</th>
                          <th className="hidden w-40 px-3 py-2 md:table-cell">Breakdown</th>
                          <th className="w-36 px-3 py-2">Email</th>
                          <th className="w-16 px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {restShown.map(({ c, rank }) => (
                          <tr key={c.id} className="border-t border-line/60 hover:bg-sand/50">
                            <td className="px-3 py-2 text-inkmut">{rank}</td>
                            <td className="px-3 py-2">
                              <Link href={`/candidates/${c.id}`} className="font-medium text-terradk hover:underline">
                                {names.get(c.id) || 'Unknown'}
                              </Link>
                              <Flags c={c} dupe={dupeIds.has(c.id)} inline />
                              <p className="text-xs text-inkmut">
                                {role === 'PM' ? 'SPM' : 'PM'} rubric: {otherScore(c) ?? 0}
                              </p>
                            </td>
                            <td className="px-3 py-2">
                              <ScoreBar value={appliedScore(c) ?? 0} line={line} />
                            </td>
                            <td className="hidden px-3 py-2 md:table-cell">
                              <MiniBreakdown items={items(c)} />
                            </td>
                            <td className="px-3 py-2">
                              <EmailBadge c={c} />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <Link href={`/candidates/${c.id}`} className="btn !px-3 !py-1">
                                Open
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!q && rest.length > PAGE_ROWS && (
                      <div className="border-t border-line/60 bg-sanddk/20 px-4 py-2.5 text-center text-sm">
                        <Link className="font-semibold text-terradk hover:underline" href={href({ all: showAll ? undefined : '1' })}>
                          {showAll ? 'Show fewer' : `Show all ${rest.length}`}
                        </Link>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-inkmut">
                    Breakdown bars, in order: {rubric[role].map((k: Criterion) => `${k.name} (${k.weight}%)`).join(' · ')}
                  </p>
                </section>
              )}
            </div>

            {/* ───────── side column ───────── */}
            <aside className="space-y-4 lg:sticky lg:top-24">
              <SettingsBar threshold={settings.threshold} topN={settings.topN} />

              <div className="card space-y-3 text-sm">
                <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-inkmut">To do</h3>
                <QueueRow tone={toSend ? 'terra' : 'ok'} label="Emails to review" value={toSend} sub={`${invitesWaiting} invites · ${toSend - invitesWaiting} rejections`} />
                <QueueRow
                  tone={dupeViews.length ? 'terra' : 'ok'}
                  label="Possible duplicates"
                  value={dupeViews.length}
                  sub={dupeViews.length ? 'review below' : 'none found'}
                  href={dupeViews.length ? `${href({ dupes: '1' })}#duplicates` : undefined}
                />
                <QueueRow tone={attention.length ? 'red' : 'ok'} label="Needs attention" value={attention.length} sub={attention.length ? 'failed or unfinished' : 'all processed'} />
                {attention.slice(0, 4).map(c => (
                  <Link key={c.id} href={`/candidates/${c.id}`} className="block truncate pl-5 text-xs text-terradk hover:underline">
                    {names.get(c.id) || c.filename || 'Unknown'}: {c.status === 'processing' ? 'not finished' : 'failed'}
                  </Link>
                ))}
              </div>

              {ranked.length > 0 && (
                <div className="card space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-inkmut">Score spread · {role}</h3>
                  <Spread scores={ranked.map(c => appliedScore(c) ?? 0)} line={line} />
                </div>
              )}
            </aside>
          </div>
        )}

        {dupeViews.length > 0 && (
          <details id="duplicates" open={searchParams.dupes === '1'} className="group">
            <summary className="btn cursor-pointer select-none list-none">
              Possible duplicates · {dupeViews.length} group{dupeViews.length === 1 ? '' : 's'} (show / hide)
            </summary>
            <div className="mt-3">
              <DuplicatesPanel groups={dupeViews} />
            </div>
          </details>
        )}
      </div>
    </Shell>
  )
}

function Flags({ c, dupe, inline = false }: { c: Candidate; dupe: boolean; inline?: boolean }) {
  if (!dupe && !c.role_auto) return null
  return (
    <span className={inline ? 'ml-2' : 'mt-1 flex flex-wrap gap-1'}>
      {dupe && (
        <span className="badge bg-red-100 text-red-700" title="Another entry looks like the same CV. See Possible duplicates.">
          duplicate?
        </span>
      )}
      {c.role_auto && (
        <span className={`badge bg-terra/10 text-terradk ${inline ? 'ml-1' : ''}`} title={c.role_note ?? 'Role picked by the system'}>
          auto-picked
        </span>
      )}
    </span>
  )
}

function QueueRow({ tone, label, value, sub, href }: { tone: 'ok' | 'terra' | 'red'; label: string; value: number; sub: string; href?: string }) {
  const dot = tone === 'ok' ? 'bg-[#5f7f4f]' : tone === 'red' ? 'bg-red-500' : 'bg-terra'
  const body = (
    <div className="flex items-center gap-3">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-tight">{label}</p>
        <p className="text-xs text-inkmut">{sub}</p>
      </div>
      <span className="text-xl font-extrabold tabular-nums">{value}</span>
    </div>
  )
  return href ? (
    <Link href={href} className="block rounded-lg hover:bg-white/60">
      {body}
    </Link>
  ) : (
    body
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
