// Sharing how you use them: on unless you turn it off (/frens share off), said
// plainly the first time, and nothing personal, ever. What's counted is which lines they said (by id, like
// "kai.failing.2", never the words) on top of what the mod already counts for
// achievements; what's shared is the report below, which /frens share shows in
// full. No code, prompts, file or project names, places or weather.

import type { EventName, Tally } from '../achievements/types'

export const SHARE_KEY = 'shareUsage'
export const USAGE_PREFIX = 'usage:'
export const SENT_KEY = 'usageSent'
/** Set once the first-time notice about sharing has been shown */
export const SHARE_NOTICE_KEY = 'shareNoticed'
/** Where reports go. Empty: nowhere yet, so nothing is ever sent */
export const USAGE_URL = ''

/** One session's count of the lines said, by id */
export type Usage = { lines: Record<string, number> }

export function asUsage(value: unknown): Usage {
  const lines = (value as Usage | undefined)?.lines
  if (lines === null || typeof lines !== 'object') return { lines: {} }
  return { lines: Object.fromEntries(Object.entries(lines).filter((x): x is [string, number] => typeof x[1] === 'number')) }
}

export const heard = (u: Usage, id: string): Usage => ({ lines: { ...u.lines, [id]: (u.lines[id] ?? 0) + 1 } })

/** Everything a report holds, and nothing else */
export type Report = {
  /** Who's your buddy now */
  character: string
  /** Different days you've coded together */
  days: number
  /** Hearts with each character */
  hearts: Record<string, number>
  achievements: string[]
  /** How often each thing happened: prompts, commits, checks fixed… */
  events: Partial<Record<EventName, number>>
  /** How often each line was said, by id */
  lines: Record<string, number>
}

export function report(
  character: string,
  tallies: readonly Tally[],
  usages: readonly Usage[],
  hearts: Record<string, number>,
  achievements: readonly string[],
): Report {
  const events: Partial<Record<EventName, number>> = {}
  for (const t of tallies) for (const [name, n] of Object.entries(t.counts)) events[name as EventName] = (events[name as EventName] ?? 0) + (n ?? 0)
  const lines: Record<string, number> = {}
  for (const u of usages) for (const [id, n] of Object.entries(u.lines)) lines[id] = (lines[id] ?? 0) + n
  const days = new Set(tallies.flatMap(t => t.days.prompt ?? [])).size
  return { character, days, hearts, achievements: [...achievements], events, lines }
}
