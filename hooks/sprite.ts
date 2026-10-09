// The pixel art: a 32 × 44 head-and-shoulders portrait of a grown-up, drawn
// from shapes as the character's look describes, then painted into terminal
// cells two pixels to a cell with half blocks

import type { Item } from '../achievements/types'
import type { Look, Palette } from '../characters/types'

export type Accessory = Extract<Item, { kind: 'accessory' }>

export const WIDTH = 32
export const HEIGHT = 44

export type EyeKind = 'open' | 'blink' | 'happy' | 'squeeze' | 'determined' | 'lidded' | 'sleep' | 'soft'
export type MouthKind = 'smile' | 'open' | 'grin' | 'wavy' | 'flat' | 'small' | 'smirk' | 'frown'
export type ArmKind = 'down' | 'wave' | 'waveB' | 'typeA' | 'typeB' | 'cheeks' | 'cheer' | 'cheerB' | 'fist' | 'cup' | 'snack' | 'water' | 'coffee' | 'fanA' | 'fanB' | 'hold' | 'chin' | 'pump'

/** Things in the air around them */
export type Air = 'petals' | 'sparkles' | 'fireflies' | 'leaves' | 'hearts' | 'bats' | 'lanterns' | 'snowflakes' | 'streamers' | 'heat'

export type Pose = {
  eyes: EyeKind
  look: -1 | 0 | 1
  mouth: MouthKind
  arms: ArmKind
  blush: boolean
  sweat: boolean
  ahoge: 0 | 1
  /** A tear on the cheek */
  tear: boolean
  /** Falling confetti, 0 for none, else the frame it has fallen to */
  confetti: number
  /** 1 while in the air, a terminal row up */
  hop: 0 | 1
  /** Moves the little things in their hands: steam rising, bites taken */
  beat: number
  /** Rain or snow falling around them, as it is where you are */
  weather?: 'rain' | 'snow'
  /** What drifts past when it isn't raining or snowing: the season's, or a special day's */
  air?: Air
  /** At most this many at once, for a gentle moment; absent, the kind's own number */
  airCount?: number
  /** Gusts streaking past */
  wind?: boolean
  /** Lightning, now and then */
  storm?: boolean
  /** Mist drifting low */
  fog?: boolean
  /** How far it has fallen, 0 to 7, round and round */
  drift?: number
  /** Things in the air you've caught, by id ("leaf:2:5"), left out until they come round again */
  hidden?: string[]
  /** The frame, for the rare things in the air: when they come, and a shooting star's flight */
  frame?: number
  /** A preview: the rare ones come at once, every time */
  rare?: boolean
  /** For leaves, which fall slowly: the frame, 0 to LEAF_CYCLE - 1, round and
   * round; for stars and fireflies, which twinkle slowly, 0 to TWINKLE - 1 */
  fall?: number
}

// One character a pixel; '.' is see-through. These never change between
// characters; the rest come from the character's palette
const FIXED: Record<string, number> = {
  K: 0x2b1d2e, // outline
  W: 0xffffff, // eye shine
  w: 0xe6ecff, // eye white, steam, a glass
  m: 0x6e1a30, // mouth inside
  R: 0xe2404f, // confetti red, the mug
  Z: 0x9fd8ff, // sweat drop, tear, water
  Y: 0xffd54a, // confetti gold, tea, fireflies
  P: 0xffb7d5, // petals
  Q: 0xe8833a, // a leaf
  q: 0xc8452f, // a redder leaf
  J: 0xd9a63a, // a golden leaf
  N: 0x7a4a2a, // a leaf's stem
  n: 0x8d94a8, // a star, dimmed for a moment
  y: 0x9c7f2e, // a firefly, dimmed for a moment
  V: 0xff6f91, // hearts
  b: 0x9a7fc4, // bats, light enough to see on a dark terminal
  j: 0xffb36b, // heat rising
  g: 0xb8c4d6, // gusts, mist
  T: 0xff4d3d, // lanterns
  O: 0xfafafa, // rice
  o: 0x2e4a3a, // nori
  G: 0x7ad68a, // confetti green
  C: 0x5aa9d6, // a coffee mug
  c: 0x6b4226, // coffee
}

export function paletteOf(p: Palette, accessories: readonly Accessory[] = []): Record<string, number> {
  const worn: Record<string, number> = {}
  accessories.forEach((a, k) => {
    for (const [digit, color] of Object.entries(a.colors)) if (color !== undefined) worn[own(k, digit)] = color
  })
  return {
    ...worn,
    ...FIXED,
    H: p.hair,
    h: p.hairShade,
    L: p.hairShine,
    S: p.skin,
    s: p.skinShade,
    E: p.eyes,
    e: p.eyesDark,
    F: p.eyesGlow,
    B: p.blush,
    M: p.lips,
    D: p.top,
    d: p.topShade,
    U: p.inner,
    u: p.innerShade,
    A: p.accent,
    x: p.detail,
    t: blend(p.skinShade, p.hair, 0.3),
  }
}

// Part way from one color to another
function blend(from: number, to: number, amount: number): number {
  const channel = (shift: number) => {
    const a = (from >> shift) & 255
    const b = (to >> shift) & 255
    return Math.round(a + (b - a) * amount) << shift
  }
  return channel(16) | channel(8) | channel(0)
}

type Grid = string[][]

const blank = (width = WIDTH): Grid => Array.from({ length: HEIGHT }, () => Array<string>(width).fill('.'))
// How wide a grid is: the portrait's 32, or a wider stage
const widthOf = (g: Grid) => g[0]?.length ?? WIDTH
// More of what's in the air on a wider stage, as many for its width
const spread = (n: number, g: Grid) => Math.round((n * widthOf(g)) / WIDTH)

// Which part of them each pixel belongs to, so a click can tell the hair from
// the scarf: filled as they're drawn, one character a pixel, '.' for none.
// Things in the air leave it alone, so a click goes through them
let parts: Grid | undefined
let part: string | undefined

// Things in the air you can catch: each leaf, petal, snowflake and firefly is a
// part of its own in the grid, a private-use character named by its id
// and, now and then, a rare one: a golden leaf, a cherry blossom, a snow
// crystal, a shooting star
export const COMMON = ['leaf', 'petal', 'snowflake', 'firefly'] as const
export const RARE = ['goldleaf', 'blossom', 'crystal', 'star'] as const
export const CATCHABLE = [...COMMON, ...RARE] as const
export type Catchable = (typeof CATCHABLE)[number]
export type Rare = (typeof RARE)[number]
export const isRare = (kind: Catchable): kind is Rare => (RARE as readonly string[]).includes(kind)

