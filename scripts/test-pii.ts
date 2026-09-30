// Runs the personal-details separation over every CV in a folder and prints what it found.
// Usage: npx tsx scripts/test-pii.ts "<folder with cvs>"
import fs from 'node:fs'
import path from 'node:path'
import { extractCvText } from '../src/lib/extract'
import { separatePii, assertClean } from '../src/lib/pii'

async function main() {
  const dir = process.argv[2]
  if (!dir) throw new Error('pass a folder')
  let bad = 0
  for (const f of fs.readdirSync(dir).filter(f => /\.(pdf|docx|txt)$/i.test(f)).sort()) {
    try {
      const text = await extractCvText(fs.readFileSync(path.join(dir, f)), f)
      const { pii, redacted } = separatePii(text, f)
      assertClean(redacted, pii)
      const flag = !pii.name || !pii.email || !pii.phone ? '  <-- incomplete' : ''
      if (flag) bad++
      console.log(f.padEnd(34), '|', String(pii.name).padEnd(22), '|', String(pii.email).padEnd(30), '|', String(pii.phone).padEnd(18), '| chars', redacted.length, flag)
    } catch (e) {
      bad++
      console.log(f.padEnd(34), 'ERROR', (e as Error).message)
    }
  }
  console.log(`\n${bad} file(s) need attention`)
}
main()
