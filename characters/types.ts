// What a character is: who they are, how they speak, and how they're drawn.
// One file per character in this folder, listed in ./index.ts.

import type { ArmKind, EyeKind, MouthKind } from '../hooks/sprite'
import type { Mood } from '../types'
import type { FavoriteKind } from '../hooks/bond'
import type { PartOfDay, Season, Sky } from '../hooks/world'

export type Gender = 'woman' | 'man' | 'nonbinary'

/** Filled into lines as {they}, {them}, {their} and {themself} */
export type Pronouns = { they: string; them: string; their: string; themself: string }

/** 0xRRGGBB colors for the parts of the portrait that differ between characters */
export type Palette = {
  hair: number
  hairShade: number
  hairShine: number
  skin: number
  skinShade: number
  /** Iris, pupil, and the glow at the bottom of the iris */
  eyes: number
  eyesDark: number
  eyesGlow: number
  blush: number
  lips: number
  /** The outer layer: blazer, hoodie, sweater */
  top: number
  topShade: number
  /** What shows at the neck: blouse, shirt */
  inner: number
  innerShade: number
  /** A tie, a button */
  accent: number
  /** Glasses frames */
  detail: number
}

export type Look = {
  /** Their color in the pane: name, speech bubble, headings. Bright enough for dark and light terminals */
  theme: number
  palette: Palette
  /** long: past the shoulders; bob: to the jaw; short: above the ears */
  hair: 'long' | 'bob' | 'short'
  /** swept: to one side; parted: down the middle; straight: a blunt fringe */
  bangs: 'swept' | 'parted' | 'straight'
  /** The strand of hair that sticks up on top */
  ahoge: boolean
  /** narrow: tapering to the chin; square: a broader jaw */
  face: 'narrow' | 'square'
  brows: 'thin' | 'thick'
  /** A flick of lashes at the outer corner of each eye */
  lashes: boolean
  facialHair: 'none' | 'stubble'
  outfit: 'blazer' | 'suit' | 'jacket' | 'hoodie' | 'sweater'
  glasses: boolean
  /** Small touches of style */
  accessories: ('earrings' | 'necklace')[]
}

/** The face and arms for a moment of a mood */
export type MoodLook = Partial<{ eyes: EyeKind; mouth: MouthKind; arms: ArmKind; blush: boolean; hop: 0 | 1 }>

/**
 * How this character's face and arms differ from the usual in a mood, so the
 * same event looks like them: a cheer, a smug fold of the arms, a small smile.
 * `frames` take turns every `every` ticks (a quarter second each), over the
 * rest; `confetti`, `hop`, `tear` and `sweat` false leave those out
 */
export type MoodStyle = Omit<MoodLook, 'hop'> &
  Partial<{ confetti: boolean; hop: boolean; tear: boolean; sweat: boolean }> & {
    frames?: MoodLook[]
    every?: number
  }


/**
 * One version of a line: said any time, or kept back until you're close
 * (`hearts`: from this many on) or until an achievement unlocks it (`unlock`:
 * its id in achievements/list.ts)
 */
export type Version = string | { text: string; hearts?: number; unlock?: string }

/** A line, or several versions of it, used in turn so the same one doesn't come twice running */
export type Line = Version | readonly Version[]

/** How close you are and what you've earned, which decides the versions open to you */
export type Standing = { hearts: number; unlocked: readonly string[] }

/** The temperament, shown when you pick: see docs/sheets */
export type Temperament = 'cheerful' | 'sassy' | 'quiet'


/**
 * Everything the character says, as templates: {name} and the pronouns are
 * always there, and some lines get their own {placeholders}. Plain words only,
 * never code. Diary lines are not here: they're a neutral log.
 */
