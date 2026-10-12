// Builds src/scripture/plans/verse-a-day.json: one well-known verse (or a short
// passage that belongs together) for each day, pinned for a few dates and
// otherwise in a fixed shuffled order so books vary from day to day.
// Run: node scripts/gen-verse-plan.mjs
import { writeFileSync } from 'node:fs'

const VERSES = `
Genesis 1:1|Genesis 1:27|Genesis 2:7|Genesis 12:2|Genesis 15:6|Genesis 18:14|Genesis 28:15|Genesis 50:20
Exodus 14:14|Exodus 15:2|Exodus 20:3|Exodus 33:14|Exodus 34:6
Leviticus 19:18|Numbers 6:24–26|Numbers 23:19
Deuteronomy 6:4|Deuteronomy 6:5|Deuteronomy 7:9|Deuteronomy 8:3|Deuteronomy 31:6|Deuteronomy 31:8|Deuteronomy 33:27
Joshua 1:8|Joshua 1:9|Joshua 24:15|Ruth 1:16|1 Samuel 2:2|1 Samuel 16:7|2 Samuel 22:31|1 Kings 8:56
1 Chronicles 16:11|1 Chronicles 16:34|1 Chronicles 29:11|2 Chronicles 7:14|2 Chronicles 16:9
Ezra 7:10|Nehemiah 8:10|Nehemiah 9:6|Esther 4:14|Job 1:21|Job 19:25|Job 23:10|Job 42:2
Psalms 1:1|Psalms 1:2|Psalms 1:3|Psalms 4:8|Psalms 5:3|Psalms 8:1|Psalms 8:4|Psalms 16:8|Psalms 16:11|Psalms 18:2
Psalms 19:1|Psalms 19:14|Psalms 23:1|Psalms 23:4|Psalms 23:6|Psalms 25:4|Psalms 25:5|Psalms 27:1|Psalms 27:4|Psalms 27:14
Psalms 28:7|Psalms 29:11|Psalms 30:5|Psalms 31:24|Psalms 32:8|Psalms 33:12|Psalms 34:1|Psalms 34:8|Psalms 34:18|Psalms 37:4
Psalms 37:5|Psalms 37:7|Psalms 40:1|Psalms 42:1|Psalms 42:11|Psalms 46:1|Psalms 46:10|Psalms 51:10|Psalms 51:12|Psalms 55:22
Psalms 56:3|Psalms 57:10|Psalms 62:1|Psalms 62:8|Psalms 63:1|Psalms 63:3|Psalms 66:16|Psalms 68:19|Psalms 71:5|Psalms 73:26
Psalms 84:10|Psalms 84:11|Psalms 86:5|Psalms 86:11|Psalms 90:2|Psalms 90:12|Psalms 91:1|Psalms 91:2|Psalms 91:11|Psalms 92:1
Psalms 95:1|Psalms 95:6|Psalms 96:1|Psalms 100:4|Psalms 100:5|Psalms 103:1|Psalms 103:2|Psalms 103:8|Psalms 103:12|Psalms 107:1
Psalms 112:7|Psalms 115:1|Psalms 118:24|Psalms 119:9|Psalms 119:11|Psalms 119:18|Psalms 119:105|Psalms 119:114|Psalms 121:1–2|Psalms 121:8
Psalms 126:3|Psalms 127:1|Psalms 130:5|Psalms 136:1|Psalms 138:8|Psalms 139:14|Psalms 139:23|Psalms 143:8|Psalms 145:3|Psalms 145:18
Psalms 147:3|Psalms 150:6
Proverbs 1:7|Proverbs 3:5–6|Proverbs 3:9|Proverbs 4:23|Proverbs 9:10|Proverbs 12:25|Proverbs 14:12|Proverbs 15:1|Proverbs 16:3|Proverbs 16:9
Proverbs 17:17|Proverbs 18:10|Proverbs 18:24|Proverbs 19:21|Proverbs 22:6|Proverbs 27:17|Proverbs 29:25|Proverbs 30:5|Proverbs 31:30
Ecclesiastes 3:1|Ecclesiastes 3:11|Ecclesiastes 4:9|Ecclesiastes 12:13|Song of Solomon 2:4|Song of Solomon 8:7
Isaiah 6:8|Isaiah 9:6|Isaiah 12:2|Isaiah 25:1|Isaiah 26:3|Isaiah 26:4|Isaiah 30:15|Isaiah 30:18|Isaiah 40:8|Isaiah 40:29
Isaiah 40:31|Isaiah 41:10|Isaiah 41:13|Isaiah 43:1|Isaiah 43:2|Isaiah 43:19|Isaiah 43:25|Isaiah 45:22|Isaiah 49:15|Isaiah 49:16
Isaiah 53:5|Isaiah 53:6|Isaiah 54:10|Isaiah 55:6|Isaiah 55:8–9|Isaiah 55:11|Isaiah 58:11|Isaiah 61:1|Isaiah 61:10|Isaiah 64:8|Isaiah 65:24
Jeremiah 1:5|Jeremiah 15:16|Jeremiah 17:7|Jeremiah 29:11|Jeremiah 29:13|Jeremiah 31:3|Jeremiah 32:17|Jeremiah 33:3
Lamentations 3:22–23|Lamentations 3:25|Lamentations 3:40|Ezekiel 34:26|Ezekiel 36:26
Daniel 2:20|Daniel 3:17|Daniel 6:10|Daniel 12:3|Hosea 6:3|Hosea 10:12|Hosea 14:4|Joel 2:13|Joel 2:25|Joel 2:32
Amos 5:24|Obadiah 1:15|Jonah 2:9|Micah 6:8|Micah 7:7|Micah 7:18|Nahum 1:7|Habakkuk 2:14|Habakkuk 3:17–18|Habakkuk 3:19
Zephaniah 3:17|Haggai 2:4|Zechariah 4:6|Zechariah 9:9|Malachi 3:6|Malachi 3:10|Malachi 4:2
Matthew 4:4|Matthew 4:19|Matthew 5:3|Matthew 5:6|Matthew 5:8|Matthew 5:9|Matthew 5:14|Matthew 5:16|Matthew 5:44|Matthew 6:6
Matthew 6:21|Matthew 6:33|Matthew 6:34|Matthew 7:7|Matthew 7:12|Matthew 7:24|Matthew 9:37|Matthew 11:28|Matthew 11:29|Matthew 16:24
Matthew 16:26|Matthew 18:20|Matthew 19:26|Matthew 22:37|Matthew 24:35|Matthew 28:19–20
Mark 1:15|Mark 8:36|Mark 9:23|Mark 10:27|Mark 10:45|Mark 11:24|Mark 12:30|Mark 16:15
Luke 1:37|Luke 1:46|Luke 2:11|Luke 2:14|Luke 6:31|Luke 6:38|Luke 9:23|Luke 11:9|Luke 12:34|Luke 15:7|Luke 18:27|Luke 19:10|Luke 24:6
John 1:1|John 1:5|John 1:12|John 1:14|John 1:29|John 3:16|John 3:17|John 3:30|John 4:24|John 6:35
John 6:68|John 8:12|John 8:32|John 8:36|John 10:10|John 10:11|John 10:27|John 10:28|John 11:25|John 13:34
John 13:35|John 14:1|John 14:2|John 14:6|John 14:15|John 14:21|John 14:27|John 15:5|John 15:7|John 15:12
John 15:13|John 16:33|John 17:3|John 17:17|John 20:29|John 20:31
Acts 1:8|Acts 2:38|Acts 2:42|Acts 4:12|Acts 16:31|Acts 17:28|Acts 20:24|Acts 20:35
Romans 1:16|Romans 3:23|Romans 5:1|Romans 5:5|Romans 5:8|Romans 6:4|Romans 6:23|Romans 8:1|Romans 8:18|Romans 8:26
Romans 8:28|Romans 8:31|Romans 8:37|Romans 8:38–39|Romans 10:9|Romans 10:13|Romans 10:17|Romans 11:33|Romans 11:36|Romans 12:1
Romans 12:2|Romans 12:10|Romans 12:12|Romans 12:21|Romans 13:10|Romans 14:8|Romans 15:4|Romans 15:13
1 Corinthians 1:18|1 Corinthians 2:9|1 Corinthians 6:19–20|1 Corinthians 10:13|1 Corinthians 10:31|1 Corinthians 13:4|1 Corinthians 13:7|1 Corinthians 13:13
1 Corinthians 15:3|1 Corinthians 15:55|1 Corinthians 15:57|1 Corinthians 15:58|1 Corinthians 16:13|1 Corinthians 16:14
2 Corinthians 1:3|2 Corinthians 1:4|2 Corinthians 3:17|2 Corinthians 3:18|2 Corinthians 4:7|2 Corinthians 4:16|2 Corinthians 4:17|2 Corinthians 4:18
2 Corinthians 5:7|2 Corinthians 5:17|2 Corinthians 5:21|2 Corinthians 9:7|2 Corinthians 9:8|2 Corinthians 12:9|2 Corinthians 12:10|2 Corinthians 13:14
Galatians 2:20|Galatians 5:1|Galatians 5:13|Galatians 5:22–23|Galatians 6:2|Galatians 6:9|Galatians 6:14
Ephesians 1:3|Ephesians 1:7|Ephesians 2:8–9|Ephesians 2:10|Ephesians 3:20|Ephesians 4:2|Ephesians 4:15|Ephesians 4:29|Ephesians 4:32|Ephesians 5:2
Ephesians 5:15|Ephesians 5:16|Ephesians 6:10|Ephesians 6:11|Ephesians 6:18
Philippians 1:6|Philippians 1:21|Philippians 2:3|Philippians 2:5|Philippians 2:13|Philippians 3:8|Philippians 3:13–14|Philippians 3:20
Philippians 4:4|Philippians 4:6–7|Philippians 4:8|Philippians 4:11|Philippians 4:13|Philippians 4:19
Colossians 1:17|Colossians 2:6|Colossians 3:2|Colossians 3:12|Colossians 3:13|Colossians 3:15|Colossians 3:16|Colossians 3:17|Colossians 3:23|Colossians 4:2|Colossians 4:6
1 Thessalonians 4:16|1 Thessalonians 5:11|1 Thessalonians 5:16|1 Thessalonians 5:17|1 Thessalonians 5:18|1 Thessalonians 5:24
2 Thessalonians 3:3|2 Thessalonians 3:16|1 Timothy 1:15|1 Timothy 2:5|1 Timothy 4:8|1 Timothy 4:12|1 Timothy 6:6|1 Timothy 6:12
2 Timothy 1:7|2 Timothy 1:12|2 Timothy 2:15|2 Timothy 3:16–17|2 Timothy 4:7|2 Timothy 4:18|Titus 2:11|Titus 3:5|Philemon 1:6
Hebrews 4:12|Hebrews 4:15|Hebrews 4:16|Hebrews 10:23|Hebrews 10:24|Hebrews 11:1|Hebrews 11:6|Hebrews 12:1–2|Hebrews 12:11
Hebrews 13:5|Hebrews 13:8|Hebrews 13:15|Hebrews 13:16
James 1:2|James 1:5|James 1:12|James 1:17|James 1:19|James 1:22|James 4:7|James 4:8|James 4:10|James 5:16
1 Peter 1:3|1 Peter 1:8|1 Peter 2:9|1 Peter 2:24|1 Peter 3:15|1 Peter 4:8|1 Peter 4:10|1 Peter 5:6|1 Peter 5:7|1 Peter 5:10
2 Peter 1:3|2 Peter 3:9|2 Peter 3:18|1 John 1:7|1 John 1:9|1 John 3:1|1 John 3:18|1 John 4:4|1 John 4:7|1 John 4:8
1 John 4:10|1 John 4:18|1 John 4:19|1 John 5:4|1 John 5:14|2 John 1:6|3 John 1:4|Jude 1:24–25
Revelation 1:8|Revelation 3:20|Revelation 4:11|Revelation 5:12|Revelation 7:17|Revelation 21:4|Revelation 21:5|Revelation 22:13|Revelation 22:20
`.trim().split(/[|\n]/).map((s) => s.trim()).filter(Boolean)

