import { loadRubric, loadSettings } from '@/lib/rubric'
import { roleTitle } from '@/lib/types'
import type { RoleCode } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function RubricPage() {
  const [rubric, settings] = await Promise.all([loadRubric(), loadSettings()])
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Hiring rubric</h1>
        <p className="text-sm text-gray-600">
          Loaded from rubric.txt. Every candidate is scored 0-10 on each criterion of both rubrics; the weights turn that into a 0-100 total.
        </p>
      </div>
      {(['PM', 'SPM'] as RoleCode[]).map(code => (
        <section key={code} className="card">
          <h2 className="mb-3 font-medium">
            {roleTitle(code)} <span className="text-sm font-normal text-gray-500">(weights total {rubric[code].reduce((s, c) => s + c.weight, 0)}%)</span>
          </h2>
          <ul className="space-y-3 text-sm">
            {rubric[code].map(c => (
              <li key={c.id}>
                <p className="font-medium">
                  {c.name} <span className="text-gray-500">· {c.weight}%</span>
                </p>
                <p className="text-gray-700">{c.description}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className="card">
        <h2 className="mb-2 font-medium">Scoring notes (given to the scorer)</h2>
        <p className="whitespace-pre-wrap text-sm text-gray-700">{settings.scoringNotes}</p>
      </section>
    </div>
  )
}
