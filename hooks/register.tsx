import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, StateDollar } from 'claude-code'

import { ACHIEVEMENTS } from '../achievements/list'
import { ITEMS, itemById } from '../achievements/items'
import { TALLY_PREFIX, UNLOCKED_KEY, WEARING_KEY, asTally, bonded, count, dateOf, dayOf, isLate, newlyDone, progress, together } from '../achievements/progress'
import type { EventName, Item, Tally, Wearing } from '../achievements/types'
import type { Buddy, Change, Letter, Mood, Peer, Picker, Score, Trophies, World } from '../types'
import { DEV } from './dev'
import { fit, record, shown } from './diffs'
import { FORGET_MS, HEARTBEAT_MS, POLL_MS, PREFIX, asPeer, chip, finished, isAlive, keyOf, line, names, projectOf } from './sessions'
import {
  IP_LOOKUP_URL,
  dayKind,
  describeWorld,
  where,
  forecastUrl,
  geocodeUrl,
  glyph,
  partOfDay,
  readForecast,
  readGeocode,
  readIpLookup,
  seasonOf,
} from './world'
import type { PartOfDay, Place, WeatherSetting } from './world'
import { isWindy } from './world'
import { AROUND, BREAK_AFTER, BREAK_FOR, MISS_AFTER, MISS_FOR, SNACK_FOR, COFFEE_FOR, TICK_MS, WATER_EVERY, WATER_FOR, coffeeTime, mealtime, nextLine } from './routine'
import type { Patch } from './diffs'
import { CHARACTERS, DEFAULT, birthdayOf, byId, describeCharacter, pickOpen, search, spinnerWords, voiceOf } from '../characters/index'
import type { Character, LineKey, Say } from '../characters/index'
import type { Palette, Standing } from '../characters/types'

import type { StatusKey, WeatherVerb } from '../characters/types'
import { brief, cheer, classify, describe, fallback, judge, language, react, systemFor, tidy } from './coach'
import type { GitOperation, Reaction, Turn } from './coach'
import { BIRTHDAY_HAT, SPECIAL_DAYS, findDay, specialDayOn, wornBy } from '../events/calendar'
import { SCENES, propOn } from '../events/scenes'
import type { Scene } from '../events/scenes'
import { DAILY_CAP, HEART_POINTS, anniversaryOn, daysWith, nextAnniversary, heartSlots, heartsBar, heartsFor, pointsWith, progressBar, reasonsByDay, toNextHeart } from './bond'
import type { BondReason, FavoriteKind } from './bond'
import { MEMORY_PREFIX, agoOf, asMemories, bestStreak, daysBetween, lastComeback, recall, remember, streak } from './memory'
import type { Memory } from './memory'
import { SENT_KEY, SHARE_KEY, SHARE_NOTICE_KEY, USAGE_PREFIX, USAGE_URL, asUsage, heard, report } from './usage'
import { INSTALL_KEY, PING_URL, RELEASE_KEY, asRelease, isInstallId, newInstallId, ping } from './ping'
import { comingUp, countsOn, describeDay, lastDayBefore, whenWas } from './day'
import { HIGHLIGHT_PREFIX, YEAR_KEY, asHighlights, asYearWins, isAfterBreak, keepHighlight, keepYearWin, letterBrief, letterSystem, tidyNote, yearBrief, yearSystem } from './letter'
import { JOURNAL_KEY, NO_JOURNAL, SKIES, STORIES_KEY, asJournal, asTold, caught, jot, journalSections, journalText, journalVoice, nextBeat, seasonKey } from './journal'
import type { Found, Journal, JournalFacts } from './journal'
import type { Highlight } from './letter'
import { TONES, atRest, chatEvery as chatPace, dayMoment, inTone, swayOf, timeAir } from './daytime'
import { SEASONAL, dressFor, isCold, isHot, layered, seasonAir, seasonMoment } from './seasons'
import { LONG_NAP, TALK_FOR, WAKE_FOR, wakeKind, wakeMark, wakePose } from './wake'
import type { WakeKind } from './wake'
import type { SeasonShow } from './seasons'
import { COMMON, HEIGHT, LEAF_CYCLE, RARE, SMALLEST, TWINKLE, WIDTH, catchOf, isRare, cells, coffeeStep, paletteOf, grow, shrink, shrunkHeight, sprite, spriteWithParts, svgOf } from './sprite'
import type { Accessory, Air, Catchable } from './sprite'
import type { PortraitProps } from './portrait'
import { KEEPSAKES, pictureCells, pictureSvg, pixelColor, ribbon, sizeOf, washiTape } from './decor'
import type { Picture } from './decor'
import { BIG_COLUMNS, BIG_ROWS, ICON_COLUMNS, ICON_ROWS, ICONS, bigCells, bigSvg, iconCells, iconSvg } from './icons'
import { CAUGHT_FOR, ONE_OF, TOO_MUCH, TOUCH_QUIET, catchLine, touchFor, touchKind, touchLine, touchMark, touchNote, touchPose } from './touch'
import type { TouchKind } from './touch'
import type { Pose } from './sprite'

const PANE = 'buddy'
// How many ticks a passing mood lasts before they settle back to idle
const LINGER: Partial<Record<Mood, number>> = {
  watching: 8,
  happy: 12,
  worried: 16,
  celebrate: 20,
  comfort: 24,
  break: BREAK_FOR,
  snack: SNACK_FOR,
  water: WATER_FOR,
  coffee: COFFEE_FOR,
  miss: MISS_FOR,
}
// Idle this many ticks (two minutes) and they doze off
const DOZE = (2 * 60 * 1000) / TICK_MS
const DIARY_SIZE = 6

// "Never typed": far enough back that you're never counted as around
const NEVER = -1_000_000
const hasTyped = (b: Buddy) => b.active > NEVER

const INITIAL: Buddy = { frame: 0, mood: 'idle', since: 0, look: 0, note: '', diary: [], worked: 0, lastMeal: '', lastCoffee: '', lastWater: 0, active: NEVER, missedFor: -1, missLine: -1, lastGreet: '', lastSeason: '', lastSky: '', lastSpecial: '', lastWrap: '', lastRecall: '', lastChat: NEVER }
const buddy = atom({ plugin: 'maiyu', key: 'buddy' } as const, INITIAL)

// $.state outlives a reload, so a value an older version saved can lack newer fields
export const fresh = (b: Partial<Buddy> | undefined): Buddy => ({
  ...INITIAL,
  ...b,
  diary: Array.isArray(b?.diary) ? b.diary : [],
})
const look$ = async ($: StateDollar): Promise<Buddy> => fresh(await read($, buddy))
// /frens play: a mood held and looped for looking at an animation; nothing
// else changes it until /frens play off. Replays from the start every LOOP ticks
let held: Mood | undefined
// Or a time of day, held: resting as they would then, with its air at its fullest
let heldPart: PartOfDay | undefined
const LOOP = 40
const MOODS: readonly Mood[] = ['idle', 'sleepy', 'watching', 'thinking', 'reading', 'editing', 'running', 'worried', 'happy', 'celebrate', 'comfort', 'break', 'snack', 'water', 'miss']
const PARTS: readonly PartOfDay[] = ['dawn', 'morning', 'afternoon', 'evening', 'night', 'lateNight']
const hold = (before: Buddy, next: Buddy): Buddy => {
  if (held === undefined) return next
  const since = next.frame - before.since >= LOOP ? next.frame : before.since
  return { ...next, mood: held, since }
}
const change = ($: StateDollar, fn: (b: Buddy) => Buddy): Promise<Buddy> =>
  update($, buddy, b => {
    const before = fresh(b)
    return hold(before, fn(before))
  })

// Diffs are off in the pane unless you turn them on
const NO_SCORE: Score = { checks: {}, wins: 0, losses: 0, isQuiet: false, hidesDiffs: true }
const score = atom({ plugin: 'maiyu', key: 'score' } as const, NO_SCORE)
const freshScore = (s: Partial<Score> | undefined): Score => ({ ...NO_SCORE, ...s, checks: { ...s?.checks } })
const scoreOf = async ($: StateDollar): Promise<Score> => freshScore(await read($, score))
const rescore = ($: StateDollar, fn: (s: Score) => Score): Promise<Score> => update($, score, s => fn(freshScore(s)))

const changes = atom({ plugin: 'maiyu', key: 'changes' } as const, [] as Change[])
const changesOf = async ($: StateDollar): Promise<Change[]> => {
  const list = await read($, changes)
  return Array.isArray(list) ? list : []
}

const peers = atom({ plugin: 'maiyu', key: 'peers' } as const, [] as Peer[])
const peersOf = async ($: StateDollar): Promise<Peer[]> => {
  const list = await read($, peers)
  return Array.isArray(list) ? list : []
}
// Sessions that finished in the last few minutes, by id, and when: they stand
// out in the chip and the list until you open it
const FRESH_FOR = 5 * 60_000
const justDone = atom({ plugin: 'maiyu', key: 'justDone' } as const, {} as Record<string, number>)
// Finished while they were busy: they tell you once they're free
let headsUps: Peer[] = []

async function openSessions($: Pick<EngineInterface, 'state' | 'ui'>) {
  await update($, justDone, () => ({}))
  await openPicker($, 'sessions')
}

// Who your buddy is: kept in the shared store so every session agrees, and in
// state so the pane redraws when it changes
const CHARACTER_KEY = 'character'
const who = atom({ plugin: 'maiyu', key: 'who' } as const, DEFAULT.id)
let current: Character = DEFAULT
// How close you are to whoever's here, and every achievement earned: which
// versions of their lines are open to you
let heartsNow = 0
let unlockedNow: string[] = []
const standing = (): Standing => ({ hearts: heartsNow, unlocked: unlockedNow })

// Usage sharing, only if you turned it on: each line said is counted by its
// id, and the counts join this session's record every few seconds
let shares = true
let usageKey = `${USAGE_PREFIX}local`
let pending: string[] = []
const onHeard = (id: string) => {
  if (shares) pending.push(id)
}
async function flushUsage($: Pick<EngineInterface, 'store'>) {
  const ids = pending
  pending = []
  if (!shares || ids.length === 0) return
  await $.store.set(usageKey, ids.reduce(heard, asUsage(await $.store.get(usageKey))))
}
// One voice per character, kept, so their lines carry on in turn when you come back
const voices = new Map<string, Say>()
const voiceFor = (c: Character): Say => {
  const known = voices.get(c.id) ?? voiceOf(c, standing, onHeard)
  voices.set(c.id, known)
  return known
}
let say: Say = voiceFor(DEFAULT)

async function become($: StateDollar, c: Character) {
  current = c
  say = voiceFor(c)
  await update($, who, () => c.id)
}


// Whether their pane is drawn (a pane opened unasked waits below 144
// columns), and whether you closed it, so prompts leave it be until /frens
let isShown = false
// How many rows the rest of the pane took when it was last drawn (the name,
// the bubble, the buttons, a picker or letter), so the portrait can have
// what's left. A pane isn't told its content's height, so it's counted here
let rowsBesides = 8
let isDismissed = false
let headless = false
// Where this session draws, for the ping
let surface: string | null = null

// Achievements: every session counts what happens under its own key in the
// shared store; progress merges them all. Unlocks and what's worn are shared too.
type Kit = Pick<EngineInterface, 'store' | 'clock' | 'state' | 'ui'>
const wearingAtom = atom({ plugin: 'maiyu', key: 'wearing' } as const, {} as Wearing)
const trophies = atom({ plugin: 'maiyu', key: 'trophies' } as const, { unlocked: [], progress: [] } as Trophies)
let tallyKey = `${TALLY_PREFIX}local`
let memoryKey = `${MEMORY_PREFIX}local`
let highlightKey = `${HIGHLIGHT_PREFIX}local`

// Remembering a big win, in plain words
async function memorize($: Kit, what: string, kind?: Memory['kind']) {
  const now = await $.clock.now()
  const today = dayOf(now)
  await $.store.set(memoryKey, remember(asMemories(await $.store.get(memoryKey)), { day: today, what, ...(kind ? { kind } : {}) }, today))
  // And the month's first, kept two years, for the anniversary's letter
  const at = new Date(now)
  const key = `${YEAR_KEY}:${current.id}`
  const kept = keepYearWin(asYearWins(await $.store.get(key)), `${at.getFullYear()}-${at.getMonth() + 1}`, what)
  if (kept) await $.store.set(key, kept)
}
const keepMemory = ($: Kit, what: string, kind?: Memory['kind']) => enqueue(() => memorize($, what, kind))

// A turn that got something done, for the morning letter: what you asked and
// what they said about it
async function highlight($: Kit, asked: string, said: string) {
  const today = dayOf(await $.clock.now())
  await $.store.set(highlightKey, keepHighlight(asHighlights(await $.store.get(highlightKey)), { day: today, asked, said }, today))
}
async function highlights($: Pick<EngineInterface, 'store'>): Promise<Highlight[]> {
  const out: Highlight[] = []
  for (const key of await $.store.keys()) if (key.startsWith(HIGHLIGHT_PREFIX)) out.push(...asHighlights(await $.store.get(key)))
  return out
}
const bondFor = ($: Kit, reason: BondReason, line?: string) => enqueue(() => bondUp($, reason, line))

// Their favorite things, if you're doing one now: each counts once a day
function favoritesNow(at: Date, w: World): FavoriteKind[] {
  const hour = at.getHours()
  const kinds: FavoriteKind[] = []
  if (hour >= 22 || hour < 4) kinds.push('lateNight')
  if (hour >= 5 && hour < 9) kinds.push('morning')
  if (w.day === 'weekend') kinds.push('weekend')
  if (w.part === 'evening') kinds.push('evening')
  const sky = w.weather?.sky
  if (sky === 'rain' || sky === 'drizzle' || sky === 'storm') kinds.push('rain')
  return kinds
}

async function noticeFavorites($: Kit, kinds: readonly FavoriteKind[]) {
  const loved = current.bond.favorites.find(f => kinds.includes(f.kind))
  if (loved) await bondUp($, 'favorite', loved.line)
}

// What you sent counts as a day together; on their birthday, and when it's one
// of their favorite things, a little more
async function promptBond($: Kit) {
  await rememberMeeting($, current)
  const at = new Date(await $.clock.now())
  const b = current.birthday
  if (at.getMonth() + 1 === b.month && at.getDate() === b.day) await bondUp($, 'birthday')
  const together = anniversaryOn(metDays[current.id], at)
  if (together && !eventsOff.includes('anniversary')) {
    await bondUp($, 'anniversary')
    await memorize($, `our ${years(together)} anniversary`)
  }
  await noticeFavorites($, favoritesNow(at, await worldOf($)))
}

// Waking up: how they woke and when, and, after talking in their sleep, what
// they say once they notice you. Each kind plays for a few seconds
let waking: { kind: WakeKind; at: number; then?: string } | undefined
let wakes = 0
const wakingNow = (b: Buddy) => (waking !== undefined && b.frame - waking.at < WAKE_FOR[waking.kind] ? waking : undefined)
const WAKE_LINE = { startle: 'wakeStartle', yawn: 'wakeYawn', dream: 'wakeDream', sleepTalk: 'sleepTalk' } as const

// Wakes them from sleep, the next way in turn; a line of your own (a welcome
// back) comes with a yawn
function wakeUp(b: Buddy, part: World['part'], line?: string): Buddy {
  const slept = b.frame - b.since
  const isLate = part === 'night' || part === 'lateNight'
  const kind = line !== undefined ? 'yawn' : wakeKind(wakes++, slept, isLate)
  const said = line ?? (slept >= LONG_NAP ? say('wakeLong') : isLate ? say('wakeLate') : say(WAKE_LINE[kind]))
  waking = { kind, at: b.frame, then: kind === 'sleepTalk' ? say('wakeAfterTalk') : undefined }
  return feel('happy', said, 'woke up')(b)
}

async function sayHi($: Kit) {
  const b = await look$($)
  const picked = pickOpen(current.bond.hiBack, standing(), b.frame)
  if (picked && b.mood !== 'sleepy') onHeard(`${current.id}.hiBack.${picked.index}`)
  const line = picked?.text ?? 'hi!'
  const part = (await read($, world)).part
  await change($, x => ({
    ...(x.mood === 'sleepy' ? wakeUp(x, part) : feel('happy', line, 'you said hi')(x)),
    active: x.frame,
  }))
  bondFor($, 'hi')
}

// Touching them: a pat on the head, a poke on the cheek, a look at what
// they're wearing. Free, and never a heart, so there's nothing to farm. Too
// many in a row and they've had enough, until things go quiet for a bit
let touching: { kind: TouchKind; at: number } | undefined
let touches = { count: 0, at: -Infinity }
const touchingNow = (b: Buddy) => (touching !== undefined && b.frame - touching.at < touchFor(touching.kind) ? touching : undefined)

// Now and then, their eyes follow the pointer across the portrait for a few
// seconds: every other time you come by, never more than once in 45 seconds
const FOLLOW_FOR = 6 * 4
const FOLLOW_GAP = 45 * 4
// A pointer back within ten seconds is the same visit
const VISIT_GAP = 10 * 4
let following: { look: -1 | 0 | 1; until: number } | undefined
let lastSeen = -Infinity
let visits = 0
let nextFollow = 0
const followingNow = (b: Buddy) => (following !== undefined && b.frame < following.until ? following : undefined)

async function pointerAt($: Kit, look: -1 | 0 | 1 | null) {
  const b = await look$($)
  if (look === null) {
    if (following) following = { ...following, until: Math.min(following.until, b.frame + 2) }
    return
  }
  const isNewVisit = b.frame - lastSeen > VISIT_GAP
  lastSeen = b.frame
  if (followingNow(b)) {
    following = { ...following!, look }
    return
  }
  if (!isNewVisit) return
  const isFree = b.mood === 'idle' || b.mood === 'watching' || b.mood === 'happy'
  if (visits++ % 2 !== 0 || b.frame < nextFollow || !isFree) return
  following = { look, until: b.frame + FOLLOW_FOR }
  nextFollow = b.frame + FOLLOW_FOR + FOLLOW_GAP
}
// What's worn in the portrait as last drawn, to name what you touched
let wornNow: readonly Accessory[] = []
// What you've caught out of the air, gone from the picture until it's due back
let hiddenAir: { id: string; until: number }[] = []
const hiddenAt = (frame: number) => hiddenAir.filter(h => frame < h.until).map(h => h.id)

// Catching a leaf, a petal, a snowflake or a firefly as it drifts by: it's gone
// from the air, counted in the journal, and they're delighted. Asleep, they
// sleep on; it's caught all the same
async function catchIt($: Kit, id: string, kind: Catchable) {
  const b = await look$($)
  if (hiddenAt(b.frame).includes(id)) return
  hiddenAir = [...hiddenAir.filter(h => b.frame < h.until), { id, until: b.frame + CAUGHT_FOR[kind] }]
  // A preview's catches are for seeing how it looks: they don't go in the journal
  if (!preview && !airPreview) {
    const season = seasonKey(dayOf(await $.clock.now()), (await read($, world)).season)
    journalNow = caught(asJournal(await $.store.get(JOURNAL_KEY)), kind, season)
    await $.store.set(JOURNAL_KEY, journalNow)
  }
  if (b.mood === 'sleepy') {
    await change($, x => ({ ...x }))
    return
  }
  const line = say(catchLine(kind))
  // A rare one is a celebration, and a toast to say it's in the journal
  const rare = isRare(kind)
  touching = { kind: rare ? 'rare' : 'catch', at: b.frame }
  if (rare) $.ui.toast(`✦ ${ONE_OF[kind]}! A rare find, in your journal now`)
  await change($, x =>
    UNTOUCHED.includes(x.mood)
      ? { ...x, note: line }
      : { ...feel(rare ? 'celebrate' : 'happy', line, touchNote(rare ? 'rare' : 'catch', ONE_OF[kind]))(x), active: x.frame },
  )
}

