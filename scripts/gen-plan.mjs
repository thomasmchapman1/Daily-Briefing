// Generates the placeholder 365-day reading plan:
// one psalm (Psalm 119 split into eight parts) plus one chapter a day
// through the New Testament, then Proverbs, Genesis and a few short books.
import { writeFileSync } from 'node:fs'

const psalms = []
for (let p = 1; p <= 150; p++) {
  if (p === 119) for (let s = 1; s <= 176; s += 22) psalms.push(`Psalm 119:${s}–${s + 21}`)
  else psalms.push(`Psalm ${p}`)
}

const books = [
  ['Matthew', 28], ['Mark', 16], ['Luke', 24], ['John', 21], ['Acts', 28], ['Romans', 16],
  ['1 Corinthians', 16], ['2 Corinthians', 13], ['Galatians', 6], ['Ephesians', 6], ['Philippians', 4],
  ['Colossians', 4], ['1 Thessalonians', 5], ['2 Thessalonians', 3], ['1 Timothy', 6], ['2 Timothy', 4],
  ['Titus', 3], ['Philemon', 1], ['Hebrews', 13], ['James', 5], ['1 Peter', 5], ['2 Peter', 3],
  ['1 John', 5], ['2 John', 1], ['3 John', 1], ['Jude', 1], ['Revelation', 22],
  ['Proverbs', 31], ['Genesis', 50], ['Ruth', 4], ['Jonah', 4], ['Esther', 10], ['Joel', 3], ['Habakkuk', 3],
]
const chapters = books.flatMap(([b, n]) => Array.from({ length: n }, (_, i) => `${b} ${i + 1}`))
if (chapters.length !== 365) throw new Error(`expected 365 chapters, got ${chapters.length}`)

const days = {}
for (let d = 1; d <= 365; d++) days[d] = [psalms[(d - 1) % psalms.length], chapters[d - 1]]

const plan = { id: 'default-365', name: 'Psalms & New Testament (placeholder)', days }
writeFileSync(new URL('../src/scripture/plans/default-365.json', import.meta.url), JSON.stringify(plan, null, 1) + '\n')
console.log('wrote default-365.json')
