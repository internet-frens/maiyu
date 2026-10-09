// Your bond with each character, in points: a day together, and a little more
// for a win, a hello, something they love, their birthday, or coming back.
// Slow on purpose, and never from tokens or clicks: each reason counts once a
// day, and a day counts for at most six

import type { Tally } from '../achievements/types'

export type BondReason = 'day' | 'win' | 'hi' | 'favorite' | 'birthday' | 'anniversary' | 'reunion'

export const WEIGHTS: Record<BondReason, number> = { day: 2, win: 1, hi: 1, favorite: 1, birthday: 2, anniversary: 2, reunion: 1 }
export const DAILY_CAP = 6

// Points for each heart: a day together is two, so the first five are the old
// 2, 5, 10, 20 and 35 days, and nobody loses a heart they had. Then five more,
// the hearts turning gold one by one, over months: the last at about 140 days
// together, a year or so of coding a few days a week
export const HEART_POINTS = [4, 10, 20, 40, 70, 120, 190, 280, 400, 560] as const
/** Hearts shown at once: past five, they turn gold */
export const HEART_SLOTS = 5

/** The reasons each day counted, merged from every session */
export function reasonsByDay(tallies: readonly Tally[], id: string): Map<string, Set<BondReason>> {
  const byDay = new Map<string, Set<BondReason>>()
  const add = (day: string, reason: BondReason) => {
    const set = byDay.get(day) ?? new Set<BondReason>()
    set.add(reason)
    byDay.set(day, set)
  }
  for (const t of tallies) {
    for (const day of t.with?.[id] ?? []) add(day, 'day')
    for (const [day, reasons] of Object.entries(t.bond?.[id] ?? {})) for (const r of reasons) add(day, r as BondReason)
  }
  return byDay
}

export function pointsWith(tallies: readonly Tally[], id: string): number {
  let total = 0
  for (const reasons of reasonsByDay(tallies, id).values()) {
    total += Math.min(DAILY_CAP, [...reasons].reduce((sum, r) => sum + (WEIGHTS[r] ?? 0), 0))
  }
  return total
}

// The different days spent with a character, across every session
export function daysWith(tallies: readonly Tally[], id: string): number {
  return new Set(tallies.flatMap(t => t.with?.[id] ?? [])).size
}

export function heartsFor(points: number): number {
  return HEART_POINTS.filter(p => points >= p).length
}

// Points still to go before the next heart, or undefined at every heart
export function toNextHeart(points: number): number | undefined {
  const next = HEART_POINTS.find(p => points < p)
  return next === undefined ? undefined : next - points
}

// How far from the last heart to the next, out of 1
export function towardNext(points: number): number {
  const hearts = heartsFor(points)
  if (hearts >= HEART_POINTS.length) return 1
  const from = hearts === 0 ? 0 : HEART_POINTS[hearts - 1]!
  const to = HEART_POINTS[hearts]!
  return (points - from) / (to - from)
}

/** Five slots: gold for the second round, pink for the first, empty for none yet */
export function heartSlots(hearts: number): { gold: number; pink: number; empty: number } {
  const gold = Math.max(0, Math.min(HEART_SLOTS, hearts - HEART_SLOTS))
  const filled = Math.min(HEART_SLOTS, hearts)
  return { gold, pink: filled - gold, empty: HEART_SLOTS - filled }
}

/** In plain text, where there's no gold: "♥ ♥ · · ·", and past five,
 * "♥ ♥ ♥ ♥ ♥  ★ ★ ☆ ☆ ☆". A space between each, and · not ♡ for the ones to
 * come: many fonts draw ♥, ♡ and the stars wider than a cell, crowding the next */
export const heartsBar = (hearts: number) => {
  const row = (marks: string[]) => marks.join(' ')
  if (hearts <= HEART_SLOTS) return row([...Array<string>(hearts).fill('♥'), ...Array<string>(HEART_SLOTS - hearts).fill('·')])
  const { gold } = heartSlots(hearts)
  return `${row(Array<string>(HEART_SLOTS).fill('♥'))}  ${row([...Array<string>(gold).fill('★'), ...Array<string>(HEART_SLOTS - gold).fill('☆')])}`
}

// The bar to the next heart, in five steps: "▰▰▰▱▱"
export const progressBar = (points: number) => {
  const filled = Math.floor(towardNext(points) * 5)
  return '▰'.repeat(filled) + '▱'.repeat(5 - filled)
}

// Anniversaries of the day you met: the date it falls on in a given year
// (a February 29th meeting is kept on the 28th in other years)
function anniversaryIn(met: string, year: number): Date {
  const [, m = 1, d = 1] = met.split('-').map(Number)
  const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
  return new Date(year, m - 1, m === 2 && d === 29 && !isLeap(year) ? 28 : d)
}

/** How many years since you met, if today's the anniversary */
export function anniversaryOn(met: string | undefined, at: Date): number | undefined {
  if (!met) return undefined
  const metYear = Number(met.split('-')[0])
  const day = anniversaryIn(met, at.getFullYear())
  const years = at.getFullYear() - metYear
  return years >= 1 && day.getMonth() === at.getMonth() && day.getDate() === at.getDate() ? years : undefined
}

/** Days until the next anniversary, and which one */
export function nextAnniversary(met: string | undefined, at: Date): { inDays: number; years: number } | undefined {
  if (!met) return undefined
  const metYear = Number(met.split('-')[0])
  const today = new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime()
  for (const year of [at.getFullYear(), at.getFullYear() + 1]) {
    const day = anniversaryIn(met, year)
    if (year - metYear >= 1 && day.getTime() >= today) {
      return { inDays: Math.round((day.getTime() - today) / 86_400_000), years: year - metYear }
    }
  }
  return undefined
}

/** Things a character loves you doing; each counts once a day */
export type FavoriteKind = 'lateNight' | 'weekend' | 'morning' | 'rain' | 'evening'