// Whether a seed comes up one in `odds`: the same answer for the same seed, so
// a rare one stays rare for as long as it's in the air
const lucky = (seed: number, odds: number) => (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) >>> 0) % odds === 0
// How long a rare petal or crystal stays, in frames: ten seconds
const RARE_WINDOW = 40
// A golden leaf one in a thousand leaves: about one an hour with the season
// showing all the time, a few hours apart the rest of the time
const ODDS = { goldleaf: 1000, blossom: 1000, crystal: 1000, star: 10 }
// Their own shapes: a five-petal blossom, a six-pointed crystal
const RARE_SHAPES: Partial<Record<Air, { kind: Rare; shape: string[] }>> = {
  petals: { kind: 'blossom', shape: ['.O.', 'OYO', '.O.'] },
  snowflakes: { kind: 'crystal', shape: ['Z.Z', '.W.', 'Z.Z'] },
}
const CATCHES: Partial<Record<Air, Catchable>> = { petals: 'petal', snowflakes: 'snowflake', fireflies: 'firefly' }
/** What kind of thing a caught id is ("leaf:2:5" is a leaf), or undefined for anything else */
export function catchOf(id: string): Catchable | undefined {
  const kind = id.split(':')[0]
  return id.includes(':') && (CATCHABLE as readonly string[]).includes(kind!) ? (kind as Catchable) : undefined
}
let airNames: Record<string, string> = {}
let hiddenNow: readonly string[] = []
let rareNow = false
// Marks what's drawn next as the thing in the air with this id
function airPart(id: string) {
  const c = String.fromCharCode(0xe800 + Object.keys(airNames).length)
  airNames[c] = id
  part = c
}

function set(g: Grid, x: number, y: number, c: string) {
  if (y >= 0 && y < HEIGHT && x >= 0 && x < (g[y]?.length ?? 0)) {
    g[y]![x] = c
    // Cleared back to nothing, there's nothing to touch there
    if (parts !== undefined && part !== undefined) parts[y]![x] = c === '.' ? '.' : part
  }
}

function ellipse(g: Grid, cx: number, cy: number, rx: number, ry: number, c: string, keep?: (x: number, y: number) => boolean) {
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const dx = (x + 0.5 - cx) / rx
      const dy = (y + 0.5 - cy) / ry
      if (dx * dx + dy * dy <= 1 && (keep === undefined || keep(x, y))) set(g, x, y, c)
    }
  }
}

function rect(g: Grid, x0: number, y0: number, x1: number, y1: number, c: string) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(g, x, y, c)
}

// Stamps rows at (x, y); ':' leaves what is under it
function stamp(g: Grid, x: number, y: number, rows: string[], mirror = false) {
  rows.forEach((row, dy) => {
    const line = mirror ? [...row].reverse().join('') : row
    ;[...line].forEach((c, dx) => {
      if (c !== ':') set(g, x + dx, y + dy, c)
    })
  })
}

// The face fills the top of the frame and the shoulders the bottom, an
// adult's proportions: a long face and neck, eyes a third of the way down

const FACE_X = 16

function shoulders(g: Grid, outfit: Look['outfit']) {
  // Neck
  part = PART.face
  rect(g, 14, 25, 17, 32, 'S')
  // The chin's shadow on the neck
  rect(g, 14, 27, 17, 27, 's')
  // The outer layer, sloping out from the neck to the shoulders
  part = PART.outfit
  for (let y = 31; y < HEIGHT; y++) {
    const spread = Math.min(13, 5 + (y - 31) * 2)
    rect(g, FACE_X - spread, y, FACE_X + spread - 1, y, 'D')
  }
  switch (outfit) {
    case 'blazer':
    case 'suit':
      // A V opening over a shirt, edged by lapels
      for (let y = 31; y <= 41; y++) {
        const half = Math.round((41 - y) * 0.4)
        const left = FACE_X - half - 1
        const right = FACE_X + half
        rect(g, left, y, right, y, y < 33 ? 'S' : 'U')
        if (y >= 32) {
          rect(g, left - 2, y, left - 1, y, 'd')
          rect(g, right + 1, y, right + 2, y, 'd')
        }
      }
      // Collar points, and a notch in each lapel
      stamp(g, 12, 32, ['uU::::::Uu', ':uU::::Uu:'])
      set(g, 10, 35, 'D')
      set(g, 21, 35, 'D')
      if (outfit === 'suit') {
        // A tie, knotted at the collar
        stamp(g, 15, 33, ['AA', 'AA', 'AA', 'AA', 'AA', 'AA', 'AA', ':A'])
      } else {
        // One button where the lapels meet
        set(g, 15, 42, 'A')
      }
      return
    case 'jacket':
      // An open jacket over a plain tee
      for (let y = 31; y < HEIGHT; y++) {
        const half = Math.min(5, 2 + Math.floor((y - 31) / 2))
        rect(g, FACE_X - half - 1, y, FACE_X + half, y, 'U')
        set(g, FACE_X - half - 2, y, 'd')
        set(g, FACE_X + half + 1, y, 'd')
      }
      // The tee's round neck
      stamp(g, 13, 31, ['uSSSSu', ':uuuu:'])
      // The jacket's collar turned up at the sides
      stamp(g, 9, 30, ['dd::::::::::dd', ':dD::::::::Dd:'])
      return
    case 'hoodie':
      // A round neckline with the hood's rim behind it, and drawstrings
      stamp(g, 11, 31, ['ddS::::Sdd', ':ddSSSSdd:', '::dddddd::'])
      rect(g, 13, 34, 13, 40, 'U')
      rect(g, 18, 34, 18, 40, 'U')
      return
    case 'sweater':
      // A crew neck, a shirt collar peeking out, and a ribbed neckline
      stamp(g, 12, 31, ['UUSSSSUU'])
      rect(g, 12, 33, 19, 33, 'd')
      for (let x = 9; x <= 22; x += 3) rect(g, x, 38, x, 43, 'd')
      return
  }
}