// Moods a touch doesn't interrupt: a break, or Claude at work
const UNTOUCHED: Mood[] = ['break', 'snack', 'water', 'coffee', 'thinking', 'reading', 'editing', 'running']

async function touch($: Kit, where: string, isStroke = false) {
  const caughtKind = catchOf(where)
  if (caughtKind !== undefined) return catchIt($, where, caughtKind)
  const b = await look$($)
  if (b.mood === 'sleepy') {
    touches = { count: 0, at: b.frame }
    const part = (await read($, world)).part
    await change($, x => ({ ...wakeUp(x, part, say('touchWake')), active: x.frame }))
    return
  }
  touches = b.frame - touches.at > TOUCH_QUIET ? { count: 1, at: b.frame } : { count: touches.count + 1, at: b.frame }
  const worn = wornNow.find(a => a.id === where)
  const kind = touchKind(where, worn !== undefined, touches.count >= TOO_MUCH, isStroke)
  // What's in their hands is whatever their mood has them holding
  const key = kind === 'held' ? (HELD_LINES[b.mood] ?? 'touchHeld') : touchLine(kind)
  const line = say(key, worn ? { item: worn.name.toLowerCase() } : undefined)
  touching = { kind, at: b.frame }
  const entry = touches.count === 1 || touches.count === TOO_MUCH ? touchNote(kind, worn?.name) : undefined
  await change($, x =>
    UNTOUCHED.includes(x.mood) ? { ...x, note: line, active: x.frame } : { ...feel(kind === 'tooMuch' ? 'idle' : 'happy', line, entry)(x), active: x.frame },
  )
}

// Every session's memories, oldest first
async function memories($: Pick<EngineInterface, 'store'>): Promise<Memory[]> {
  const out: Memory[] = []
  for (const key of await $.store.keys()) if (key.startsWith(MEMORY_PREFIX)) out.push(...asMemories(await $.store.get(key)))
  return out.sort((a, b) => dateOf(a.day).getTime() - dateOf(b.day).getTime())
}

// The days you've coded together, every session's, for streaks
const codingDays = (all: readonly Tally[]) => all.flatMap(t => t.days.prompt ?? [])

// "1 day", "4 days"
const dayCount = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

// What a check going green again sounds like
const GREEN: Record<string, string> = {
  test: 'the tests went green again',
  typecheck: 'the types checked out again',
  lint: 'the linter was happy again',
  build: 'the build worked again',
}

const wearingOf = async ($: StateDollar): Promise<Wearing> => ({ ...(await read($, wearingAtom)) })
const trophiesOf = async ($: StateDollar): Promise<Trophies> => {
  const t = await read($, trophies)
  return { unlocked: Array.isArray(t?.unlocked) ? t.unlocked : [], progress: Array.isArray(t?.progress) ? t.progress : [] }
}

async function tallies($: Pick<EngineInterface, 'store'>): Promise<Tally[]> {
  const out: Tally[] = []
  for (const key of await $.store.keys()) if (key.startsWith(TALLY_PREFIX)) out.push(asTally(await $.store.get(key)))
  return out
}

async function wear($: Pick<EngineInterface, 'store' | 'state'>, next: Wearing) {
  await $.store.set(WEARING_KEY, next)
  await update($, wearingAtom, () => next)
}

// Puts an item on in its slot, or takes off what's in a slot
async function putOn($: Kit, item: Item) {
  await wear($, { ...(await wearingOf($)), [item.kind]: item.id })
  await change($, feel('happy', say('wearing', { item: item.name.toLowerCase() }), `wearing ${item.name}`))
}
async function takeOff($: Kit, slot: Item['kind'] | 'all') {
  const now = await wearingOf($)
  await wear($, slot === 'all' ? {} : { ...now, [slot]: undefined })
  await change($, feel('happy', say('wearingNothing'), 'changed back'))
}

// Works out progress, and celebrates anything newly done
// Your bond with each character: days together, points, and what counted today
type Bond = { days: number; points: number; today: string[] }
const togetherAtom = atom({ plugin: 'maiyu', key: 'together' } as const, {} as Record<string, Bond>)
// Points given with /frens heart, by character, for working on the mod: on
// top of the ones earned, and only while the dev tools are on
const GIFT_KEY = 'devHearts'
async function giftedPoints($: Pick<EngineInterface, 'store'>): Promise<Record<string, number>> {
  if (!DEV) return {}
  const stored = await $.store.get(GIFT_KEY)
  return typeof stored === 'object' && stored !== null
    ? Object.fromEntries(Object.entries(stored).filter((e): e is [string, number] => Number.isInteger(e[1]) && e[1] > 0))
    : {}
}

// Progress made here celebrates here; progress another session made is only mentioned
async function checkAchievements($: Kit, isHere = true) {
  const every = await tallies($)
  const today = dayOf(await $.clock.now())
  const gifted = await giftedPoints($)
  const bonds = Object.fromEntries(
    CHARACTERS.map(c => [
      c.id,
      { days: daysWith(every, c.id), points: pointsWith(every, c.id) + (gifted[c.id] ?? 0), today: [...(reasonsByDay(every, c.id).get(today) ?? [])] },
    ]),
  )
  heartsNow = heartsFor(bonds[current.id]?.points ?? 0)
  await update($, togetherAtom, () => bonds)
  const all = progress(every)
  const stored = await $.store.get(UNLOCKED_KEY)
  const unlocked = Array.isArray(stored) ? stored.filter((x): x is string => typeof x === 'string') : []
  const done = newlyDone(all, unlocked)
  const nowUnlocked = [...unlocked, ...done.map(p => p.achievement.id)]
  unlockedNow = nowUnlocked
  if (done.length > 0) await $.store.set(UNLOCKED_KEY, nowUnlocked)
  await update($, trophies, () => ({ unlocked: nowUnlocked, progress: all.map(p => ({ id: p.achievement.id, value: p.value })) }))
  for (const p of done) {
    const item = p.achievement.unlocks === undefined ? undefined : itemById(p.achievement.unlocks)
    const verbs = current.voice.verbs.achievements[p.achievement.id] ?? []
    const words = verbs.length > 0 ? `, and new words: ${verbs.join(', ')}` : ''
    keepMemory($, `you earned ${p.achievement.name}`)
    bondFor($, 'win')
    // Nothing to wear: it opens up new things for them to say
    const cheer = (note: string) => (isHere ? feel('celebrate', note, `★ ${p.achievement.name}`) : mention(note, `★ ${p.achievement.name}`))
    if (item === undefined) {
      await change($, cheer(say('unlockedLines', { achievement: p.achievement.name })))
      if (isHere) $.ui.toast(`${current.name}: ${p.achievement.name} unlocked, new things to say${words} ✧`)
      continue
    }
    await change($, cheer(say('unlocked', { achievement: p.achievement.name, item: item.name.toLowerCase() })))
    if (isHere) $.ui.toast(`${current.name}: ${p.achievement.name} unlocked, the ${item.name.toLowerCase()}${words} ✧`)
    // On straight away, unless something's already in that slot
    const w = await wearingOf($)
    if (w[item.kind] === undefined) await wear($, { ...w, [item.kind]: item.id })
  }
}

// Counts something that happened, toward every achievement built on it
async function tallyUp($: Kit, event: EventName) {
  const now = await $.clock.now()
  let mine = asTally(await $.store.get(tallyKey))
  mine = count(mine, event, dayOf(now))
  if (event === 'prompt' && isLate(now)) mine = count(mine, 'lateWork', dayOf(now))
  const at = new Date(now)
  if (event === 'prompt' && at.getHours() >= 5 && at.getHours() < 7) mine = count(mine, 'earlyWork', dayOf(now))
  if (event === 'prompt' && (at.getDay() === 0 || at.getDay() === 6)) mine = count(mine, 'weekendWork', dayOf(now))
  // Pushing on a Friday evening: brave
  if (event === 'push' && at.getDay() === 5 && at.getHours() >= 17) mine = count(mine, 'fridayDeploy', dayOf(now))
  // A prompt is a day spent with whoever's here
  if (event === 'prompt') mine = together(mine, current.id, dayOf(now))
  await $.store.set(tallyKey, mine)
  await checkAchievements($)
}

// A reason today counts toward your bond with whoever's here, once a day each;
// with a line to say the first time, like a favorite thing
async function bondUp($: Kit, reason: BondReason, line?: string) {
  const today = dayOf(await $.clock.now())
  const already = reasonsByDay(await tallies($), current.id).get(today)?.has(reason) === true
  if (already) return
  await $.store.set(tallyKey, bonded(asTally(await $.store.get(tallyKey)), current.id, today, reason))
  await checkAchievements($)
  if (line) await change($, mention(line, `${current.name} loved that ♡`))
}

// Recording never holds up what you're doing, and never breaks it. Records
// queue up one after another, so two at once never overwrite each other;
// anything that reads them waits for the queue first
let recording: Promise<void> = Promise.resolve()
const enqueue = (work: () => Promise<void>) => {
  recording = recording.then(work).catch(() => undefined)
}
const logEvent = ($: Kit, event: EventName) => enqueue(() => tallyUp($, event))

// One line of progress: "▰▰▰▱▱ Shipper 15/25 commits → gold pin"
function progressLine(id: string, t: Trophies): string {
  const a = ACHIEVEMENTS.find(x => x.id === id)
  if (a === undefined) return ''
  const verbs = current.voice.verbs.achievements[a.id] ?? []
  const prize = a.unlocks === undefined ? 'new lines' : (itemById(a.unlocks)?.name.toLowerCase() ?? 'something')
  const item = `${prize}${verbs.length > 0 ? ` + "${verbs.join('", "')}"` : ''}`
  if (t.unlocked.includes(a.id)) return `✓ ${a.name}: ${item}`
  const value = t.progress.find(p => p.id === a.id)?.value ?? 0
  const filled = Math.round((value / a.goal) * 5)
  return `${'▰'.repeat(filled)}${'▱'.repeat(5 - filled)} ${a.name} ${value}/${a.goal} ${a.unit} → ${item}`
}

// The world around you: the time, the season, and the weather where you are.
// Where you are comes from your IP address, unless you name a city or turn it off
const WEATHER_SETTING = 'weatherSetting'
const WEATHER_NOW = 'weatherNow'
const LOCATION = 'location'
const WEATHER_EVERY = 30 * 60_000
const LOCATION_EVERY = 24 * 60 * 60_000
const world = atom({ plugin: 'maiyu', key: 'world' } as const, { part: 'morning', season: 'spring', day: 'weekday' } as World)
const worldOf = ($: StateDollar): Promise<World> => read($, world)

async function weatherSetting($: Pick<EngineInterface, 'store'>): Promise<WeatherSetting> {
  const v = (await $.store.get(WEATHER_SETTING)) as Partial<WeatherSetting> | undefined
  return v?.mode === 'city' || v?.mode === 'off' ? { mode: v.mode, city: v.city } : { mode: 'auto' }
}

// Where to ask about: a city you named, or a guess from your IP, kept a day
async function placeFor($: Pick<EngineInterface, 'store' | 'http' | 'clock'>, setting: WeatherSetting): Promise<Place | undefined> {
  const now = await $.clock.now()
  const key = setting.mode === 'city' ? `city:${setting.city ?? ''}` : 'auto'
  const kept = (await $.store.get(LOCATION)) as { key?: string; at?: number; place?: Place } | undefined
  if (kept?.key === key && kept.place && now - (kept.at ?? 0) < LOCATION_EVERY) return kept.place
  const reply =
    setting.mode === 'city' ? await $.http.fetch(geocodeUrl(setting.city ?? '')) : await $.http.fetch(IP_LOOKUP_URL)
  if (!reply.ok) return undefined
  const place = setting.mode === 'city' ? readGeocode(reply.text) : readIpLookup(reply.text)
  if (place) await $.store.set(LOCATION, { key, at: now, place })
  return place
}

// The weather, shared by every session: whoever finds it stale asks again
async function refreshWeather($: Pick<EngineInterface, 'store' | 'http' | 'clock' | 'state'>, force = false) {
  const setting = await weatherSetting($)
  if (setting.mode === 'off') {
    lastWeather = undefined
    await update($, world, w => ({ ...w, weather: undefined }))
    return
  }
  const now = await $.clock.now()
  const kept = (await $.store.get(WEATHER_NOW)) as { at?: number; weather?: World['weather']; key?: string; latitude?: number } | undefined
  const key = setting.mode === 'city' ? `city:${setting.city ?? ''}` : 'auto'
  let weather = !force && kept?.key === key && now - (kept.at ?? 0) < WEATHER_EVERY ? kept.weather : undefined
  let latitude = kept?.latitude
  let country = (kept as { country?: string } | undefined)?.country
  if (weather === undefined) {
    const place = await placeFor($, setting)
    if (place === undefined) return
    const reply = await $.http.fetch(forecastUrl(place))
    const forecast = reply.ok ? readForecast(reply.text, place) : undefined
    if (forecast === undefined) return
    weather = { ...forecast, isChosen: setting.mode === 'city' }
    latitude = Math.round(place.latitude)
    country = place.country
    await $.store.set(WEATHER_NOW, { at: now, key, weather, latitude, country })
  }
  const known = weather
  lastWeather = known
  await update($, world, w => ({ ...w, weather: known, latitude, country: country ?? w.country }))
}

// How much of the season shows, shared by every session
const SEASONS_KEY = 'seasons'
let seasonShow: SeasonShow = 'subtle'
const readSeasonShow = async ($: Pick<EngineInterface, 'store'>) => {
  const v = await $.store.get(SEASONS_KEY)
  seasonShow = v === 'full' || v === 'off' ? v : 'subtle'
}

// Whether the time of day shows in how they speak and move, shared by every session
const DAYTIME_KEY = 'daytime'
let daytimeOn = true
const readDaytime = async ($: Pick<EngineInterface, 'store'>) => {
  daytimeOn = (await $.store.get(DAYTIME_KEY)) !== 'off'
}

// Their own stories, a beat now and then: shared by every session
const TELLING_KEY = 'storiesOn'
let storiesOn = true
const readStories = async ($: Pick<EngineInterface, 'store'>) => {
  storiesOn = (await $.store.get(TELLING_KEY)) !== 'off'
}

// The journal: what you've found together, written down as it's found. Kept in
// memory too, so the store is only written when there's something new
let journalNow: Journal = NO_JOURNAL
async function noteJournal($: Pick<EngineInterface, 'store'>, kind: Found, what: string) {
  if (preview || journalNow[kind].includes(what)) return
  const added = jot(asJournal(await $.store.get(JOURNAL_KEY)), kind, what)
  if (added) await $.store.set(JOURNAL_KEY, added)
  journalNow = added ?? asJournal(await $.store.get(JOURNAL_KEY))
}

// The day you first met each character, kept for good: their anniversaries
const MET_KEY = 'met'
let metDays: Record<string, string> = {}
const readMet = async ($: Pick<EngineInterface, 'store'>) => {
  const v = await $.store.get(MET_KEY)
  metDays = v && typeof v === 'object' ? (v as Record<string, string>) : {}
}
// The first time with someone, or for those you already know, the earliest
// day together on record
async function rememberMeeting($: Pick<EngineInterface, 'store' | 'clock'>, c: Character) {
  await readMet($)
  if (metDays[c.id]) return
  const today = dayOf(await $.clock.now())
  const earliest = (await tallies($))
    .flatMap(t => t.with?.[c.id] ?? [])
    .sort((a, b) => dateOf(a).getTime() - dateOf(b).getTime())[0]
  metDays = { ...metDays, [c.id]: earliest ?? today }
  await $.store.set(MET_KEY, metDays)
}
const years = (n: number) => `${n} ${n === 1 ? 'year' : 'years'}`

