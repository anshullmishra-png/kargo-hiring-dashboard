import { getDb, must } from '@/lib/db'
import Shell from '@/components/Shell'
import { assertClean } from '@/lib/pii'
import type { Candidate, CandidatePii } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function PrivacyPage() {
  const db = getDb()
  const [cands, pii] = await Promise.all([
    db.from('candidates').select('id,cv_text,cv_path,created_at').then(r => must(r, 'load candidates') as Pick<Candidate, 'id' | 'cv_text' | 'cv_path' | 'created_at'>[]),
    db.from('candidate_pii').select('candidate_id,name,email,phone').then(r => must(r, 'load pii') as CandidatePii[]),
  ])
  const piiById = new Map(pii.map(p => [p.candidate_id, p]))

  // Live proof: re-check every stored CV text against that candidate's own name, email and phone.
  let leaks = 0
  for (const c of cands) {
    const p = piiById.get(c.id)
    if (!p) continue
    try {
      assertClean(c.cv_text, p)
    } catch {
      leaks++
    }
  }
  const withFile = cands.filter(c => c.cv_path).length

  return (
    <Shell
      eyebrow="Data privacy"
      title="What the AI sees, and what it never does."
      sub="This tool scores and ranks people, so it is built to keep who they are apart from what they did."
      pill={
        <>
          <span className={leaks ? 'text-red-600' : 'text-[#5f7f4f]'}>●</span> {leaks ? `${leaks} CV(s) failed the check` : `${cands.length} of ${cands.length} stored CVs pass the check`}
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 text-lg font-bold tracking-tight">Where each thing lives</h2>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-inkmut">
              <tr>
                <th className="py-2 pr-3">Data</th>
                <th className="py-2 pr-3">Stored in</th>
                <th className="py-2">Sent to AI?</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr className="border-t border-line/60">
                <td className="py-2 pr-3 font-semibold">Name, email, phone</td>
                <td className="py-2 pr-3">Private <code>candidate_pii</code> table</td>
                <td className="py-2 font-semibold text-[#5f7f4f]">Never</td>
              </tr>
              <tr className="border-t border-line/60">
                <td className="py-2 pr-3 font-semibold">CV with those removed</td>
                <td className="py-2 pr-3">
                  <code>candidates.cv_text</code>
                </td>
                <td className="py-2">Yes: scoring, brief, email draft</td>
              </tr>
              <tr className="border-t border-line/60">
                <td className="py-2 pr-3 font-semibold">Original CV file</td>
                <td className="py-2 pr-3">Private storage bucket ({withFile} files), short-lived links only</td>
                <td className="py-2 font-semibold text-[#5f7f4f]">Never</td>
              </tr>
              <tr className="border-t border-line/60">
                <td className="py-2 pr-3 font-semibold">Real name in emails</td>
                <td className="py-2 pr-3">Filled in by code after the AI has finished</td>
                <td className="py-2 font-semibold text-[#5f7f4f]">Never</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-4 text-sm text-inkmut">
            The split is done by plain code, not by an AI, so personal details are never sent anywhere to be found. If anything personal survives, the upload is rejected before anything reaches the AI. The check in the top-right re-runs on every stored CV each time you open this page.
          </p>
        </section>

        <section className="card space-y-4 text-sm leading-relaxed">
          <h2 className="text-lg font-bold tracking-tight">Free Gemini tier vs paid Gemini API</h2>
          <p>
            On Google&apos;s free tier (AI Studio and the unpaid API), the terms allow Google to use what you send to improve its products, and people may review it. With billing enabled on the API, Google says inputs and outputs are not used to train its models and are kept only for limited abuse and safety checks.
          </p>
          <p className="rounded-xl border border-terra/30 bg-terra/[0.07] p-3">
            <b>What this means here:</b> the AI only ever receives CV text with the personal details removed, which limits the harm on either tier. For real candidates use a billing-enabled key. Terms change, so check Google&apos;s current terms before relying on this.
          </p>
        </section>

        <section className="card space-y-3 text-sm leading-relaxed lg:col-span-2">
          <h2 className="text-lg font-bold tracking-tight">What the split does for DPDP compliance, and what it does not</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <b>Data minimisation and purpose limitation:</b> the AI gets only what it needs to judge work history. Identity is kept apart, in a table that only the server can read (the public key returns nothing).
            </li>
            <li>
              <b>Access control and safeguards:</b> the dashboard is behind a password, storage is private, and emails go only to approved test domains until you change that on purpose.
            </li>
            <li>
              <b>Erasure:</b> &quot;Delete candidate&quot; removes the personal details, the CV text, the scores, and the original file together.
            </li>
          </ul>
          <p className="rounded-xl border border-sanddk bg-white/60 p-3">
            <b>Honest limits:</b> removing name, email and phone makes a CV <i>pseudonymised</i>, not anonymous. Employers, dates and achievements can still point to a person, so the law still applies to that text. A real deployment also needs a notice to candidates about scoring and ranking, a lawful basis or consent, a retention period with automatic deletion, a grievance contact, a human making the final decision (as here: nothing is sent without a click), and a look at the fact that data is processed outside India by the AI provider.
          </p>
        </section>
      </div>
    </Shell>
  )
}
