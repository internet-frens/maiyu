// The journal: what you've found together over months, like a collection to
// fill in. Special days seen, the weather you worked through, the kinds of work
// you did, the moments shared, and how far along each of their stories is.
// Blank slots say there's more, without saying how to find it

import type { Character, Story, Temperament } from '../characters/types'
import type { Sky } from './world'
import { COMMON, RARE } from './sprite'
import type { Catchable } from './sprite'
import { CATCH_NAMES, ONE_OF } from './touch'

export const JOURNAL_KEY = 'journal'
export const STORIES_KEY = 'stories'

/** `caught`: how many of each thing in the air you've caught, by kind ("leaf")
 * and by kind in a season ("2026-autumn:leaf") */
export type Journal = { specials: string[]; skies: string[]; work: string[]; caught: Record<string, number> }
export const NO_JOURNAL: Journal = { specials: [], skies: [], work: [], caught: {} }
export type Found = Exclude<keyof Journal, 'caught'>

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [])

export function asJournal(value: unknown): Journal {
  const v = (value ?? {}) as Partial<Record<keyof Journal, unknown>>
  const caught = typeof v.caught === 'object' && v.caught !== null ? v.caught : {}
  return {
    specials: strings(v.specials),
    skies: strings(v.skies),
    work: strings(v.work),
    caught: Object.fromEntries(Object.entries(caught).filter((e): e is [string, number] => Number.isInteger(e[1]) && e[1] > 0)),
  }
}

/** The season a catch counts toward: "2026-autumn" */
export const seasonKey = (day: string, season: string) => `${day.slice(0, 4)}-${season}`

/** The journal with one more caught, in all and this season */
export function caught(j: Journal, kind: Catchable, season: string): Journal {
  const inSeason = `${season}:${kind}`
  return { ...j, caught: { ...j.caught, [kind]: (j.caught[kind] ?? 0) + 1, [inSeason]: (j.caught[inSeason] ?? 0) + 1 } }
}

/** The journal with one more thing in it, or undefined if it was there already */
export function jot(j: Journal, kind: Found, what: string): Journal | undefined {
  if (what === '' || j[kind].includes(what)) return undefined
  return { ...j, [kind]: [...j[kind], what] }
}

/** How many beats of each character's story they've told, by id */
export function asTold(value: unknown): Record<string, number> {
  if (typeof value !== 'object' || value === null) return {}
  return Object.fromEntries(Object.entries(value).filter((e): e is [string, number] => Number.isInteger(e[1]) && e[1] >= 0))
}

/** The next beat of their story, once you've spent long enough together for it */
export function nextBeat(story: Story, told: number, days: number): { index: number; line: string } | undefined {
  const beat = story.beats[told]
  return beat !== undefined && days >= beat.after ? { index: told, line: beat.line } : undefined
}

export const SKIES: readonly Sky[] = ['clear', 'cloudy', 'fog', 'drizzle', 'rain', 'snow', 'storm']
// The kinds of work that can be found, as coach.ts names them
export const WORK = [
  'TypeScript', 'JavaScript', 'Python', 'Rust', 'Go', 'Ruby', 'Java', 'Swift', 'C',
  'styling', 'page markup', 'writing', 'config', 'shell script', 'test code',
] as const

export type JournalFacts = {
  journal: Journal
  /** Every special day there is, by id and name; birthdays and anniversaries included */
  specials: readonly { id: string; name: string }[]
  characters: readonly Character[]
  /** Moments seen, as "kai:3" */
  moments: readonly string[]
  told: Record<string, number>
  /** Days together, by character */
  days: Record<string, number>
  /** This season, for its catches: "2026-autumn" */
  season?: string
}

/** One thing in a section: found, with its stamp and words, or still a blank */
/** `id`: what it is ("leaf", "rain"), for its pixel-art icon */
export type Slot = { found: boolean; text: string; id?: string; stamp?: string; isRare?: boolean; count?: number }

/** A page's section: what's found of how many, slot by slot, or a line per character */
export type Section = {
  icon: string
  title: string
  found?: number
  total?: number
  slots?: Slot[]
  /** Only what's found is listed; this many more are still to find */
  more?: number
  rows?: { found: boolean; text: string }[]
}

// The stamps in the pane's journal, one per thing found
const SKY_STAMPS: Record<string, string> = { clear: '☀', cloudy: '☁', fog: '≈', drizzle: '⁘', rain: '☂', snow: '❄', storm: 'ϟ' }
const WORK_STAMPS: Record<string, string> = {
  TypeScript: 'TS',
  JavaScript: 'JS',
  Python: 'Py',
  Rust: 'Rs',
  Go: 'Go',
  Ruby: 'Rb',
  Java: 'Jv',
  Swift: 'Sw',
  C: 'C',
  styling: '✿',
  'page markup': '<>',
  writing: '✎',
  config: '≡',
  'shell script': '$_',
  'test code': '✓',
}
const CATCH_STAMPS: Record<string, string> = { leaf: '❧', petal: '✿', snowflake: '❄', firefly: '✧', goldleaf: '❧', blossom: '❀', crystal: '❅', star: '★' }

