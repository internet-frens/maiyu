// Little scenes for special days, played one after another with the ✦ celebrate
// button: something they hold up or that floats beside them, animated a frame
// at a time, and a line. A character can say each their own way in
// `voice.scenes`, by the day's id, scene by scene

import type { Accessory, Air, ArmKind } from '../hooks/sprite'

export type Prop = {
  name: string
  /** Where its top-left pixel goes on the 32 × 44 portrait */
  at: { x: number; y: number }
  /** Frames of pixels, shown in turn: '1' to '9' are its own colors, ':' leaves what's there */
  frames: string[][]
  colors: Accessory['colors']
  /** Bobs a pixel up and down as it plays */
  bob?: boolean
}

export type Scene = {
  prop?: Prop
  /** How they hold themselves: holding it up at the chest by default */
  arms?: ArmKind
  air?: Air
  confetti?: boolean
  line: string
}

// The same rows again with some colors swapped: a flame flickering, a cursor blinking
const swap = (rows: string[], from: string, to: string) => rows.map(r => r.split(from).join(to))
const flicker = (rows: string[], from: string, to: string) => [rows, swap(rows, from, to)]

// Held up at the chest, centered between the hands
const held = (width: number, height: number) => ({ x: 16 - Math.ceil(width / 2), y: 40 - height })

const PUMPKIN_ROWS = [
  ':::::33:::::',
  '::11211211::',
  ':1141211411:',
  '114441144411',
  '111121121111',
  '114444444411',
  ':1144114411:',
  '::11211211::',
]
const PUMPKIN: Prop = {
  name: 'Carved pumpkin',
  at: held(12, 8),
  // The candle inside flickers
  frames: [PUMPKIN_ROWS, swap(PUMPKIN_ROWS, '4', '5'), PUMPKIN_ROWS, swap(PUMPKIN_ROWS, '4', '6')],
  colors: { '1': 0xf28c28, '2': 0xc4621a, '3': 0x4f7a2a, '4': 0xffd54a, '5': 0xfff2a8, '6': 0xe0a030 },
}

const GHOST: Prop = {
  name: 'Little ghost',
  at: { x: 1, y: 20 },
  frames: [['::111::', ':11111:', '1121211', '1121211', '1111111', '1113111', '1111111', '1:111:1']],
  colors: { '1': 0xf4f4f8, '2': 0x2b1d2e, '3': 0x2b1d2e },
  bob: true,
}

const CAULDRON_POT = [':3333333333:', '111111111111', ':2222222222:', '222222222222', '222222222222', ':2222222222:', '::2::::::2::']
const BUBBLES = ['::::4:::::::', '::4:::::4:::', ':::::::4::::']
const CAULDRON: Prop = {
  name: 'Bubbling cauldron',
  at: held(12, 10),
  // Bubbles rising off the brew
  frames: [0, 1, 2].map(k => [BUBBLES[k % 3]!, BUBBLES[(k + 1) % 3]!, BUBBLES[(k + 2) % 3]!, ...CAULDRON_POT]),
  colors: { '1': 0x4a4a5a, '2': 0x2f2f3c, '3': 0x7ad64a, '4': 0xb4f08a },
}

const presentOf = (box: number, ribbon: number): Prop => ({
  name: 'Present',
  at: held(10, 8),
  frames: [['::22::22::', ':::2222:::', '1111221111', '1111221111', '2222222222', '1111221111', '1111221111', '1111221111']],
  colors: { '1': box, '2': ribbon },
  // A little shake: what's inside?
  bob: true,
})

const STEAM = [':4:::4::::', '::4:::4:::']
const COCOA: Prop = {
  name: 'Hot cocoa',
  at: held(10, 8),
  frames: [0, 1].map(k => [STEAM[k]!, STEAM[1 - k]!, '13223231::', '111111111:', '11111111:1', '11111111:1', '111111111:', ':111111:::']),
  colors: { '1': 0xd7263d, '2': 0x7a4a2a, '3': 0xfafafa, '4': 0xe6ecff },
}

const SNOWMAN: Prop = {
  name: 'Snowman',
  at: { x: 0, y: 31 },
  frames: [['::555::', ':55555:', '::111::', ':12121:', ':11311:', ':44444:', '1111111', '1112111', '1111111', '1112111', ':11111:']],
  colors: { '1': 0xfafafa, '2': 0x2b1d2e, '3': 0xf28c28, '4': 0xd7263d, '5': 0x2b2d3a },
}

