// Small server-rendered chart pieces (plain SVG/divs, no chart library) in the sand + terracotta palette.

export const GOOD = '#5f7f4f' // at/above the line, or a strong criterion score
export const MID = '#c4633f' // terracotta: partial
export const WEAK = '#b9a98d' // muted sand: weak / below the line

const scoreColor100 = (v: number, line: number) => (v >= line ? GOOD : v >= line * 0.5 ? MID : WEAK)
const scoreColor10 = (s: number) => (s >= 7 ? GOOD : s >= 4 ? MID : WEAK)

/** Donut ring 0-100 with a tick where "the line" sits. */
export function ScoreRing({
  value,
  line,
  size = 96,
  dark = false,
  label,
}: {
  value: number
  line: number
  size?: number
  dark?: boolean
  label?: string
}) {
  const stroke = Math.max(8, size / 9)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, value))
  const ang = (line / 100) * 2 * Math.PI - Math.PI / 2
  const tick = {
    x1: size / 2 + (r - stroke / 2 - 2) * Math.cos(ang),
    y1: size / 2 + (r - stroke / 2 - 2) * Math.sin(ang),
    x2: size / 2 + (r + stroke / 2 + 2) * Math.cos(ang),
    y2: size / 2 + (r + stroke / 2 + 2) * Math.sin(ang),
  }
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={dark ? 'rgba(255,255,255,.12)' : '#e6dcc9'} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={dark && v >= line ? '#9ad4a3' : scoreColor100(v, line)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`}
        />
      </svg>
      {/* the line marker sits outside the rotated svg so its angle math stays simple */}
      <svg width={size} height={size} className="absolute inset-0" aria-hidden>
        <line {...tick} stroke={dark ? '#efe7d8' : '#2b251d'} strokeWidth={2} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className={`font-extrabold tracking-tight ${dark ? 'text-white' : 'text-ink'}`} style={{ fontSize: size * 0.3 }}>
          {Math.round(v * 10) / 10}
        </span>
        <span className={dark ? 'text-sand/60' : 'text-inkmut'} style={{ fontSize: Math.max(10, size * 0.115), marginTop: 2 }}>
          {label ?? '/100'}
        </span>
      </div>
    </div>
  )
}

/** Horizontal 0-100 bar with a tick at the line. */
export function ScoreBar({ value, line, muted = false }: { value: number; line: number; muted?: boolean }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className="flex items-center gap-2.5">
      <span className={`w-9 text-right tabular-nums ${muted ? 'text-sm text-inkmut' : 'text-base font-extrabold'}`}>{Math.round(v * 10) / 10}</span>
      <div className={`relative w-full min-w-[84px] rounded-full bg-sanddk ${muted ? 'h-1.5' : 'h-2.5'}`}>
        <div
          className="h-full rounded-full"
          style={{ width: `${v}%`, background: muted ? WEAK : scoreColor100(v, line) }}
        />
        <div className="absolute -top-1 h-[calc(100%+8px)] w-0.5 rounded bg-ink/45" style={{ left: `${line}%` }} title={`The line: ${line}`} />
      </div>
    </div>
  )
}

/** One rubric criterion: 0-10 bar plus weighted points earned. */
export function CritBar({ score, weight }: { score: number; weight: number }) {
  const pts = Math.round(((score / 10) * weight) * 10) / 10
  return (
    <div className="flex items-center gap-3">
      <div className="h-2.5 w-full rounded-full bg-sanddk">
        <div className="h-full rounded-full" style={{ width: `${score * 10}%`, background: scoreColor10(score) }} />
      </div>
      <span className="w-12 shrink-0 text-right text-base font-extrabold tabular-nums">
        {score}
        <span className="text-xs font-medium text-inkmut">/10</span>
      </span>
      <span className="hidden w-24 shrink-0 text-right text-xs text-inkmut sm:block">
        <b className="text-ink">{pts}</b> of {weight} pts
      </span>
    </div>
  )
}

/** Histogram of scores in 10-point bins with the line drawn across. */
export function Spread({ scores, line }: { scores: number[]; line: number }) {
  const bins = Array.from({ length: 10 }, () => 0)
  for (const s of scores) bins[Math.min(9, Math.max(0, Math.floor(s / 10)))]++
  const max = Math.max(1, ...bins)
  return (
    <div className="w-full max-w-[260px]">
      <div className="relative flex h-14 items-end gap-[3px]">
        {bins.map((n, i) => (
          <div key={i} className="flex h-full flex-1 items-end" title={`${i * 10}-${i * 10 + 10}: ${n} candidate${n === 1 ? '' : 's'}`}>
            <div
              className="w-full rounded-t"
              style={{ height: n ? `${Math.max(12, (n / max) * 100)}%` : '3px', background: n ? ((i + 1) * 10 > line ? GOOD : MID) : '#e6dcc9', opacity: n ? 1 : 0.7 }}
            />
          </div>
        ))}
        <div className="absolute inset-y-0 w-px border-l border-dashed border-ink/50" style={{ left: `${line}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-inkmut">
        <span>0</span>
        <span>score spread · line {line}</span>
        <span>100</span>
      </div>
    </div>
  )
}

