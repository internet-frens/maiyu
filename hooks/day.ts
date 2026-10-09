// A day as a loop: a morning letter about yesterday and what's coming, and a
// wrap-up when the evening winds down

import { dateOf } from '../achievements/progress'
import type { EventName, Tally } from '../achievements/types'
import { SPECIAL_DAYS, nextDate } from '../events/calendar'

export type DayCounts = Partial<Record<EventName, number>>

// Every session's counts for one day, added up
export function countsOn(tallies: readonly Tally[], day: string): DayCounts {
  const out: DayCounts = {}
  for (const t of tallies) {
    for (const [event, n] of Object.entries(t.byDay?.[day] ?? {}) as [EventName, number][]) out[event] = (out[event] ?? 0) + n
  }
  return out
}

// The last day before today that anything happened on: yesterday, or Friday after a weekend away
export function lastDayBefore(tallies: readonly Tally[], today: string): string | undefined {
  const before = dateOf(today).getTime()
  const days = new Set(tallies.flatMap(t => Object.keys(t.byDay ?? {})))
  return [...days].filter(d => dateOf(d).getTime() < before).sort((a, b) => dateOf(b).getTime() - dateOf(a).getTime())[0]
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// What a day held, in plain words: "9 asks · 4 files changed · 2 commits"
export function describeDay(c: DayCounts): string[] {
  const out: string[] = []
  if (c.prompt) out.push(plural(c.prompt, 'ask'))
  if (c.fileChanged) out.push(`${plural(c.fileChanged, 'file')} changed`)
  if (c.commit) out.push(plural(c.commit, 'commit'))
  if (c.checkFixed) out.push(c.checkFixed === 1 ? 'fixed a failing check' : `fixed ${c.checkFixed} failing checks`)
  if (c.pullRequest) out.push(plural(c.pullRequest, 'pull request'))
  return out
}

// How long ago a day was, as people say it
export function whenWas(day: string, today: string): string {
  const days = Math.round((dateOf(today).getTime() - dateOf(day).getTime()) / 86_400_000)
  if (days <= 1) return 'yesterday'
  if (days < 7) return `on ${dateOf(day).toLocaleDateString('en', { weekday: 'long' })}`
  return `${days} days ago`
}

// The nearest special day coming up this week (not today), counted to the day itself
export function comingUp(at: Date, country: string | undefined, off: readonly string[]): { name: string; inDays: number } | undefined {
  const today = new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime()
  const soon = SPECIAL_DAYS.filter(d => !off.includes(d.id) && (d.countries === undefined || d.countries.includes((country ?? '').toUpperCase())))
    .map(d => ({ name: d.name, date: nextDate(d.when, at) }))
    .map(d => ({ name: d.name, inDays: d.date ? Math.round((d.date.getTime() - today) / 86_400_000) : Infinity }))
    .filter(d => d.inDays >= 1 && d.inDays <= 7)
    .sort((a, b) => a.inDays - b.inDays)
  return soon[0]
}
