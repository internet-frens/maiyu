// The morning letter: a short note in their own voice about something real you
// did together yesterday, not a tally. It waits for a night's break, so working
// past midnight doesn't bring one

import type { Character } from '../characters/types'
import { looksLikeCode } from './coach'
import { daysBetween } from './memory'

export const HIGHLIGHT_PREFIX = 'highlights:'
const KEEP_DAYS = 4
const KEEP = 40

/** A turn that got something done: what you asked, and what they said about it */
export type Highlight = { day: string; asked: string; said: string }

export function keepHighlight(list: readonly Highlight[], h: Highlight, today: string): Highlight[] {
  const fresh = list.filter(x => daysBetween(x.day, today) <= KEEP_DAYS)
  if (fresh.some(x => x.day === h.day && x.said === h.said)) return fresh
  return [...fresh, h].slice(-KEEP)
}

export function asHighlights(value: unknown): Highlight[] {
  if (!Array.isArray(value)) return []
  return value.filter((h): h is Highlight => typeof h?.day === 'string' && typeof h?.asked === 'string' && typeof h?.said === 'string')
}

const HOUR = 60 * 60 * 1000

/** A new day's letter waits for a night's break: three hours away, or, from
 * five in the morning, half an hour. Coding on past midnight doesn't count */
export function isAfterBreak(hour: number, awayMs: number): boolean {
  return awayMs >= 3 * HOUR || (hour >= 5 && awayMs >= HOUR / 2)
}

/** What the model is told, to write the letter as them */
export function letterSystem(c: Character): string {
  return [
    `You are ${c.name}, ${c.voice.persona}, writing a short morning note to the programmer you code alongside.`,
    'Write two or three short sentences, warm and personal, the way a friend leaves a note.',
    'Name one or two specific things you got done together, in plain everyday words, and how it felt.',
    'No numbers or tallies, no lists, no greeting and no sign-off, and leave out streaks and what is coming up: those are added around your words.',
    'Plain words only: never write code, commands, file names, paths, identifiers or backticks.',
    c.voice.style,
  ].join(' ')
}

export type LetterFacts = {
  /** "yesterday", "on Friday" */
  when: string
  highlights: readonly Highlight[]
  /** Wins remembered that day, in plain words */
  wins: readonly string[]
  /** "a rainy morning" */
  today?: string
}

export function letterBrief(f: LetterFacts): string {
  return [
    `What you did together ${f.when}:`,
    ...f.highlights.slice(-6).map(h => `- they asked: ${h.asked.slice(0, 160)} / you said after: ${h.said}`),
    ...f.wins.map(w => `- ${w}`),
    f.today ? `This morning: ${f.today}.` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/** On the anniversary of the day you met, a longer letter about the year */
export function yearSystem(c: Character, years: string): string {
  return [
    `You are ${c.name}, ${c.voice.persona}. Today it's ${years} since you met the programmer you code alongside, and you're writing them a letter about it.`,
    'Write four or five short sentences, warm and personal, the way a friend writes on a day that matters.',
    'Look back on the year: a real thing or two you got done together, in plain everyday words, the late nights, the longest run of days in a row, and what changed between you.',
    'One or two numbers are fine if they mean something. No lists, no greeting and no sign-off: those are added around your words.',
    'Plain words only: never write code, commands, file names, paths, identifiers or backticks.',
    c.voice.style,
  ].join(' ')
}

export type YearFacts = {
  years: string
  /** Days coded together in the year */
  days: number
  /** The longest run of days in a row that year */
  streak: number
  /** Days you were up past midnight together */
  lateNights: number
  /** A few wins from through the year, in plain words, oldest first */
  wins: readonly string[]
  /** How far you've come: "7 hearts" */
  hearts: number
  /** Their own story, so far */
  story?: string
}

export function yearBrief(f: YearFacts): string {
  return [
    `${f.years} since you met. This past year:`,
    `- ${f.days} days coding together`,
    f.streak >= 2 ? `- the longest run: ${f.streak} days in a row` : '',
    f.lateNights > 0 ? `- ${f.lateNights} late nights past midnight` : '',
    `- you're at ${f.hearts} of 10 hearts`,
    f.story ? `- in your own life: ${f.story}` : '',
    ...f.wins.slice(-6).map(w => `- a win: ${w}`),
  ]
    .filter(Boolean)
    .join('\n')
}

// One win a month for the year's letter, kept for two years
export type YearWin = { month: string; what: string }
export const YEAR_KEY = 'yearbook'

export function keepYearWin(list: readonly YearWin[], month: string, what: string): YearWin[] | undefined {
  if (list.some(w => w.month === month)) return undefined
  return [...list, { month, what }].slice(-24)
}

export function asYearWins(value: unknown): YearWin[] {
  if (!Array.isArray(value)) return []
  return value.filter((w): w is YearWin => typeof w?.month === 'string' && typeof w?.what === 'string')
}

/** Their note, cleaned up: plain sentences, no code, a few hundred characters at most */
export function tidyNote(text: string, max = 300): string {
  const note = text
    .trim()
    .replace(/^["'“]|["'”]$/g, '')
    .replace(/\s*\n+\s*/g, ' ')
    .trim()
  if (note === '' || looksLikeCode(note)) return ''
  if (note.length <= max) return note
  // Cut at the last sentence that fits
  const cut = note.slice(0, max)
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  return end > 80 ? cut.slice(0, end + 1) : `${cut.slice(0, max - 1)}…`
}