// A hand holding something, the forearm running down and out to the frame's
// edge, as the chin's does. Outlined, since it crosses the collar and the
// jacket, and drawn before what it holds, so that sits in the hand. `x` is the
// hand's left edge; `left` is the other hand, the forearm running the other way
// The forearm runs out a pixel a row, as the fist's does, so it meets the
// shoulder at the frame's edge rather than ending in the middle of the chest;
// six wide, since a sleeve on the slant reads thinner than it is
const HOLDING_WIDTH = 28
const HOLDING = [
  ':KKKKK:',
  'KSSSSSK',
  'KSsSsSK',
  ':KSSSK:',
  ':KdddddK',
  ...Array.from({ length: 18 }, (_, i) => `${':'.repeat(i + 1)}KDDDDDDK`),
].map(row => row.padEnd(HOLDING_WIDTH, ':').slice(0, HOLDING_WIDTH))
function holding(g: Grid, x: number, y: number, left = false) {
  const was = part
  part = PART.hands
  stamp(g, left ? x - (HOLDING_WIDTH - 7) : x, y, HOLDING, left)
  part = was
}

// A mug of tea held in both hands, steam curling up from it
function cup(g: Grid, beat: number) {
  holding(g, 9, 35, true)
  holding(g, 17, 35)
  stamp(g, 12, 34, [':KKKKKK:', 'SSRYYRSS', 'SSRRRRSR', ':KRRRRK:'])
  const wisp = beat % 2 === 0 ? [[14, 33], [15, 32], [14, 31]] : [[16, 33], [15, 32], [16, 31]]
  for (const [x, y] of wisp) set(g, x!, y!, 'w')
}

// An onigiri held up to the mouth, a bite gone every few beats
function snack(g: Grid, beat: number) {
  const bites = beat % 6
  const rows = ['::O::', ':OOO:', 'OOOOO', 'ooooo', 'ooooo']
  if (bites >= 2) rows[0] = ':::::'
  if (bites >= 4) rows[1] = '::OO:'
  holding(g, 18, 25)
  stamp(g, 19, 22, rows)
}

// A glass of water: raised for a sip, then lowered to ask after yours
function water(g: Grid, beat: number) {
  const isSipping = beat % 4 < 2
  const glass = ['w::w', 'wZZw', 'wZZw', 'wZZw', 'wwww']
  if (isSipping) {
    holding(g, 17, 24)
    stamp(g, 18, 21, glass)
  } else {
    holding(g, 18, 31)
    stamp(g, 19, 28, glass)
  }
}

// A morning coffee, round and round every twelve seconds: held close while it
// steams, lifted to blow on, sipped, then lowered with a happy sigh
export const COFFEE_BEATS = 8
export function coffeeStep(beat: number): 'hold' | 'blow' | 'sip' | 'sigh' {
  const step = Math.floor(beat / 6) % COFFEE_BEATS
  return step === 2 ? 'blow' : step === 3 || step === 4 ? 'sip' : step === 5 ? 'sigh' : 'hold'
}

function coffee(g: Grid, beat: number) {
  const step = coffeeStep(beat)
  const curl = Math.floor(beat / 3) % 2
  if (step === 'sip') {
    // Tipped up to the lips in one hand, the handle out to the side
    holding(g, 16, 24)
    stamp(g, 16, 21, [':KKKK:::', 'KCCCCKKK', 'KCVVCK:K', 'KCCCCKKK', ':KKKK:::'])
    return
  }
  // In both hands, up under the chin to blow on it, or close at the chest
  const y = step === 'blow' ? 28 : 31
  holding(g, 9, y + 2, true)
  holding(g, 17, y + 2)
  stamp(g, 12, y, [':KKKKKK:', 'SKccccKS', 'SCCVVCCS', 'SCCCCCCS', ':KKKKKK:'])
  if (step === 'blow') {
    // The steam blown off to one side
    for (const [x, sy] of [[20, y - 1], [21, y - 2], [23, y - 2], [24, y - 3]] as const) set(g, x, sy, 'w')
    return
  }
  if (step === 'sigh') {
    // A little puff of contentment
    for (const [x, sy] of [[21, 22], [22, 21], [23, 22]] as const) set(g, x, sy, 'w')
  }
  // Steam curling up from it
  const wisp = curl === 0 ? [[14, y - 1], [15, y - 2], [14, y - 3], [17, y - 2], [18, y - 3]] : [[15, y - 1], [14, y - 2], [15, y - 3], [18, y - 2], [17, y - 3]]
  for (const [x, sy] of wisp) set(g, x!, sy!, 'w')
}