// Special days you've turned off, by id ('birthday' for the characters'),
// shared by every session
const EVENTS_OFF = 'eventsOff'
let eventsOff: string[] = []
const readEventsOff = async ($: Pick<EngineInterface, 'store'>) => {
  const v = await $.store.get(EVENTS_OFF)
  eventsOff = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

// A special day played on demand with /frens preview, to see how it looks and
// sounds. It stands in for today's until /frens preview off, and counts for
// nothing: no bond points, no memories
type Preview = { special: NonNullable<World['special']>; years: number; lastSpecial: string }
let preview: Preview | undefined

// A season or what's in the air, played on demand with /frens preview: all the
// time, over today's weather, until /frens preview off
/** `label`: what you asked for, as you'd say it ("golden leaf") */
type AirPreview = { season?: World['season']; air?: Air; rare?: boolean; label: string }
let airPreview: AirPreview | undefined
const SEASON_NAMES: readonly World['season'][] = ['spring', 'summer', 'autumn', 'winter']
const AIR_NAMES: Record<string, Air> = {
  leaves: 'leaves',
  leaf: 'leaves',
  petals: 'petals',
  petal: 'petals',
  snow: 'snowflakes',
  snowflakes: 'snowflakes',
  fireflies: 'fireflies',
  firefly: 'fireflies',
  sparkles: 'sparkles',
  stars: 'sparkles',
}
// The rare ones, to preview: there at once, every time
const RARE_PREVIEWS: Record<string, Air> = {
  'golden-leaf': 'leaves',
  goldleaf: 'leaves',
  blossom: 'petals',
  'cherry-blossom': 'petals',
  crystal: 'snowflakes',
  'snow-crystal': 'snowflakes',
  'shooting-star': 'sparkles',
  star: 'sparkles',
}

// What they say on a special day
function specialLine(id: string, together: number): string {
  if (id === 'birthday') return say('birthday')
  if (id === 'anniversary') return say('anniversary', { years: years(together) })
  return current.voice.events?.[id] ?? SPECIAL_DAYS.find(d => d.id === id)?.line ?? ''
}

// A special day's scenes, played one after another with the ✦ celebrate
// button: a prop, a line, the day in the air. Each lasts half a minute, or
// until they get busy
const SCENE_FOR = (30 * 1000) / TICK_MS
const playing = atom({ plugin: 'maiyu', key: 'scene' } as const, null as { day: string; index: number; at: number } | null)
const sceneTurns = new Map<string, number>()

// Pressed, it's you there; on their own, it isn't
async function celebrate($: StateDollar, byYou = true) {
  const w = await worldOf($)
  const scenes = w.special ? SCENES[w.special.id] : undefined
  if (w.special === undefined || scenes === undefined || scenes.length === 0) return
  const turn = sceneTurns.get(w.special.id) ?? 0
  sceneTurns.set(w.special.id, turn + 1)
  const index = turn % scenes.length
  const line = current.voice.scenes?.[w.special.id]?.[index] ?? scenes[index]!.line
  const b = await change($, x => ({ ...feel('happy', line)(x), active: byYou ? x.frame : x.active }))
  await update($, playing, () => ({ day: w.special!.id, index, at: b.frame }))
}

// On a special day they play the next scene by themselves, about once an
// hour: only when they're free and you're around, and an hour after the last
// one, pressed or not. The first comes a minute after the day's hello
const SCENE_EVERY = (60 * 60 * 1000) / TICK_MS
async function maybeScene($: StateDollar, w: World) {
  if (w.special === undefined || SCENES[w.special.id] === undefined) return
  const b = await look$($)
  const isFree = b.mood === 'idle' || b.mood === 'watching'
  if (!isFree || !hasTyped(b) || b.frame - b.active > AROUND) return
  const last = await read($, playing)
  if (last !== null && last.day === w.special.id && b.frame - last.at < SCENE_EVERY) return
  await celebrate($, false)
}

// The scene playing now, if any: for today's special day, while they're free
async function sceneNow($: StateDollar, b: Buddy, w: World): Promise<Scene | undefined> {
  const p = await read($, playing)
  if (p === null || p.day !== w.special?.id || b.frame - p.at >= SCENE_FOR) return undefined
  if (!['idle', 'happy', 'watching', 'celebrate'].includes(b.mood)) return undefined
  return SCENES[p.day]?.[p.index]
}

// A special day: a preview first, then the character's birthday, then the calendar
function specialOf(at: Date, country: string | undefined): World['special'] {
  if (preview) return preview.special
  const b = current.birthday
  const isBirthday = at.getMonth() + 1 === b.month && at.getDate() === b.day
  if (isBirthday && !eventsOff.includes('birthday')) return { id: 'birthday', name: `${current.name}'s birthday` }
  const together = anniversaryOn(metDays[current.id], at)
  if (together && !eventsOff.includes('anniversary')) return { id: 'anniversary', name: `${years(together)} with ${current.name}` }
  const day = specialDayOn(at, country, eventsOff)
  return day ? { id: day.id, name: day.name } : undefined
}

// The first look at the world, which /frens weather waits for
let worldReady: Promise<void> = Promise.resolve()

// The moment: part of the day, season, weekday, from your clock
async function tickWorld($: Pick<EngineInterface, 'clock' | 'state'>) {
  const at = new Date(await $.clock.now())
  await update($, world, w => ({
    ...w,
    part: partOfDay(at.getHours()),
    season: seasonOf(at.getMonth(), w.latitude),
    day: dayKind(at.getDay()),
    special: specialOf(at, w.country),
  }))
}

// A hello for the part of the day, a word on a new season, or on the weather:
// one at a time, only when they're free and you're around
function rhythm(b: Buddy, w: World, today: string): Buddy {
  const isFree = b.mood === 'idle' || b.mood === 'sleepy' || b.mood === 'watching'
  // Not to an empty room: only once you've typed something, and recently
  if (!isFree || !hasTyped(b) || b.frame - b.active > AROUND || !hasPaused(b)) return b
  const lines = current.voice.world
  const pick = (list: readonly string[]) => list[b.frame % Math.max(1, list.length)] ?? ''
  if (w.special && b.lastSpecial !== `${today}:${w.special.id}`) {
    const id = w.special.id
    const met = preview?.years ?? anniversaryOn(metDays[current.id], new Date(today)) ?? 1
    const line = specialLine(id, met)
    // A preview you asked for celebrates; the day itself only speaks
    return { ...(preview ? feel('celebrate', line, w.special.name) : mention(line, w.special.name))(b), lastSpecial: `${today}:${id}` }
  }
  const greetKey = `${today}:${w.part}`
  if (b.lastGreet !== greetKey) {
    const isMorning = w.part === 'dawn' || w.part === 'morning'
    const usual = isMorning && w.day === 'friday' ? lines.friday : w.day === 'weekend' && isMorning ? lines.weekend : lines.greet[w.part]
    // Close friends get a warmer hello now and then
    const list = heartsNow >= 3 && b.frame % 3 === 0 ? current.bond.warm : usual
    return { ...mention(pick(list), `said good ${w.part === 'lateNight' ? 'night' : w.part}`)(b), lastGreet: greetKey }
  }
  if (b.lastSeason !== w.season && b.lastSeason !== '') {
    return { ...mention(lines.season[w.season], `${w.season} began`)(b), lastSeason: w.season }
  }
  // The first season they see is just noted, and doesn't take their turn
  if (b.lastSeason === '') b = { ...b, lastSeason: w.season }
  if (w.weather && b.lastSky !== w.weather.sky) {
    const vars: Record<string, string> = { temp: `${Math.round(w.weather.temperature)}°${w.weather.unit}`, where: where(w.weather) }
    const line = pick(lines.sky[w.weather.sky]).replace(/\{(temp|where)\}/g, (_all, name: string) => vars[name] ?? '')
    return { ...mention(line, `${w.weather.sky} outside`)(b), lastSky: w.weather.sky }
  }
  return b
}

// The day as a loop: a letter the first time you're around each morning, and
// a wrap-up once the evening winds down
const LETTER_KEY = 'lastLetter'
const LETTER_FOR = (15 * 60 * 1000) / TICK_MS
const WIND_DOWN = (15 * 60 * 1000) / TICK_MS
const letter = atom({ plugin: 'maiyu', key: 'letter' } as const, null as Letter | null)
let letterChecked = ''

// The letter: a hello, a few words about something real from last time, what's
// coming up, and their name. Once a day, in whichever session you show up in
// first, after a night's break: working on past midnight doesn't bring it
const LAST_ACTIVE_KEY = 'lastActive'
let lastActiveAt: number | undefined

async function maybeLetter($: Kit & Pick<EngineInterface, 'model'>) {
  const now = await $.clock.now()
  const today = dayOf(now)
  // How long you'd been away, across sessions, before just now
  let before = lastActiveAt ?? Number((await $.store.get(LAST_ACTIVE_KEY)) ?? 0)
  if (now - before >= 30 * 60 * 1000) before = Math.max(before, Number((await $.store.get(LAST_ACTIVE_KEY)) ?? 0))
  // Checked when you first show up, and then at most once a minute
  if (lastActiveAt !== undefined && now - lastActiveAt < 60_000) return
  lastActiveAt = now
  await $.store.set(LAST_ACTIVE_KEY, now)
  if (letterChecked === today) return
  if ((await $.store.get(LETTER_KEY)) === today) {
    letterChecked = today
    return
  }
  // Still up from yesterday: the letter waits for the morning, or a proper break
  const hadLetter = (await $.store.get(LETTER_KEY)) !== undefined
  if (hadLetter && !isAfterBreak(new Date(now).getHours(), now - before)) return
  letterChecked = today
  await $.store.set(LETTER_KEY, today)

  const all = await tallies($)
  const last = lastDayBefore(all, today)
  const when = last ? whenWas(last, today) : ''
  const w = await worldOf($)
  const holiday = comingUp(new Date(now), w.country, eventsOff)
  const ahead = eventsOff.includes('anniversary') ? undefined : nextAnniversary(metDays[current.id], new Date(now))
  const anniversary = ahead && ahead.inDays >= 1 && ahead.inDays <= 7 ? { name: 'our anniversary', inDays: ahead.inDays } : undefined
  const soon = anniversary && (!holiday || anniversary.inDays <= holiday.inDays) ? anniversary : holiday
  const wins = last ? (await memories($)).filter(m => m.day === last).map(m => m.what) : []
  const done = last ? (await highlights($)).filter(h => h.day === last) : []

  // Their words while a note of their own is written: a win by name if there
  // was one, else a word about the day, never a tally
  const win = wins[wins.length - 1]
  const about = !last ? say('letterFresh') : win ? say('letterWin', { when, win }) : say('letterRecap', { when })
  const extra = [...streakLine(codingDays(all), today), ...(soon ? [say('letterSoon', { event: soon.name, soon: soon.inDays === 1 ? 'tomorrow' : `in ${soon.inDays} days` })] : [])]
  const b = await look$($)
  // On the anniversary of the day you met, a longer letter about the year
  const together = eventsOff.includes('anniversary') ? undefined : anniversaryOn(metDays[current.id], new Date(now))
  if (together !== undefined) return yearLetter($, together, all, today, b.frame)
  const opened = { day: today, title: `✉ a letter from ${current.name}`, lines: [say('letter'), about, ...extra, say('letterSign')], at: b.frame }
  // The streak and what's coming up keep lines of their own: a note only takes the word about last time
  await update($, letter, () => opened)

  // With something real to talk about, they write it themselves
  if (headless || (done.length === 0 && wins.length === 0)) return
  const who = current
  const facts = {
    when,
    highlights: done,
    wins,
    today: w.weather ? `${w.weather.sky} ${w.part === 'lateNight' ? 'night' : w.part}` : undefined,
  }
  const reply = await $.model
    .complete({ model: 'haiku', system: letterSystem(who), prompt: letterBrief(facts), maxTokens: 160, effort: 'low' })
    .catch(() => undefined)
  const note = reply?.isAnswered ? tidyNote(reply.text) : ''
  if (!note || current.id !== who.id) return
  // Only if the same letter is still open
  await update($, letter, l => (l !== null && l.at === opened.at && l.day === today ? { ...l, lines: l.lines.map(x => (x === about ? note : x)) } : l))
}

// The year's letter: what you did together since the last anniversary, in
// their words if they can write it, or a few lines of their own if not
async function yearLetter($: Kit & Pick<EngineInterface, 'model'>, together: number, all: readonly Tally[], today: string, frame: number) {
  const who = current
  const inYear = (day: string) => daysBetween(day, today) >= 0 && daysBetween(day, today) <= 365
  const days = [...new Set(all.flatMap(t => t.with?.[who.id] ?? []))].filter(inYear)
  const facts = {
    years: years(together),
    days: days.length,
    streak: bestStreak(days),
    lateNights: new Set(all.flatMap(t => t.days.lateWork ?? []).filter(inYear)).size,
    wins: asYearWins(await $.store.get(`${YEAR_KEY}:${who.id}`))
      .filter(w => inYear(`${w.month}-1`))
      .map(w => w.what),
    hearts: heartsNow,
    story: storiesOn && (asTold(await $.store.get(STORIES_KEY))[who.id] ?? 0) > 0 ? who.story.name : undefined,
  }
  const body = say('yearLetter', { years: facts.years, days: facts.days })
  const opened = { day: today, title: `✉ ${facts.years} with ${who.name}`, lines: [say('letter'), body, say('letterSign')], at: frame }
  await update($, letter, () => opened)
  if (headless) return
  const reply = await $.model
    .complete({ model: 'haiku', system: yearSystem(who, facts.years), prompt: yearBrief(facts), maxTokens: 320, effort: 'low' })
    .catch(() => undefined)
  const note = reply?.isAnswered ? tidyNote(reply.text, 600) : ''
  if (!note || current.id !== who.id) return
  await update($, letter, l => (l !== null && l.at === opened.at && l.day === today ? { ...l, lines: l.lines.map(x => (x === body ? note : x)) } : l))
}

// A heart moment: at each new heart, once, when it's quiet and you're around.
// It opens like the letter, and waits for the letter to be put away first
const MOMENTS_KEY = 'moments'
async function maybeMoment($: Kit) {
  const b = await look$($)
  const isFree = b.mood === 'idle' || b.mood === 'sleepy' || b.mood === 'watching'
  if (!isFree || !hasTyped(b) || b.frame - b.active > AROUND) return
  const open = await read($, letter)
  if (open !== null && b.frame - open.at < LETTER_FOR) return
  const stored = await $.store.get(MOMENTS_KEY)
  const seen = Array.isArray(stored) ? stored.filter((x): x is string => typeof x === 'string') : []
  if (!hasPaused(b)) return
  const level = HEART_POINTS.map((_, i) => i + 1).find(h => h <= heartsNow && !seen.includes(`${current.id}:${h}`))
  if (level === undefined) return
  const moment = current.bond.moments[level - 1]
  if (moment === undefined) return
  await $.store.set(MOMENTS_KEY, [...seen, `${current.id}:${level}`])
  const today = dayOf(await $.clock.now())
  await update($, letter, () => ({ day: today, title: `♡ ${moment.title}`, lines: [...moment.lines, heartsBar(level)], at: b.frame }))
  await change($, mention(moment.title, `shared a moment ♡ ${level}`))
  keepMemory($, `we reached ${level} ${level === 1 ? 'heart' : 'hearts'}`)
  // Every heart gold: what they call you from now on, and something to wear
  if (level === HEART_POINTS.length) logEvent($, 'goldHearts')
}

// "4 days in a row together", counting today as you've just shown up; a new
// record when it beats the longest before
function streakLine(days: readonly string[], today: string): string[] {
  const withToday = [...days, today]
  const run = streak(withToday, today)
  if (run < 2) return []
  // A record beats every earlier run; matching it isn't one
  return [say(run >= 3 && run > bestStreak(days) ? 'streakRecord' : 'streak', { days: run })]
}

// Once a day, in a quiet afternoon or evening, they bring up a win from the
// last week or month (yesterday's is in the letter already)
async function maybeRecall($: Kit, w: World) {
  if (w.part !== 'afternoon' && w.part !== 'evening') return
  const today = dayOf(await $.clock.now())
  const b = await look$($)
  const isFree = b.mood === 'idle' || b.mood === 'sleepy' || b.mood === 'watching'
  if (!isFree || b.lastRecall === today || !hasTyped(b) || b.frame - b.active > AROUND || !hasPaused(b)) return
  const past = (await memories($)).filter(m => (agoOf(m.day, today)?.ago ?? 'yesterday') !== 'yesterday')
  const m = recall(past, today, b.frame)
  if (m === undefined) return
  await change($, x => ({ ...mention(say('remember', { when: m.when, memory: m.what }), 'remembered a good day')(x), lastRecall: today }))
}

// Their own life goes on alongside yours: now and then, when it's quiet and
// you're around, the next beat of their story. One a day at most, across every
// session and character, and each only once you've spent long enough together
const STORY_DAY_KEY = 'storyDay'
async function maybeStory($: Kit, w: World) {
  if (!storiesOn || w.part === 'lateNight' || w.special !== undefined) return
  const b = await look$($)
  const isFree = b.mood === 'idle' || b.mood === 'watching'
  if (!isFree || !hasTyped(b) || b.frame - b.active > AROUND || b.frame - b.lastChat < QUIET_FOR) return
  const open = await read($, letter)
  if (open !== null && b.frame - open.at < LETTER_FOR) return
  const today = dayOf(await $.clock.now())
  if ((await $.store.get(STORY_DAY_KEY)) === today) return
  const told = asTold(await $.store.get(STORIES_KEY))
  const days = (await read($, togetherAtom))[current.id]?.days ?? 0
  const beat = nextBeat(current.story, told[current.id] ?? 0, days)
  if (beat === undefined) return
  await $.store.set(STORY_DAY_KEY, today)
  await $.store.set(STORIES_KEY, { ...told, [current.id]: beat.index + 1 })
  onHeard(`${current.id}.story.${beat.index}`)
  await change($, x => ({ ...feel('happy', beat.line, current.story.name)(x), lastChat: x.frame }))
}

// Small talk: now and then, when you're around and they're not busy. A line
// that fits the moment, every other time; their own thoughts the rest
// The closer you are, the more they talk: minutes between small talk, by hearts
const CHAT_MINUTES = [12, 12, 10, 10, 8, 8, 8, 7, 7, 6, 6] as const
// The time of day sets the pace (chattier mornings, quieter nights), and
// closeness quickens it
const chatEvery = (part: World['part']) => {
  const closeness = (CHAT_MINUTES[heartsNow] ?? 12) / 12
  return Math.round((daytimeOn ? chatPace(part) : (12 * 60 * 1000) / TICK_MS) * closeness)
}
const QUIET_FOR = (2 * 60 * 1000) / TICK_MS
const RECENT = (30 * 60 * 1000) / TICK_MS
const LONG_SESSION = (2 * 60 * 60 * 1000) / TICK_MS
const chatTurns = new Map<string, number>()
let chats = 0

function chatPool(b: Buddy, w: World): keyof Character['voice']['chatter'] | undefined {
  if (b.frame - lastWinAt < RECENT) return 'afterWin'
  if (b.frame - lastLossAt < RECENT) return 'afterLoss'
  if (b.worked >= LONG_SESSION) return 'longSession'
  const sky = w.weather?.sky
  if (sky === 'rain' || sky === 'drizzle' || sky === 'storm') return 'rain'
  if (w.weather && isHot(w.weather.temperature, w.weather.unit)) return 'hot'
  if (w.weather && isCold(w.weather.temperature, w.weather.unit)) return 'cold'
  if (w.part === 'dawn' || w.part === 'morning') return 'morning'
  if (w.part === 'afternoon') return 'afternoon'
  if (w.part === 'evening') return 'evening'
  return 'night'
}

function chat(b: Buddy, w: World): Buddy {
  const isFree = b.mood === 'idle' || b.mood === 'watching'
  const isAround = hasTyped(b) && b.frame - b.active <= AROUND
  if (!isFree || !isAround || b.frame - b.lastChat < chatEvery(w.part) || b.frame - b.since < QUIET_FOR || !hasPaused(b)) return b
  chats += 1
  const fitting = chatPool(b, w)
  const pool = fitting !== undefined && chats % 2 === 1 ? fitting : 'idle'
  const turn = chatTurns.get(`${current.id}:${pool}`) ?? 0
  chatTurns.set(`${current.id}:${pool}`, turn + 1)
  // Nothing open in this pool yet (some only open as you get closer): they keep quiet
  const picked = pickOpen(current.voice.chatter[pool], standing(), turn)
  if (picked) onHeard(`${current.id}.chatter.${pool}.${picked.index}`)
  const line = picked?.text
  // A word, not a change of mood: they just say it
  return line ? { ...b, note: line, lastChat: b.frame } : b

}

// The settings tucked behind the ⋯ in the dock
const more = atom({ plugin: 'maiyu', key: 'more' } as const, false)
const toggleMore = ($: StateDollar) => update($, more, m => !m)

async function putLetterAway($: StateDollar) {
  await update($, letter, () => null)
}

// The evening wrap-up: once a day, after a day with something in it, when
// you've been quiet a while
async function maybeWrapUp($: Kit, w: World) {
  if (w.part !== 'evening' && w.part !== 'night' && w.part !== 'lateNight') return
  const today = dayOf(await $.clock.now())
  const b = await look$($)
  const isFree = b.mood === 'idle' || b.mood === 'sleepy'
  if (!isFree || b.lastWrap === today || !hasTyped(b) || b.frame - b.active < WIND_DOWN || !hasPaused(b)) return
  const summary = describeDay(countsOn(await tallies($), today))
  if (summary.length === 0) return
  await change($, x => ({ ...mention(say('wrapUp', { summary: summary.join(' · ') }), 'wrapped up the day')(x), lastWrap: today }))
}

// The character picker: open or not, and what's been typed
const CLOSED: Picker = { isOpen: false, query: '' }
const picker = atom({ plugin: 'maiyu', key: 'picker' } as const, CLOSED)
const pickerOf = async ($: StateDollar): Promise<Picker> => ({ ...CLOSED, ...(await read($, picker)) })

// The journal as it stands: drawn as a page in the pane, or in words for /frens journal
async function journalFacts($: Kit): Promise<JournalFacts> {
  const bonds = await read($, togetherAtom)
  const stored = await $.store.get(MOMENTS_KEY)
  const specials = [{ id: 'birthday', name: 'a birthday' }, { id: 'anniversary', name: 'an anniversary' }, ...SPECIAL_DAYS.map(d => ({ id: d.id, name: d.name }))]
  return {
    journal: asJournal(await $.store.get(JOURNAL_KEY)),
    specials,
    characters: CHARACTERS,
    moments: Array.isArray(stored) ? stored.filter((x): x is string => typeof x === 'string') : [],
    told: asTold(await $.store.get(STORIES_KEY)),
    days: Object.fromEntries(Object.entries(bonds).map(([id, x]) => [id, x.days])),
    season: seasonKey(dayOf(await $.clock.now()), (await read($, world)).season),
  }
}
const journalNowText = async ($: Kit) => journalText(await journalFacts($))

// Every word /frens answers to, for guessing what a typo meant
const COMMAND_WORDS = [
  'help', 'notify', 'characters', 'character', 'quiet', 'chatty', 'close', 'hide', 'off', 'achievements', 'wardrobe', 'wear',
  'events', 'memories', 'hi', 'hello', 'poke', 'bond', 'hearts', 'stories', 'journal', 'daytime', 'seasons',
  'weather', 'diffs', 'sessions', 'share', 'score', 'open',
  ...(DEV ? ['preview'] : []),
]

// The known word a typo is nearest to, if it's near enough: a letter or two
// off, swapped or missing
export function closest(word: string, known: readonly string[]): string | undefined {
  const distance = (a: string, b: string) => {
    const row = Array.from({ length: b.length + 1 }, (_, j) => j)
    for (let i = 1; i <= a.length; i++) {
      let last = row[0]!
      row[0] = i
      for (let j = 1; j <= b.length; j++) {
        const next = Math.min(row[j]! + 1, row[j - 1]! + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1))
        last = row[j]!
        row[j] = next
      }
    }
    return row[b.length]!
  }
  const best = known.map(k => ({ k, d: distance(word, k) })).sort((x, y) => x.d - y.d)[0]
  return best !== undefined && best.d <= Math.max(1, Math.floor(word.length / 3)) ? best.k : undefined
}

