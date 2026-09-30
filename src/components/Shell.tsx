// Grain hero strip (eyebrow + headline + optional pill) followed by the page container.
export default function Shell({
  eyebrow,
  title,
  sub,
  pill,
  children,
}: {
  eyebrow: string
  title: string
  sub?: string
  pill?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <>
      <section className="grain border-b border-line">
        <div className="mx-auto flex max-w-page flex-wrap items-end justify-between gap-4 px-4 py-10">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="mt-2 text-[2.4rem] font-extrabold leading-[1.02] tracking-tight sm:text-5xl">{title}</h1>
            {sub && <p className="mt-3 max-w-xl text-[15.5px] text-inkmut">{sub}</p>}
          </div>
          {pill && (
            <div className="rounded-full border border-line bg-white/70 px-4 py-2 text-[12.5px] font-semibold shadow-soft">{pill}</div>
          )}
        </div>
      </section>
      <div className="mx-auto max-w-page px-4 py-10">{children}</div>
    </>
  )
}
