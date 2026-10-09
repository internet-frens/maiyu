// Waking up, a little differently each time: a start and an embarrassed "I
// wasn't asleep", a long yawn and a stretch, still half in a dream, or
// mumbling in their sleep before they notice you. A long nap or a late night
// always brings the yawn. Each plays for a few seconds over whatever mood
// they're in, as a pose and a mark before what they say

import type { Pose } from './sprite'

export type WakeKind = 'startle' | 'yawn' | 'dream' | 'sleepTalk'

/** The kinds taken in turn when nothing calls for a yawn */
export const WAKE_KINDS: readonly WakeKind[] = ['startle', 'yawn', 'dream', 'sleepTalk']

// How long each plays, in ticks of a quarter second
export const WAKE_FOR: Record<WakeKind, number> = { startle: 16, yawn: 20, dream: 16, sleepTalk: 28 }
/** Sleep-talking: mumbling this long, then they notice you */
export const TALK_FOR = 12
/** Asleep this long counts as a long nap: an hour */
export const LONG_NAP = (60 * 60 * 1000) / 250

/** How they wake: a yawn after a long nap or late at night, otherwise the next in turn */
export function wakeKind(turn: number, slept: number, isLate: boolean): WakeKind {
  if (slept >= LONG_NAP || isLate) return 'yawn'
  return WAKE_KINDS[turn % WAKE_KINDS.length]!
}

/** Their pose a moment into waking, over the mood's own */
export function wakePose(kind: WakeKind, age: number): Partial<Pose> {
  switch (kind) {
    case 'startle':
      // A jolt, eyes wide, hands to their face; then a sheepish, blushing smile
      return age < 5
        ? { eyes: 'open', mouth: 'open', arms: 'cheeks', sweat: true, hop: age % 2 === 0 ? 1 : 0 }
        : { eyes: 'happy', mouth: 'wavy', arms: 'down', blush: true }
    case 'yawn':
      // A big stretch with a yawn, then rubbing their eyes, blinking awake
      if (age < 10) return { eyes: 'sleep', mouth: 'open', arms: 'cheer' }
      if (age < 15) return { eyes: age % 3 === 0 ? 'blink' : 'lidded', mouth: 'small', arms: 'cheeks' }
      return { eyes: age % 4 === 0 ? 'blink' : 'lidded', mouth: 'smile', arms: 'down' }
    case 'dream':
      // Still smiling at the dream, eyes half open, slowly coming round
      return { eyes: age < 6 ? 'lidded' : 'soft', mouth: 'smile', arms: 'down', blush: true }
    case 'sleepTalk':
      // Mumbling with their eyes shut; then awake with a start, red-faced
      if (age < TALK_FOR) return { eyes: 'sleep', mouth: age % 3 === 0 ? 'open' : 'small', arms: 'down' }
      return age < TALK_FOR + 3
        ? { eyes: 'open', mouth: 'open', arms: 'cheeks', hop: 1, blush: true }
        : { eyes: 'squeeze', mouth: 'wavy', arms: 'cheeks', blush: true }
  }
}

/** The mark before what they say: a jolt, a yawn, a dream, the last of the z's */
export function wakeMark(kind: WakeKind, age: number, frame: number): string {
  switch (kind) {
    case 'startle':
      return age < 6 ? '!' : '…'
    case 'yawn':
      return age < 10 ? ['~', '~~', '~'][Math.floor(frame / 3) % 3]! : '…'
    case 'dream':
      return ['☁', '☁ ⋆', '☁'][Math.floor(frame / 3) % 3]!
    case 'sleepTalk':
      return age < TALK_FOR ? ['z', 'zZ'][Math.floor(frame / 3) % 2]! : age < TALK_FOR + 6 ? '!?' : '…'
  }
}