// What the pane's buttons and the /frens commands do, shared between them

// Opens the picker and gives the pane the keyboard, so you can type at once
async function openPicker($: Pick<EngineInterface, 'state' | 'ui'>, mode: Picker['mode'] = 'characters') {
  await update($, picker, () => ({ isOpen: true, query: '', mode, page: mode === 'journal' ? undefined : 0 }))
  if (isShown) await $.ui.open({ id: PANE, title: current.name, focus: true })
}

async function closePicker($: StateDollar) {
  await update($, picker, () => CLOSED)
}

async function searchFor($: StateDollar, query: string) {
  await update($, picker, p => ({ ...p, isOpen: true, query }))
}

async function choose($: Pick<EngineInterface, 'store' | 'state' | 'ui' | 'clock'>, c: Character) {
  const isWelcome = (await pickerOf($)).mode === 'welcome'
  await closePicker($)
  if (isWelcome) await meet($, c)
  else if (c.id !== current.id) await switchTo($, c)
}

// The first time ever: pick who you'd like, or keep the first. Not a switch,
// so it never counts toward Fickle, and it's saved so it's asked only once
async function meet($: Pick<EngineInterface, 'store' | 'state' | 'ui'>, c: Character) {
  await $.store.set(CHARACTER_KEY, c.id)
  await become($, c)
  await change($, feel('happy', say('switched'), `met ${c.name}`))
  if (isShown) await $.ui.open({ id: PANE, title: c.name })
}

// What each of them sounds like on a good day, for picking: their first word on a fixed check
const sampleOf = (c: Character) => voiceOf(c)('greenAgain', { check: 'the tests' })


async function closePane($: Pick<EngineInterface, 'ui'>) {
  await $.ui.close({ id: PANE })
  isShown = false
  isDismissed = true
  showStatus($, undefined)
}

// Their line under the prompt: how things are going, in their voice
const STATUS_OF: Record<Mood, StatusKey> = {
  idle: 'calm',
  watching: 'watching',
  thinking: 'working',
  reading: 'working',
  editing: 'working',
  running: 'working',
  happy: 'win',
  celebrate: 'win',
  comfort: 'loss',
  worried: 'loss',
  break: 'rest',
  snack: 'rest',
  water: 'rest',
  coffee: 'rest',
  miss: 'away',
  sleepy: 'sleep',
}
let lastStatus: string | undefined
// The weather the status line shows, kept in step with the world
let lastWeather: World['weather']

// Sets the status line when it changes; closed with /frens off, there is none
function showStatus($: Pick<EngineInterface, 'ui'>, b: Buddy | undefined) {
  const sky = lastWeather ? ` · ${glyph(lastWeather)} ${Math.round(lastWeather.temperature)}°` : ''
  const text = b === undefined || isDismissed ? undefined : `${current.voice.status[STATUS_OF[b.mood]]}${sky}`
  if (text === lastStatus) return
  lastStatus = text
  $.ui.status(text)
}

// Who you switched away from today, shared by every session
const LEFT_KEY = 'leftToday'

// Switching characters. Coming back to someone you left earlier today gets a
// reaction of their own; nothing changes in your bond either way
async function switchTo($: Pick<EngineInterface, 'store' | 'state' | 'ui' | 'clock'>, c: Character): Promise<string> {
  // Keeping track of who you left never gets in the way of switching
  let isBack = false
  try {
    const today = dayOf(await $.clock.now())
    const kept = (await $.store.get(LEFT_KEY)) as { day?: string; ids?: string[] } | undefined
    const left = kept?.day === today && Array.isArray(kept.ids) ? kept.ids : []
    isBack = left.includes(c.id) && c.id !== current.id
    const leaving = c.id === current.id ? left : [...left.filter(id => id !== c.id), current.id]
    await $.store.set(LEFT_KEY, { day: today, ids: [...new Set(leaving)] })
  } catch {
    isBack = false
  }
  await $.store.set(CHARACTER_KEY, c.id)
  if (c.id !== current.id) logEvent($, 'switched')
  await become($, c)
  const b = await look$($)
  const line = isBack ? (pickOpen(c.voice.lines.returned, standing(), b.frame)?.text ?? say('switched')) : say('switched')

  await change($, feel('happy', line, isBack ? `${c.name} noticed you came back` : `became ${c.name}`))
  if (isShown) await $.ui.open({ id: PANE, title: c.name })
  return line
}

// Everything a usage report would hold, put together from every session
async function usageReport($: Kit) {
  await flushUsage($)
  const all = await tallies($)
  const usages = []
  for (const key of await $.store.keys()) if (key.startsWith(USAGE_PREFIX)) usages.push(asUsage(await $.store.get(key)))
  const hearts = Object.fromEntries(CHARACTERS.map(c => [c.id, heartsFor(pointsWith(all, c.id))]))
  return report(current.id, all, usages, hearts, unlockedNow)
}

// Turning sharing off forgets every line counted, in every session
async function setShare($: Kit, turnOn: boolean) {
  shares = turnOn
  pending = []
  await $.store.set(SHARE_KEY, turnOn)

  if (!turnOn) for (const key of await $.store.keys()) if (key.startsWith(USAGE_PREFIX)) await $.store.delete(key)
}

// Once a day, if you said yes and there's somewhere to send it
async function maybeSendUsage($: Kit & Pick<EngineInterface, 'http'>) {
  if (!shares || USAGE_URL === '') return
  const today = dayOf(await $.clock.now())
  if ((await $.store.get(SENT_KEY)) === today) return
  await $.store.set(SENT_KEY, today)
  await $.http.fetch(USAGE_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(await usageReport($)) })
}

// Once per session, unless sharing is off: the first ever is the install
async function sendPing($: Pick<EngineInterface, 'store' | 'http'>) {
  if (!shares) return
  const known = await $.store.get(INSTALL_KEY)
  const install = isInstallId(known) ? known : newInstallId()
  if (install !== known) await $.store.set(INSTALL_KEY, install)
  const kind = install !== known ? 'install' : headless ? 'headless' : 'session'
  const reply = await $.http.fetch(PING_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(ping(install, surface, kind)) })
  const release = reply.ok ? asRelease(reply.text) : undefined
  if (release) await $.store.set(RELEASE_KEY, release)
}

async function setNotify($: Pick<EngineInterface, 'store'>, turnOn: boolean) {
  notifies = turnOn
  await $.store.set(NOTIFY_KEY, turnOn)
}

async function toggleDiffs($: StateDollar): Promise<boolean> {
  const s = await rescore($, s => ({ ...s, hidesDiffs: !s.hidesDiffs }))
  return s.hidesDiffs
}

// Desktop notifications: on unless you turn them off, for every session
const NOTIFY_KEY = 'notify'
let notifies = true

// A notification from the operating system. The text travels as arguments,
// never spliced into a script, so nothing in it can run
async function desktop($: Pick<EngineInterface, 'process'>, title: string, text: string) {
  try {
    const mac = await $.process.run(
      ['osascript', '-e', 'on run argv', '-e', 'display notification (item 2 of argv) with title (item 1 of argv)', '-e', 'end run', title, text],
      { timeoutMs: 5000 },
    )
    if (mac.exitCode === 0) return
  } catch {
    // Not a Mac: try Linux's notifier below
  }
  await $.process.run(['notify-send', title, text], { timeoutMs: 5000 }).catch(() => undefined)
}

const HELP = [
  '/frens                      open the pane',
  '/frens close, /frens off    close it; prompts leave it closed until /frens',
  '/frens characters           pick a character: search in the pane, or see the list',
  '/frens character <name>     switch to one directly',
  '/frens notify [on|off]      desktop notifications (toggles with no word)',
  '/frens quiet, /frens chatty the end-of-turn comment off or on',
  '/frens achievements         your achievements and how close you are',
  '/frens wardrobe             what you have unlocked; /frens wear <item> or none',
  '/frens weather [city|auto|off]  where the weather is from: a city, a guess from your IP, or none',
  '/frens bond                 your hearts with each character, and what counts today',
  '/frens hi                   say hi',
  '/frens poke                 a poke on the cheek (or click them: a pat on the head, a poke, a stroke)',
  '/frens memories             your streak, and the big wins they remember',
  '/frens journal              what you have found together: special days, weather, work, catches, moments, stories (❦ in the pane)',
  '/frens stories [on|off]      their own life, told a little at a time',
  '/frens events [on|off <name>]   special days: see them all, or turn one (or all) on or off',
  ...(DEV ? ['/frens preview [<day>|off]   (dev) play a special day now to see it: birthday, anniversary [years], moment <1-10>, any holiday; or a season (spring…winter) or what drifts by (leaves, petals, snow, fireflies)'] : []),
  '/frens seasons [subtle|full|off]  how much of the season shows',
  '/frens daytime [on|off]      the time of day in how they talk and move',
  '/frens diffs                hide or show the changes in the pane',
  '/frens share [on|off]       usage sharing: on unless you turn it off; shows exactly what it holds',
  ...(DEV ? ['/frens play <mood|time> [who]  (dev) loop one animation or time of day, for looking at it; /frens play off to stop'] : []),
  ...(DEV ? ['/frens heart [n|reset]       (dev) the next heart (or n more) with who you have now, for seeing its moment; reset takes them back'] : []),
  '/frens sessions             your other sessions',
  '/frens score                wins and losses this session',
  '/frens help                 this list',
].join('\n')

// How a reaction shows on their face
const MOOD_OF: Record<Reaction['tone'], Mood> = { win: 'celebrate', loss: 'comfort', good: 'happy' }

// A check that failed more than this many runs in a row, then passed, is a comeback
const COMEBACK = 5
let calledBack = ''

// A check fails, and you've had a comeback before: once a day, they bring it up
async function callback($: Kit, kind: string, isPass: boolean, r: Reaction): Promise<Reaction> {
  if (isPass || !GREEN[kind]) return r
  // Remembering never gets in the way of the reaction itself
  try {
    const today = dayOf(await $.clock.now())
    if (calledBack === today) return r
    const m = lastComeback(await memories($), today)
    if (m === undefined) return r
    calledBack = today
    return { ...r, note: say('callback', { when: m.when, memory: m.what }) }
  } catch {
    return r
  }
}



// When the last win and loss were, for small talk about them
let lastWinAt = NEVER
let lastLossAt = NEVER

// Show a reaction, remember it, and count it for the turn and the session
async function show($: StateDollar, r: Reaction, turn: Turn) {
  const b = await change($, feel(MOOD_OF[r.tone], r.note, r.entry))
  if (r.tone === 'win') lastWinAt = b.frame
  if (r.tone === 'loss') lastLossAt = b.frame
  if (r.tone === 'win') turn.wins += 1
  if (r.tone === 'loss') turn.losses += 1
  if (r.tone !== 'good') {
    await rescore($, s => (r.tone === 'win' ? { ...s, wins: s.wins + 1 } : { ...s, losses: s.losses + 1 }))
  }
}

const EDITS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
const BUSY: Mood[] = ['thinking', 'reading', 'editing', 'running']

const baseName = (path: unknown) => (typeof path === 'string' ? path.split('/').pop() ?? path : '')
const clip = (text: string, size: number) => (text.length > size ? `${text.slice(0, Math.max(0, size - 1))}…` : text)

// A new mood, and a line in the diary when there is something to remember
const feel = (mood: Mood, note: string, entry?: string) => (b: Buddy): Buddy => ({
  ...b,
  mood,
  note,
  since: b.frame,
  diary: entry === undefined || entry === b.diary.at(-1) ? b.diary : [...b.diary, entry].slice(-DIARY_SIZE),
  // A win, a loss, a hello back: the season stirs in the air for a moment
  stirred: mood === 'happy' || mood === 'celebrate' || mood === 'comfort' ? b.frame : b.stirred,
})

// Words the clock brings wait a couple of minutes after the last, so one never
// talks over another
const hasPaused = (b: Buddy) => b.frame - (b.stirred ?? NEVER) >= (2 * 60 * 1000) / TICK_MS

// Words, not a reaction: for what the clock or another session brings, so

// they only move when you or Claude do something. The air still stirs a little
const mention = (note: string, entry?: string) => (b: Buddy): Buddy => ({
  ...b,
  note,
  diary: entry === undefined || entry === b.diary.at(-1) ? b.diary : [...b.diary, entry].slice(-DIARY_SIZE),
  stirred: b.frame,
})

// Which way the eyes point: where you type, or a scan while Claude reads
function gaze(b: Buddy): -1 | 0 | 1 {
  if (b.mood === 'watching') return b.look
  if (b.mood === 'reading') return ([-1, 0, 1, 0] as const)[Math.floor(b.frame / 2) % 4]!
  if (b.mood === 'idle') return ([0, 0, 0, -1, 0, 0, 0, 1] as const)[Math.floor(b.frame / 6) % 8]!
  return 0
}

// The ahoge, the strand of hair on top, bounces faster the busier they are
function ahoge(b: Buddy): 0 | 1 {
  const pace = b.mood === 'idle' || b.mood === 'sleepy' ? 4 : 1
  return Math.floor(b.frame / pace) % 2 === 0 ? 0 : 1
}

// The pixel-art pose for a mood on a frame, with the character's own touches:
// their way of moving through each event, in turn, over the usual
export function pose(b: Buddy, c: Character = DEFAULT): Pose {
  const usual = expression(b)
  const style = c.moods?.[b.mood]
  if (style === undefined) return usual
  const { frames, every, confetti, hop, tear, sweat, ...still } = style
  const age = b.frame - b.since
  const moment = frames && frames.length > 0 ? frames[Math.floor(age / Math.max(1, every ?? 4)) % frames.length] : undefined
  // Left out for the mood as a whole, then each frame's own moment on top: a hop on a fist pump
  return {
    ...usual,
    ...still,
    ...(confetti === false ? { confetti: 0 } : {}),
    ...(hop === false ? { hop: 0 } : {}),
    ...(tear === false ? { tear: false } : {}),
    ...(sweat === false ? { sweat: false } : {}),
    ...moment,
  }

}


function expression(b: Buddy): Pose {
  const blink = b.frame % 24 === 0 || b.frame % 24 === 1
  const even = b.frame % 2 === 0
  const base: Pose = {
    eyes: blink ? 'blink' : 'open',
    look: gaze(b),
    mouth: 'smile',
    arms: 'down',
    blush: false,
    sweat: false,
    ahoge: ahoge(b),
    tear: false,
    confetti: 0,
    hop: 0,
    beat: 0,
  }
  const age = b.frame - b.since
  switch (b.mood) {
    case 'watching':
      return { ...base, mouth: 'open', blush: true }
    case 'thinking':
      return { ...base, eyes: 'lidded', mouth: b.frame % 6 < 3 ? 'flat' : 'small' }
    case 'reading':
      return { ...base, mouth: 'small' }
    case 'editing':
      return { ...base, eyes: 'determined', mouth: 'small', arms: even ? 'typeA' : 'typeB' }
    case 'running':
      return { ...base, eyes: 'determined', mouth: 'open', arms: even ? 'typeA' : 'typeB' }
    case 'happy':
      // A wave: the hand leaning in, then out
      return { ...base, eyes: 'happy', mouth: 'grin', arms: b.frame % 4 < 2 ? 'wave' : 'waveB', blush: true }
    case 'worried':
      // Eyes wide under raised brows, a little "oh", hands to the cheeks
      return { ...base, eyes: 'soft', mouth: 'open', arms: 'cheeks', sweat: true }

    case 'sleepy':
      return { ...base, eyes: 'sleep', mouth: b.frame % 8 < 4 ? 'small' : 'flat' }
    case 'celebrate':
      return {
        ...base,
        eyes: 'happy',
        mouth: even ? 'grin' : 'open',
        arms: b.frame % 4 < 2 ? 'cheer' : 'cheerB',
        blush: true,
        confetti: age + 1,
        hop: even ? 1 : 0,
      }
    case 'comfort':
      return { ...base, eyes: 'soft', mouth: 'smile', arms: 'fist', tear: age < 8 }
    case 'miss':
      // A soft smile and a little wave, now and then
      return { ...base, eyes: base.eyes === 'blink' ? 'blink' : 'soft', arms: b.frame % 40 < 8 ? (b.frame % 4 < 2 ? 'wave' : 'waveB') : 'down', blush: true }

    case 'break':
      // Sipping tea, eyes closing contentedly with each sip
      return { ...base, eyes: b.frame % 16 < 6 ? 'happy' : 'lidded', arms: 'cup', beat: Math.floor(b.frame / 3) }
    case 'snack':
      return { ...base, eyes: 'happy', mouth: even ? 'open' : 'small', arms: 'snack', blush: true, beat: Math.floor(age / 8) }
    case 'water': {
      // A sip, then the glass lowered while they look at you and ask
      const beat = Math.floor(age / 6)
      const isSipping = beat % 4 < 2
      return { ...base, eyes: isSipping ? 'happy' : base.eyes, mouth: isSipping ? 'small' : 'open', arms: 'water', blush: isSipping, beat }
    }
    case 'coffee': {
      // Blowing on it, a sip with eyes closed, then a happy sigh
      const step = coffeeStep(age)
      if (step === 'blow') return { ...base, eyes: 'lidded', mouth: 'small', arms: 'coffee', beat: age }
      if (step === 'sip') return { ...base, eyes: 'happy', mouth: 'small', arms: 'coffee', blush: true, beat: age }
      if (step === 'sigh') return { ...base, eyes: 'happy', mouth: 'open', arms: 'coffee', blush: true, beat: age }
      return { ...base, eyes: base.eyes === 'blink' ? 'blink' : 'soft', arms: 'coffee', beat: age }
    }
    default:
      return base
  }
}

// The moment you're in, as the nameplate says it: "autumn night"
const PART_WORDS: Record<PartOfDay, string> = { dawn: 'dawn', morning: 'morning', afternoon: 'afternoon', evening: 'evening', night: 'night', lateNight: 'late night' }

// What each mood has in their hands, for a touch on it: the tea on a break,
// the morning coffee, the snack, the water
const HELD_LINES: Partial<Record<Mood, LineKey>> = { break: 'touchTea', coffee: 'touchCoffee', snack: 'touchSnack', water: 'touchWater' }

// Each pose is painted once per character and outfit; there are only a few dozen
const painted = new Map<string, string>()
// What they have on, in layers: the season's piece, then what the weather
// calls for, then a special day's, then what you chose from the wardrobe. Two
// in one slot, the later wins. Colors likewise: the weather's, then yours
function paint(
  p: Pose,
  c: Character,
  w: Wearing,
  pieces: readonly Accessory[],
  weatherColors?: Partial<Palette>,
  as: 'cells' | 'svg' = 'cells',
  columns = WIDTH,
  scale = 1,
): string {
  const chosen = itemById(w.accessory)
  const accessories = layered([...pieces, ...(chosen?.kind === 'accessory' ? [chosen] : [])])
  const yours = itemById(w.palette)
  const id = `${as}:${columns}:${scale}:${c.id}:${accessories.map(x => x.id).join('+')}:${JSON.stringify(weatherColors ?? {})}:${w.palette ?? ''}:${JSON.stringify(p)}`
  let out = painted.get(id)
  if (out === undefined) {
    const palette = { ...c.look.palette, ...weatherColors, ...(yours?.kind === 'palette' ? yours.palette : {}) }
    const rows = grow(shrink(sprite(p, { ...c.look, palette }, accessories), columns), scale)
    out = as === 'svg' ? svgOf(rows, paletteOf(palette, accessories)) : cells(rows, paletteOf(palette, accessories))
    // Falling leaves make many more frames: keep the cache from growing for ever
    if (painted.size > 600) painted.clear()
    painted.set(id, out)
  }
  return out
}