function arms(g: Grid, kind: ArmKind, beat = 0) {
  // A raised arm: up from the shoulder's corner, which lifts with it, to the
  // elbow at the edge of the frame, the forearm straight up, a cuff, and a
  // hand at the height of the face: open with the thumb in towards the head,
  // leaning out for the other half of a wave, or a fist punched up
  const HANDS = {
    in: [':SS:::::', 'SSSS::::', 'SSSSS:::', 'SSSs::::', 'sss:::::'],
    out: ['::SS::::', ':SSSS:::', ':SSSSS::', 'SSSs::::', 'sss:::::'],
    fist: ['KKKKK:::', 'SSSSK:::', 'SsSsK:::', 'SSSSK:::', 'sssK::::'],
  }
  const raised = (x: number, mirror: boolean, hand: keyof typeof HANDS = 'in') =>
    stamp(
      g,
      x,
      13,
      [
        ...HANDS[hand],
        'UUU:::::',
        'DDd:::::',
        'DDd:::::',
        'DDd:::::',
        'DDd:::::',
        'DDd:::::',
        'DDd:::::',
        'DDd:::::',
        'DDd:::::',
        'DDDd::::',
        'DDDD::::',
        'DDDDd:::',
        ':DDDDd::',
        ':DDDDDd:',
        ':DDDDDDd',
        ':DDDDDDD',
        '::DDDDDD',
      ],
      mirror,
    )
  switch (kind) {
    case 'down':
      return
    case 'wave':
    case 'waveB':
      raised(23, true, kind === 'waveB' ? 'out' : 'in')
      return
    case 'pump':
      // A fist punched up in the air
      raised(23, true, 'fist')
      return
    case 'cheer':
    case 'cheerB':
      raised(1, false, kind === 'cheerB' ? 'out' : 'in')
      raised(23, true, kind === 'cheerB' ? 'out' : 'in')
      return

    case 'typeA':
    case 'typeB': {
      // Hands at the bottom of the frame, tapping in turn
      const lift = kind === 'typeA' ? [0, 1] : [1, 0]
      rect(g, 8, 41 - lift[0]!, 11, 43, 'S')
      rect(g, 20, 41 - lift[1]!, 23, 43, 'S')
      return
    }
    case 'cheeks': {
      // Both hands on the cheeks, the forearms running down to the shoulders: oh no
      const side = [
        '::::KKKKK::',
        ':::KSSSSSK:',
        ':::KSSSSSK:',
        ':::KSsSsSK:',
        ':::KSSSSSK:',
        '::::KSSSK::',
        ':::KddddddK',
        ':::KDDDDDDK',
        '::KDDDDDDK:',
        '::KDDDDDDK:',
        ':KDDDDDDK::',
        ':KDDDDDDK::',
        'KDDDDDDK:::',
        'KDDDDDDK:::',
      ]
      stamp(g, 2, 20, side)
      stamp(g, 19, 20, side, true)
      return
    }

    case 'fanA':
    case 'fanB':
      // Fanning themselves in the heat, the hand flicking back and forth
      stamp(g, kind === 'fanA' ? 21 : 22, 18, ['SS', 'SS', 'DD', ':DD', '::DD', '::DD', ':::D'])
      return
    case 'cup':
      part = PART.held
      cup(g, beat)
      return
    case 'snack':
      part = PART.held
      snack(g, beat)
      return
    case 'water':
      part = PART.held
      water(g, beat)
      return
    case 'coffee':
      // Drawn over the collar, once the details are in
      return
    case 'hold':
      // Both hands up at the chest, holding something out to you
      rect(g, 7, 35, 9, 38, 'S')
      rect(g, 22, 35, 24, 38, 'S')
      return
    case 'fist':
      // A fist up at the chest, the forearm coming up from the elbow, low at
      // the side, out past the frame: you can do it
      stamp(g, 15, 29, [
        '::KKKKKK::',
        ':KSSSSSSK:',
        ':KSsSsSSK:',
        ':KSSSSSSK:',
        '::KSSSSK::',
        '::KddddddK',
        ':::KDDDDDDK',
        '::::KDDDDDDK',
        ':::::KDDDDDDK',
        '::::::KDDDDDDK',
        ':::::::KDDDDDDK',
        '::::::::KDDDDDDK',
        ':::::::::KDDDDDDK',
        '::::::::::KDDDDDDK',
        ':::::::::::KDDDDDDK',
      ])
      return
    case 'chin':
      // A hand up under the chin, the forearm running down to the frame's edge: smug.
      // Outlined, since it sits over the neck and the jacket
      stamp(g, 15, 26, [
        '::KKKK::::::',
        ':KSSSSK:::::',
        'KSSSSSSK::::',
        'KSsSsSSK::::',
        ':KSSSSK:::::',
        ':KddddK:::::',
        ':KDDDDK:::::',
        '::KDDDDK::::',
        '::KDDDDK::::',
        ':::KDDDDK:::',
        ':::KDDDDK:::',
        '::::KDDDDK::',
        '::::KDDDDK::',
        ':::::KDDDDK:',
        ':::::KDDDDK:',
        '::::::KDDDDK',
        '::::::KDDDDK',
        ':::::::KDDDD',
      ])
      return

  }
}

function hairBack(g: Grid, hair: Look['hair']) {
  if (hair === 'short') {
    // Close to the head, ending above the ears
    ellipse(g, FACE_X, 13, 10.5, 10, 'h')
    return
  }
  // Long hair falls past the shoulders; a bob stops at the jaw
  const end = hair === 'long' ? 37 : 29
  ellipse(g, FACE_X, 16, 11, hair === 'long' ? 12 : 11.5, 'h')
  for (let y = 16; y <= end; y++) {
    const taper = y > end - 4 ? y - (end - 4) : 0
    rect(g, 5 + taper, y, 9, y, 'h')
    rect(g, 22, y, 26 - taper, y, 'h')
  }
  // Behind the neck, so no gap shows under the jaw
  rect(g, 9, 22, 22, Math.min(31, end), 'h')
}

// Where the bangs end, column by column
function bangBottom(bangs: Look['bangs'], x: number): number {
  switch (bangs) {
    case 'swept':
      // Low on the left, rising to the right
      return Math.round(15 - (x - 9) * 0.45) + (x % 3 === 0 ? 1 : 0)
    case 'parted':
      // Parted in the middle, falling away to each side
      return Math.min(15, 10 + Math.round(Math.abs(x + 0.5 - FACE_X) * 0.6))
    case 'straight':
      return 14 + (x % 4 === 0 ? 1 : 0)
  }
}

function face(g: Grid, pose: Pose, look: Look) {
  // A long face: rounded above the cheekbones, then the jaw drawn row by row
  // so it tapers smoothly into a rounded chin
  part = PART.face
  ellipse(g, FACE_X, 17, 7, 9.5, 'S', (_x, y) => y < 22)
  const jaw = look.face === 'narrow' ? [6, 5, 4, 3, 2] : [6, 6, 5, 4, 3]
  jaw.forEach((half, i) => rect(g, FACE_X - half, 22 + i, FACE_X + half - 1, 22 + i, 'S'))
  // Hair over the top, the bangs letting the face show
  part = PART.hair
  ellipse(g, FACE_X, 11, 9.5, 7.5, 'H', (x, y) => x < 9 || x > 22 || y < bangBottom(look.bangs, x))
  // Locks framing the face; short hair has sideburns instead
  const lockEnd = look.hair === 'long' ? 28 : look.hair === 'bob' ? 26 : 18
  for (let y = 12; y <= lockEnd; y++) {
    set(g, 8, y, 'H')
    set(g, 23, y, 'H')
    if (look.hair !== 'short' && y < 24) set(g, 9, y, 'H')
    if (look.hair !== 'short' && y < 20) set(g, 22, y, 'H')
  }
  // The shine across the crown, a broken ring of light
  for (const [x, y] of [[9, 8], [10, 7], [11, 6], [12, 6], [13, 5], [14, 5], [17, 5], [18, 5], [19, 6], [20, 6], [21, 7]] as const) {
    if (g[y]?.[x] === 'H') set(g, x, y, 'L')
  }
  // Strands: darker lines running down through the bangs to their tips
  for (let x = 10; x <= 21; x += 3) {
    const tip = bangBottom(look.bangs, x)
    for (let y = tip - 3; y < tip; y++) if (g[y]?.[x] === 'H') set(g, x, y, 'h')
  }
  // The ahoge
  if (look.ahoge) {
    part = PART.head
    const strand = pose.ahoge === 0 ? [[16, 3], [17, 2], [18, 1]] : [[16, 3], [15, 2], [14, 1]]
    for (const [x, y] of strand) set(g, x!, y!, 'H')
  }
  // A hint of a nose
  part = PART.face
  set(g, 16, 21, 's')
  // Stubble along the jaw and chin
  if (look.facialHair === 'stubble') {
    for (let y = 22; y <= 27; y++) {
      for (let x = 9; x <= 22; x++) {
        const isMouth = x >= 13 && x <= 18 && y >= 22 && y <= 24
        if (g[y]?.[x] === 'S' && (x + y) % 3 === 0 && !isMouth && y >= 25) set(g, x, y, 't')
      }
    }
  }
}