const CAKE_ROWS = ['::4::4::4::', '::3::3::3::', '::3::3::3::', '22222222222', '12121212121', '11111111111', '11111111111', '66666666666']
const CAKE: Prop = {
  name: 'Birthday cake',
  at: held(11, 8),
  // The candles flicker
  frames: [CAKE_ROWS, ['::5::4::5::', ...CAKE_ROWS.slice(1)], ['::4::5::4::', ...CAKE_ROWS.slice(1)]],
  colors: { '1': 0xffd1dc, '2': 0xfafafa, '3': 0x6fb8ff, '4': 0xffd54a, '5': 0xff8a3d, '6': 0xd0d6e0 },
}

// Floating up from a raised hand: the strings meet at the hand
const BALLOONS: Prop = {
  name: 'Balloons',
  at: { x: 25, y: 10 },
  frames: [['111::::', '111:222', ':1::222', ':4:::2:', '::4:4::', ':::4:::', ':::4:::']],
  colors: { '1': 0xff6f91, '2': 0x6fb8ff, '4': 0xd0d6e0 },
  bob: true,
}

const SPARKLER: Prop = {
  name: 'Sparkler',
  at: { x: 26, y: 9 },
  frames: [
    ['5:4:5', ':444:', '45545', ':444:', '5:4:5', '::2::', '::2::', '::2::', '::2::'],
    [':5:5:', '54445', ':454:', '54445', ':5:5:', '::2::', '::2::', '::2::', '::2::'],
  ],
  colors: { '2': 0x8a8a9a, '4': 0xffd54a, '5': 0xfff2a8 },
}

const HEART_BIG = [':111:111:', '112111111', '121111111', ':1111111:', '::11111::', ':::111:::', '::::1::::']
const HEART_SMALL = [':::::::::', '::11:11::', ':1211111:', '::11111::', ':::111:::', '::::1::::', ':::::::::']
const HEART: Prop = {
  name: 'Heart',
  at: held(9, 7),
  // A heartbeat
  frames: [HEART_BIG, HEART_BIG, HEART_SMALL],
  colors: { '1': 0xff4f7b, '2': 0xffd1dc },
}

const LETTER: Prop = {
  name: 'Letter',
  at: held(11, 7),
  frames: [['12111111121', '11211111211', '11121112111', '11113331111', '11111311111', '11111111111', '11111111111']],
  colors: { '1': 0xfaf3e6, '2': 0xd8c8b0, '3': 0xd7263d },
}

const BOUQUET: Prop = {
  name: 'Bouquet',
  at: held(9, 9),
  frames: [['::::1::::', ':2:161:3:', '262:1:363', ':2::4::3:', '::4:4:4::', ':::444:::', '::55555::', '::55555::', ':::555:::']],
  colors: { '1': 0xff6f91, '2': 0xff9ec7, '3': 0xb48cf0, '4': 0x5fbf6a, '5': 0xfafafa, '6': 0xfff2a8 },
}

const pieOf = (filling: number): Prop => ({
  name: 'Pie',
  at: held(10, 7),
  frames: [0, 1].map(k => [STEAM[k]!.replace(/4/g, '3'), ':11111111:', '1212121212', '1222222221', '1212121212', '1111111111', ':11111111:']),
  colors: { '1': 0xd9a03a, '2': filling, '3': 0xe6ecff },
})

const DIYA_BASE = ['11111111', ':121212:', '::1111::']
const DIYA: Prop = {
  name: 'Diya',
  at: held(8, 5),
  frames: [
    ['::::4:::', ':::454::', ...DIYA_BASE],
    [':::4::::', ':::545::', ...DIYA_BASE],
  ],
  colors: { '1': 0xc8652a, '2': 0xffd54a, '4': 0xffd54a, '5': 0xff8a3d },
}

const MENORAH_ROWS = ['::::::::4::::::::', '4:4:4:4:3:4:4:4:4', '3:3:3:3:3:3:3:3:3', '11111111111111111', '::::::::1::::::::', ':::::::111:::::::']
const MENORAH: Prop = {
  name: 'Menorah',
  at: held(17, 6),
  frames: flicker(MENORAH_ROWS, '4', '5'),
  colors: { '1': 0xd9b64a, '3': 0xa8d0ff, '4': 0xffd54a, '5': 0xfff2a8 },
}

