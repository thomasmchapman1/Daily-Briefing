import { daysBetween, fromIsoDate } from '../lib/date'
import { load, save } from '../lib/storage'
import bundled from './program.json'

export interface Exercise {
  name: string
  spec: string
}

export interface ProgramDay {
  title: string
  minutes: number
  exercises: Exercise[]
}

export interface Program {
  name: string
  weeks: { days: ProgramDay[] }[]
}

export const DAYS_PER_WEEK = 7

/** The plan shipped with the app (src/workout/program.json). */
export const DEFAULT_PROGRAM: Program = bundled

/** Make any stored or edited plan safe to use: 1+ weeks of 7 days, named days, no blank exercises. */
export function normalizeProgram(input: unknown): Program {
  const p = (input ?? {}) as Partial<Program>
  const weeks = Array.isArray(p.weeks) ? p.weeks : []
  const out: Program = {
    name: typeof p.name === 'string' && p.name.trim() ? p.name.trim() : 'My plan',
    weeks: weeks.map((w) => {
      const days = Array.isArray(w?.days) ? w.days : []
      return {
        days: Array.from({ length: DAYS_PER_WEEK }, (_, i) => {
          const d = (days[i] ?? {}) as Partial<ProgramDay>
          const exercises = (Array.isArray(d.exercises) ? d.exercises : [])
            .map((e) => ({ name: String(e?.name ?? '').trim(), spec: String(e?.spec ?? '').trim() }))
            .filter((e) => e.name)
          const title = String(d.title ?? '').trim()
          const minutes = Math.max(0, Math.round(Number(d.minutes) || 0))
          return { title: title || (exercises.length ? 'Workout' : 'Rest day'), minutes: exercises.length ? minutes : 0, exercises }
        }),
      }
    }),
  }
  return out.weeks.length ? out : DEFAULT_PROGRAM
}

/** The plan in use: the one edited in settings, or the bundled default. */
export function loadProgram(): Program {
  const saved = load<Program | null>('program', null)
  return saved ? normalizeProgram(saved) : DEFAULT_PROGRAM
}

export function saveProgram(p: Program): Program {
  const clean = normalizeProgram(p)
  save('program', clean)
  return clean
}

/** Forget edits and go back to the bundled plan. */
export function resetProgram(): Program {
  save('program', null)
  return DEFAULT_PROGRAM
}

export interface TodayWorkout extends ProgramDay {
  week: number
  day: number
  rest: boolean
}

/** Current week/day of the programme, counted from its start date. Loops when it ends. */
export function getWorkout(date: Date, programStart: string, p: Program = DEFAULT_PROGRAM): TodayWorkout {
  const flat = p.weeks.flatMap((w, wi) => w.days.map((d, di) => ({ ...d, week: wi + 1, day: di + 1 })))
  const elapsed = daysBetween(fromIsoDate(programStart), date)
  const entry = flat[((elapsed % flat.length) + flat.length) % flat.length]
  return { ...entry, rest: entry.exercises.length === 0 }
}

export type WorkoutLog = Record<string, Record<number, true>>

export function loadWorkoutLog(): WorkoutLog {
  return load<WorkoutLog>('workoutLog', {})
}

export function toggleExercise(log: WorkoutLog, date: string, index: number): WorkoutLog {
  const day = { ...(log[date] ?? {}) }
  if (day[index]) delete day[index]
  else day[index] = true
  const next = { ...log, [date]: day }
  save('workoutLog', next)
  return next
}

// ---------- Import from a Claude chat (copy a prompt out, paste the reply in) ----------

/** The prompt to paste into Claude. Includes the current plan, if given, so Claude can edit it. */
export function planPrompt(programStart: string, current?: Program): string {
  const firstDay = fromIsoDate(programStart).toLocaleDateString('en-GB', { weekday: 'long' })
  const lines = [
    'Please write my workout plan for my morning briefing app. Reply with only one JSON code block, in exactly this format:',
    '',
    '```json',
    '{',
    '  "name": "Plan name",',
    '  "weeks": [',
    '    { "days": [',
    '      { "title": "Lower body", "minutes": 50, "exercises": [',
    '        { "name": "Back squat", "spec": "4 × 6 · 185 lb" }',
    '      ] },',
    '      { "title": "Rest day", "minutes": 0, "exercises": [] }',
    '    ] }',
    '  ]',
    '}',
    '```',
    '',
    'Rules:',
    `- Every week has exactly ${DAYS_PER_WEEK} days, in order. Day 1 is a ${firstDay}.`,
    '- A rest day has "exercises": [].',
    '- "spec" is short free text: sets × reps · load, a distance, or a time.',
    '- Use as many weeks as the plan needs; the app repeats them in a loop. Write out every week in full.',
  ]
  if (current) lines.push('', 'Here is my current plan to start from:', '', '```json', JSON.stringify(current), '```')
  lines.push('', 'Here’s what I want: ')
  return lines.join('\n')
}

export type ParsedPlan = { ok: true; program: Program } | { ok: false; error: string }

/** Find and check a plan in pasted text: a reply from Claude, a ```json block, or bare JSON. */
export function parsePlanText(text: string): ParsedPlan {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  let body = (fenced ? fenced[1] : text).trim()
  if (!fenced) {
    const start = body.search(/[[{]/)
    const end = Math.max(body.lastIndexOf('}'), body.lastIndexOf(']'))
    if (start < 0 || end < start) return { ok: false, error: 'No plan found. Paste Claude’s whole reply, including the code block.' }
    body = body.slice(start, end + 1)
  }
  let data: unknown
  try {
    data = JSON.parse(body)
  } catch {
    return { ok: false, error: 'The plan looks cut off or garbled. Ask Claude to send it again as one JSON code block.' }
  }
  const raw = Array.isArray(data) ? { weeks: data } : (data as Partial<Program>)
  if (!raw || !Array.isArray(raw.weeks) || raw.weeks.length === 0) {
    return { ok: false, error: 'That text has no "weeks" list, so it isn’t a training plan.' }
  }
  if (!raw.weeks.every((w) => Array.isArray(w?.days) && w.days.length > 0)) {
    return { ok: false, error: 'Every week needs a "days" list. Ask Claude to write each week out in full.' }
  }
  const program = normalizeProgram(raw)
  if (!program.weeks.some((w) => w.days.some((d) => d.exercises.length))) {
    return { ok: false, error: 'The plan has no exercises in it.' }
  }
  return { ok: true, program }
}