export type Lines = {
  // You at the prompt
  typingShort: Line
  typingLong: Line
  thinking: Line
  // What Claude is doing ({lang}: TypeScript, Python, test code…)
  reading: Line
  searching: Line
  web: Line
  writing: Line
  runningTests: Line
  checkingTypes: Line
  linting: Line
  building: Line
  git: Line
  command: Line
  helper: Line
  planning: Line
  tool: Line
  toolFailed: Line
  // Checks ({check}: tests, types, lint, build; {count}: a number; {failing}: "3 failing")
  greenAgain: Line
  passing: Line
  checkPassed: Line
  downTo: Line
  stillFailing: Line
  failing: Line
  // Git ({done}: "is up" or "merged")
  pullRequest: Line
  merged: Line
  pushed: Line
  committed: Line
  // The end of a turn ({lang} of the first file changed)
  allWins: Line
  mixed: Line
  tough: Line
  niceWork: Line
  finished: Line
  stopped: Line
  error: Line
  // Her own life ({meal}: breakfast, lunch, dinner)
  sleep: Line
  // Waking up when you type or say hi: taken in turn, each with its own little animation
  /** With a start, embarrassed: "I wasn't asleep!" */
  wakeStartle: Line
  /** A big yawn and a stretch */
  wakeYawn: Line
  /** Still half in a dream, and telling you about it */
  wakeDream: Line
  /** Mumbled in their sleep, before they notice you */
  sleepTalk: Line
  /** Right after, realizing you heard */
  wakeAfterTalk: Line
  /** After a nap of an hour or more */
  wakeLong: Line
  /** Woken at night or late at night */
  wakeLate: Line
  // Touching them: a click on the portrait, or the pat button
  /** A pat on the top of the head */
  touchHead: Line
  /** Fiddling with their hair */
  touchHair: Line
  /** A poke on the cheek, or anywhere on the face */
  touchCheek: Line
  /** Their hand: a high five */
  touchHands: Line
  /** What they're holding, when it's none of the ones below: said of anything */
  touchHeld: Line
  /** Their mug of tea, on a break */
  touchTea: Line
  /** Their morning coffee */
  touchCoffee: Line
  /** Their snack: an onigiri */
  touchSnack: Line
  /** Their glass of water */
  touchWater: Line
  /** A tug at their clothes */
  touchOutfit: Line
  /** Something they're wearing ({item}: "headphones", "knit scarf") */
  touchWorn: Line
  /** Five in a row: enough */
  touchTooMuch: Line
  /** Woken by a touch */
  touchWake: Line
  /** A drag across their hair: stroking it */
  touchStroke: Line
  /** A drag across a cheek: squishing it */
  touchSquish: Line
  // Catching something drifting past with a click
  catchLeaf: Line
  catchPetal: Line
  catchSnowflake: Line
  catchFirefly: Line
  // The rare ones: a celebration
  catchGoldenLeaf: Line
  catchBlossom: Line
  catchCrystal: Line
  catchShootingStar: Line
  tea: Line
  meal: Line
  back: Line
  /** Now and then, a sip and a gentle reminder; picked from in turn, so they don't repeat */
  water: string[]
  /** A morning coffee break: blowing on it, a sip, a happy sigh. Picked from in turn */
  coffee: string[]
  /** After an hour without you: a hello, picked so it's never the last one used */
  missYou: string[]
  /** When you come back after they said they missed you */
  welcomeBack: string[]
  // Your other sessions ({project}; {summary}: that session's last words)
  peerDone: Line
  peerToast: Line
  // Replies to /frens
  opened: Line
  closed: Line
  quiet: Line
  chatty: Line
  diffsHidden: Line
  diffsShown: Line
  alone: Line
  scoreUp: Line
  scoreDown: Line
  hint: Line
  switched: Line
  /** When you switched away from them and came back the same day, taken in turn; versions can be kept back */
  returned: Version[]

  notifyOn: Line
  notifyOff: Line
  /** On their own birthday */
  birthday: Line
  /** On the anniversary of the day you met ({years}: "1 year", "2 years") */
  anniversary: Line
  /** The anniversary's letter, when no note of their own could be written ({years}; {days}: days together that year, a number) */
  yearLetter: Line
  // The day as a loop ({when}: "yesterday"; {summary}: "6 asks · 2 commits")
  /** The morning letter's greeting */
  letter: Line
  /** The letter's word about a win last time, when no note of their own could be written ({when}; {win}: "the tests went green again") */
  letterWin: Line
  /** ...about last time, when there's no win to name ({when}) */
  letterRecap: Line
  /** ...and when it's your first day, or a fresh start */
  letterFresh: Line
  /** Something coming up ({event}; {soon}: "tomorrow" or "in 3 days") */
  letterSoon: Line
  /** Signing off the letter */
  letterSign: Line
  /** In the evening, once you've wound down after a day of work */
  wrapUp: Line
  // Memory ({when}: "last Tuesday"; {memory}: "the tests went green again"; {days}: a number)
  /** Bringing up a past win */
  remember: Line
  /** In the letter, on a run of days in a row */
  streak: Line
  /** ...when it's the longest run yet */
  streakRecord: Line
  /** A check fails again, and you had a comeback before: once a day ({when}: "last Tuesday"; {memory}: "the tests went green again, after 7 tries") */
  callback: Line
  // Achievements ({achievement}: its name; {item}: what it unlocked)
  unlocked: Line
  /** An achievement with nothing to wear: it opens up new things for them to say */
  unlockedLines: Line

  wearing: Line
  wearingNothing: Line
}

