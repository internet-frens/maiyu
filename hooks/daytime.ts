// The time of day, in how they speak and how they move: bright and chatty in
// the morning, warm in the evening, hushed late at night. A stretch at dawn, a
// warm cup in the morning, fireflies in the evening, stars at night, and
// heavy eyes and yawns in the small hours

import type { Pose } from './sprite'
import type { PartOfDay } from './world'

const MINUTE = 60 * 4
// The same rhythm as a seasonal moment (a minute in every eight), but in the
// other half of the cycle, so the two never drift past at once
const CYCLE = 8 * MINUTE
const MOMENT = MINUTE
const FADE = 12 * 4

/** How each part of the day sounds, in a word */
export const TONES: Record<PartOfDay, string> = {
  dawn: 'soft',
  morning: 'bright',
  afternoon: 'bright',
  evening: 'warm',
  night: 'calm',
  lateNight: 'hushed',
}

/** A line said in the day's tone: evenings calm the double exclamations, nights
 * drop them for full stops, and the small hours start in lowercase too */
export function inTone(line: string, part: PartOfDay): string {
  if (part === 'evening') return line.replace(/!{2,}/g, '!')
  if (part !== 'night' && part !== 'lateNight') return line
  const calm = line.replace(/!+(?=[?~…])/g, '').replace(/!+/g, '.').replace(/\.{2}(?!\.)/g, '.')
  if (part === 'night') return calm
  // "Happy" → "happy", but "I" and "AI" stay as they are
  return calm.replace(/^([A-Z])(?=[a-z])/, first => first.toLowerCase())
}

/** How often they make small talk: chattier by day, quieter late */
export function chatEvery(part: PartOfDay): number {
  const minutes = { dawn: 15, morning: 10, afternoon: 12, evening: 15, night: 20, lateNight: 30 }[part]
  return minutes * MINUTE
}

/** How many drift past in the day's moment: 0 for none, else up to 4, fading in and out */
export function dayMoment(frame: number): number {
  const at = (frame + CYCLE / 2) % CYCLE
  if (at >= MOMENT) return 0
  const edge = Math.min(at, MOMENT - at)
  return edge >= FADE ? 4 : Math.max(1, Math.ceil((edge / FADE) * 4))
}

/** What's in the air for the time of day: fireflies in the evening, stars at night */
export function timeAir(part: PartOfDay): Pose['air'] {
  if (part === 'evening') return 'fireflies'
  if (part === 'night' || part === 'lateNight') return 'sparkles'
  return undefined
}

/** How they look at rest at this time of day, over the pose they'd have anyway */
export function atRest(p: Pose, part: PartOfDay, frame: number): Pose {
  const isBlinking = p.eyes === 'blink'
  switch (part) {
    case 'dawn': {
      // Still waking up: heavy eyes, and a big stretch every couple of minutes
      const at = frame % (2 * MINUTE)
      if (at < 12) return { ...p, eyes: 'squeeze', mouth: 'open', arms: 'cheer' }
      return isBlinking ? p : { ...p, eyes: 'lidded' }
    }
    case 'morning': {
      // A warm cup for a minute in every six, a sip now and then
      const at = frame % (6 * MINUTE)
      if (at >= MINUTE) return p
      return { ...p, arms: 'cup', eyes: at % 40 < 10 ? 'happy' : p.eyes, beat: Math.floor(frame / 3) }
    }
    case 'evening':
      // A softer look, some of the time
      return isBlinking || frame % 48 < 32 ? p : { ...p, eyes: 'soft' }
    case 'night':
      // Blinking a little more often
      return frame % 12 === 0 ? { ...p, eyes: 'blink' } : p
    case 'lateNight': {
      // Heavy eyes, and a yawn every minute and a half
      const at = frame % (MINUTE + MINUTE / 2)
      if (at < 10) return { ...p, eyes: 'squeeze', mouth: 'open' }
      return isBlinking ? p : { ...p, eyes: 'lidded', mouth: p.mouth === 'smile' ? 'small' : p.mouth }
    }
    default:
      return p
  }
}

/** How slowly they sway at rest: one way and back, in frames */
export const swayOf = (part: PartOfDay) => (part === 'lateNight' || part === 'night' ? 32 : part === 'morning' ? 12 : 16)
