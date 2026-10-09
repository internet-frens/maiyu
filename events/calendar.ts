// Special days: holidays, festivals, and a few for programmers. Each is data:
// when it is, what's worn, what's in the air, and a line for the day. A
// character can say it their own way in `voice.events`.

import type { Accessory, Air } from '../hooks/sprite'

export type When =
  /** The same date every year, with `before` days of lead-up */
  | { month: number; day: number; before?: number }
  /** The nth weekday of a month: US Thanksgiving is the 4th Thursday (4) of November */
  | { month: number; weekday: number; nth: number }
  /** Dates that move every year, listed out */
  | { dates: string[]; days?: number }

/** What a special day dresses this character in: their own, or everyone's */
export const wornBy = (d: Pick<SpecialDay, 'wears' | 'wearsFor'>, characterId: string): Accessory | undefined => d.wearsFor?.[characterId] ?? d.wears

export type SpecialDay = {
  id: string
  name: string
  when: When
  /** Only where you are, by country code, as your weather lookup finds it */
  countries?: string[]
  /** Worn in place of the season's piece */
  wears?: Accessory
  /** Each character's own, by id, in place of `wears` */
  wearsFor?: Record<string, Accessory>
  air?: Air
  /** Said once, the first time you're around that day */
  line: string
}

const hat = (id: string, name: string, pixels: string[], colors: Accessory['colors']): Accessory => ({
  id,
  name,
  kind: 'accessory',
  slot: 'head',
  at: { x: 11, y: 0 },
  pixels,
  colors,
})

const clip = (id: string, name: string, petal: number, middle: number): Accessory => ({
  id,
  name,
  kind: 'accessory',
  slot: 'hair',
  at: { x: 20, y: 8 },
  pixels: [':1:', '121', ':1:'],
  colors: { '1': petal, '2': middle },
})

// Big and floppy, the tip hanging down one side to its pompom, but narrower
// than their hair, which shows either side, and up on the crown of their head:
// they sit five pixels lower to make room for it
const SANTA_HAT: Accessory = {
  ...hat(
    'santa-hat',
    'Santa Hat',
    [
      '::::::::111:::::::',
      '::::::1111111:::::',
      ':::::1111111111:::',
      '::::111111111111::',
      '::::11111111111111',
      ':::111111111111133',
      ':::111111111111:33',
      '::11111111111111::',
      '::111111111111::::',
      ':2222222222222222:',
      ':2222222222222222:',
    ],
    { '1': 0xd7263d, '2': 0xfafafa, '3': 0xfafafa },
  ),
  at: { x: 7, y: 1 },
  sink: 5,
}
const WITCH_HAT: Accessory = {
  id: 'witch-hat',
  name: 'Witch Hat',
  kind: 'accessory',
  slot: 'head',
  // Giant, as witch hats should be: bigger than the frame, the cone running
  // off the top and the brim off both sides, a buckle on the band. They sit
  // six pixels lower under it. The dots clear the hair above the brim, so the
  // hat sits on their head, not in it
  at: { x: -6, y: -10 },
  sink: 6,
  pixels: [
    '...........................111..............',
    '..........................1111..............',
    '..........................1111..............',
    '.........................111111.............',
    '.........................111111.............',
    '........................1111111.............',
    '.......................11111111.............',
    '.......................11111111.............',
    '......................111111111.............',
    '......................1111111111............',
    '.....................11111111111............',
    '....................111111111111............',
    '....................111111111111............',
    '...................1111111111111............',
    '..................111111111111111...........',
    '..................111111111111111...........',
    '.................1111111111111111...........',
    '.................1111111111111111...........',
    '................11111111111111111...........',
    '...............111111111111111111...........',
    '...............1111111111111111111..........',
    '..............11111111111111111111..........',
    '..............11111111111111111111..........',
    '.............111111111111111111111..........',
    '............1111111111111111111111..........',
    '............1111111111111111111111..........',
    '...........222222222233322222222222.........',
    '...........111111111111111111111111.........',
    '..........1111111111111111111111111.........',
    '11111111111111111111111111111111111111111111',
    '::1111111111111111111111111111111111111111::',
  ],
  colors: { '1': 0x6a4c93, '2': 0xf28c28, '3': 0xffd54a },
}
// The witch hat in another hat color and band
const witchHat = (hat: number, band: number): Accessory => ({ ...WITCH_HAT, colors: { ...WITCH_HAT.colors, '1': hat, '2': band } })
const PARTY_HAT: Accessory = {
  id: 'birthday-hat',
  name: 'Party Hat',
  kind: 'accessory',
  slot: 'head',
  at: { x: 13, y: 0 },
  pixels: ['::33::', '::12::', ':1221:', ':2112:', '122221', '333333'],
  colors: { '1': 0x6fb8ff, '2': 0xffd54a, '3': 0xfafafa },
}