// Each eye is 4 × 3, almond shaped; the left one is drawn, the right mirrored
function eye(kind: EyeKind, look: -1 | 0 | 1, right: boolean): string[] {
  // Gaze moves the iris across the eye white; mirrored eyes look the other way
  const o = 1 + (right ? -look : look)
  const iris = (row: string) => {
    const cells = ['w', 'w', 'w', 'w']
    ;[...row].forEach((c, i) => {
      if (o + i < 4) cells[o + i] = c
    })
    return cells.join('')
  }
  // A lash line, the pupil with a sparkle, the iris, and its glow above the lower lid
  const open = ['KKKK', iris('eW'), iris('WE'), iris('FF')]
  switch (kind) {
    case 'open':
    case 'soft':
      return open
    case 'blink':
      return ['::::', 'KKKK', '::::']
    case 'sleep':
      return ['::::', '::::', 'KKKK']
    case 'happy':
      return ['::::', ':KK:', 'K::K']
    case 'squeeze':
      return ['KK::', '::KK', 'KK::']
    case 'determined':
      return ['::::', 'KKKK', iris('Ee'), iris('FF')]
    case 'lidded':
      return ['::::', 'KKKK', iris('EE'), iris('FF')]
  }
}

// Brows say as much as the eyes: level, knit in focus, or raised with worry
function brow(kind: EyeKind, thick: boolean): string[] {
  if (thick) {
    // Heavier brows: each stroke a pixel wider
    return brow(kind, false).map(row => row.replace(/:h/g, 'hh').replace(/h:/g, 'hh'))
  }
  switch (kind) {
    case 'determined':
      return ['hh::', '::hh']
    case 'soft':
    case 'squeeze':
      return ['::hh', 'hh::']
    case 'happy':
      return [':hh:', 'h::h']
    default:
      return ['::::', 'hhhh']
  }
}

const MOUTHS: Record<MouthKind, string[]> = {
  smile: ['M::M', ':MM:'],
  open: [':MM:', ':mm:'],
  grin: ['MMMM', ':mm:'],
  wavy: ['M:M:', ':M:M'],
  flat: ['::::', ':MM:'],
  small: ['::::', ':M::'],
  // Up at one corner: a little smug
  smirk: [':::M', 'MMM:'],
  // Down at the corners: not happy about it
  frown: [':MM:', 'M::M'],
}

function details(g: Grid, pose: Pose, look: Look) {
  const thick = look.brows === 'thick'
  stamp(g, 11, 14, brow(pose.eyes, thick))
  stamp(g, 18, 14, brow(pose.eyes, thick), true)
  stamp(g, 11, 17, eye(pose.eyes, pose.look, false))
  stamp(g, 18, 17, eye(pose.eyes, pose.look, true), true)
  const isOpen = pose.eyes === 'open' || pose.eyes === 'soft' || pose.eyes === 'determined' || pose.eyes === 'lidded'
  // Lashes: a flick at each outer corner, and a touch below
  if (look.lashes && isOpen) {
    set(g, 10, 16, 'K')
    set(g, 22, 16, 'K')
    set(g, 10, 18, 'K')
    set(g, 22, 18, 'K')
  }
  // Glasses: light half-rims over each eye and a bridge between
  if (look.glasses) {
    stamp(g, 10, 16, ['xxxxxx', 'x::::x'])
    stamp(g, 17, 16, ['xxxxxx', 'x::::x'])
    set(g, 16, 16, 'x')
  }
  stamp(g, 14, 23, MOUTHS[pose.mouth])
  if (pose.blush) {
    rect(g, 10, 22, 12, 22, 'B')
    rect(g, 19, 22, 21, 22, 'B')
  }
  if (pose.sweat) stamp(g, 23, 12, [':Z', 'ZZ', 'ZZ'])
  if (pose.tear) stamp(g, 12, 21, ['Z', 'Z'])
  for (const extra of look.accessories) {
    // Small gold studs at the ears
    if (extra === 'earrings') {
      set(g, 8, 22, 'A')
      set(g, 23, 22, 'A')
    }
    // A fine chain and a pendant at the collar
    if (extra === 'necklace') {
      part = PART.outfit
      stamp(g, 14, 32, ['A::A', ':AA:', ':AA:'])
    }
  }
}

const CONFETTI = ['R', 'Y', 'Z', 'G', 'O', 'Y', 'R', 'Z']

// Bits of confetti drifting down through the empty space around them
function confetti(g: Grid, fall: number) {
  let placed = 0
  for (let i = 0; i < spread(120, g) && placed < spread(18, g); i++) {
    const x = (i * 13 + 5) % widthOf(g)
    const y = (i * 7 + fall * 2) % HEIGHT
    if (g[y]?.[x] === '.') {
      set(g, x, y, CONFETTI[i % CONFETTI.length]!)
      placed += 1
    }
  }
}

// Rain in thin slanting streaks, or snow drifting slowly, in the empty space
function precipitation(g: Grid, kind: 'rain' | 'snow', drift: number) {
  for (let i = 0; i < spread(16, g); i++) {
    const x = (i * 11 + 3 + (kind === 'rain' ? drift : 0)) % widthOf(g)
    const y = (i * 7 + drift * (kind === 'rain' ? 6 : 2)) % HEIGHT
    if (kind === 'snow') {
      const id = `snowflake:s${i}`
      if (g[y]?.[x] === '.' && !hiddenNow.includes(id)) {
        airPart(id)
        set(g, x, y, 'W')
        part = undefined
      }
    } else {
      // Two pixels of a streak, leaning with the wind
      if (g[y]?.[x] === '.') set(g, x, y, 'Z')
      if (g[y + 1]?.[x - 1] === '.') set(g, x - 1, y + 1, 'Z')
    }
  }
}

