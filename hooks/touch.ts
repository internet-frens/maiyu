// Touching them: click a part of the portrait (or press the pat button) and
// they react to it. A pat on the head, a poke on the cheek, a hand, what
// they're holding, what they're wearing. Too many in a row and they pout.
// Each plays for a couple of seconds over whatever mood they're in, as a pose
// and a mark before what they say

import type { LineKey } from '../characters/index'
import type { Catchable, Part, Pose } from './sprite'

export type TouchKind = 'head' | 'hair' | 'cheek' | 'hands' | 'held' | 'outfit' | 'worn' | 'tooMuch' | 'catch' | 'rare' | 'stroke' | 'squish'

// In ticks of a quarter second: how long a reaction plays, and how long it's
// quiet before the count of touches starts again
export const TOUCH_FOR = 8
/** A stroke lasts longer: they lean into it */
export const touchFor = (kind: TouchKind) => (kind === 'stroke' || kind === 'rare' ? TOUCH_FOR * 2 : TOUCH_FOR)
export const TOUCH_QUIET = (20 * 1000) / 250
/** This many in a row is too many */
export const TOO_MUCH = 5

const OF_PART: Record<Part, Exclude<TouchKind, 'catch' | 'rare'>> = {
  head: 'head',
  hair: 'hair',
  face: 'cheek',
  cheek: 'cheek',
  hands: 'hands',
  held: 'held',
  outfit: 'outfit',
}

/** What a touch on a part (or a worn item's id) is */
export function touchKind(where: string, isWorn: boolean, isTooMuch: boolean, isStroke = false): Exclude<TouchKind, 'catch' | 'rare'> {
  if (isTooMuch) return 'tooMuch'
  // A drag across the hair is a stroke; across a cheek, a squish
  if (isStroke && (where === 'head' || where === 'hair')) return 'stroke'
  if (isStroke && (where === 'cheek' || where === 'face')) return 'squish'
  if (isWorn) return 'worn'
  return OF_PART[where as Part] ?? 'head'
}

const LINES: Record<Exclude<TouchKind, 'catch' | 'rare'>, LineKey> = {
  head: 'touchHead',
  hair: 'touchHair',
  cheek: 'touchCheek',
  hands: 'touchHands',
  held: 'touchHeld',
  outfit: 'touchOutfit',
  worn: 'touchWorn',
  tooMuch: 'touchTooMuch',
  stroke: 'touchStroke',
  squish: 'touchSquish',
}

export const touchLine = (kind: Exclude<TouchKind, 'catch' | 'rare'>): LineKey => LINES[kind]

// Catching something drifting past: a leaf, a petal, a snowflake, a firefly
const CATCH_LINES: Record<Catchable, LineKey> = {
  leaf: 'catchLeaf',
  petal: 'catchPetal',
  snowflake: 'catchSnowflake',
  firefly: 'catchFirefly',
  goldleaf: 'catchGoldenLeaf',
  blossom: 'catchBlossom',
  crystal: 'catchCrystal',
  star: 'catchShootingStar',
}
export const catchLine = (kind: Catchable): LineKey => CATCH_LINES[kind]

/** How long a caught one stays gone, in ticks: a leaf until it comes round
 * again (its id changes then), the rest a few seconds; a firefly just flits off */
export const CAUGHT_FOR: Record<Catchable, number> = {
  leaf: 4 * 60 * 4,
  petal: 20,
  snowflake: 20,
  firefly: 12,
  goldleaf: 4 * 60 * 4,
  blossom: 40,
  crystal: 40,
  star: 30 * 4,
}

/** The plural, for the journal */
export const CATCH_NAMES: Record<Catchable, string> = {
  leaf: 'leaves',
  petal: 'petals',
  snowflake: 'snowflakes',
  firefly: 'fireflies',
  goldleaf: 'golden leaves',
  blossom: 'cherry blossoms',
  crystal: 'snow crystals',
  star: 'shooting stars',
}

