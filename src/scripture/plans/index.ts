import type { ReadingPlan } from '../types'

// Every plans/*.json file is a plan; drop a new file here to add one.
const files = import.meta.glob<ReadingPlan>('./*.json', { eager: true, import: 'default' })

export const PLANS: Record<string, ReadingPlan> = Object.fromEntries(
  Object.values(files).map((plan) => [plan.id, plan]),
)

export const DEFAULT_PLAN = 'verse-a-day'

export function getPlan(id: string): ReadingPlan {
  return PLANS[id] ?? PLANS[DEFAULT_PLAN]
}
