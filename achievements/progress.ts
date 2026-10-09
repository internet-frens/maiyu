// Counting toward achievements. Each session keeps its own tally under its own
// key in the shared store; progress merges every session's tally when it's read.

import { ACHIEVEMENTS } from './list'
import type { Achievement, EventName, Measure, Tally } from './types'
import { heartsFor, pointsWith } from '../hooks/bond'


export const TALLY_PREFIX = 'progress:'
export const UNLOCKED_KEY = 'unlocked'
export const WEARING_KEY = 'wearing'
// Enough days for a year of streaks, without a tally growing forever
const MAX_DAYS = 400
// Day-by-day counts kept for the letter and the wrap-up
const KEEP_DAYS = 14

// A day as the person's own calendar has it
export function dayOf(now: number): string {
  const at = new Date(now)
  return `${at.getFullYear()}-${at.getMonth() + 1}-${at.getDate()}`
}

// Midnight to 4 in the morning counts as late
export const isLate = (now: number) => new Date(now).getHours() < 4

export function count(tally: Tally, event: EventName, day: string): Tally {
  const days = tally.days[event] ?? []
  const today = tally.byDay?.[day] ?? {}
  const byDay = { ...tally.byDay, [day]: { ...today, [event]: (today[event] ?? 0) + 1 } }
  // Only the last two weeks of days
  const kept = Object.keys(byDay).sort((a, b) => dateOf(b).getTime() - dateOf(a).getTime()).slice(0, KEEP_DAYS)
  // Everything else in the tally carries over, days together included
  return {
    ...tally,
    counts: { ...tally.counts, [event]: (tally.counts[event] ?? 0) + 1 },
    days: { ...tally.days, [event]: days.includes(day) ? days : [...days, day].slice(-MAX_DAYS) },
    byDay: Object.fromEntries(kept.map(d => [d, byDay[d]!])),
  }
}

// A day spent with a character
export function together(tally: Tally, id: string, day: string): Tally {
  const days = tally.with?.[id] ?? []
  return days.includes(day) ? tally : { ...tally, with: { ...tally.with, [id]: [...days, day].slice(-MAX_DAYS) } }
}

// A reason a day counted toward your bond with a character, once a day each
export function bonded(tally: Tally, id: string, day: string, reason: string): Tally {
  const days = tally.bond?.[id] ?? {}
  const reasons = days[day] ?? []
  if (reasons.includes(reason)) return tally
  // Only the last year of days
  const kept = Object.keys(days).sort((a, b) => dateOf(b).getTime() - dateOf(a).getTime()).slice(0, MAX_DAYS)
  const trimmed = Object.fromEntries(kept.map(d => [d, days[d]!]))
  return { ...tally, bond: { ...tally.bond, [id]: { ...trimmed, [day]: [...reasons, reason] } } }
}

// A day key back into a date
export function dateOf(day: string): Date {
  const [y = 0, m = 1, d = 1] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// A stored value that is a usable tally, whatever an older version wrote
export function asTally(value: unknown): Tally {
  const v = value as Partial<Tally> | undefined
  return {
    counts: v && typeof v.counts === 'object' && v.counts !== null ? v.counts : {},
    days: v && typeof v.days === 'object' && v.days !== null ? v.days : {},
    byDay: v && typeof v.byDay === 'object' && v.byDay !== null ? v.byDay : {},
    with: v && typeof v.with === 'object' && v.with !== null ? v.with : {},
    bond: v && typeof v.bond === 'object' && v.bond !== null ? v.bond : {},
  }
}

// How far every session together has got on a measure
export function measure(m: Measure, tallies: readonly Tally[]): number {
  switch (m.by) {
    case 'count':
      return tallies.reduce((sum, t) => sum + (t.counts[m.event] ?? 0), 0)
    case 'days':
      return new Set(tallies.flatMap(t => t.days[m.event] ?? [])).size
    case 'sessionsOnOneDay': {
      const sessionsOn = new Map<string, number>()
      for (const t of tallies) for (const day of t.days[m.event] ?? []) sessionsOn.set(day, (sessionsOn.get(day) ?? 0) + 1)
      return Math.max(0, ...sessionsOn.values())
    }
    case 'hearts': {
      const ids = new Set(tallies.flatMap(t => [...Object.keys(t.with ?? {}), ...Object.keys(t.bond ?? {})]))
      return Math.max(0, ...[...ids].map(id => heartsFor(pointsWith(tallies, id))))
    }

  }
}

export type Progress = { achievement: Achievement; value: number; isDone: boolean }

export function progress(tallies: readonly Tally[], list: readonly Achievement[] = ACHIEVEMENTS): Progress[] {
  return list.map(achievement => {
    const value = Math.min(achievement.goal, measure(achievement.measure, tallies))
    return { achievement, value, isDone: value >= achievement.goal }
  })
}

// The achievements newly done: done now, and not in the list already unlocked
export const newlyDone = (all: readonly Progress[], unlocked: readonly string[]) =>
  all.filter(p => p.isDone && !unlocked.includes(p.achievement.id))
