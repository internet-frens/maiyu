// Achievements and the items they unlock, as data: a new one is a few lines
// in ./list.ts or ./items.ts, no code

import type { Palette } from '../characters/types'
import type { Wearing } from '../types'

export type { Wearing }

/**
 * What the mod records as you work. Achievements are built from these; a new
 * kind of event is the only thing that needs code (in hooks/register.tsx).
 */
export type EventName =
  | 'prompt' // you sent Claude something
  | 'lateWork' // ...between midnight and 4 in the morning
  | 'turnDone' // a turn of Claude's finished
  | 'commit'
  | 'push'
  | 'pullRequest' // opened or merged
  | 'checkFixed' // tests, types, lint or a build went from failing to passing
  | 'checkPassed'
  | 'checkFailed'
  | 'earlyWork' // ...between 5 and 7 in the morning
  | 'weekendWork' // ...on a Saturday or Sunday
  | 'fridayDeploy' // a push on a Friday, from 5 in the evening
  | 'comeback' // a check went green after failing five runs or more in a row
  | 'switched' // you switched to another character
  | 'break' // they took a tea break
  | 'meal' // they had a meal
  | 'fileChanged' // Claude edited a file
  | 'goldHearts' // every heart gold with a character, their tenth moment shared

export type Measure =
  | {
      event: EventName
      /**
       * count: every time it happened; days: the different days it happened on;
       * sessionsOnOneDay: the most sessions it happened in on any one day
       */
      by: 'count' | 'days' | 'sessionsOnOneDay'
    }
  /** The most hearts with any one character */
  | { by: 'hearts' }

export type Achievement = {
  id: string
  name: string
  /** What it takes, in plain words, shown with the progress */
  description: string
  measure: Measure
  goal: number
  /** The unit in progress: "commits", "days" */
  unit: string
  /** Kept out of /frens achievements until it's earned: a surprise */
  hidden?: boolean

  /**
   * The item's id in ./items.ts. Without one, the achievement opens up lines
   * instead: every version a character keeps back with `unlock` set to its id
   */
  unlocks?: string

}

/** Something to wear: a change of colors, or a small thing drawn on */
export type Item =
  | {
      id: string
      name: string
      kind: 'palette'
      /** The colors it changes, over any character's own */
      palette: Partial<Palette>
    }
  | {
      id: string
      name: string
      kind: 'accessory'
      /** Where it's worn: two in one slot, the later wins */
      slot?: 'head' | 'neck' | 'hair' | 'held'
      /** Where its top-left pixel goes on the 32 × 44 portrait */
      at: { x: number; y: number }
      /** How many pixels lower they sit while it's on, to make room above a tall hat */
      sink?: number
      /** Rows of pixels: '1' to '9' are its own colors, ':' leaves what's there */
      pixels: string[]
      colors: Partial<Record<'1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9', number>>
    }

/** One session's tally, kept under its own key so sessions never collide */
export type Tally = {
  counts: Partial<Record<EventName, number>>
  /** The days each event happened on, as "2026-10-7" */
  days: Partial<Record<EventName, string[]>>
  /** How many of each, day by day, for the last two weeks */
  byDay?: Record<string, Partial<Record<EventName, number>>>
  /** The days spent with each character, by their id */
  with?: Record<string, string[]>
  /** Extra reasons a day counted toward your bond, by character, then day */
  bond?: Record<string, Record<string, string[]>>
}