// The portrait you can touch: the pixels, what each belongs to, and the colors used
const touchable = new Map<string, PortraitProps>()
function paintParts(p: Pose, c: Character, w: Wearing, pieces: readonly Accessory[], weatherColors: Partial<Palette> | undefined, stage: number, scale = 1): PortraitProps {
  const chosen = itemById(w.accessory)
  const accessories = layered([...pieces, ...(chosen?.kind === 'accessory' ? [chosen] : [])])
  wornNow = accessories
  const yours = itemById(w.palette)
  const id = `${stage}:${scale}:${c.id}:${accessories.map(x => x.id).join('+')}:${JSON.stringify(weatherColors ?? {})}:${w.palette ?? ''}:${JSON.stringify(p)}`
  let out = touchable.get(id)
  if (out === undefined) {
    const palette = { ...c.look.palette, ...weatherColors, ...(yours?.kind === 'palette' ? yours.palette : {}) }
    const drawn = spriteWithParts(p, { ...c.look, palette }, accessories, stage)
    const { names } = drawn
    const rows = grow(drawn.rows, scale)
    const parts = grow(drawn.parts, scale)
    const all = paletteOf(palette, accessories)
    const used = [...new Set(rows.join(''))].filter(ch => all[ch] !== undefined)
    out = { rows, parts, names, colors: Object.fromEntries(used.map(ch => [ch, hex(all[ch]!)])) }
    if (touchable.size > 600) touchable.clear()
    touchable.set(id, out)
  }
  return out
}
// The journal's page: cream paper, brown ink, old gold for the rare, and
// their color deepened so it reads on paper
// A colour the terminal's pixel art draws exactly (each channel a multiple of
// 0x11), so the icons' see-through pixels match the page around them
const PAPER = '#ffeedd'
const INK = '#3d2f22'
const FADED = '#a08f76'
const GOLD_INK = '#b07d12'
function deepen(color: string, amount = 0.45): string {
  const from = parseInt(color.slice(1), 16)
  const to = parseInt(INK.slice(1), 16)
  const mix = (shift: number) => Math.round(((from >> shift) & 255) * (1 - amount) + ((to >> shift) & 255) * amount) << shift
  return `#${(mix(16) | mix(8) | mix(0)).toString(16).padStart(6, '0')}`
}

// The touchable portrait failed to load or draw: back to the Raster for this load
let portraitFailed = false

// A terminal that can't draw them: they're pixel art only, never text art, so
// they say where they can be seen instead: a toast as the session starts, and in the pane
export const NO_PICTURES = "maiyu is pixel art, and this terminal can't draw it: it has no colors (TERM, NO_COLOR). Open Claude Code in a terminal with color, the desktop app or VS Code to see your buddy."
// A terminal with no colors to draw them in: a dumb one, a bare console, or
// colors turned off. Read once a session
let colorful = true
const BARE = ['linux', 'vt100', 'vt220', 'ansi', 'cons25']

// The weather spinner words to use today
function weatherVerbs(w: World): WeatherVerb[] {
  if (w.weather === undefined) return []
  const sky = w.weather.sky === 'drizzle' ? 'rain' : w.weather.sky
  return [
    sky,
    ...(isHot(w.weather.temperature, w.weather.unit) ? (['hot'] as const) : []),
    ...(isCold(w.weather.temperature, w.weather.unit) ? (['cold'] as const) : []),
    ...(isWindy(w.weather) ? (['windy'] as const) : []),
  ]
}

