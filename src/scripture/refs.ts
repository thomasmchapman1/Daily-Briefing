// Splits plan references into pieces a text provider can fetch one by one:
//   "Psalms 52–54"               → Psalms 52, Psalms 53, Psalms 54
//   "Exodus 11; Exodus 12:1–21"  → Exodus 11, Exodus 12:1-21
//   "Luke 1:39–80"               → Luke 1:39-80

export function splitReference(ref: string): string[] {
  const out: string[] = []
  for (const raw of ref.split(';')) {
    const part = raw.trim().replace(/[–—]/g, '-')
    const range = part.match(/^(.+?) (\d+)-(\d+)$/)
    if (range) {
      for (let c = Number(range[2]); c <= Number(range[3]); c++) out.push(`${range[1]} ${c}`)
    } else if (part) out.push(part)
  }
  return out
}