export const SPECIAL_DAYS: readonly SpecialDay[] = [
  {
    id: 'new-year',
    name: "New Year's",
    when: { month: 1, day: 1 },
    air: 'streamers',
    line: 'happy new year! a fresh start, and I get to spend it with you ✧',
  },
  {
    id: 'new-years-eve',
    name: "New Year's Eve",
    when: { month: 12, day: 31 },
    wears: PARTY_HAT,
    air: 'sparkles',
    line: 'the last day of the year! thank you for every bit of it ✧',
  },
  {
    id: 'lunar-new-year',
    name: 'Lunar New Year',
    when: { dates: ['2026-02-17', '2027-02-06', '2028-01-26', '2029-02-13', '2030-02-03'], days: 3 },
    wears: clip('lantern-clip', 'Red Clip', 0xd7263d, 0xffd54a),
    air: 'lanterns',
    line: 'happy lunar new year! wishing us luck and good code ✧',
  },
  {
    id: 'valentines',
    name: "Valentine's Day",
    when: { month: 2, day: 14 },
    wears: clip('heart-clip', 'Heart Clip', 0xff6f91, 0xffd1dc),
    air: 'hearts',
    line: "happy valentine's day. thanks for coding with me ♡",
  },
  {
    id: 'pi-day',
    name: 'Pi Day',
    when: { month: 3, day: 14 },
    line: 'happy pi day! three point one four one five nine… and so on ✧',
  },
  {
    id: 'eid-al-fitr',
    name: 'Eid al-Fitr',
    when: { dates: ['2026-03-20', '2027-03-09', '2028-02-26', '2029-02-14', '2030-02-04'], days: 3 },
    air: 'lanterns',
    line: 'eid mubarak! wishing you a joyful day ✧',
  },
  {
    id: 'april-fools',
    name: "April Fools' Day",
    when: { month: 4, day: 1 },
    line: "I fixed every bug in the project! …just kidding. happy april fools' ✧",
  },
  {
    id: 'earth-day',
    name: 'Earth Day',
    when: { month: 4, day: 22 },
    wears: clip('leaf-clip', 'Leaf Clip', 0x5fbf6a, 0x2f7d3a),
    air: 'petals',
    line: "happy earth day! maybe a walk outside later? ✧",
  },
  {
    id: 'cinco-de-mayo',
    name: 'Cinco de Mayo',
    when: { month: 5, day: 5 },
    wears: clip('fiesta-clip', 'Flower Clip', 0xe63946, 0x2a9d5c),
    air: 'streamers',
    line: 'happy cinco de mayo! a bright, colorful day to code ✧',
  },
  {
    id: 'programmers-day',
    name: "Programmers' Day",
    // The 256th day of the year
    when: { dates: ['2026-09-13', '2027-09-13', '2028-09-12', '2029-09-13', '2030-09-13'] },
    wears: PARTY_HAT,
    air: 'streamers',
    line: "it's programmers' day, the 256th day of the year! that's you ✧",
  },
  {
    id: 'thanksgiving-ca',
    name: 'Thanksgiving',
    when: { month: 10, weekday: 1, nth: 2 },
    countries: ['CA'],
    air: 'leaves',
    line: "happy thanksgiving! I'm thankful for you, and our code ✧",
  },
  {
    id: 'halloween',
    name: 'Halloween',
    when: { month: 10, day: 31, before: 6 },
    wears: WITCH_HAT,
    // A hat of their own each: Ai-chan's classic purple, Kai's pumpkin (black
    // would vanish into his hair), Sora's midnight blue
    wearsFor: { aichan: WITCH_HAT, kai: witchHat(0xe07a1f, 0x2b2d3a), sora: witchHat(0x2c3a70, 0xc9b6ff) },
    air: 'bats',
    line: 'happy halloween! the scariest thing here is the bug backlog ✧',
  },
  {
    id: 'diwali',
    name: 'Diwali',
    when: { dates: ['2026-11-08', '2027-10-29', '2028-10-17', '2029-11-05', '2030-10-26'], days: 3 },
    air: 'fireflies',
    line: 'happy diwali! may your days be full of light ✧',
  },
  {
    id: 'thanksgiving-us',
    name: 'Thanksgiving',
    when: { month: 11, weekday: 4, nth: 4 },
    countries: ['US'],
    air: 'leaves',
    line: "happy thanksgiving! I'm thankful for you, and our code ✧",
  },
  {
    id: 'hanukkah',
    name: 'Hanukkah',
    when: { dates: ['2026-12-05', '2027-12-25', '2028-12-13', '2029-12-02', '2030-12-21'], days: 8 },
    air: 'sparkles',
    line: 'happy hanukkah! eight nights of light ✧',
  },
  {
    id: 'christmas',
    name: 'Christmas',
    when: { month: 12, day: 25, before: 5 },
    wears: SANTA_HAT,
    air: 'snowflakes',
    line: 'merry christmas! the best present is coding with you ✧',
  },
]

