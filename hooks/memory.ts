// What they remember: your big wins, and how many days in a row you've coded
// together. Each session keeps its own list under its own key; they merge on read

import { dateOf } from '../achievements/progress'

export const MEMORY_PREFIX = 'memories:'
// About two months of memories, and never too many
const KEEP_DAYS = 62
const KEEP = 120

/**
 * A big win, in plain words: "the tests went green again". A comeback, a check
 * won after a long fight, gets brought up when that check fails again
 */
export type Memory = { day: string; what: string; kind?: 'comeback' }

// The latest comeback from before today, to bring up when a check fails again
export function lastComeback(list: readonly Memory[], today: string): (Memory & { when: string }) | undefined {
  const m = [...list].reverse().find(x => x.kind === 'comeback' && agoOf(x.day, today) !== undefined)
  return m ? { ...m, when: agoOf(m.day, today)!.when } : undefined
}


export const daysBetween = (from: string, to: string) => Math.round((dateOf(to).getTime() - dateOf(from).getTime()) / 86_400_000)

export function remember(list: readonly Memory[], m: Memory, today: string): Memory[] {
  const fresh = list.filter(x => daysBetween(x.day, today) <= KEEP_DAYS)
  // The same win twice in a day is one memory
  if (fresh.some(x => x.day === m.day && x.what === m.what)) return fresh
  return [...fresh, m].slice(-KEEP)
}

export function asMemories(value: unknown): Memory[] {
  if (!Array.isArray(value)) return []
  return value.filter((m): m is Memory => typeof m?.day === 'string' && typeof m?.what === 'string')
}

// Days in a row, ending today (or yesterday, if you haven't been around yet today)
export function streak(days: readonly string[], today: string): number {
  const set = new Set(days)
  let day = set.has(today) ? today : undefined
  if (day === undefined) {
    const y = dateOf(today)
    y.setDate(y.getDate() - 1)
    const yesterday = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`
    if (!set.has(yesterday)) return 0
    day = yesterday
  }
  let n = 0
  const d = dateOf(day)
  while (set.has(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`)) {
    n += 1
    d.setDate(d.getDate() - 1)
  }
  return n
}

// The longest run of days in a row, ever
export function bestStreak(days: readonly string[]): number {
  const sorted = [...new Set(days)].sort((a, b) => dateOf(a).getTime() - dateOf(b).getTime())
  let best = 0
  let run = 0
  sorted.forEach((day, i) => {
    run = i > 0 && daysBetween(sorted[i - 1]!, day) === 1 ? run + 1 : 1
    best = Math.max(best, run)
  })
  return best
}

export type Ago = 'yesterday' | 'week' | 'month'

// How long ago, in words: "yesterday", "last Tuesday", "a week ago", "3 weeks ago"
export function agoOf(day: string, today: string): { ago: Ago; when: string } | undefined {
  const days = daysBetween(day, today)
  if (days < 1) return undefined
  if (days === 1) return { ago: 'yesterday', when: 'yesterday' }
  if (days < 7) return { ago: 'week', when: `last ${dateOf(day).toLocaleDateString('en', { weekday: 'long' })}` }
  if (days < 14) return { ago: 'week', when: 'a week ago' }
  return { ago: 'month', when: days < 45 ? `${Math.round(days / 7)} weeks ago` : 'a month or so ago' }
}

// A memory worth bringing up: from before today, picked so it changes day to day
export function recall(list: readonly Memory[], today: string, seed: number): (Memory & { ago: Ago; when: string }) | undefined {
  const older = list.flatMap(m => {
    const a = agoOf(m.day, today)
    return a ? [{ ...m, ...a }] : []
  })
  return older.length === 0 ? undefined : older[seed % older.length]
}