/** Lines for the time of day, the week, the season and the weather; lists are taken in turn */
export type WorldLines = {
  /** The first hello in each part of the day */
  greet: Record<PartOfDay, string[]>
  /** In place of a morning hello, on Fridays and weekends */
  friday: string[]
  weekend: string[]
  /** Once, when a new season starts */
  season: Record<Season, string>
  /** When the weather changes ({temp}; {where}: " in Tokyo" for a city you set, nothing for a guess) */
  sky: Record<Sky, string[]>
}

/** Small talk, by what's going on; each pool is taken in turn. A pool with nothing open stays quiet */
export type Chatter = {
  /** Just after a win, or a loss */
  afterWin: Version[]
  afterLoss: Version[]
  /** After a couple of hours of work */
  longSession: Version[]
  /** The weather */
  rain: Version[]
  hot: Version[]
  cold: Version[]
  /** The time of day */
  morning: Version[]
  afternoon: Version[]
  evening: Version[]
  night: Version[]
  /** Whatever's on their mind */
  idle: Version[]
}

/** The weather spinner words follow: the sky, and hot, cold or windy days */
export type WeatherVerb = 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm' | 'hot' | 'cold' | 'windy'

/** The moods the status line tells apart */
export type StatusKey = 'calm' | 'watching' | 'working' | 'win' | 'loss' | 'rest' | 'away' | 'sleep'

/** A heart moment: a little scene where they share something about themselves */
export type Moment = { title: string; lines: string[] }

/** Something going on in their life, told over months: "learning the guitar" */
export type Story = { name: string; beats: { after: number; line: string }[] }

export type Character = {
  /** What /frens character takes, and the file's name */
  id: string
  name: string
  gender: Gender
  temperament: Temperament
  pronouns: Pronouns
  /** They celebrate it, in a party hat */
  birthday: { month: number; day: number }
  voice: {
    /** Who they are, for the model writing their end-of-turn line: "a cheerful …" */
    persona: string
    /** How they write: tone, and whether to use kaomoji */
    style: string
    lines: Lines
    /** Words for Claude's spinner while it works ("Ganbatte-ing"), one per turn */
    spinner: string[]
    /** More spinner words: in season, for the day's weather, and unlocked by achievements (by achievement id) */
    verbs: {
      seasons: Record<Season, string[]>
      weather: Partial<Record<WeatherVerb, string[]>>
      achievements: Partial<Record<string, string[]>>
    }
    /** Their line under the prompt, by how things are going */
    status: Record<StatusKey, string>
    /** What they say about the world around you */
    world: WorldLines
    /** Their own way of greeting a special day, by its id in events/calendar.ts */
    events?: Partial<Record<string, string>>
    /** Their own lines for a special day's scenes, by its id, one per scene in events/scenes.ts */
    scenes?: Partial<Record<string, string[]>>
    /** Small talk now and then, when you're around and they're not busy: the most fitting pool first */
    chatter: Chatter
  }
  look: Look
  /** Your relationship: a moment at each heart, five, then five more as the
   * hearts turn gold, and warmer hellos once you're close */
  bond: {
    moments: [Moment, Moment, Moment, Moment, Moment, Moment, Moment, Moment, Moment, Moment]
    /** What they call you once every heart is gold: "partner in crime" */
    title: string
    /** Hellos used now and then from three hearts on */
    warm: string[]
    /** Things they love you doing: each brings a little bond, once a day, and a line */
    favorites: { kind: FavoriteKind; name: string; line: string }[]
    /** Their answer when you say hi, taken in turn */
    hiBack: Version[]
  }
  /** Their own life, going on alongside yours: told a beat at a time, each
   * once you've spent `after` days together, never more than one a day */
  story: Story
  /** Per-mood touches on top of the usual expressions */
  moods?: Partial<Record<Mood, MoodStyle>>
}