// What drifts past: petals, sparkles, fireflies, leaves, hearts, bats,
// lanterns, snowflakes or streamers, each a pixel or two
const AIR: Record<Air, { count: number; fall: number; shape: string[]; colors: string[] }> = {
  petals: { count: 10, fall: 3, shape: ['x'], colors: ['P'] },
  sparkles: { count: 7, fall: 0, shape: ['x'], colors: ['W'] },
  fireflies: { count: 7, fall: 0, shape: ['x'], colors: ['Y'] },
  leaves: { count: 10, fall: 3, shape: ['xx'], colors: ['Q', 'q'] },
  hearts: { count: 6, fall: 2, shape: ['x.x', '.x.'], colors: ['V'] },
  bats: { count: 5, fall: 1, shape: ['x.x', '.x.'], colors: ['b'] },
  lanterns: { count: 5, fall: 1, shape: ['Y', 'x', 'x'], colors: ['T'] },
  snowflakes: { count: 10, fall: 2, shape: ['x'], colors: ['W'] },
  streamers: { count: 12, fall: 4, shape: ['x'], colors: ['R', 'Y', 'Z', 'G'] },
  // Heat shimmer rises instead of falling
  heat: { count: 9, fall: -3, shape: ['x', '.', 'x'], colors: ['j'] },
}

// Stars and fireflies twinkle slowly: each dims for a second in every eight,
// each at its own moment, and never goes out
export const TWINKLE = 32
const DIMMED: Record<string, string> = { W: 'n', Y: 'y' }

function inAir(g: Grid, kind: Air, drift: number, most?: number, twinkle = 0, frame?: number) {
  const { fall, shape, colors } = AIR[kind]
  const count = spread(Math.min(AIR[kind].count, most ?? AIR[kind].count), g)
  const blinks = kind === 'sparkles' || kind === 'fireflies'
  let placed = 0
  // Try plenty of spots, keep a handful: most land behind them
  for (let i = 0; i < spread(80, g) && placed < count; i++) {
    const x = (i * 13 + 2 + (fall > 0 ? Math.floor(drift / 2) : 0)) % widthOf(g)
    const y = (((i * 7 + drift * fall) % HEIGHT) + HEIGHT) % HEIGHT
    // Now and then one of them is a rare one, for ten seconds or so
    const rare = RARE_SHAPES[kind]
    const window = Math.floor((frame ?? 0) / RARE_WINDOW)
    const isRareOne = rare !== undefined && (rareNow ? placed === 0 : lucky(i * 104729 + window, ODDS[rare.kind]))
    const drawn = isRareOne ? rare.shape : shape
    const fits = drawn.every((row, dy) => [...row].every((c, dx) => c === '.' || g[y + dy]?.[x + dx] === '.'))
    if (!fits) continue
    placed += 1
    const catchable = isRareOne ? rare.kind : CATCHES[kind]
    const id = isRareOne ? `${rare.kind}:${i}:${window}` : `${catchable}:${i}`
    // Caught: its place stays empty a while, so no other one takes it
    if (catchable !== undefined && hiddenNow.includes(id)) continue
    if (catchable !== undefined) airPart(id)
    const isDim = blinks && (twinkle + i * 11) % TWINKLE < 4
    const color = isDim ? (DIMMED[colors[i % colors.length]!] ?? colors[i % colors.length]!) : colors[i % colors.length]!
    drawn.forEach((row, dy) =>
      [...row].forEach((c, dx) => {
        if (c !== '.') set(g, x + dx, y + dy, c === 'x' ? color : c)
      }),
    )
    part = undefined
  }
}

// Leaves fall slowly, swaying side to side like a pendulum as they go: tipped
// toward the way they're swinging, flat for a moment at each end of the swing.
// Each has its own pace, place and colour, and slips behind them as it passes
const LEAF = {
  right: ['.xx', 'xxx', 'N..'],
  left: ['xx.', 'xxx', '..N'],
  flat: ['.xx.', 'Nxxx'],
}
const LEAF_COLORS = ['Q', 'q', 'J']
// Frames for a leaf to fall one pixel: three or four, a pixel a second or so
const LEAF_PACES = [3, 4]
// How far a leaf falls before it comes round again: off the bottom, back in at the top
const LEAF_ROWS = HEIGHT + 4
/** Every leaf is back where it started after this many frames, so it loops without a jump */
export const LEAF_CYCLE = LEAF_PACES.reduce((a, b) => a * b) * LEAF_ROWS
// One swing, there and back, in frames: twelve seconds, and a whole number of them in a loop
const SWING = 48
// Where each leaf falls: mostly down the open sides, a couple over their head
const LEAF_LANES = [1, 27, 2, 28, 12, 19]

// On a wider stage the portrait's lanes move with it to the middle, and more
// leaves fall down the open sides
function leafLanes(width: number): number[] {
  const margin = Math.floor((width - WIDTH) / 2)
  const sides = Math.floor((width - WIDTH) / 6)
  const extra = Array.from({ length: sides }, (_, k) => (k % 2 === 0 ? 1 + ((k * 5) % Math.max(1, margin - 3)) : width - 4 - ((k * 5) % Math.max(1, margin - 3))))
  return [...LEAF_LANES.map(lane => lane + margin), ...extra]
}

function fallingLeaves(g: Grid, frame: number, most?: number) {
  const width = widthOf(g)
  const lanes = leafLanes(width)
  const count = Math.min(lanes.length, most === undefined ? lanes.length : spread(most, g))
  for (let i = 0; i < count; i++) {
    const pace = LEAF_PACES[i % LEAF_PACES.length]!
    const fallen = i * 17 + Math.floor(frame / pace)
    const y = (fallen % LEAF_ROWS) - 3
    // Caught, it's gone until it comes round to the top again
    const round = Math.floor(fallen / LEAF_ROWS)
    // One in a few hundred falls golden
    const isGold = rareNow ? i === 0 : lucky(i * 7919 + round, ODDS.goldleaf)
    const id = `${isGold ? 'goldleaf' : 'leaf'}:${i}:${round}`
    if (hiddenNow.includes(id)) continue
    airPart(id)
    const phase = (2 * Math.PI * frame) / SWING + i * 1.7
    const heading = Math.cos(phase)
    const shape = heading > 0.35 ? LEAF.right : heading < -0.35 ? LEAF.left : LEAF.flat
    const size = shape[0]!.length
    const x = Math.max(0, Math.min(width - size, lanes[i]! + Math.round(1.5 * Math.sin(phase))))
    const color = isGold ? 'Y' : LEAF_COLORS[i % LEAF_COLORS.length]!
    shape.forEach((row, dy) =>
      [...row].forEach((c, dx) => {
        // Only in the empty space: behind them, never over them
        if (c !== '.' && g[y + dy]?.[x + dx] === '.') set(g, x + dx, y + dy, c === 'x' ? (isGold && dx === 1 && dy === 0 ? 'W' : color) : isGold ? 'J' : c)
      }),
    )
    part = undefined
  }
}

