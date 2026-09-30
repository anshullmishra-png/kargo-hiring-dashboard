import { getDocumentProxy } from 'unpdf'

// Turns an uploaded CV (PDF, DOCX or TXT) into plain text.
export async function extractCvText(buf: Buffer, filename: string): Promise<string> {
  const lower = filename.toLowerCase()
  let text = ''
  if (lower.endsWith('.pdf')) {
    const pdf = await getDocumentProxy(new Uint8Array(buf))
    // Build text from raw items so line breaks survive (unpdf's extractText flattens them).
    const pages: string[] = []
    for (let n = 1; n <= pdf.numPages; n++) {
      const content = await (await pdf.getPage(n)).getTextContent()
      let out = ''
      for (const item of content.items as Array<{ str: string; hasEOL?: boolean }>) {
        out += item.str + (item.hasEOL ? '\n' : ' ')
      }
      pages.push(out)
    }
    text = pages.join('\n\n')
  } else if (lower.endsWith('.docx')) {
    const mammoth = await import('mammoth')
    text = (await mammoth.extractRawText({ buffer: buf })).value
  } else if (lower.endsWith('.txt')) {
    text = buf.toString('utf8')
  } else {
    throw new Error('Unsupported file type — upload a PDF, DOCX or TXT')
  }
  text = text.replace(/\u0000/g, '').trim()
  if (text.length < 200) {
    throw new Error('Could not read text from this file (scanned image?) — upload a text-based PDF or DOCX')
  }
  return text
}
