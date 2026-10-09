// Each season worn and felt: a little seasonal piece on any character, and the
// season in the air around them

import type { Palette } from '../characters/types'
import type { Accessory, Air } from './sprite'
import type { Season } from './world'

export const SEASONAL: Record<Season, Accessory> = {
  // A flower clip in the hair
  spring: {
    id: 'spring',
    slot: 'hair',
    name: 'Flower Clip',
    kind: 'accessory',
    at: { x: 20, y: 8 },
    pixels: [':1:', '121', ':1:'],
    colors: { '1': 0xff9ec7, '2': 0xffe066 },
  },
  // Sunglasses pushed up on the head
  summer: {
    id: 'summer',
    slot: 'head',
    name: 'Sunglasses',
    kind: 'accessory',
    at: { x: 11, y: 5 },
    pixels: ['1111::1111', '1221111221'],
    colors: { '1': 0x2b2d3a, '2': 0x3a5f8a },
  },
  // A striped knit scarf in warm colors
  autumn: {
    id: 'autumn',
    slot: 'neck',
    name: 'Knit Scarf',
    kind: 'accessory',
    at: { x: 10, y: 28 },
    pixels: [':1212121212:', '121212121212', ':2121212121:', '::::::::12::', '::::::::21::', '::::::::12::'],
    colors: { '1': 0xd4622a, '2': 0x8f3b1e },
  },
  // A thick scarf for the cold
  winter: {
    id: 'winter',
    slot: 'neck',
    name: 'Winter Scarf',
    kind: 'accessory',
    at: { x: 10, y: 28 },
    pixels: [':1111111111:', '122112211221', ':1111111111:', '::::::::22::', '::::::::11::', '::::::::22::'],
    colors: { '1': 0xe8eef7, '2': 0x5b7fb8 },
  },
}

// Hot enough that they'll remind you about water sooner, cold enough for rosy cheeks
export const isHot = (temperature: number, unit: 'C' | 'F') => (unit === 'F' ? temperature >= 82 : temperature >= 28)
export const isCold = (temperature: number, unit: 'C' | 'F') => (unit === 'F' ? temperature <= 41 : temperature <= 5)

/** How much of the season shows: now and then (the default), all the time, or not at all */
export type SeasonShow = 'subtle' | 'full' | 'off'

// A seasonal moment: for about a minute after something happens (a win, a
// hello, you coming back), a few drifting in, then out again. `age` is the
// ticks of a quarter second since then. Zero means none right now
const MOMENT = 60 * 4
const FADE = 12 * 4
export function seasonMoment(age: number): number {
  const at = age
  if (at < 0 || at >= MOMENT) return 0

  const edge = Math.min(at, MOMENT - at)
  return edge >= FADE ? 4 : Math.max(1, Math.ceil((edge / FADE) * 4))
}

// What's in the air in each season; winter waits for real snow
export function seasonAir(season: Season, isNight: boolean): Air | undefined {
  if (season === 'spring') return 'petals'
  if (season === 'summer') return isNight ? 'fireflies' : 'sparkles'
  if (season === 'autumn') return 'leaves'
  return undefined
}

// Dressing for the weather: a beanie and scarf in the freezing cold, a yellow
// raincoat in the rain, light layers in the heat

export const BEANIE: Accessory = {
  id: 'beanie',
  name: 'Knit Beanie',
  kind: 'accessory',
  slot: 'head',
  at: { x: 9, y: 1 },
  pixels: [':::::3333:::::', '::1111111111::', ':111111111111:', '22222222222222', '21212121212121'],
  colors: { '1': 0x5b7fb8, '2': 0x3f5f94, '3': 0xe8eef7 },
}

export const RAINCOAT: Partial<Palette> = { top: 0xf2c94c, topShade: 0xc9a227 }
export const SUMMER_LAYERS: Partial<Palette> = { top: 0xdfe9f2, topShade: 0xb9c9d8 }

/** What they wear for the weather: pieces, and colors over their outfit */
export function dressFor(w: { sky: string; temperature: number; unit: 'C' | 'F' } | undefined): {
  pieces: Accessory[]
  palette?: Partial<Palette>
} {
  if (w === undefined) return { pieces: [] }
  const wet = w.sky === 'rain' || w.sky === 'drizzle' || w.sky === 'storm'
  if (isCold(w.temperature, w.unit)) return { pieces: [BEANIE, SEASONAL.winter], palette: wet ? RAINCOAT : undefined }
  if (wet) return { pieces: [], palette: RAINCOAT }
  if (isHot(w.temperature, w.unit)) return { pieces: [SEASONAL.summer], palette: SUMMER_LAYERS }
  return { pieces: [] }
}

// Pieces in slots: a later one in the same slot replaces the earlier
export function layered(pieces: readonly Accessory[]): Accessory[] {
  const bySlot = new Map<string, Accessory>()
  pieces.forEach((p, i) => bySlot.set(p.slot ?? `free-${i}`, p))
  return [...bySlot.values()]
}