// A shooting star, now and then, under the stars or among the fireflies:
// streaking down across the top of the sky for four seconds, a bright head
// and a fading tail. Catch it before it's gone
const STAR_WINDOW = 30 * 4
const STAR_FLIGHT = 16
function shootingStar(g: Grid, frame: number) {
  const window = Math.floor(frame / STAR_WINDOW)
  const t = rareNow ? frame % STAR_FLIGHT : frame % STAR_WINDOW
  if (t >= STAR_FLIGHT || !(rareNow || lucky(window * 31337 + 7, ODDS.star))) return
  const width = widthOf(g)
  const x = 4 + ((window * 17) % Math.max(1, width - STAR_FLIGHT * 2)) + t * 2
  const y = 1 + Math.floor(t / 2)
  const id = `star:${window}`
  if (hiddenNow.includes(id)) return
  airPart(id)
  for (const [dx, dy, c] of [[0, 0, 'W'], [-1, 0, 'Y'], [-2, -1, 'Y'], [-3, -1, 'y'], [-4, -2, 'y']] as const) {
    if (g[y + dy]?.[x + dx] === '.') set(g, x + dx, y + dy, c)
  }
  part = undefined
}

// Wind: short gusts streaking across at a few heights
function gusts(g: Grid, drift: number) {
  for (const [row, speed] of [[4, 5], [12, 4], [21, 6], [30, 5], [39, 4]] as const) {
    for (const offset of [0, 17]) {
      const start = ((drift * speed + row * 7 + offset) % (widthOf(g) + 8)) - 4
      for (let x = start; x < start + 6; x++) if (g[row]?.[x] === '.') set(g, x, row, 'g')
    }
  }
}

// A storm: a bolt of lightning in the corner, now and then
function lightning(g: Grid, drift: number) {
  if (drift % 8 !== 0 && drift % 8 !== 1) return
  const bolt: [number, number][] = [[3, 1], [2, 2], [2, 3], [3, 4], [4, 5], [3, 6], [2, 7], [2, 8], [3, 9]]
  for (const [x, y] of bolt) if (g[y]?.[x] === '.') set(g, x, y, 'Y')
}

// Fog: mist drifting low across the frame
function mist(g: Grid, drift: number) {
  for (let y = 30; y < HEIGHT; y += 3) {
    for (let x = 0; x < widthOf(g); x++) if (g[y]?.[x] === '.' && (x + drift + y) % 5 < 2) set(g, x, y, 'g')
  }
}

// A dark line around everything, and a shade where the bangs meet the face
function outline(g: Grid) {
  const solid = (x: number, y: number) => g[y]?.[x] !== undefined && g[y]![x] !== '.'
  const edges: [number, number][] = []
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) edges.push([x, y])
    }
  }
  // An edge belongs to the part it outlines
  const near = (x: number, y: number) =>
    ([[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const).map(([nx, ny]) => parts?.[ny]?.[nx]).find(p => p !== undefined && p !== NONE)
  for (const [x, y] of edges) {
    part = near(x, y)
    set(g, x, y, 'K')
  }
  for (let y = 0; y < HEIGHT - 1; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (g[y]![x] === 'H' && g[y + 1]![x] === 'S') g[y]![x] = 'h'
    }
  }
}

// Each accessory's digits become characters of its own, so two worn at once
// never share a color
const own = (k: number, digit: string) => String.fromCharCode(0xe000 + k * 16 + Number(digit))

// Arms held up in front of the neck and chest, drawn over what's worn there
const IN_FRONT: readonly ArmKind[] = ['chin', 'fist', 'cup', 'snack', 'water', 'cheeks']

// The sprite for a pose in a look, with accessories on, one string of pixels a
// row. Later accessories go over earlier ones
export function sprite(
pose: Pose, look: Look, accessories: readonly Accessory[] = []): string[] {
  return spriteWithParts(pose, look, accessories).rows
}

/** The parts of them a click can land on */
export type Part = 'hair' | 'head' | 'face' | 'cheek' | 'outfit' | 'hands' | 'held'

// One character per part in the parts grid; worn things are their index in the list, '0' to '9'
const PART = { hair: 'r', head: 'p', face: 'f', cheek: 'k', outfit: 'o', hands: 'a', held: 'l' } as const satisfies Record<Part, string>
const NONE = '.'
const PART_NAMES: Record<string, Part> = Object.fromEntries(Object.entries(PART).map(([name, c]) => [c, name as Part]))

/** A sprite and what's under each pixel: `parts` as `rows` are, one character
 * a pixel, '.' for nothing; `names` says which part (or worn item's id) each is */
export type Sprite = { rows: string[]; parts: string[]; names: Record<string, string> }

// The top of the head, for a pat, and the cheeks, for a poke
const isCrown = (y: number) => y <= 9
const isCheek = (x: number, y: number) => y >= 20 && y <= 23 && ((x >= 9 && x <= 13) || (x >= 18 && x <= 22))

/** `stage`: how wide to draw, the portrait in the middle and what's in the
 * air across all of it; the portrait's own 32 when left out */