const LANTERN_ROWS = [':::2:::', ':22222:', '1111111', '1131311', '1111111', ':22222:', ':::2:::', ':::3:::', '::3:3::']
const lanternOf = (body: number): Prop => ({
  name: 'Lantern',
  at: held(7, 9),
  frames: flicker(LANTERN_ROWS, '3', '1'),
  colors: { '1': body, '2': 0xffd54a, '3': 0xffb36b },
})

const RED_ENVELOPE: Prop = {
  name: 'Red envelope',
  at: held(8, 7),
  frames: [['11111111', '11122111', '11222211', '11122111', '11111111', '11111111', '11111111']],
  colors: { '1': 0xd7263d, '2': 0xffd54a },
  bob: true,
}

const CRESCENT: Prop = {
  name: 'Crescent moon',
  at: { x: 25, y: 3 },
  frames: [[':111:', '11:::', '1::::', '11:::', ':111:']],
  colors: { '1': 0xffd54a },
  bob: true,
}

const DUCK: Prop = {
  name: 'Rubber duck',
  at: held(9, 6),
  frames: [['::::111::', '::::11312', '1:::1111:', '11111111:', '11111111:', ':111111::']],
  colors: { '1': 0xffd54a, '2': 0xf28c28, '3': 0x2b1d2e },
  bob: true,
}

const SPROUT_POT = ['11111111', ':111111:', ':111111:', '::1111::']
const SPROUT: Prop = {
  name: 'Sprout',
  at: held(8, 8),
  // Growing a leaf
  frames: [
    ['::::::::', '::::::::', ':::4:44:', '::::4:::', ...SPROUT_POT],
    ['::44::::', '::::4:44', ':::44:4:', '::::4:::', ...SPROUT_POT],
  ],
  colors: { '1': 0xc8652a, '4': 0x5fbf6a },
}

const MARACAS: Prop = {
  name: 'Maracas',
  at: held(9, 5),
  frames: [
    [':11:::22:', '1111:2222', ':11:::22:', '::3:::3::', '::3:::3::'],
    ['11:::::22', '1111::222', '11::::22:', ':3:::::3:', '::3:::3::'],
  ],
  colors: { '1': 0xe63946, '2': 0x2a9d5c, '3': 0xd9a63a },
}

const LAPTOP_ROWS = ['1111111111', '1255525551', '1252555221', '1232222221', '1111111111', '4444444444']
const LAPTOP: Prop = {
  name: 'Laptop',
  at: held(10, 6),
  // The cursor blinking
  frames: flicker(LAPTOP_ROWS, '3', '2'),
  colors: { '1': 0x3a3f4a, '2': 0x1d2b3a, '3': 0x7ad68a, '4': 0x8a8f9a, '5': 0x6fb8ff },
}

const THANKSGIVING: Scene[] = [
  { prop: pieOf(0xe8833a), air: 'leaves', line: 'pumpkin pie, still warm! save me a slice ✧' },
  { prop: LETTER, air: 'leaves', line: 'a thank-you note: for you, and every bug we fixed ✧' },
]

