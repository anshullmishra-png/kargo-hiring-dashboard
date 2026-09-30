import { loadRubric, loadSettings } from '@/lib/rubric'
import { roleTitle } from '@/lib/types'
import type { RoleCode } from '@/lib/types'
import Shell from '@/components/Shell'

export const dynamic = 'force-dynamic'

export default async function RubricPage() {
  const [rubric, settings] = await Promise.all([loadRubric(), loadSettings()])
  return (
    <Shell
      eyebrow="The standard"
      title="Hiring rubric."
      sub="Every candidate is scored 0-10 on each criterion of both rubrics; the weights turn that into a 0-100 total."
      pill="Loaded from rubric.txt"
    >
    <div className="space-y-6">
      {settings.patterns && (
        <section className="card">
          <h2 className="mb-1 text-lg font-bold tracking-tight">Where this rubric came from</h2>
          <p className="mb-3 text-sm text-inkmut">
            Patterns found by comparing the 8 past hires rated Exceeds against those rated Meets or Below. Each criterion below traces back to one of them.
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/80">{settings.patterns}</p>
        </section>
      )}
      {(['PM', 'SPM'] as RoleCode[]).map(code => (
        <section key={code} className="card">
          <h2 className="mb-4 text-lg font-bold tracking-tight">
            {roleTitle(code)} <span className="text-sm font-normal text-inkmut">(weights total {rubric[code].reduce((s, c) => s + c.weight, 0)}%)</span>
          </h2>
          <ul className="space-y-3 text-sm">
            {rubric[code].map(c => (
              <li key={c.id}>
                <p className="font-medium">
                  {c.name} <span className="text-inkmut">· {c.weight}%</span>
                </p>
                <p className="text-ink/80">{c.description}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className="card">
        <h2 className="mb-2 text-lg font-bold tracking-tight">Scoring notes (given to the scorer)</h2>
        <p className="whitespace-pre-wrap text-sm text-ink/80">{settings.scoringNotes}</p>
      </section>
    </div>
    </Shell>
  )
}