export function spriteWithParts(pose: Pose, look: Look, accessories: readonly Accessory[] = [], stage = WIDTH): Sprite {
  const g = blank()
  parts = blank()
  part = PART.hair
  hairBack(g, look.hair)
  shoulders(g, look.outfit)
  face(g, pose, look)
  // Hands held up in front go over a scarf or a pin; the rest go under
  const isInFront = IN_FRONT.includes(pose.arms)
  part = PART.hands
  if (!isInFront) arms(g, pose.arms, pose.beat)
  part = PART.face
  details(g, pose, look)
  // A mug held up close comes in front of the collar
  part = PART.held
  if (pose.arms === 'coffee') coffee(g, pose.beat)
  // The crown is for pats, the cheeks for pokes
  const drawn = parts
  drawn.forEach((row, y) =>
    row.forEach((p, x) => {
      if (p === PART.hair && isCrown(y)) row[x] = PART.head
      if (p === PART.face && isCheek(x, y)) row[x] = PART.cheek
    }),
  )
  const wear = (a: Accessory, k: number) => {
    part = String(k % 10)
    stamp(g, a.at.x, a.at.y, a.pixels.map(row => row.replace(/[1-9]/g, d => own(k, d))))
  }
  accessories.forEach((a, k) => a.sink === undefined && wear(a, k))
  if (isInFront) {
    part = PART.hands
    arms(g, pose.arms, pose.beat)
  }
  // A tall hat sits them lower, to make room above it: the bottom rows run off
  // the frame, and the hat goes on once they've moved
  const sink = Math.max(0, ...accessories.map(a => a.sink ?? 0))
  if (sink > 0) {
    for (const grid of [g, drawn]) {
      grid.splice(HEIGHT - sink, sink)
      grid.unshift(...blank().slice(0, sink))
    }
    accessories.forEach((a, k) => a.sink !== undefined && wear(a, k))
  }
  outline(g)
  // What's in the air is no part of them, but the things you can catch each are
  part = undefined
  // A hop lifts them two pixels, one terminal row. The bottom row carries on
  // down under them, so they still run off the frame's edge, not end above it
  const below = <T,>(rows: T[][]) => [...rows.slice(2), [...rows[HEIGHT - 1]!], [...rows[HEIGHT - 1]!]]
  const lifted = pose.hop === 1 ? below(g) : g
  const liftedParts = pose.hop === 1 ? below(drawn) : drawn
  // In the middle of a wider stage
  const left = Math.max(0, Math.floor((stage - WIDTH) / 2))
  const right = Math.max(0, stage - WIDTH - left)
  const widen = (grid: Grid) => (left + right === 0 ? grid : grid.map(row => [...Array<string>(left).fill('.'), ...row, ...Array<string>(right).fill('.')]))
  const rows = widen(lifted)
  const under = widen(liftedParts)
  parts = under
  airNames = {}
  hiddenNow = pose.hidden ?? []
  rareNow = pose.rare === true
  if (pose.confetti > 0) confetti(rows, pose.confetti)
  if (pose.weather) precipitation(rows, pose.weather, (pose.drift ?? 0) % 8)
  else if (pose.air === 'leaves') fallingLeaves(rows, pose.fall ?? 0, pose.airCount)
  else if (pose.air) inAir(rows, pose.air, (pose.drift ?? 0) % 8, pose.airCount, pose.fall ?? 0, pose.frame)
  // A clear night's sky, or a summer evening's: now and then a shooting star
  if (!pose.weather && (pose.air === 'sparkles' || pose.air === 'fireflies') && pose.frame !== undefined) shootingStar(rows, pose.frame)
  if (pose.wind) gusts(rows, pose.drift ?? 0)
  if (pose.storm) lightning(rows, pose.drift ?? 0)
  if (pose.fog) mist(rows, pose.drift ?? 0)
  parts = undefined
  const names: Record<string, string> = { ...PART_NAMES, ...airNames }
  airNames = {}
  hiddenNow = []
  rareNow = false
  accessories.forEach((a, k) => (names[String(k % 10)] = a.id))
  return { rows: rows.map(row => row.join('')), parts: under.map(row => row.join('')), names }
}

const DEFAULT = 0x01000000

function base64(bytes: Uint8Array): string {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += abc[(n >> 18) & 63]! + abc[(n >> 12) & 63]!
    out += i + 1 < bytes.length ? abc[(n >> 6) & 63]! : '='
    out += i + 2 < bytes.length ? abc[n & 63]! : '='
  }
  return out
}

// The smallest they're drawn, in columns: any smaller and they're clipped
export const SMALLEST = 8

// How many rows of pixels a sprite shrunk to this many columns has: even, for half blocks
export const shrunkHeight = (columns: number) =>
  columns >= WIDTH ? HEIGHT : Math.max(2, Math.round((HEIGHT * columns) / WIDTH / 2) * 2)

// A sprite shrunk to fit a narrow or short pane, every pixel the one nearest
// its middle in the full-size sprite, so they look the same, just smaller
export function shrink(rows: string[], columns: number): string[] {
  const width = rows[0]?.length ?? WIDTH
  if (columns >= width) return rows
  const height = shrunkHeight(columns)
  return Array.from({ length: height }, (_, y) => {
    const row = rows[Math.min(rows.length - 1, Math.floor(((y + 0.5) * rows.length) / height))]!
    return Array.from({ length: columns }, (_, x) => row[Math.floor(((x + 0.5) * width) / columns)] ?? '.').join('')
  })
}

// A sprite grown a whole number of times, each pixel a square of `by` pixels,
// so it stays crisp: pixel art grown by a fraction has pixels of two sizes
export function grow(rows: string[], by: number): string[] {
  if (by <= 1) return rows
  return rows.flatMap(row => {
    const wide = [...row].map(c => c.repeat(by)).join('')
    return Array.from({ length: by }, () => wide)
  })
}

// A Raster's cells for a sprite: each cell the pixel above as an upper half
// block's color and the pixel below as its background. See-through pixels
// show the terminal's own background, or `clear` when given (a page's paper)
export function cells(rows: string[], palette: Record<string, number>, clear?: number): string {
  const color = (c: string | undefined) => (c === undefined || c === '.' ? undefined : palette[c])
  const none = clear ?? DEFAULT
  const width = rows[0]?.length ?? WIDTH
  const words: number[] = []
  for (let y = 0; y < rows.length; y += 2) {
    for (let x = 0; x < width; x++) {
      const top = color(rows[y]![x])
      const bottom = color(rows[y + 1]?.[x])
      if (top === undefined && bottom === undefined) words.push(0x20, none, none)
      else if (top === undefined) words.push(0x2584, bottom!, none)
      else words.push(0x2580, top, bottom ?? none)
    }
  }
  return base64(new Uint8Array(Uint32Array.from(words).buffer))
}

// The same sprite as an SVG, for surfaces that draw pictures but not terminal
// cells (the desktop app, the editor, the phone): a square per pixel, runs of
// one color merged into one rectangle to keep it small
export function svgOf(rows: string[], palette: Record<string, number>, scale = 4): string {
  const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`
  const rects: string[] = []
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const c = row[x]!
      let end = x + 1
      while (end < row.length && row[end] === c) end++
      const color = c === '.' ? undefined : palette[c]
      if (color !== undefined) rects.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${hex(color)}"/>`)
      x = end
    }
  })
  const width = rows[0]?.length ?? WIDTH
  const w = width * scale
  const h = rows.length * scale
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${width} ${rows.length}" shape-rendering="crispEdges">${rects.join('')}</svg>`
}