// A color as the pane takes it: "#ff7eb6"
const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`

// Animated marks before what they say keep one width, so the words never shift
const steady = (mark: string) => (mark === '' ? '' : mark.padEnd(3))

const sparkle = (b: Buddy) => {
  const wake = wakingNow(b)
  if (wake) return wakeMark(wake.kind, b.frame - wake.at, b.frame)
  const touched = touchingNow(b)
  if (touched) return touchMark(touched.kind, b.frame - touched.at)
  if (b.mood === 'sleepy') return ['z', 'zZ', 'zZz', 'zZ'][Math.floor(b.frame / 3) % 4]!
  if (b.mood === 'thinking') return ['.', '..', '...'][Math.floor(b.frame / 2) % 3]!
  if (b.mood === 'happy' || b.mood === 'watching') return ['✧', '✦', '⋆', '✦'][b.frame % 4]!
  if (b.mood === 'celebrate') return ['✦ ✧', '✧ ⋆', '⋆ ✦'][b.frame % 3]!
  return ''
}

export const register: Register = on => {
  // What this turn has done, for their comment at its end
  let turn: Turn = { prompt: '', files: [], results: [], wins: 0, losses: 0 }
  // Counts turns, so a late comment never lands on a newer one
  let turns = 0
  // The project folder, so diffs show paths relative to it
  let root = ''
  // This session's record in the shared store, and what they last saw of the others
  let me: Peer | undefined
  let lastSeen = new Map<string, Peer['status']>()

  on('session.start', async ($, e, next) => {
    root = e.cwd ?? ''
    // A -p run or the SDK: no one at the prompt and nowhere to draw, so no
    // pane, no hints and no desktop notifications; the sharing carries on
    headless = !e.isInteractive || e.surface === null
    surface = e.surface
    // Where the environment can't be read, they assume colors
    const [term, noColor, colorTerm] = await Promise.all([$.env.get('TERM'), $.env.get('NO_COLOR'), $.env.get('COLORTERM')]).catch(() => [])
    colorful = !noColor && term !== 'dumb' && !(BARE.includes(term ?? '') && !colorTerm)
    if (!headless && e.surface === 'terminal' && !colorful) $.ui.toast(NO_PICTURES)
    await $.command.register({
      name: 'frens',
      description:
        'Open your coding buddy; /frens help lists everything: character, close/off, notify, sessions, quiet, diffs, score',
    })
    // Seats by itself on a wide terminal; your next prompt or /frens opens it at any width
    const title = current.name
    if (!headless) void $.ui.open({ id: PANE, title }).then(opened => {
      isShown = opened.isPlaced
      if (!isShown) $.ui.toast(say('hint'))
      // The saved character loaded while the pane was opening: retitle it
      else if (current.name !== title) void $.ui.open({ id: PANE, title: current.name })
    })

    // The world: the moment now and every minute, the weather now and every half hour
    worldReady = tickWorld($)
      .then(() => refreshWeather($))
      .catch(() => undefined)
    let minutes = 0
    $.clock.every(60_000, () => {
      minutes += 1
      void (async () => {
        await tickWorld($)
        if (minutes % 30 === 0) await refreshWeather($)
        const w = await worldOf($)
        const today = new Date(await $.clock.now()).toDateString()
        await change($, b => chat(rhythm(b, w, today), w))
        await maybeWrapUp($, w)
        await maybeMoment($)
        await maybeScene($, w)
        await maybeStory($, w)
        await maybeRecall($, w)
        // Written in the journal: a special day spent together, the weather worked through
        const b = await look$($)
        if (hasTyped(b) && b.frame - b.active <= AROUND) {
          if (w.special) await noteJournal($, 'specials', w.special.id)
          if (w.weather) await noteJournal($, 'skies', w.weather.sky)
        }
      })().catch(() => undefined)
    })

    // Once a minute they check the time, and grab a bite at mealtimes when free
    $.clock.every(60_000, () => {
      void $.clock.now().then(now => {
        const meal = mealtime(now)
        if (meal === undefined) return
        return change($, (b): Buddy =>
          b.mood === 'idle' || b.mood === 'sleepy'
            ? b.lastMeal === meal.key
              ? b
              : { ...feel('snack', say('meal', { meal: meal.name }), `had ${meal.name}`)(b), lastMeal: meal.key }
            : b,
        ).then(b => {
          if (b.mood === 'snack' && b.since === b.frame) logEvent($, 'meal')
        })
      })
    })

    // And in the morning, while things are quiet and you're around, a coffee.
    // Part of the time of day, so /frens daytime off leaves it out
    $.clock.every(60_000, () => {
      void $.clock.now().then(now => {
        const key = coffeeTime(now)
        if (key === undefined || !daytimeOn) return
        return change($, (b): Buddy => {
          if (b.mood !== 'idle' || b.lastCoffee === key || b.frame - b.active > AROUND) return b
          const lines = current.voice.lines.coffee
          const line = lines[Math.floor(now / 86_400_000) % lines.length] ?? ''
          return { ...feel('coffee', line, 'had a coffee')(b), lastCoffee: key }
        })
      })
    })

    // One tick moves the animation on and lets passing moods wear off
    $.clock.every(TICK_MS, () => {
      void tick().then(async b => {
        // Talking in their sleep, then they notice you
        const talked = waking?.then
        if (talked && waking && b.frame - waking.at >= TALK_FOR) {
          waking = { ...waking, then: undefined }
          if (b.note !== '' && b.mood !== 'thinking' && !BUSY.includes(b.mood)) b = await change($, x => ({ ...x, note: talked }))
        }
        showStatus($, b)
        if (b.mood === 'break' && b.since === b.frame) logEvent($, 'break')
        // Just said they miss you: you're away, so a notification is how it reaches you
        if (b.mood === 'miss' && b.since === b.frame && notifies && !headless) void desktop($, current.name, b.note)
      })
    })
    const tick = () =>
      change($, (b): Buddy => {
        const frame = b.frame + 1
        const age = frame - b.since
        const worked = BUSY.includes(b.mood) ? b.worked + 1 : b.worked
        const linger = LINGER[b.mood]
        if (linger !== undefined && age > linger) {
          const isRested = b.mood === 'break' || b.mood === 'snack' || b.mood === 'coffee'
          // What they said stays until they say something new; only your typing's echo goes
          const note = isRested ? say('back') : b.mood === 'watching' ? '' : b.note
          return { ...b, frame, worked, mood: 'idle', since: frame, note }
        }
        // Every so often, while you're around and things are quiet: a sip, and a gentle reminder
        const isFree = b.mood === 'idle' || b.mood === 'sleepy'
        // On hot days, sooner
        const thirsty = lastWeather && isHot(lastWeather.temperature, lastWeather.unit) ? (WATER_EVERY * 2) / 3 : WATER_EVERY
        if (isFree && frame - b.lastWater >= thirsty && frame - b.active <= AROUND) {
          const lines = current.voice.lines.water
          const line = lines[Math.floor(frame / 7) % lines.length] ?? ''
          return { ...feel('water', line, 'had some water')(b), frame, since: frame, worked, lastWater: frame }
        }
        // An hour without you: hello, I miss you. Once per absence, never the same line twice running
        // Away since you last typed, or since the session began if you haven't
        if (isFree && frame - Math.max(b.active, 0) >= MISS_AFTER && b.missedFor !== b.active) {
          const lines = current.voice.lines.missYou
          const index = nextLine(lines.length, b.missLine, frame)
          return {
            ...feel('miss', lines[index] ?? '', 'missed you')(b),
            frame,
            since: frame,
            worked,
            missedFor: b.active,
            missLine: index,
          }
        }
        // A long stretch of work, and now a quiet moment: time for tea
        if (b.mood === 'idle' && worked >= BREAK_AFTER) {
          return {
            ...feel('break', say('tea'), 'took a tea break')(b),
            frame,
            since: frame,
            worked: 0,
          }
        }
        // Dozing off only once you've been away a while too, never on someone who's here
        if (b.mood === 'idle' && age > DOZE && frame - b.active > AROUND) {
          return { ...b, frame, mood: 'sleepy', since: frame, note: say('sleep') }
        }
        return { ...b, frame, worked }
      })

    // Sharing with your other sessions, starting with the character you picked
    // last; a failure here leaves the rest alone
    try {
      // Who this session is comes first: its keys in the store are named after it
      const started = await $.clock.now()
      me = { id: await $.session.id(), project: projectOf(await $.session.root()), status: 'idle', since: started, seen: started, summary: '' }
      tallyKey = `${TALLY_PREFIX}${me.id}`
      memoryKey = `${MEMORY_PREFIX}${me.id}`
      highlightKey = `${HIGHLIGHT_PREFIX}${me.id}`
      usageKey = `${USAGE_PREFIX}${me.id}`
      shares = (await $.store.get(SHARE_KEY)) !== false
      // Sharing is on unless you turn it off: said once, plainly, the first time
      if (shares && !headless && (await $.store.get(SHARE_NOTICE_KEY)) === undefined) {
        await $.store.set(SHARE_NOTICE_KEY, true)
        $.ui.toast('maiyu shares which lines your buddy says, by id, to make them better: never your words, code or projects. /frens share shows it all; /frens share off stops it.')
      }
      void sendPing($).catch(() => undefined)
      const picked = byId(await $.store.get(CHARACTER_KEY))
      if (picked && picked.id !== current.id) {
        await become($, picked)
        if (isShown) await $.ui.open({ id: PANE, title: picked.name })
      }
      // Never picked anyone, and nothing done together yet: the first time ever
      if (picked === undefined && (await tallies($)).length === 0) {
        await update($, picker, (): Picker => ({ isOpen: true, query: '', mode: 'welcome' }))
      }
      notifies = (await $.store.get(NOTIFY_KEY)) !== false
      await readEventsOff($)
      await readSeasonShow($)
      await readDaytime($)
      await readStories($)
      journalNow = asJournal(await $.store.get(JOURNAL_KEY))
      await readMet($)
      // What you're wearing, and how far along you are
      const worn = (await $.store.get(WEARING_KEY)) as Wearing | undefined
      await update($, wearingAtom, () => ({ ...worn }))
      await checkAchievements($)
      await $.store.set(keyOf(me.id), me)

      let polls = 0
      $.clock.every(POLL_MS, () => {
        void (async () => {
          const at = await $.clock.now()
          polls += 1
          if (me && polls % (HEARTBEAT_MS / POLL_MS) === 0) {
            // After /clear the session carries on under a new id: move the record with it
            const id = await $.session.id()
            if (id !== me.id) await $.store.delete(keyOf(me.id))
            me = { ...me, id, seen: at }
            await $.store.set(keyOf(me.id), me)
          }
          // Notifications turned on or off, an outfit changed, or progress made in another session
          notifies = (await $.store.get(NOTIFY_KEY)) !== false
          shares = (await $.store.get(SHARE_KEY)) !== false
          await flushUsage($)
          if (polls % 60 === 0) await maybeSendUsage($).catch(() => undefined)
          await readEventsOff($)
          await readSeasonShow($)
          await readDaytime($)
          await readStories($)
          await readMet($)
          const worn = (await $.store.get(WEARING_KEY)) as Wearing | undefined
          if (JSON.stringify({ ...worn }) !== JSON.stringify(await wearingOf($))) await update($, wearingAtom, () => ({ ...worn }))
          if (polls % 6 === 0) await checkAchievements($, false)

          // Picked another character in another session: follow along
          const picked = byId(await $.store.get(CHARACTER_KEY))
          // Not while /frens play shows someone else
          if (picked && picked.id !== current.id && held === undefined) {
            await become($, picked)
            await change($, mention(say('switched'), `became ${picked.name}`))
            if (isShown) await $.ui.open({ id: PANE, title: picked.name })
          }
          const found: Peer[] = []
          for (const key of await $.store.keys()) {
            if (!key.startsWith(PREFIX) || key === keyOf(me?.id ?? '')) continue
            const peer = asPeer(await $.store.get(key))
            if (peer === undefined || at - peer.seen > FORGET_MS) await $.store.delete(key)
            else if (isAlive(peer, at)) found.push(peer)
          }
          const done = finished(lastSeen, found)
          lastSeen = new Map(found.map(p => [p.id, p.status]))
          await update($, peers, () => found)
          // Fresh for a few minutes, while it's still done
          await update($, justDone, fresh => ({
            ...Object.fromEntries(Object.entries(fresh).filter(([id, when]) => at - when < FRESH_FOR && found.some(p => p.id === id && p.status === 'done'))),
            ...Object.fromEntries(done.map(p => [p.id, at])),
          }))

          // Another session finished: they tell you, without interrupting their own work
          const label = names(found)
          // One that finished while they were busy, now that they're free
          const waiting = headsUps[0]
          if (waiting && done.length === 0) {
            const b = await look$($)
            if (b.mood === 'idle' || b.mood === 'watching') {
              headsUps = headsUps.slice(1)
              const name = label.get(waiting.id) ?? waiting.project
              await change($, feel('happy', say('peerDone', { project: name, summary: waiting.summary }).trim()))
            }
          }
          for (const peer of done) {
            const name = label.get(peer.id) ?? peer.project
            const entry = `${name} session finished`
            const b = await change($, (b): Buddy =>
              BUSY.includes(b.mood)
                ? { ...b, diary: [...b.diary, entry].slice(-DIARY_SIZE) }
                : mention(say('peerDone', { project: name, summary: peer.summary }).trim(), entry)(b),
            )
            if (BUSY.includes(b.mood)) headsUps = [...headsUps.filter(p => p.id !== peer.id), peer]
            $.ui.toast(say('peerToast', { project: name }))
            if (notifies && !headless) await desktop($, current.name, say('peerDone', { project: name, summary: peer.summary }).trim())
          }
        })().catch(() => undefined)
      })
    } catch {
      me = undefined
    }

    return next(e)
  })

  // This session closing: its record goes, so the others stop listing it.
  // A /clear ends one conversation but not the process, which shares on under its new id.
  // A touch on the portrait: which part, from its surface module
  on('ui.message', async ($, e, next) => {
    const data = e.data as { touch?: unknown; stroke?: unknown; look?: unknown } | undefined
    if (e.element === 'portrait' && typeof data?.touch === 'string') await touch($, data.touch, data.stroke === true)
    if (e.element === 'portrait' && (data?.look === null || data?.look === -1 || data?.look === 0 || data?.look === 1)) await pointerAt($, data.look)
    return next(e)
  })

  // The touchable portrait couldn't draw here: the Raster takes its place
  on('ui.fault', ($, e, next) => {
    if (e.element === 'portrait') portraitFailed = true
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (me) await $.store.delete(keyOf(me.id)).catch(() => undefined)
    if (e.reason !== 'clear') me = undefined

    return next(e)
  })

  on('command.run', { command: 'frens' }, async ($, e) => {
    const [word = '', ...rest] = e.args.trim().toLowerCase().split(/\s+/)
    if (word === 'help' || word === '?') {
      return { text: `${current.name}'s commands:\n${HELP}` }
    }
    if (word === 'notify' || word === 'notifications') {
      const turnOn = rest[0] === 'on' ? true : rest[0] === 'off' ? false : !notifies
      await setNotify($, turnOn)
      return { text: say(turnOn ? 'notifyOn' : 'notifyOff') }
    }
    if (word === 'characters' || (word === 'character' && rest.length === 0)) {
      // Opens the picker in the pane too, when it's showing
      if (isShown) await openPicker($)
      const list = CHARACTERS.map(c => {
        const pronouns = `${c.pronouns.they}/${c.pronouns.them}`
        return `  ${c.id === current.id ? '●' : '○'} ${c.id.padEnd(8)} ${c.name}, ${c.gender} (${pronouns}), birthday ${birthdayOf(c)}`
      })
      const how = isShown ? 'type in the pane to search, or /frens character <name>' : '/frens character <name> to switch'
      return { text: [`Characters (${how}):`, ...list].join('\n') }
    }
    if (word === 'character') {
      const picked = CHARACTERS.find(c => c.id === rest[0] || c.name.toLowerCase() === rest.join(' '))
      if (picked === undefined) {
        return { text: `No character called "${rest.join(' ')}". Try /frens characters.` }
      }
      return { text: await switchTo($, picked) }
    }
    if (word === 'quiet' || word === 'chatty') {
      await rescore($, s => ({ ...s, isQuiet: word === 'quiet' }))
      return { text: say(word === 'quiet' ? 'quiet' : 'chatty') }
    }
    if (word === 'close' || word === 'hide' || word === 'off') {
      await closePane($)
      return { text: say('closed') }
    }
    if (word === 'achievements' || word === 'trophies') {
      await recording
      const t = await trophiesOf($)
      const done = t.unlocked.length
      // Hidden ones show only once found
      const shown = ACHIEVEMENTS.filter(a => !a.hidden || t.unlocked.includes(a.id))
      const secret = ACHIEVEMENTS.length - shown.length
      const lines = [`Achievements, ${done} of ${ACHIEVEMENTS.length}:`, ...shown.map(a => `  ${progressLine(a.id, t)}`)]
      if (secret > 0) lines.push(`  ? ${secret === 1 ? 'one more, hidden' : `${secret} more, hidden`} until you find ${secret === 1 ? 'it' : 'them'}`)
      return { text: lines.join('\n') }

    }
    if (word === 'wear' || word === 'wardrobe') {
      await recording
      const t = await trophiesOf($)
      const owned = ITEMS.filter(i => ACHIEVEMENTS.some(a => a.unlocks === i.id && t.unlocked.includes(a.id)))
      const name = rest.join(' ')
      if (word === 'wardrobe' || name === '') {
        if (isShown) await openPicker($, 'wardrobe')
        const list = owned.length === 0 ? ['  nothing yet: /frens achievements shows how to earn things'] : owned.map(i => `  ${i.id.padEnd(14)} ${i.name}`)
        return { text: ['Wardrobe (/frens wear <item>, /frens wear none):', ...list].join('\n') }
      }
      if (name === 'none' || name === 'nothing') {
        await takeOff($, 'all')
        return { text: say('wearingNothing') }
      }
      const item = ITEMS.find(i => i.id === name || i.name.toLowerCase() === name)
      if (item === undefined) return { text: `No item called "${name}". Try /frens wardrobe.` }
      if (!owned.includes(item)) {
        const a = ACHIEVEMENTS.find(x => x.unlocks === item.id)
        return { text: `Not unlocked yet. ${a ? progressLine(a.id, t) : ''}`.trim() }
      }
      await putOn($, item)
      return { text: say('wearing', { item: item.name.toLowerCase() }) }
    }
    if (word === 'events' || word === 'event') {
      const [toggle, ...named] = rest
      const name = named.join(' ')
      if (toggle === 'on' || toggle === 'off') {
        const ids =
          name === 'all'
            ? ['birthday', 'anniversary', ...SPECIAL_DAYS.map(d => d.id)]
            : name === 'birthday' || name === 'birthdays'
              ? ['birthday']
              : name === 'anniversary' || name === 'anniversaries'
                ? ['anniversary']
              : [findDay(name)?.id].filter((x): x is string => x !== undefined)
        if (ids.length === 0) return { text: `No special day called "${name}". /frens events lists them.` }
        eventsOff = toggle === 'off' ? [...new Set([...eventsOff, ...ids])] : eventsOff.filter(id => !ids.includes(id))
        await $.store.set(EVENTS_OFF, eventsOff)
        // Today changes straight away
        await tickWorld($).catch(() => undefined)
        const what =
          name === 'all' ? 'All special days' : ids[0] === 'birthday' ? 'Birthdays' : ids[0] === 'anniversary' ? 'Anniversaries' : (findDay(name)?.name ?? name)
        return { text: `${what} ${toggle === 'off' ? 'turned off' : 'turned on'}.` }
      }
      const mark = (id: string) => (eventsOff.includes(id) ? '○ off' : '● on ')
      const list = [
        `  ${mark('birthday')}  Birthdays (${CHARACTERS.map(x => `${x.name} ${birthdayOf(x)}`).join(', ')})`,
        `  ${mark('anniversary')}  Anniversaries of the day you met`,
        ...SPECIAL_DAYS.map(d => `  ${mark(d.id)}  ${d.name}${d.countries ? ` (${d.countries.join(', ')})` : ''}`),
      ]
      return { text: ['Special days (/frens events off <name>, /frens events on <name>, or all):', ...list].join('\n') }
    }
    if (DEV && word === 'heart') {
      // Just enough points for the next heart, or the next n: the moment for
      // each comes when they're free and you've paused, as an earned one does
      const gifted = await giftedPoints($)
      if (rest[0] === 'reset') {
        await $.store.set(GIFT_KEY, { ...gifted, [current.id]: 0 })
        await checkAchievements($)
        return { text: `${current.name}: back to the hearts you've earned (${heartsNow}).` }
      }
      const more = Math.max(1, Math.min(HEART_POINTS.length, Math.floor(Number(rest[0] ?? 1)) || 1))
      let points = pointsWith(await tallies($), current.id) + (gifted[current.id] ?? 0)
      let given = gifted[current.id] ?? 0
      for (let i = 0; i < more; i++) {
        const gap = toNextHeart(points)
        if (gap === undefined) break
        points += gap
        given += gap
      }
      await $.store.set(GIFT_KEY, { ...gifted, [current.id]: given })
      await checkAchievements($)
      return { text: `${current.name}: ${heartsNow} ${heartsNow === 1 ? 'heart' : 'hearts'} now (dev). Its moment comes when they're free and you've paused; /frens heart reset takes them back.` }
    }
    if (DEV && (word === 'preview' || word === 'simulate')) {
      const [what = '', ...more] = rest
      if (what === '') {
        const list = [
          `  birthday               ${current.name}'s birthday (${birthdayOf(current)})`,
          '  anniversary [years]    the day you met, 1 year on or more',
          '  moment <1-10>          the little scene they share at each heart',
          '  spring, summer, autumn, winter   a season, all the time, whatever the weather',
          '  leaves, petals, snow, fireflies, sparkles   just that, drifting by',
          '  golden-leaf, blossom, crystal, shooting-star   a rare one, there at once',
          ...SPECIAL_DAYS.map(d => `  ${d.id.padEnd(22)} ${d.name}${d.countries ? ` (${d.countries.join(', ')})` : ''}`),
        ]
        const showing = preview?.special.name ?? airPreview?.label
        const now = showing ? `Previewing ${showing}; /frens preview off goes back to today.\n` : ''
        return { text: `${now}Special moments to preview (/frens preview <name>, /frens preview off):\n${list.join('\n')}` }
      }
      if (what === 'off' || what === 'stop' || what === 'end') {
        if (preview === undefined && airPreview === undefined) return { text: 'Nothing is being previewed.' }
        airPreview = undefined
        if (preview === undefined) {
          await change($, b => ({ ...b }))
          return { text: 'Preview over: back to today.' }
        }
        const restore = preview.lastSpecial
        preview = undefined
        await tickWorld($).catch(() => undefined)
        await change($, b => ({ ...feel('idle', '')(b), lastSpecial: restore }))
        return { text: 'Preview over: back to today.' }
      }
      if (!isShown) isShown = (await $.ui.open({ id: PANE, title: current.name })).isPlaced
      const season = SEASON_NAMES.find(s => s === what)
      const rareAir = RARE_PREVIEWS[what]
      const air = AIR_NAMES[what] ?? rareAir
      if (season !== undefined || air !== undefined) {
        const label = what.replace(/-/g, ' ')
        airPreview = season !== undefined ? { season, label } : { air, rare: rareAir !== undefined, label }
        await change($, b => ({ ...b }))
        const catchable = season === 'summer' ? ' (fireflies at night)' : ''
        return { text: `Previewing ${label}${catchable}, drifting by all the time. Click what drifts past to catch it.\n/frens preview off goes back to today.` }
      }
      if (what === 'moment' || what === 'heart' || what === 'hearts') {
        const level = Number(more[0] ?? 1)
        const moment = current.bond.moments[level - 1]
        if (!Number.isInteger(level) || moment === undefined) return { text: `${current.name} has moments for hearts 1 to ${current.bond.moments.length}.` }
        const b = await look$($)
        const today = dayOf(await $.clock.now())
        await update($, letter, () => ({ day: today, title: `♡ ${moment.title}`, lines: [...moment.lines, heartsBar(level)], at: b.frame }))
        await change($, feel('happy', moment.title))
        return { text: `Previewing ${current.name}'s heart ${level} moment: "${moment.title}".` }
      }
      const name = rest.join(' ')
      const together = what === 'anniversary' ? Math.max(1, Math.floor(Number(more[0] ?? 1)) || 1) : 1
      const day = what === 'birthday' || what === 'anniversary' ? undefined : findDay(name)
      const special =
        what === 'birthday'
          ? { id: 'birthday', name: `${current.name}'s birthday` }
          : what === 'anniversary'
            ? { id: 'anniversary', name: `${years(together)} with ${current.name}` }
            : day && { id: day.id, name: day.name }
      if (special === undefined) return { text: `No special moment called "${name}". /frens preview lists them.` }
      const before = await look$($)
      preview = { special, years: together, lastSpecial: preview?.lastSpecial ?? before.lastSpecial }
      await tickWorld($).catch(() => undefined)
      const today = new Date(await $.clock.now()).toDateString()
      await change($, b => ({ ...feel('celebrate', specialLine(special.id, together))(b), lastSpecial: `${today}:${special.id}` }))
      return { text: `Previewing ${special.name} with ${current.name}: "${specialLine(special.id, together)}"\n/frens preview off goes back to today. Nothing counts toward your bond.` }
    }
    if (word === 'memories' || word === 'memory') {
      await recording
      const today = dayOf(await $.clock.now())
      const days = codingDays(await tallies($))
      const all = (await memories($)).reverse()
      const group = (ago: 'yesterday' | 'week' | 'month', title: string) => {
        const these = all.filter(m => (m.day === today ? 'today' : agoOf(m.day, today)?.ago) === ago)
        return these.length === 0 ? [] : [title, ...these.slice(0, 6).map(m => `  · ${m.what}`)]
      }
      const todays = all.filter(m => m.day === today)
      const lines = [
        `Streak: ${dayCount(streak(days, today))} in a row · best ${dayCount(bestStreak(days))}`,
        ...(todays.length > 0 ? ['Today', ...todays.slice(0, 6).map(m => `  · ${m.what}`)] : []),
        ...group('yesterday', 'Yesterday'),
        ...group('week', 'This week'),
        ...group('month', 'This month'),
      ]
      return { text: lines.length > 1 ? lines.join('\n') : `${lines[0]}\nNo big wins remembered yet. They'll come ✧` }
    }
    if (word === 'hi' || word === 'hello') {
      await sayHi($)
      return { text: (await look$($)).note }
    }
    if (word === 'poke') {
      await touch($, 'cheek')
      return { text: (await look$($)).note }
    }
    if (word === 'bond' || word === 'hearts') {
      await recording
      await checkAchievements($)
      await readMet($)
      const bonds = await read($, togetherAtom)
      const list = CHARACTERS.map(x => {
        const bond = bonds[x.id] ?? { days: 0, points: 0, today: [] }
        const next = toNextHeart(bond.points)
        const left = next === undefined ? `every heart gold: your ${x.bond.title}` : `${next} to the next heart`
        const since = metDays[x.id] ? ` · since ${dateOf(metDays[x.id]!).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''
        return `  ${heartsBar(heartsFor(bond.points))} ${progressBar(bond.points)}  ${x.name.padEnd(8)} ${bond.points} points, ${bond.days} ${bond.days === 1 ? 'day' : 'days'} together${since} · ${left}`
      })
      // Today's checklist, for whoever's here
      const done = new Set(bonds[current.id]?.today ?? [])
      const tick = (reason: BondReason, label: string) => `${done.has(reason) ? '✓' : '○'} ${label}`
      const favorite = current.bond.favorites.map(f => f.name).join(' or ')
      const today = [
        tick('day', 'a day together'),
        tick('win', 'a win together'),
        tick('hi', 'say hi'),
        tick('favorite', `something ${current.name} loves (${favorite})`),
        ...(done.has('birthday') ? ['✓ their birthday'] : []),
        ...(done.has('reunion') ? ['✓ coming back'] : []),
      ]
      return {
        text: [
          `Your bond (hearts at ${HEART_POINTS.join(', ')} points; up to ${DAILY_CAP} a day):`,
          ...list,
          `Today with ${current.name}: ${today.join(' · ')}`,
        ].join('\n'),
      }
    }
    if (word === 'stories' || word === 'story') {
      const pick = rest[0]
      if (pick === 'on' || pick === 'off') {
        storiesOn = pick === 'on'
        await $.store.set(TELLING_KEY, pick)
      }
      const told = asTold(await $.store.get(STORIES_KEY))[current.id] ?? 0
      const so = told === 0 ? 'nothing yet' : `${told} of ${current.story.beats.length} told`
      const how = storiesOn
        ? `Stories: on. Now and then ${current.name} tells you how ${current.story.name} is going (${so}).`
        : 'Stories: off. They keep their own life to themselves.'
      return { text: `${how}\n/frens stories on or off to change it; /frens journal shows how far along each one is.` }
    }
    if (word === 'journal') {
      await recording
      await checkAchievements($)
      // In the pane too, when it's showing
      if (isShown) await openPicker($, 'journal')
      return { text: await journalNowText($) }
    }
    if (word === 'daytime' || word === 'time') {
      const pick = rest[0]
      if (pick === 'on' || pick === 'off') {
        daytimeOn = pick === 'on'
        await $.store.set(DAYTIME_KEY, pick)
      }
      const part = (await read($, world)).part
      const now = part === 'lateNight' ? 'late night' : part
      const how = daytimeOn
        ? `Time of day: on. It's ${now}, so they sound ${TONES[part]}. Bright in the morning, warm in the evening, hushed late at night; a stretch at dawn, a warm cup in the morning, fireflies in the evening, stars and sleepy eyes at night.`
        : 'Time of day: off. They speak and move the same all day.'
      return { text: `${how}\n/frens daytime on or off to change it.` }
    }
    if (word === 'seasons' || word === 'season') {
      const pick = rest[0]
      if (pick === 'subtle' || pick === 'full' || pick === 'off') {
        seasonShow = pick
        await $.store.set(SEASONS_KEY, pick)
      }
      const how = {
        subtle: 'Seasons: subtle. The season shows in what they wear, and when something happens a few petals or leaves drift by.',

        full: 'Seasons: full. Petals, sparkles, fireflies or leaves drift by all the time.',
        off: 'Seasons: off. No seasonal pieces or drifting. Special days and real weather still show.',
      }[seasonShow]
      return { text: `${how}\n/frens seasons subtle, full or off to change it.` }
    }
    if (word === 'weather') {
      // A city keeps the spelling you typed
      const what = e.args.trim().split(/\s+/).slice(1).join(' ')
      const lower = what.toLowerCase()
      // No word: what it is now. A word: a city, auto, or off
      await worldReady
      const setting: WeatherSetting =
        what === '' ? await weatherSetting($) : lower === 'off' ? { mode: 'off' } : lower === 'auto' ? { mode: 'auto' } : { mode: 'city', city: what }
      if (what !== '') {
        await $.store.set(WEATHER_SETTING, setting)
        await refreshWeather($, true).catch(() => undefined)
      }
      const w = await worldOf($)
      if (setting.mode === 'off') return { text: 'No weather: nothing is looked up. /frens weather turns it back on.' }
      if (w.weather === undefined) return { text: `Couldn't get the weather${setting.city ? ` for "${setting.city}"` : ''} just now. Your organization may block web requests; /frens weather off stops trying.` }
      const how = setting.mode === 'city' ? `for ${w.weather.place}` : 'guessed from your IP address, which can be off (/frens weather <city> to set it)'
      return { text: `Weather, ${how}: ${describeWorld(w.weather, w.part)}` }
    }
    if (word === 'diffs') {
      return { text: say((await toggleDiffs($)) ? 'diffsHidden' : 'diffsShown') }
    }
    if (word === 'sessions') {
      if (isShown) await openSessions($)
      const others = await peersOf($)
      const now = await $.clock.now()
      const label = names(others)
      return {
        text:
          others.length === 0
            ? say('alone')
            : ['Your other sessions:', ...others.map(p => `  ${line(p, label.get(p.id) ?? p.project, now)}`)].join('\n'),
      }
    }
    if (DEV && word === 'play') {
      const [what = '', who = ''] = rest
      if (what === 'off' || what === 'stop') {
        held = undefined
        heldPart = undefined
        // Back to whoever you picked, if play showed someone else
        const picked = byId(await $.store.get(CHARACTER_KEY)) ?? DEFAULT
        await become($, picked)
        if (isShown) await $.ui.open({ id: PANE, title: picked.name })

        await update($, buddy, (b): Buddy => ({ ...fresh(b), mood: 'idle', since: fresh(b).frame, note: '' }))
        return { text: 'Stopped playing. Back to normal.' }
      }
      // A time of day plays as idle, resting as they would then: "latenight" or "late-night" will do
      const part = PARTS.find(p => p.toLowerCase() === what.replace(/-/g, ''))
      const mood = part !== undefined ? 'idle' : MOODS.find(m => m === what)
      const usage = `/frens play <mood or time of day> [character], or /frens play off.\nMoods: ${MOODS.join(', ')}\nTimes of day: ${PARTS.join(', ')}\nCharacters: ${CHARACTERS.map(x => x.id).join(', ')}`
      if (mood === undefined) return { text: usage }
      // The start of a name will do: "ai" is Ai-chan
      const c = who === '' ? current : search(who)[0]
      if (c === undefined) return { text: `No character called "${who}".\n${usage}` }

      // Only for looking: no switch is saved or counted. Always set, since the
      // pane can still show someone else after the mod reloads
      await become($, c)
      held = mood
      heldPart = part
      const name = part ?? mood
      isDismissed = false
      isShown = (await $.ui.open({ id: PANE, title: c.name })).isPlaced
      await update($, buddy, (b): Buddy => ({ ...fresh(b), mood, since: fresh(b).frame, note: `playing ${name}` }))
      return { text: `Playing ${name} on ${c.name}, looping every ${(LOOP * TICK_MS) / 1000}s. /frens play off to stop.` }
    }
    if (word === 'share' || word === 'usage') {
      const pick = rest[0]
      if (pick === 'on' || pick === 'off') await setShare($, pick === 'on')
      else shares = (await $.store.get(SHARE_KEY)) !== false
      await recording
      const where = USAGE_URL === '' ? 'There is nowhere to send it yet, so nothing is sent.' : `It is sent once a day to ${USAGE_URL}.`
      if (!shares) {
        return {
          text: [
            'Usage sharing is off: nothing is counted or sent, not even the session ping.',
            '/frens share on turns it back on: it counts which lines your buddy says (by id, never the words), on top of what the mod already counts for achievements, and pings once per session with a random install id, the version and the surface.',
            'Never your code, prompts, files, projects, places or weather. /frens share shows the whole report.',
          ].join('\n'),
        }
      }
      const known = await $.store.get(INSTALL_KEY)
      const session = ping(isInstallId(known) ? known : '(made on the next session)', surface, headless ? 'headless' : 'session')
      return {
        text: [
          `Usage sharing is on. ${where} /frens share off stops it and forgets what was counted. The report, in full:`,
          JSON.stringify(await usageReport($), null, 2),
          `And once per session, to ${PING_URL}:`,
          JSON.stringify(session),
        ].join('\n'),
      }
    }
    if (word === 'score') {

      const s = await scoreOf($)
      return { text: `This session: ${s.wins} wins, ${s.losses} losses. ${say(s.wins >= s.losses ? 'scoreUp' : 'scoreDown')}` }
    }
    // A word it doesn't know is most likely a typo: say so, and guess which
    if (word !== '' && word !== 'open' && word !== 'show') {
      const guess = closest(word, COMMAND_WORDS)
      return { text: `No /frens ${word}.${guess ? ` Did you mean /frens ${[guess, ...rest].join(' ')}?` : ''} /frens help lists them all.` }
    }
    isDismissed = false
    isShown = (await $.ui.open({ id: PANE, title: current.name })).isPlaced

    return { text: say('opened') }
  })

  // While Claude works, the spinner speaks their language: one word per turn
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || isDismissed) return next(e)
    // Their words, the season's, the day's weather, and every one achievements unlocked
    const w = await worldOf($)
    const words = spinnerWords(current, seasonShow === 'off' ? undefined : w.season, weatherVerbs(w), (await trophiesOf($)).unlocked)
    if (words.length === 0) return next(e)
    return next({ ...e, props: { ...e.props, word: words[turns % words.length] ?? e.props.word } })
  })

  // Closed by you (their close mark, a key, or /frens close): they stay away until /frens
  on('ui.close', ($, e, next) => {
    if (e.id === PANE) {
      isShown = false
      if (e.origin.kind !== 'unload') isDismissed = true
    }

    return next(e)
  })

  // Whether what you're typing has already grown long, so the line changes once
  let typedLong = false

  // You type: they wake, look at where your cursor is, and read along
  on('prompt.edit', async ($, e, next) => {
    const box = await next(e)
    void maybeLetter($).catch(() => undefined)
    const fraction = box.text.length === 0 ? 0.5 : box.cursor / Math.max(box.text.length, 40)
    const look = fraction < 0.33 ? -1 : fraction > 0.66 ? 1 : 0
    const isLong = box.text.length >= 40
    const part = (await worldOf($)).part
    await change($, (b): Buddy => {
      // Back after they said they missed you: a welcome, then on with it
      if (b.missedFor === b.active) {
        const lines = current.voice.lines.welcomeBack
        const welcome = lines[b.frame % lines.length] ?? ''
        bondFor($, 'reunion')
        const welcomed = b.mood === 'sleepy' ? wakeUp(b, part, welcome) : feel('happy', welcome, 'you came back')(b)
        return { ...welcomed, look, active: b.frame }
      }
      // Asleep: you wake them, a little differently each time
      if (b.mood === 'sleepy') return { ...wakeUp(b, part), look, active: b.frame }
      // Still waking up: their eyes follow you, and they finish what they're saying
      if (wakingNow(b)) return { ...b, look, active: b.frame }
      if (BUSY.includes(b.mood)) return { ...b, active: b.frame }
      // One line while you type: picked when you start, changed only once, if
      // what you're writing grows long. Every keystroke moves just their eyes
      const isWatching = b.mood === 'watching' && b.note !== ''
      const grewLong = isLong && !typedLong
      const note =
        box.text.length === 0 ? '' : isWatching && !grewLong ? b.note : say(isLong ? 'typingLong' : 'typingShort')
      typedLong = box.text.length === 0 ? false : isLong
      return { ...b, mood: 'watching', since: b.frame, look, note, active: b.frame }
    })

    return box
  })

  on('prompt.submit', async ($, e, next) => {
    // Your prompt counts as asking, so their pane seats at any width
    if (!isShown && !isDismissed && !headless) isShown = (await $.ui.open({ id: PANE, title: current.name })).isPlaced
    turns += 1
    turn = { prompt: e.text, files: [], results: [], wins: 0, losses: 0 }
    logEvent($, 'prompt')
    enqueue(() => promptBond($))
    void maybeLetter($).catch(() => undefined)
    if (me) {
      const now = await $.clock.now()
      me = { ...me, id: await $.session.id(), status: 'working', since: now, seen: now }
      await $.store.set(keyOf(me.id), me)
    }
    await change($, b => ({ ...feel('thinking', say('thinking'), 'you asked for something')(b), active: b.frame }))

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const input = e as unknown as Record<string, unknown>
    const doing = describe(e.tool, input, say)
    await change($, feel(doing.activity, doing.note, doing.entry))

    const ran = await next(e)
    if (EDITS.has(e.tool) && ran.deny === undefined && ran.isError !== true) {
      const file = baseName(input.file_path ?? input.notebook_path)
      if (file && !turn.files.includes(file)) turn.files.push(file)
      logEvent($, 'fileChanged')
      const path = input.file_path ?? input.notebook_path
      if (typeof path === 'string') void noteJournal($, 'work', language(path)).catch(() => undefined)
      const edit = (ran.result ?? {}) as { filePath?: string; structuredPatch?: Patch[] }
      if (edit.filePath && edit.structuredPatch && edit.structuredPatch.length > 0) {
        const { filePath, structuredPatch } = edit
        await update($, changes, list => record(Array.isArray(list) ? list : [], filePath, structuredPatch))
      }
    }

    if (e.tool === 'Bash' && ran.deny === undefined) {
      const record = (ran.result ?? {}) as { stdout?: string; stderr?: string; gitOperation?: GitOperation }
      const output = `${record.stdout ?? ''}\n${record.stderr ?? ''}` || (ran.text ?? '')
      const kind = classify(String(input.command ?? ''))
      const git = cheer(record.gitOperation, say)
      if (kind !== undefined) {
        const verdict = judge(kind, ran.isError === true, output)
        const before = await scoreOf($)
        // Failed runs in a row, this one included
        const fails = verdict.isPass ? 0 : (before.checks[kind]?.streak ?? 0) + 1
        logEvent($, verdict.isPass ? (before.checks[kind]?.isPass === false ? 'checkFixed' : 'checkPassed') : 'checkFailed')
        if (verdict.isPass && before.checks[kind]?.isPass === false) {
          const tries = (before.checks[kind]?.streak ?? 1) + 1
          // A long fight won is a comeback, and remembered as one
          if (tries > COMEBACK) {
            logEvent($, 'comeback')
            keepMemory($, `${GREEN[kind] ?? 'a check went green again'}, after ${tries} tries`, 'comeback')
          } else keepMemory($, GREEN[kind] ?? 'a check went green again')
          bondFor($, 'win')
        }
        await show($, await callback($, kind, verdict.isPass, react(verdict, before, say)), turn)
        await rescore($, s => ({ ...s, checks: { ...s.checks, [kind]: { isPass: verdict.isPass, failed: verdict.failed, streak: fails } } }))

        turn.results.push(`${kind} ${verdict.isPass ? 'passed' : 'failed'}${verdict.failed ? ` (${verdict.failed} failing)` : ''}`)
        return ran
      }
      if (git !== undefined) {
        const op = record.gitOperation
        if (op?.commit) logEvent($, 'commit')
        if (op?.push) logEvent($, 'push')
        if (op?.pr && (op.pr.action === 'created' || op.pr.action === 'merged')) {
          logEvent($, 'pullRequest')
          keepMemory($, op.pr.action === 'merged' ? 'a pull request got merged' : 'a pull request went up')
          bondFor($, 'win')
        }
        await show($, git, turn)
        turn.results.push(git.entry)
        return ran
      }
    }

    if (ran.deny !== undefined || ran.isError === true) {
      await change($, feel('worried', say('toolFailed'), `${e.tool} failed`))
      turn.results.push(`${e.tool} failed`)
    }

    return ran
  })

  on('turn.complete', async ($, e, next) => {
    const done = turn
    const outcome = e.reason === 'answer' ? 'finished' : e.reason === 'aborted' ? 'was stopped' : 'hit an error'
    const mood: Mood =
      outcome !== 'finished' ? 'worried' : done.wins > 0 ? 'celebrate' : done.losses > 0 ? 'comfort' : 'happy'
    await change($, feel(mood, fallback(done, outcome, say), outcome === 'finished' ? 'Claude finished ✧' : `turn ${e.reason}`))
    const out = await next(e)
    if (e.reason === 'answer') logEvent($, 'turnDone')
    if (me) {
      const now = await $.clock.now()
      me = { ...me, status: 'done', since: now, seen: now, summary: fallback(done, outcome, say) }
      await $.store.set(keyOf(me.id), me)
    }

    // A short comment of their own, when the turn did something worth one
    const isWorthIt = done.files.length > 0 || done.results.length > 0
    if (isWorthIt && !(await scoreOf($)).isQuiet) {
      const asked = turns
      void $.model
        .complete({ model: 'haiku', system: systemFor(current, heartsNow), prompt: brief(done, outcome), maxTokens: 80, effort: 'low' })

        .then(async reply => {
          const line = reply.isAnswered ? tidy(reply.text) : ''
          if (!line) return
          // Something got done: the morning letter can bring it up
          if (outcome === 'finished' && done.losses <= done.wins && (done.wins > 0 || done.files.length > 0)) {
            enqueue(() => highlight($, done.prompt.slice(0, 200), line))
          }
          if (asked !== turns) return
          await change($, b => (b.mood === mood ? { ...b, note: line } : b))
          // The others hear their words too
          if (me) {
            me = { ...me, summary: line }
            await $.store.set(keyOf(me.id), me)
          }
        })
        .catch(() => undefined)
    }

    return out
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Button, Code, Text } = elements
    // A text field everywhere but the phone, which gets the list alone
    const Input = 'Input' in elements ? elements.Input : undefined
    const b = await look$($)
    const c = byId(await read($, who)) ?? DEFAULT
    const worn = await wearingOf($)
    const w = await worldOf($)
    const sky = w.weather?.sky
    const falling = sky === 'rain' || sky === 'drizzle' || sky === 'storm' ? 'rain' : sky === 'snow' ? 'snow' : undefined
    // A special day dresses up over the season: its own piece and its own air
    // A birthday brings a party hat and streamers; an anniversary, a heart clip and hearts
    const isAnniversary = w.special?.id === 'anniversary'
    const day = SPECIAL_DAYS.find(d => d.id === (isAnniversary ? 'valentines' : w.special?.id))
    const dayLook = w.special?.id === 'birthday' ? BIRTHDAY_HAT : day && wornBy(day, c.id)
    const dayAir = w.special?.id === 'birthday' ? 'streamers' : day?.air
    // The season, worn and in the air: its piece on them, and petals, sparkles,
    // fireflies or leaves around them when nothing's falling. Cold days bring rosy cheeks
    const isNight = w.part === 'evening' || w.part === 'night' || w.part === 'lateNight'
    const cold = w.weather !== undefined && isCold(w.weather.temperature, w.weather.unit)
    // The season in the air: all the time, off, or by default just now and then,
    // a few drifting in and out again
    const moment = seasonShow === 'full' ? undefined : seasonShow === 'off' ? 0 : seasonMoment(b.frame - (b.stirred ?? NEVER))
    const seasonAirNow: Pick<Pose, 'air' | 'airCount'> = moment === 0 ? {} : { air: seasonAir(w.season, isNight), airCount: moment }
    // Between the season's moments, the time of day's: fireflies in the evening, stars at night
    const daily = daytimeOn ? dayMoment(b.frame) : 0
    const seasonal: Pick<Pose, 'air' | 'airCount'> =
      seasonAirNow.air !== undefined || daily === 0 || timeAir(w.part) === undefined ? seasonAirNow : { air: timeAir(w.part), airCount: daily }
    // Hot: heat rising, a bead of sweat, and fanning themselves when nothing else is going on
    const hot = w.weather !== undefined && isHot(w.weather.temperature, w.weather.unit)
    // At rest, the time of day shows in how they hold themselves
    // Waking up shows over everything else for its few seconds
    const wake = wakingNow(b)
    const restPart = heldPart ?? (daytimeOn ? w.part : undefined)
    const usual = restPart !== undefined && b.mood === 'idle' ? atRest(pose(b, c), restPart, b.frame) : pose(b, c)
    const touched = touchingNow(b)
    const posed = wake
      ? { ...usual, ...wakePose(wake.kind, b.frame - wake.at) }
      : touched
        ? { ...usual, ...touchPose(touched.kind, b.frame - touched.at, b.frame) }
        : usual
    // Now and then, eyes on your pointer
    const eyesOn = !wake && !touched ? followingNow(b) : undefined
    if (eyesOn) posed.look = eyesOn.look
    const isResting = (b.mood === 'idle' || b.mood === 'watching') && !wake
    const scene: Pose = {
      ...posed,
      blush: posed.blush || cold,
      sweat: posed.sweat || hot,
      ...(hot && isResting ? { arms: b.frame % 4 < 2 ? 'fanA' : 'fanB' } : {}),
      drift: b.frame % 8,
      ...(hiddenAt(b.frame).length > 0 ? { hidden: hiddenAt(b.frame) } : {}),
      ...(falling ? { weather: falling } : dayAir ? { air: dayAir } : hot ? { air: 'heat' } : seasonal),
      wind: w.weather !== undefined && isWindy(w.weather),
      storm: sky === 'storm',
      fog: sky === 'fog',
    }
    // A special day's scene, from the ✦ celebrate button: the prop held up or
    // floating beside them, and the scene's own air
    const playingNow = await sceneNow($, b, w)
    const sceneAt = (await read($, playing))?.at ?? b.frame
    if (playingNow) {
      scene.arms = playingNow.arms ?? (playingNow.prop ? 'hold' : scene.arms)
      if (playingNow.air && !falling) scene.air = playingNow.air
      if (playingNow.confetti) scene.confetti = b.frame - sceneAt + 1
    }
    // A season or what's in the air, previewed: all of it, whatever the weather
    if (airPreview !== undefined) {
      scene.weather = undefined
      scene.airCount = undefined
      scene.air = airPreview.air ?? seasonAir(airPreview.season ?? w.season, isNight) ?? 'snowflakes'
    }
    // A time of day, played: its air at its fullest, whatever the weather
    if (heldPart !== undefined) {
      scene.weather = undefined
      scene.airCount = undefined
      scene.air = timeAir(heldPart)
    }
    // The rare ones in the air come and go by the frame
    if (scene.air !== undefined || scene.weather === 'snow') scene.frame = b.frame
    if (airPreview?.rare) scene.rare = true
    // Leaves fall slowly, on a longer loop of their own
    if (scene.air === 'leaves') scene.fall = b.frame % LEAF_CYCLE
    // Stars and fireflies twinkle slowly, on a loop of their own
    if (scene.air === 'sparkles' || scene.air === 'fireflies') scene.fall = b.frame % TWINKLE
    const dressed = dressFor(w.weather)
    // Too hot for a scarf, whatever the season
    const seasonPiece = airPreview?.season ? [SEASONAL[airPreview.season]] : seasonShow === 'off' ? [] : [SEASONAL[w.season]]
    const prop = playingNow?.prop ? [propOn(playingNow.prop, b.frame - sceneAt)] : []
    const pieces = [...seasonPiece, ...dressed.pieces, ...(dayLook ? [dayLook] : []), ...prop].filter(p => !(hot && p.slot === 'neck'))
    const width = Math.max(13, e.props.bodyColumns)
    // A gentle sway while idle
    const swing = daytimeOn ? swayOf(w.part) : 16
    const sway = b.mood === 'idle' && b.frame % swing >= swing / 2 ? 1 : 0
    // Pixel art in a terminal pane: full size where there's room (32 columns,
    // 22 rows and the rest of the pane), shrunk to fit where there isn't. An SVG
    // of the same where pictures are drawn (the desktop app, the editor, the
    // phone). Never text art: where neither can be drawn, they say so
    // By the surface, not by what the table holds: every table names them all
    const Raster = e.surface === 'terminal' && colorful ? $.ui.resolve(e).Raster : undefined
    const Client = e.surface === 'terminal' && colorful && !portraitFailed ? $.ui.resolve(e).Client : undefined
    const Svg = e.surface === 'terminal' ? undefined : $.ui.resolve(e).Svg
    // The rows left for them: the pane's, less everything else it drew last
    // time (8 before it has drawn), so nothing under them pushes their head off the top
    const besides = rowsBesides
    // As many columns as fit: the pane's width less a column for the sway, its rows less the rest
    const fits = Math.min(e.props.bodyColumns - 1, Math.floor(((e.props.scroll.bodyRows - besides) * 2 * WIDTH) / HEIGHT))
    const hasRoom = fits >= WIDTH
    // Room for more: grown a whole number of times, so the pixels stay square
    const scale = hasRoom ? Math.max(1, Math.floor(fits / WIDTH)) : 1
    const columns = hasRoom ? WIDTH : Math.max(SMALLEST, fits)
    const artRows = Raster !== undefined ? (shrunkHeight(columns) * scale) / 2 : 0
    let art
    if (Raster !== undefined && hasRoom) {
      // The touchable portrait takes the pane's whole width, a column spare for
      // the sway, so there's room around them to click and to catch things in
      // Grown, the stage is drawn small and grown with them
      const stage = Math.floor((width - 1) / scale)
      art =
        Client !== undefined ? (
          <Box marginLeft={sway + Math.floor((width - 1 - stage * scale) / 2)}>
            <Client key="portrait" module="./portrait.tsx" props={paintParts(scene, c, worn, pieces, dressed.palette, stage, scale)} width={stage * scale} height={artRows} />
          </Box>
        ) : (
          <Box marginLeft={Math.max(0, Math.floor((width - WIDTH * scale) / 2)) + sway}>
            <Raster key="portrait" columns={WIDTH * scale} rows={artRows} cells={paint(scene, c, worn, pieces, dressed.palette, 'cells', WIDTH, scale)} />
          </Box>
        )
    } else if (Raster !== undefined) {
      art = (
        <Box marginLeft={Math.max(0, Math.floor((width - columns) / 2)) + sway}>
          <Raster key="portrait" columns={columns} rows={artRows} cells={paint(scene, c, worn, pieces, dressed.palette, 'cells', columns)} />
        </Box>
      )
    } else if (Svg !== undefined) {
      // Too much in the air for one picture: them without it
      const still = { ...scene, weather: undefined, air: undefined, wind: undefined, storm: undefined, fog: undefined, confetti: 0 }
      const source = [scene, still].map(s => paint(s, c, worn, pieces, dressed.palette, 'svg')).find(svg => svg.length <= 131_072)
      art = source && (
        <Box justifyContent="center">
          <Svg key="portrait" source={source} alt={`${c.name}, ${b.mood === 'idle' ? 'relaxing' : b.mood}`} width={WIDTH * 4} />
        </Box>
      )
    } else {
      art = <Text wrap="wrap" dimColor>{NO_PICTURES}</Text>
    }
    const quiet = b.mood === 'idle' || b.mood === 'sleepy' || b.mood === 'break' || b.mood === 'snack' || b.mood === 'coffee'
    // Their own color runs through the pane: name, bubble, headings
    const theme = hex(c.look.theme)
    // Their name, with your hearts and the way to the next one
    const bondNow = (await read($, togetherAtom))[c.id]?.points ?? 0
    // Five slots: past five hearts they turn gold, one by one
    const slots = heartSlots(heartsFor(bondNow))
    // Their name and your hearts, then how far to the next heart and the
    // moment you're in. A space between hearts: many fonts draw ♥ wider than
    // its cell, and side by side they crowd each other
    const kinds = [...Array<'gold'>(slots.gold).fill('gold'), ...Array<'pink'>(slots.pink).fill('pink'), ...Array<'empty'>(slots.empty).fill('empty')]
    // As wide as the portrait and a little more, centred over it: their name at
    // the left, your hearts at the right, and under them how far to the next
    // heart and the moment you're in
    const plateWidth = Math.min(width, Math.max(30, columns * scale + 6))
    const nameplate = (
      <Box justifyContent="center">
        <Box flexDirection="column" width={plateWidth}>
          <Box justifyContent="space-between">
            <Text color={theme} bold wrap="truncate">{c.name}</Text>
            <Text key="hearts">
              {kinds.map((k, i) => (
                <Text key={`heart-${i}`} color={k === 'gold' ? '#ffc83d' : k === 'pink' ? '#ff6f91' : undefined} dimColor={k === 'empty'}>
                  {`${i > 0 ? ' ' : ''}♥`}
                </Text>
              ))}
            </Text>
          </Box>
          <Text dimColor wrap="truncate">{`${progressBar(bondNow)} · ${w.season} ${PART_WORDS[w.part]}`}</Text>
        </Box>
      </Box>
    )
    // Your other sessions, in a line under their name, when there are any:
    // press it (or s) for the list
    const others = await peersOf($)
    const fresh = await read($, justDone)
    const label = names(others)
    const sessionChip =
      others.length > 0 ? (
        <Box justifyContent="center">
          <Button key="sessions" plain hotkey="s" label={chip(others, new Set(Object.keys(fresh)), label)} dimColor={Object.keys(fresh).length === 0} onPress={() => openSessions($)} />
        </Box>
      ) : null
    // What they say, in a speech bubble pointing up at them
    const said = (
      <Box flexDirection="column" alignItems="center">
        <Text color={theme}>▲</Text>
        <Box borderStyle="round" borderColor={theme} paddingX={1} width="100%">
          <Text bold={!quiet && !(daytimeOn && w.part === 'lateNight')} dimColor={quiet} wrap="wrap">
            {[steady(sparkle(b)), (daytimeOn && b.mood !== 'watching' ? inTone(b.note, w.part) : b.note) || '…'].filter(Boolean).join(' ')}
          </Text>
        </Box>
      </Box>
    )
    // A heading for a part of the pane: an icon and a title in their color, and a soft rule
    const heading = (icon: string, title: string) => (
      <Text wrap="truncate">
        <Text color={theme} bold>{`${icon} ${title} `}</Text>
        <Text color={theme} dimColor>{'┈'.repeat(Math.max(0, width - title.length - 3))}</Text>
      </Text>
    )

    // The morning letter, until you put it away or it's been a while
    const note = await read($, letter)
    const isReading = note !== null && b.frame - note.at < LETTER_FOR
    const mail = isReading ? (
      <Box flexDirection="column" borderStyle="round" borderColor={theme} paddingX={1}>
        {note.title && <Text color={theme} bold>{note.title}</Text>}
        {note.lines.map(line => (
          <Text wrap="wrap">{line}</Text>
        ))}
        <Button key="letter-away" plain hotkey="k" label="put away" dimColor onPress={() => putLetterAway($)} />
      </Box>
    ) : null
    const letterRows = isReading ? note.lines.length + 4 : 0
    const settings = await scoreOf($)
    const showsMore = (await read($, more)) === true
    // Things to press: by mouse, or by the letter once the pane has the keys
    const choosing = await pickerOf($)
    const found = search(choosing.query)
    const t = await trophiesOf($)
    // The wardrobe: everything there is to earn, what you have, and what's on
    const unlocks = ACHIEVEMENTS.map(a => ({ a, item: itemById(a.unlocks), isOwned: t.unlocked.includes(a.id) }))
    const shelf = unlocks.filter(u => u.item && `${u.item.name} ${u.a.name}`.toLowerCase().includes(choosing.query.toLowerCase()))
    const wardrobe = (
      <Box flexDirection="column">
        {Input && <Input
          key="search"
          label="search: "
          placeholder="an item or achievement"
          value={choosing.query}
          autoFocus
          onInput={(query: string) => searchFor($, query)}
          onSubmit={(query: string) => searchFor($, query)}
        />}
        {shelf.map(({ a, item, isOwned }) =>
          isOwned && item ? (
            <Button
              key={`wear-${item.id}`}
              plain
              label={`${worn[item.kind] === item.id ? '●' : '○'} ${item.name}`}
              onPress={() => (worn[item.kind] === item.id ? takeOff($, item.kind) : putOn($, item))}
            />
          ) : (
            <Text dimColor wrap="truncate">{`  ${progressLine(a.id, t)}`}</Text>
          ),
        )}
        <Button key="done" plain hotkey="x" label="done" role="dismiss" dimColor onPress={() => closePicker($)} />
      </Box>
    )
    const now = choosing.isOpen && choosing.mode === 'sessions' ? await $.clock.now() : 0
    const sessionList = (
      <Box flexDirection="column">
        {heading('⧉', 'your other sessions')}
        {others.length === 0 && <Text dimColor>  {say('alone')}</Text>}
        {[...others]
          .sort((a, b) => b.since - a.since)
          .flatMap(p => [
            <Text key={`session-${p.id}`} wrap="truncate" color={p.status === 'working' || fresh[p.id] !== undefined ? theme : undefined} bold={fresh[p.id] !== undefined}>
              {line(p, label.get(p.id) ?? p.project, now)}
            </Text>,
            <Text key={`summary-${p.id}`} wrap="truncate" dimColor>{`  ${p.summary || '…'}`}</Text>,
          ])}
        <Button key="done" plain hotkey="x" label="done" role="dismiss" dimColor onPress={() => closePicker($)} />
      </Box>
    )
    // The journal, open in the pane: a page with a border in their color, today's
    // date at the top, each section with how full it is, a stamp for each thing
    // found and a blank for each still to find, and their name signed at the end
    const isJournal = choosing.isOpen && choosing.mode === 'journal'
    const sections = isJournal ? journalSections(await journalFacts($)) : []
    const dated = isJournal ? `${new Date(await $.clock.now()).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · ${w.season}` : ''
    // A clean notebook page, everything on it at once: a stitched leather
    // spine down the left, brass protectors on the page's outer corners, a
    // quiet title, then one line for each kind of thing to find, its stamps
    // in a row (found in their color, rare ones in gold, the rest a faint
    // dot), a line for the moments, and a word from them before they sign
    const accent = deepen(theme)
    const signature = <Text color={accent} italic>{`— ${c.name}${c.temperament === 'cheerful' ? ' ♡' : ''}`}</Text>
    const LEATHER = '#6b3f22'
    const LEATHER_DARK = '#3f2611'
    // Where the page curves into the binding, a shade darker
    const GUTTER = '#e6d7b8'
    // A found thing is a little tile, like a sticker; a rare one a gold tile
    const TILE = '#ead9b6'
    const RARE_TILE = '#f1d98f'
    const RARE_STAMP = '#7a4f00'
    const BRASS = '#c9a24a'
    const LABEL = 13
    // Each kind, in the order they're read: what drifts by first, the days last
    const LINES = [
      { label: 'in the air', section: 3 },
      { label: 'rare finds', section: 4 },
      { label: 'weather', section: 1 },
      { label: 'work', section: 2 },
      { label: 'special days', section: 0 },
    ] as const
    const stampsOf = (i: number) => {
      const s = sections[i]
      if (s === undefined) return []
      return [...(s.slots ?? []), ...Array.from({ length: s.more ?? 0 }, () => ({ found: false, text: '' }) as const)]
    }
    // A found thing with a pixel-art icon of its own: the icon, then how many
    const paperColor = parseInt(PAPER.slice(1), 16)
    const iconOf = (id: string, key: string, count?: number) => {
      const cellsNow = Raster !== undefined ? iconCells(id, paperColor) : undefined
      const svg = Raster === undefined && Svg !== undefined ? iconSvg(id) : undefined
      if (cellsNow === undefined && svg === undefined) return undefined
      return (
        <Box key={key} flexDirection="row" alignItems="center">
          {cellsNow !== undefined && Raster !== undefined ? (
            <Raster key={`icon-${id}`} columns={ICON_COLUMNS} rows={ICON_ROWS} cells={cellsNow} />
          ) : Svg !== undefined && svg !== undefined ? (
            <Svg key={`icon-${id}`} source={svg} alt={id} width={ICON_COLUMNS * 4} />
          ) : null}
          {count !== undefined && count > 1 ? <Text color={INK}>{`×${count}`}</Text> : null}
        </Box>
      )
    }
    // The shelves, like a collection's: each thing found an 8 × 8 icon standing
    // on a wooden plank, its count on a tag on the plank. Only what's found is
    // there; a shelf with nothing on it yet isn't put up
    const PLANK = '#8b5a2b'
    const PLANK_TOP = '#b07a42'
    const UNIT = BIG_COLUMNS + 1
    const shelfOf = (label: string, i: number, ids: readonly string[]) => {
      const slots = sections[i]?.slots ?? []
      const found = ids.flatMap((id, j) => (slots[j]?.found === true ? [{ id, j, slot: slots[j]! }] : []))
      if (found.length === 0) return null
      return (
        <Box key={`shelf-${i}`} flexDirection="column" marginTop={1}>
          <Text color={FADED} italic>{label}</Text>
          <Box flexDirection="row" flexWrap="wrap">
            {found.map(({ id, j, slot }) => {
              const count = 'count' in slot ? slot.count : undefined
              const cellsNow = Raster !== undefined ? bigCells(id, paperColor) : undefined
              const svg = Raster === undefined && Svg !== undefined ? bigSvg(id) : undefined
              const tag = count !== undefined && count > 1 ? `×${count}` : ''
              const left = Math.floor((UNIT - tag.length) / 2)
              return (
                <Box key={`unit-${i}-${j}`} flexDirection="column" width={UNIT}>
                  <Box flexDirection="row">
                    {cellsNow !== undefined && Raster !== undefined ? (
                      <Raster key={`shelf-${id}`} columns={BIG_COLUMNS} rows={BIG_ROWS} cells={cellsNow} />
                    ) : svg !== undefined && Svg !== undefined ? (
                      <Svg key={`shelf-${id}`} source={svg} alt={id} width={BIG_COLUMNS * 4} />
                    ) : null}
                  </Box>
                  <Text backgroundColor={PLANK} color={PLANK_TOP}>
                    {'▀'.repeat(left)}
                    <Text backgroundColor={PLANK} color={PAPER} bold>{tag}</Text>
                    {'▀'.repeat(Math.max(0, UNIT - left - tag.length))}
                  </Text>
                </Box>
              )
            })}
          </Box>
        </Box>
      )
    }
    const stampLine = (label: string, i: number) =>
      stampsOf(i).some(x => x.found) && (
      <Box key={`line-${i}`} flexDirection="row" alignItems="center">
        <Box width={LABEL}>
          <Text color={FADED} italic>{label}</Text>
        </Box>
        <Box flexDirection="row" flexWrap="wrap" columnGap={1} flexGrow={1} alignItems="center">
          {stampsOf(i).filter(x => x.found).map((x, j) => {
            const icon = x.found && 'id' in x && x.id !== undefined && ICONS[x.id] !== undefined ? iconOf(x.id, `stamp-${i}-${j}`, 'count' in x ? x.count : undefined) : undefined
            return icon ?? (x.found ? (
              <Text key={`stamp-${i}-${j}`} color={INK}>
                <Text backgroundColor={'isRare' in x && x.isRare ? RARE_TILE : TILE} color={'isRare' in x && x.isRare ? RARE_STAMP : accent} bold>
                  {` ${x.stamp ?? '✦'} `}
                </Text>
                {'count' in x && (x.count ?? 0) > 1 ? `×${x.count}` : null}
              </Text>
            ) : null)
          })}
        </Box>
      </Box>
    )
    // The moments: for each one you've met, how many of their moments you've
    // shared; the ones still to meet, counted but not named
    const moments = sections[5]?.rows ?? []
    const shared = moments.flatMap(r => {
      const m = r.found ? /^(\S+)\s+(\d+) of (\d+) moments/.exec(r.text.trim()) : null
      return m ? [{ name: m[1]!, seen: Number(m[2]), of: Number(m[3]) }] : []
    })
    const toMeet = moments.filter(r => !r.found).length
    const momentLine = (
      <Box flexDirection="row">
        <Box width={LABEL}>
          <Text color={FADED} italic>moments</Text>
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          {shared.map(x => (
            <Text key={`moment-${x.name}`} color={INK} wrap="truncate">
              <Text color={accent} bold>{`♡ ${x.name}`}</Text>
              {` ${x.seen} of ${x.of} shared`}
            </Text>
          ))}
          {toMeet > 0 && <Text color={FADED} italic>{`${toMeet} still to meet`}</Text>}
        </Box>
      </Box>
    )
    const voice = journalVoice(sections, c.temperament)
    // The title on a pixel-art ribbon in their colour; the words sit on its
    // band in exactly the colour the pixels are drawn in
    const TITLE = 'Our Journal'
    // Brighter than the ink: their colour only a little deepened, so the cream title still reads on it
    const bandColor = pixelColor(parseInt(deepen(theme, 0.28).slice(1), 16))
    const band = `#${bandColor.toString(16).padStart(6, '0')}`
    const banner = ribbon(TITLE.length, bandColor)
    // A decoration in pixel art: cells in the terminal, a picture elsewhere
    const pictureOf = (p: Picture, key: string, alt: string) => {
      const size = sizeOf(p)
      if (Raster !== undefined) return <Raster key={key} columns={size.columns} rows={size.rows} cells={pictureCells(p, parseInt(PAPER.slice(1), 16))} />
      if (Svg !== undefined) return <Svg key={key} source={pictureSvg(p)} alt={alt} width={size.columns * 4} />
      return null
    }
    const journalView = (
      <Box flexDirection="column">
        <Box flexDirection="row">
          {/* A plain leather spine, and the page's gutter where it curves in */}
          <Box width={1} backgroundColor={LEATHER_DARK} />
          <Box width={1} backgroundColor={LEATHER} />
          <Box width={1} backgroundColor={GUTTER} />
          <Box flexDirection="column" flexGrow={1} backgroundColor={PAPER} paddingLeft={1} paddingRight={1}>
            {/* The title on its ribbon and the date, washi tape across the corner */}
            <Box flexDirection="row" justifyContent="space-between">
              <Box flexDirection="column">
                <Box width={sizeOf(banner).columns} height={sizeOf(banner).rows}>
                  {pictureOf(banner, 'ribbon', `a ribbon reading ${TITLE}`)}
                  <Box position="absolute" top={1} left={6}>
                    <Text backgroundColor={band} color={PAPER} bold>{TITLE}</Text>
                  </Box>
                </Box>
                <Text color={FADED} italic wrap="truncate">{dated}</Text>
              </Box>
              {pictureOf(washiTape(c.look.theme), 'tape', 'washi tape across the corner')}
            </Box>
            {shelfOf(LINES[0].label, LINES[0].section, COMMON)}
            {shelfOf(LINES[1].label, LINES[1].section, RARE)}
            {shelfOf(LINES[2].label, LINES[2].section, SKIES)}
            <Text color={PAPER}> </Text>
            {stampLine(LINES[3].label, LINES[3].section)}
            {stampLine(LINES[4].label, LINES[4].section)}
            {momentLine}
            <Text color={PAPER}> </Text>
            {/* A pressed keepsake for the season, beside their word and their name */}
            <Box flexDirection="row" alignItems="center" columnGap={2}>
              {pictureOf(KEEPSAKES[w.season], 'keepsake', `a pressed keepsake for ${w.season}`)}
              <Box flexDirection="column" flexGrow={1}>
                <Text color={INK} italic wrap="wrap">{voice}</Text>
                <Box justifyContent="flex-end">{signature}</Box>
              </Box>
            </Box>
            <Box justifyContent="flex-end">
              <Text color={BRASS}>◢</Text>
            </Box>
          </Box>
        </Box>
        <Box justifyContent="center">
          <Button key="done" plain hotkey="x" label="close" role="dismiss" dimColor onPress={() => closePicker($)} />
        </Box>
      </Box>
    )
    // The first time: who they are and how each one sounds, then pick
    const welcome = (
      <Box flexDirection="column">
        {heading('✿', 'pick your buddy')}
        {CHARACTERS.map(x => (
          <Box key={`meet-${x.id}`} flexDirection="column">
            <Button key={`pick-${x.id}`} plain label={`${x.id === c.id ? '●' : '○'} ${x.name.padEnd(9)} ${x.temperament}`} onPress={() => choose($, x)} />
            <Text dimColor wrap="truncate">{`    "${sampleOf(x)}"`}</Text>
          </Box>
        ))}
        <Text dimColor wrap="wrap">{`  you can switch any time: ☺ friends, or /frens characters`}</Text>
        <Button key="done" plain hotkey="x" label={`keep ${c.name}`} role="dismiss" dimColor onPress={() => choose($, c)} />
      </Box>
    )
    const buttons =
      choosing.isOpen && choosing.mode === 'welcome' ? welcome
      : choosing.isOpen && choosing.mode === 'sessions' ? sessionList
      : choosing.isOpen && choosing.mode === 'journal' ? journalView
      : choosing.isOpen && choosing.mode === 'wardrobe' ? wardrobe
      : choosing.isOpen ? (
      // The picker: type to search, then click, Enter, or Tab and arrows to a match
      <Box flexDirection="column">
        {Input && <Input
          key="search"
          label="search: "
          placeholder="name, gender or pronouns"
          value={choosing.query}
          submitLabel="pick"
          autoFocus
          onInput={(query: string) => searchFor($, query)}
          onSubmit={(query: string) => {
            const first = search(query)[0]
            return first ? choose($, first) : searchFor($, query)
          }}
        />}
        {found.length === 0 && <Text dimColor>  no one matches "{choosing.query}"</Text>}
        {found.map(x => (
          <Button
            key={`pick-${x.id}`}
            plain
            label={`${x.id === c.id ? '●' : '○'} ${x.name.padEnd(9)} ${describeCharacter(x)}`}
            dimColor={x.id !== c.id}
            onPress={() => choose($, x)}
          />
        ))}
        <Button key="done" plain hotkey="x" label="done" role="dismiss" dimColor onPress={() => closePicker($)} />
      </Box>
    ) : (
      // The dock: things to do together up front, settings behind the ⋯
      <Box flexDirection="column" alignItems="center">
        <Box flexDirection="row" flexWrap="wrap" columnGap={2} justifyContent="center">
          <Button key="hi" plain hotkey="h" label="♡ hi" onPress={() => sayHi($)} />
          {w.special && SCENES[w.special.id] && <Button key="celebrate" plain hotkey="e" label="✦ celebrate" onPress={() => celebrate($)} />}
          <Button key="change" plain hotkey="c" label="☺ friends" onPress={() => openPicker($)} />
          <Button key="wardrobe" plain hotkey="o" label="✧ closet" onPress={() => openPicker($, 'wardrobe')} />
          <Button key="journal" plain hotkey="j" label="❦ journal" onPress={() => openPicker($, 'journal')} />
          <Button key="more" plain hotkey="m" label="⋯" dimColor onPress={() => toggleMore($)} />
        </Box>
        {showsMore && (
          <Box flexDirection="row" flexWrap="wrap" columnGap={2} justifyContent="center">
            <Button key="notify" plain hotkey="n" label={`notify ${notifies ? 'on' : 'off'}`} dimColor onPress={() => setNotify($, !notifies).then(() => change($, b => ({ ...b })))} />
            <Button key="diffs" plain hotkey="d" label={`diffs ${settings.hidesDiffs ? 'off' : 'on'}`} dimColor onPress={() => toggleDiffs($)} />
            <Button key="close" plain hotkey="x" label="close" role="dismiss" dimColor onPress={() => closePane($)} />
          </Box>
        )}
      </Box>
    )
    const listed =
      choosing.mode === 'sessions' ? Math.max(1, others.length * 2)
      : choosing.mode === 'journal' ? 38
      : choosing.mode === 'wardrobe' ? shelf.length
      : choosing.mode === 'welcome' ? CHARACTERS.length * 2 + 2
      : Math.max(1, found.length)

    const pickerRows = choosing.isOpen ? listed + 2 : showsMore ? 2 : 1

    // The bottom half shows the changes Claude made, when there are any
    const edits = settings.hidesDiffs ? [] : await changesOf($)
    rowsBesides = 7 + pickerRows + letterRows + (sessionChip ? 1 : 0)
    const used = (Raster !== undefined ? artRows : 7) + rowsBesides
    const left = Math.max(0, e.props.scroll.bodyRows - used)
    let room = Math.max(0, left - 2)
    const parts = []
    if (edits.length > 0 && room >= 4) {
      const files = edits.length === 1 ? '1 file' : `${edits.length} files`
      parts.push(heading('✎', `changes · ${files}`))
      for (const edit of edits) {
        if (room < 3) break
        const { source, rows } = fit(edit, room - 1)
        if (rows === 0) break
        parts.push(
          <Text bold wrap="truncate-start">
            {clip(shown(edit.path, root), Math.max(1, width - 12))} <Text color="success">+{edit.added}</Text>{' '}
            <Text color="error">-{edit.removed}</Text>
          </Text>,
        )
        parts.push(<Code source={source} format="diff" path={edit.path} wrap="truncate-end" />)
        room -= rows + 2
      }
    }

    return (
      <Box flexDirection="column">
        {nameplate}
        {sessionChip}
        {art}
        {said}
        {mail}
        {buttons}
        {parts.length > 0 && <Text> </Text>}
        {parts}
      </Box>
    )
  })
}