/** One of them, in words: "a golden leaf" */
export const ONE_OF: Record<Catchable, string> = {
  leaf: 'a leaf',
  petal: 'a petal',
  snowflake: 'a snowflake',
  firefly: 'a firefly',
  goldleaf: 'a golden leaf',
  blossom: 'a cherry blossom',
  crystal: 'a snow crystal',
  star: 'a shooting star',
}

/** The diary's words for it, the first time in a while */
export function touchNote(kind: TouchKind, item?: string): string {
  switch (kind) {
    case 'head':
      return 'a headpat'
    case 'hair':
      return 'you played with their hair'
    case 'cheek':
      return 'a poke on the cheek'
    case 'hands':
      return 'a high five'
    case 'held':
      return 'you eyed their snack'
    case 'outfit':
      return 'you tugged a sleeve'
    case 'worn':
      return `you noticed the ${item ?? 'outfit'}`
    case 'tooMuch':
      return 'too many pokes'
    case 'catch':
      return `you caught ${item ?? 'something'}`
    case 'rare':
      return `a rare find: ${item ?? 'something'}!`
    case 'stroke':
      return 'you stroked their hair'
    case 'squish':
      return 'a cheek squish'
  }
}

/** Their pose a moment into a touch, over the mood's own */
export function touchPose(kind: TouchKind, age: number, frame: number): Partial<Pose> {
  switch (kind) {
    case 'head':
      // Eyes closed happily, a blush, the ahoge bobbing under your hand
      return { eyes: 'happy', mouth: 'smile', blush: true, ahoge: frame % 2 === 0 ? 0 : 1 }
    case 'hair':
      return { eyes: 'happy', mouth: 'small', blush: true }
    case 'cheek':
      // Squeezed shut with a squeak, then a flustered smile
      return age < 4 ? { eyes: 'squeeze', mouth: 'wavy', blush: true } : { eyes: 'happy', mouth: 'wavy', blush: true }
    case 'hands':
      return { eyes: 'happy', mouth: 'grin', arms: 'wave' }
    case 'held':
      // Keeps hold of it: only the face changes
      return { eyes: 'happy', mouth: 'small', blush: true }
    case 'outfit':
      return { eyes: 'open', mouth: 'open', blush: true }
    case 'worn':
      return { eyes: 'happy', mouth: 'grin', blush: true }
    case 'stroke':
      // Eyes closed, leaning into it, the ahoge swaying slowly
      return { eyes: age % 12 < 10 ? 'happy' : 'lidded', mouth: 'smile', blush: true, look: 0, ahoge: Math.floor(frame / 3) % 2 === 0 ? 0 : 1 }
    case 'squish':
      // Hands to their squished cheeks, eyes shut tight
      return { eyes: 'squeeze', mouth: 'small', blush: true, arms: 'cheeks' }
    case 'rare':
      // Thrilled: arms up, a hop, eyes shining
      return { eyes: 'happy', mouth: 'grin', blush: true, arms: age % 4 < 2 ? 'cheer' : 'wave', hop: age % 4 < 2 ? 1 : 0 }
    case 'catch':
      // Delighted, a little bounce
      return { eyes: 'happy', mouth: 'open', blush: true, hop: age < 2 ? 1 : 0 }
    case 'tooMuch':
      // A pout: lidded eyes, a flat mouth, cheeks pink with it
      return { eyes: 'lidded', mouth: 'flat', blush: true, arms: 'down', look: 0 }
  }
}

/** The mark before what they say while it plays */
export function touchMark(kind: TouchKind, age: number): string {
  if (kind === 'tooMuch') return ['…', '..', '…', '.'][Math.floor(age / 2) % 4]!
  if (kind === 'head') return ['♡', '♡ ♡', '♡'][Math.floor(age / 3) % 3]!
  if (kind === 'cheek') return age < 4 ? '!' : '!!'
  if (kind === 'stroke') return ['♡', '♡~', '♡~♡', '♡~'][Math.floor(age / 3) % 4]!
  if (kind === 'squish') return '><'
  if (kind === 'rare') return ['✦', '✦ ✧', '✦ ✧ ✦', '✧ ✦'][Math.floor(age / 2) % 4]!
  return ['✧', '✦'][age % 2]!
}
