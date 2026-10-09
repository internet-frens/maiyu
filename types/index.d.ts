export type Mood =
  | 'idle'
  | 'sleepy'
  | 'watching'
  | 'thinking'
  | 'reading'
  | 'editing'
  | 'running'
  | 'worried'
  | 'happy'
  | 'celebrate'
  | 'comfort'
  | 'break'
  | 'snack'
  | 'water'
  | 'coffee'
  | 'miss'

export type Buddy = {
  /** Animation frame, one per tick */
  frame: number
  mood: Mood
  /** The frame the mood began on */
  since: number
  /** Where the eyes look: -1 left, 0 middle, 1 right */
  look: -1 | 0 | 1
  /** What the buddy says beside itself */
  note: string
  /** The last few things she saw, newest last */
  diary: string[]
  /** Ticks of work since her last break */
  worked: number
  /** The last meal she had, as mealtime() keys it */
  lastMeal: string
  /** The morning they last had their coffee, as coffeeTime() keys it */
  lastCoffee: string
  /** The frame they last had water and reminded you to */
  lastWater: number
  /** The frame you last typed or sent something */
  active: number
  /** The absence they last said they missed you in, by its `active` frame; -1 for none */
  missedFor: number
  /** Which miss-you line they used last, so the next is different */
  missLine: number
  /** The last part of a day they said hello in, as "2026-10-7:morning" */
  lastGreet: string
  /** The season and the sky they last remarked on */
  lastSeason: string
  lastSky: string
  /** The special day they last greeted, as "2026-10-31:halloween" */
  lastSpecial: string
  /** The day they last wrapped up */
  lastWrap: string
  /** The day they last brought up a memory */
  lastRecall: string
  /** The frame they last made small talk */
  lastChat: number
  /** The frame something last happened worth a stir of the season in the air */
  stirred?: number

}

export type CheckKind = 'test' | 'typecheck' | 'lint' | 'build'

/** How the session's work has gone */
export type Score = {
  /** The last run of each kind of check */
  checks: Partial<Record<CheckKind, { isPass: boolean; failed?: number; streak?: number }>>

  wins: number
  losses: number
  /** No model comment at the end of a turn */
  isQuiet: boolean
  /** No diffs in the bottom half of her pane */
  hidesDiffs: boolean
}

/** One file Claude changed this session */
export type Change = {
  path: string
  /** Unified-diff hunks, oldest first */
  hunks: string[]
  added: number
  removed: number
}

/** Another Claude Code session on this machine, as it last described itself */
export type Peer = {
  id: string
  /** The project folder's name */
  project: string
  status: 'working' | 'idle' | 'done'
  /** When the status began, in ms since the epoch */
  since: number
  /** Its last heartbeat */
  seen: number
  /** How its last turn went, in plain words */
  summary: string
}

/** The character picker in the pane */
export type Picker = { isOpen: boolean; query: string; mode?: 'characters' | 'wardrobe' | 'sessions' | 'welcome' | 'journal'; page?: number }


/** The morning letter or a heart moment, while it's open: its title, lines, and the frame it arrived */
export type Letter = { day: string; title?: string; lines: string[]; at: number }

/** The world as the pane shows it: the moment, and the weather if known */
export type World = {
  part: 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night' | 'lateNight'
  season: 'spring' | 'summer' | 'autumn' | 'winter'
  day: 'weekday' | 'friday' | 'weekend'
  /** Where the weather is from, roughly, so seasons flip south of the equator */
  latitude?: number
  /** The country, for special days kept only in some places; never shown */
  country?: string
  /** A special day today: a holiday, or the character's birthday */
  special?: { id: string; name: string }
  weather?: {
    sky: 'clear' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm'
    temperature: number
    unit: 'C' | 'F'
    place: string
    isDay: boolean
    isChosen?: boolean
    wind?: number
  }
}

/** What you're wearing: one accessory and one palette at most, by item id */
export type Wearing = { accessory?: string; palette?: string }

/** What the pane shows of achievements: which are unlocked, and how far along each is */
export type Trophies = { unlocked: string[]; progress: { id: string; value: number }[] }

declare module 'claude-code' {
  interface PluginState {
    maiyu: { buddy: Buddy; score: Score; changes: Change[]; peers: Peer[]; who: string; picker: Picker; wearing: Wearing; trophies: Trophies; world: World; letter: Letter | null; together: Record<string, { days: number; points: number; today: string[] }>; more: boolean; justDone: Record<string, number>; scene: { day: string; index: number; at: number } | null }
  }
}