// Day of a common year (1 = 1 January) → verse, for dates that call for one.
const PINNED = { 1: 'Genesis 1:1', 359: 'Luke 2:11', 365: 'Revelation 22:20' }

if (new Set(VERSES).size !== VERSES.length) throw new Error('duplicate verse')

// Deterministic shuffle (mulberry32), so regenerating gives the same plan.
let seed = 284
const random = () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pool = VERSES.filter((v) => !Object.values(PINNED).includes(v))
for (let i = pool.length - 1; i > 0; i--) {
  const j = Math.floor(random() * (i + 1))
  ;[pool[i], pool[j]] = [pool[j], pool[i]]
}

const days = {}
for (let d = 1; d <= 365; d++) days[d] = [PINNED[d] ?? pool.shift() ?? VERSES[(d * 7) % VERSES.length]]

const plan = {
  id: 'verse-a-day',
  name: 'Verse a day',
  kind: 'verse',
  about: 'One well-known verse each day (Genesis 1:1 on 1 January, Luke 2:11 on Christmas Day, Revelation 22:20 on 31 December).',
  leapDay: 'repeat',
  days,
}
writeFileSync(new URL('../src/scripture/plans/verse-a-day.json', import.meta.url), JSON.stringify(plan, null, 1) + '\n')
console.log(`${VERSES.length} verses → 365 days, ${pool.length} unused`)