/** KPI tile with an optional progress bar. */
export function Kpi({
  label,
  value,
  of,
  hint,
  accent = MID,
}: {
  label: string
  value: number
  of?: number
  hint?: string
  accent?: string
}) {
  const pct = of ? Math.min(100, (value / Math.max(1, of)) * 100) : null
  return (
    <div className="rounded-2xl border border-sanddk bg-sandlt p-4 shadow-soft">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-inkmut">{label}</p>
      <p className="mt-1 text-[2rem] font-extrabold leading-none tracking-tight">
        {value}
        {of !== undefined && <span className="ml-1 text-base font-semibold text-inkmut">/ {of}</span>}
      </p>
      {pct !== null && (
        <div className="mt-3 h-1.5 rounded-full bg-sanddk">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: accent }} />
        </div>
      )}
      {hint && <p className="mt-2 text-xs text-inkmut">{hint}</p>}
    </div>
  )
}

/** One segment per criterion, width = weight, fill = score. Shows what drove the total. */
export function Breakdown({ items }: { items: { name: string; weight: number; score: number }[] }) {
  return (
    <div>
      <div className="flex gap-1">
        {items.map(i => (
          <div key={i.name} style={{ width: `${i.weight}%` }} title={`${i.name}: ${i.score}/10 of ${i.weight} pts`}>
            <div className="h-5 overflow-hidden rounded bg-sanddk">
              <div className="h-full" style={{ width: `${i.score * 10}%`, background: scoreColor10(i.score) }} />
            </div>
            <p className="mt-1 truncate text-[10.5px] font-semibold text-inkmut">{i.name}</p>
            <p className="text-[11px] tabular-nums text-ink">
              <b>{Math.round((i.score / 10) * i.weight * 10) / 10}</b>
              <span className="text-inkmut"> / {i.weight}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Compact per-criterion strip for table rows: one segment per criterion (width = weight, fill = score). */
export function MiniBreakdown({ items, labels = false }: { items: { name: string; weight: number; score: number }[]; labels?: boolean }) {
  return (
    <div className="flex gap-0.5" title={items.map(i => `${i.name}: ${i.score}/10`).join('  ·  ')}>
      {items.map(i => (
        <div key={i.name} style={{ width: `${i.weight}%` }}>
          <div className="h-2 overflow-hidden rounded-sm bg-sanddk">
            <div className="h-full" style={{ width: `${i.score * 10}%`, background: scoreColor10(i.score) }} />
          </div>
          <p className="mt-0.5 text-center text-[10px] font-semibold tabular-nums text-inkmut">{i.score}</p>
          {labels && <p className="text-center text-[9px] font-bold uppercase tracking-wide text-inkmut/70">{i.name.split(' ').map(w => w[0]).join('')}</p>}
        </div>
      ))}
    </div>
  )
}