export const BIRTHDAY_HAT = PARTY_HAT

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Whether a day falls on, or in the lead-up to, a special day
export function isOn(when: When, date: Date): boolean {
  if ('dates' in when) {
    return when.dates.some(start => {
      const from = new Date(`${start}T00:00:00`)
      const days = Math.round((new Date(iso(date) + 'T00:00:00').getTime() - from.getTime()) / 86_400_000)
      return days >= 0 && days < (when.days ?? 1)
    })
  }
  if ('nth' in when) {
    if (date.getMonth() + 1 !== when.month || date.getDay() !== when.weekday) return false
    return Math.ceil(date.getDate() / 7) === when.nth
  }
  const target = new Date(date.getFullYear(), when.month - 1, when.day)
  const days = Math.round((target.getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86_400_000)
  return days >= 0 && days <= (when.before ?? 0)
}

/** The special day today, if any: the first in the list that's on, and not turned off */
export function specialDayOn(date: Date, country = '', off: readonly string[] = []): SpecialDay | undefined {
  return SPECIAL_DAYS.find(
    d => !off.includes(d.id) && (d.countries === undefined || d.countries.includes(country.toUpperCase())) && isOn(d.when, date),
  )
}

/** A special day by its id or its name, as typed: "halloween", "lunar new year" */
export function findDay(name: string): SpecialDay | undefined {
  const typed = name.toLowerCase().replace(/[^a-z0-9]+/g, '')
  return SPECIAL_DAYS.find(d => d.id.replace(/-/g, '') === typed || d.name.toLowerCase().replace(/[^a-z0-9]+/g, '') === typed)
}

// The next date a special day falls on, from a day on (the day itself, not its lead-up)
export function nextDate(when: When, from: Date): Date | undefined {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  if ('dates' in when) {
    return when.dates.map(d => new Date(`${d}T00:00:00`)).find(d => d.getTime() >= start.getTime())
  }
  for (const year of [start.getFullYear(), start.getFullYear() + 1]) {
    let date: Date
    if ('nth' in when) {
      const first = new Date(year, when.month - 1, 1)
      const offset = (when.weekday - first.getDay() + 7) % 7
      date = new Date(year, when.month - 1, 1 + offset + (when.nth - 1) * 7)
    } else {
      date = new Date(year, when.month - 1, when.day)
    }
    if (date.getTime() >= start.getTime()) return date
  }
  return undefined
}
