// Their own little routine: a tea break after a long stretch of work, a coffee
// in the morning, and a bite to eat around mealtimes. Neither ever holds up Claude: work calls their back.

export const TICK_MS = 250
const ticks = (minutes: number) => (minutes * 60 * 1000) / TICK_MS

// Work this long without a pause and they take a break when things go quiet
export const BREAK_AFTER = ticks(45)
export const BREAK_FOR = ticks(5)
export const SNACK_FOR = ticks(3)

const MEALS: [number, number, string][] = [
  [8, 9, 'breakfast'],
  [12, 13, 'lunch'],
  [18, 19, 'dinner'],
]

// The meal it's time for, keyed by day so they have each one once
export function mealtime(now: number): { key: string; name: string } | undefined {
  const at = new Date(now)
  const hour = at.getHours()
  const meal = MEALS.find(([from, to]) => hour >= from && hour < to)
  if (!meal) return undefined
  const day = `${at.getFullYear()}-${at.getMonth() + 1}-${at.getDate()}`
  return { key: `${day}:${meal[2]}`, name: meal[2] }
}

// One coffee break a morning, at a time of its own each day between half past
// nine and noon, so it isn't always on the dot. Keyed by day so it's once
export const COFFEE_FOR = ticks(2)
const COFFEE_FROM = 9 * 60 + 30
const COFFEE_UNTIL = 12 * 60

export function coffeeTime(now: number): string | undefined {
  const at = new Date(now)
  const day = `${at.getFullYear()}-${at.getMonth() + 1}-${at.getDate()}`
  let seed = 0
  for (const ch of day) seed = (seed * 31 + ch.charCodeAt(0)) % 9973
  const start = COFFEE_FROM + (seed % (COFFEE_UNTIL - COFFEE_FROM - 30))
  const minute = at.getHours() * 60 + at.getMinutes()
  return minute >= start && minute < COFFEE_UNTIL ? `${day}:coffee` : undefined
}

// Every hour and a half or so, while you're around, they sip some water and
// gently remind you to have some. Nothing to answer, nothing counted
export const WATER_EVERY = ticks(90)
export const WATER_FOR = ticks(2)
// You count as around if you typed or sent something this recently
export const AROUND = ticks(10)

// An hour without you typing or sending anything, and they say they miss you:
// once for each time you're away, however long
export const MISS_AFTER = ticks(60)
export const MISS_FOR = ticks(10)

// A line to use next: any but the last one, varied by the moment
export function nextLine(count: number, last: number, frame: number): number {
  if (count <= 1) return 0
  const step = 1 + (frame % (count - 1))
  return ((last < 0 ? 0 : last) + step) % count
}
