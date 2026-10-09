// Every character there is. To add one, write a file like ./aichan.ts and list it here.

import { aichan } from './aichan'
import { kai } from './kai'
import { sora } from './sora'
import type { Character, Line, Lines, Standing, Version, WeatherVerb } from './types'
import type { Season } from '../hooks/world'

export const CHARACTERS: readonly Character[] = [aichan, kai, sora]
export const DEFAULT = aichan

export const byId = (id: unknown): Character | undefined => CHARACTERS.find(c => c.id === id)

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// A birthday as people say it: "3 April"
export const birthdayOf = (c: Character) => `${c.birthday.day} ${MONTHS[c.birthday.month - 1] ?? ''}`

// How a character reads in a list: "cheerful · woman · she/her · birthday 3 April"
export const describeCharacter = (c: Character) => `${c.temperament} · ${c.gender} · ${c.pronouns.they}/${c.pronouns.them} · birthday ${birthdayOf(c)}`

// The characters a search finds. Every word typed must match: names, ids and
// genders as you type them ("ka" finds Kai), pronouns only whole ("he" finds
// he/him, not she/her)
export function search(query: string, from: readonly Character[] = CHARACTERS): Character[] {
  const words = query.toLowerCase().split(/[\s/]+/).filter(Boolean)
  return from.filter(c => {
    const named = [c.id, c.name, c.gender].map(x => x.toLowerCase())
    const pronouns = Object.values(c.pronouns).map(x => x.toLowerCase())
    return words.every(word => named.some(x => x.startsWith(word)) || pronouns.includes(word))
  })
}

export type LineKey = keyof Lines
export type Say = (key: LineKey, vars?: Record<string, string | number>) => string

/** A newcomer: no hearts, nothing earned */
export const STRANGER: Standing = { hearts: 0, unlocked: [] }

export const textOf = (v: Version) => (typeof v === 'string' ? v : v.text)

// Whether a version is open to you: any time, once you're close enough, or once earned
export const isOpen = (v: Version, s: Standing) =>
  typeof v === 'string' || ((v.hearts ?? 0) <= s.hearts && (v.unlock === undefined || s.unlocked.includes(v.unlock)))

/** Every version of a line, each with its place in the list: the last part of its id */
export const versionsOf = (raw: Line): readonly Version[] => (Array.isArray(raw) ? raw : [raw as Version])

// The versions open to you, keeping their places
export function openOf(raw: Line, s: Standing): { text: string; index: number }[] {
  return versionsOf(raw).flatMap((v, index) => (isOpen(v, s) ? [{ text: textOf(v), index }] : []))
}

// One of the open versions, picked by a number that moves on: a turn, a frame
export function pickOpen(raw: Line, s: Standing, seed: number): { text: string; index: number } | undefined {
  const open = openOf(raw, s)
  return open.length === 0 ? undefined : open[seed % open.length]
}

// A character's line, with {name}, their pronouns and the line's own values
// filled in. A line with versions takes the open ones in turn, starting with
// the first. Each line said is reported by its id: "kai.failing.2"
export function voiceOf(c: Character, standing: () => Standing = () => STRANGER, heard?: (id: string) => void): Say {
  const turns = new Map<LineKey, number>()
  return (key, vars = {}) => {
    const turn = turns.get(key) ?? 0
    turns.set(key, turn + 1)
    const picked = pickOpen(c.voice.lines[key], standing(), turn)
    if (picked === undefined) return ''
    heard?.(`${c.id}.${key}.${picked.index}`)
    const fill: Record<string, string | number> = { name: c.name, ...c.pronouns, ...vars }
    return picked.text.replace(/\{(\w+)\}/g, (all, name: string) => String(fill[name] ?? all))
  }
}


// The words for Claude's spinner: their own, the season's (unless seasons are
// off), the day's weather, and every one unlocked by an achievement
export function spinnerWords(
  c: Character,
  season: Season | undefined,
  weather: readonly WeatherVerb[],
  unlocked: readonly string[],
): string[] {
  const seasonal = season ? c.voice.verbs.seasons[season] : []
  const today = weather.flatMap(kind => c.voice.verbs.weather[kind] ?? [])
  const earned = unlocked.flatMap(id => c.voice.verbs.achievements[id] ?? [])
  return [...c.voice.spinner, ...seasonal, ...today, ...earned]
}

export type { Character } from './types'