export const SCENES: Record<string, Scene[]> = {
  birthday: [
    { prop: CAKE, line: 'I made a cake! make a wish with me? ✧' },
    { prop: presentOf(0x6fb8ff, 0xff9ec7), line: 'a present? for me? …can I open it now? ✧' },
    { prop: BALLOONS, arms: 'wave', air: 'streamers', line: 'balloons! one for each of us ✧' },
  ],
  anniversary: [
    { prop: HEART, air: 'hearts', line: 'remember the day we met? I do ♡' },
    { prop: LETTER, air: 'hearts', line: 'I wrote you something. thank you for every day since ♡' },
    { prop: BOUQUET, air: 'petals', line: "flowers, for us. here's to the next year ♡" },
  ],
  'new-year': [
    { arms: 'cheer', confetti: true, line: 'happy new year!! the countdown never gets old ✧' },
    { prop: SPARKLER, arms: 'wave', air: 'sparkles', line: 'a sparkler for a fresh start ✧' },
    { prop: LETTER, line: 'my resolution: more good days coding with you ✧' },
  ],
  'new-years-eve': [
    { prop: SPARKLER, arms: 'wave', air: 'sparkles', line: 'one more sparkler before midnight ✧' },
    { prop: COCOA, line: 'something warm while we wait for the countdown ✧' },
    { arms: 'cheer', confetti: true, line: 'three… two… one… almost! ✧' },
  ],
  'lunar-new-year': [
    { prop: RED_ENVELOPE, air: 'lanterns', line: 'a red envelope, for luck this year ✧' },
    { prop: lanternOf(0xd7263d), air: 'lanterns', line: 'the lanterns are up! everything glows ✧' },
  ],
  valentines: [
    { prop: HEART, air: 'hearts', line: 'this one is yours ♡' },
    { prop: BOUQUET, air: 'petals', line: 'flowers! I picked the brightest ones ♡' },
    { prop: LETTER, air: 'hearts', line: 'a card for you. open it later, okay? ♡' },
  ],
  'pi-day': [
    { prop: pieOf(0xc8452f), line: 'a pie for pi day. I cut it into very precise slices ✧' },
    { prop: LAPTOP, line: "let's see how many digits we can remember… 3.14159… ✧" },
  ],
  'eid-al-fitr': [
    { prop: CRESCENT, arms: 'wave', air: 'sparkles', line: 'the new moon is up. eid mubarak ✧' },
    { prop: lanternOf(0xd9a63a), air: 'lanterns', line: 'lanterns and sweets today. wishing you joy ✧' },
  ],
  'april-fools': [
    { prop: DUCK, line: 'meet our new senior engineer. he only says quack ✧' },
    { prop: presentOf(0x7ad68a, 0xffd54a), line: "it's a present! …or is it? ✧" },
  ],
  'earth-day': [
    { prop: SPROUT, air: 'petals', line: "I'm growing a sprout! look, a new leaf ✧" },
    { prop: BOUQUET, air: 'petals', line: 'wildflowers from outside. go get some air later? ✧' },
  ],
  'cinco-de-mayo': [
    { prop: MARACAS, air: 'streamers', line: 'shake, shake! a little music while we code ✧' },
    { arms: 'cheer', confetti: true, line: 'a bright, colorful day! ✧' },
  ],
  'programmers-day': [
    { prop: LAPTOP, air: 'streamers', line: 'day 256! every one of your commits counts ✧' },
    { prop: DUCK, line: "a rubber duck, for talking through bugs. it's a great listener ✧" },
    { prop: CAKE, air: 'streamers', line: 'a cake for you. eight candles, two to the eighth ✧' },
  ],
  'thanksgiving-ca': THANKSGIVING,
  'thanksgiving-us': THANKSGIVING,
  halloween: [
    { prop: PUMPKIN, air: 'bats', line: 'I carved a pumpkin! he looks friendly, right? ✧' },
    { prop: GHOST, arms: 'wave', air: 'bats', line: 'boo! …that was the ghost, not me ✧' },
    { prop: CAULDRON, air: 'bats', line: 'a little potion for bug-free code. it smells like coffee ✧' },
  ],
  diwali: [
    { prop: DIYA, air: 'fireflies', line: 'I lit a diya. may it light up your year ✧' },
    { prop: lanternOf(0xff8a3d), air: 'fireflies', line: 'lights everywhere tonight ✧' },
  ],
  hanukkah: [
    { prop: MENORAH, air: 'sparkles', line: 'another candle tonight. the light keeps growing ✧' },
    { prop: COCOA, line: 'something warm, and a quiet night of light ✧' },
  ],
  christmas: [
    { prop: presentOf(0xd7263d, 0xffd54a), air: 'snowflakes', line: 'I got you something! …more time coding together ✧' },
    { prop: COCOA, air: 'snowflakes', line: "hot cocoa with marshmallows. careful, it's hot ✧" },
    { prop: SNOWMAN, arms: 'wave', air: 'snowflakes', line: "I built a snowman! he's guarding the repo ✧" },
  ],
}

/** The prop on a frame, as something drawn on like an accessory */
export function propOn(prop: Prop, frame: number): Accessory {
  // Two ticks a frame, about two a second
  const k = Math.floor(frame / 2) % prop.frames.length
  const lift = prop.bob && Math.floor(frame / 3) % 2 === 1 ? -1 : 0
  return {
    id: `prop:${prop.name}:${k}:${lift}`,
    name: prop.name,
    kind: 'accessory',
    at: { x: prop.at.x, y: prop.at.y + lift },
    pixels: prop.frames[k]!,
    colors: prop.colors,
  }
}
