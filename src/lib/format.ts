// Hand-rolled date formatting (IST) so server-rendered and browser-rendered text always match.
// Intl/toLocale* differ between Node and browsers (month names, separators), which breaks hydration.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

function parts(iso: string) {
  const d = new Date(new Date(iso).getTime() + IST_OFFSET_MS) // shift, then read as UTC
  const p2 = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
    time: `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`,
  }
}

export const fmtDate = (iso: string) => parts(iso).date
export const fmtDateTime = (iso: string) => {
  const p = parts(iso)
  return `${p.date}, ${p.time} IST`
}