/** The journal, section by section, for the pane to draw and for the words */
export function journalSections(f: JournalFacts): Section[] {
  const specialsFound = f.specials.filter(s => f.journal.specials.includes(s.id))
  const caughtSlot = (k: (typeof COMMON)[number]): Slot => {
    const all = f.journal.caught[k] ?? 0
    if (all === 0) return { found: false, text: '???' }
    const now = f.season ? (f.journal.caught[`${f.season}:${k}`] ?? 0) : 0
    return { found: true, id: k, count: all, stamp: CATCH_STAMPS[k], text: `${all} ${all === 1 ? k : CATCH_NAMES[k]}${now > 0 && now < all ? ` (${now} this ${f.season!.slice(5)})` : ''}` }
  }
  const rareSlot = (k: (typeof RARE)[number]): Slot => {
    const all = f.journal.caught[k] ?? 0
    return all === 0 ? { found: false, text: '???' } : { found: true, id: k, isRare: true, count: all, stamp: CATCH_STAMPS[k], text: `${ONE_OF[k].replace(/^an? /, '')}${all > 1 ? ` ×${all}` : ''}` }
  }
  const named = (all: readonly string[], found: readonly string[], stamps: Record<string, string> = {}): Slot[] =>
    all.map(x => (found.includes(x) ? { found: true, id: x, text: x, stamp: stamps[x] } : { found: false, text: '???' }))
  const count = (slots: Slot[]) => slots.filter(x => x.found).length
  const skies = named(SKIES, f.journal.skies, SKY_STAMPS)
  const work = named(WORK, f.journal.work, WORK_STAMPS)
  const caught = COMMON.map(caughtSlot)
  const rare = RARE.map(rareSlot)
  const moments = f.characters.map(c => {
    const days = f.days[c.id] ?? 0
    const seen = f.moments.filter(m => m.startsWith(`${c.id}:`)).length
    if (days === 0 && seen === 0) return { found: false, text: '??? · not met yet' }
    const told = Math.min(f.told[c.id] ?? 0, c.story.beats.length)
    const story = told === 0 ? '???' : `${c.story.name}, ${told === c.story.beats.length ? 'the whole story' : `${told} of ${c.story.beats.length} told`}`
    return { found: true, text: `${c.name.padEnd(8)} ${seen} of ${c.bond.moments.length} moments · ${story}` }
  })
  return [
    {
      icon: '✦',
      title: 'Special days together',
      found: specialsFound.length,
      total: f.specials.length,
      slots: specialsFound.map(x => ({ found: true, text: x.name, stamp: '✦' })),
      more: f.specials.length - specialsFound.length,
    },
    { icon: '☁', title: "Weather you've worked through", found: count(skies), total: SKIES.length, slots: skies },
    { icon: '✎', title: 'Kinds of work together', found: count(work), total: WORK.length, slots: work },
    { icon: '❧', title: 'Caught in the air', found: count(caught), total: COMMON.length, slots: caught },
    { icon: '✧', title: 'Rare finds', found: count(rare), total: RARE.length, slots: rare },
    { icon: '♡', title: 'Moments and stories', rows: moments },
  ]
}

export function journalText(f: JournalFacts): string {
  const lines = ['📖 Your journal']
  for (const s of journalSections(f)) {
    lines.push('', s.total === undefined ? s.title : `${s.title} (${s.found} of ${s.total})`)
    if (s.rows) for (const r of s.rows) lines.push(`  ${r.text}`)
    else if (s.more !== undefined) {
      const found = s.slots!.map(x => x.text)
      lines.push(`  ${found.length > 0 ? found.join(' · ') : 'none yet'}${s.more > 0 ? ` · and ${s.more} more to find` : ''}`)
    } else lines.push(`  ${s.slots!.map(x => (x.found ? `${x.isRare ? '✦ ' : ''}${x.text}` : '???')).join(' · ')}`)
  }
  return lines.join('\n')
}

/** One line at the foot of the journal, in their voice: how it's going, from
 * what's found. Cheerful, sassy or quiet; the same counts, the same line */
export function journalVoice(sections: readonly Section[], temperament: Temperament): string {
  const slots = sections.flatMap(s => s.slots ?? [])
  const found = slots.filter(x => x.found).length
  const rare = slots.filter(x => x.found && x.isRare)
  const leaves = slots.find(x => x.found && x.stamp === '❧' && !x.isRare)?.count ?? 0
  const rareName = rare[0]?.text.replace(/ ×\d+$/, '')
  switch (temperament) {
    case 'cheerful':
      if (found === 0) return "a fresh page! let's fill it together ✧"
      if (rareName && leaves > 0) return `${leaves} ${leaves === 1 ? 'leaf' : 'leaves'} and a ${rareName}! so much left to find ✧`
      if (rareName) return `a ${rareName}! so much left to find ✧`
      return `${found} ${found === 1 ? 'thing' : 'things'} found so far! so much left to find ✧`
    case 'sassy':
      if (found === 0) return 'empty. for now.'
      if (rareName) return `a ${rareName}, huh. not bad. keep going.`
      return 'not bad. keep going.'
    case 'quiet':
      if (found === 0) return '…a blank page.'
      if (found < 6) return '…a good start.'
      return "…it's filling up."
  }
}
