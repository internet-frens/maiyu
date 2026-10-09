import { expect, mock, test } from 'claude-code/testing'

import { DEFAULT } from '../characters/index'
import { SEASONAL } from '../hooks/seasons'
import { ITEMS } from '../achievements/items'
import { catchOf, spriteWithParts } from '../hooks/sprite'
import { KEEPSAKES, pictureCells, pixelColor, ribbon, sizeOf, washiTape } from '../hooks/decor'
import { BIG_COLUMNS, BIG_ICONS, BIG_ROWS, ICONS, ICON_COLUMNS, ICON_ROWS, bigCells, bigSvg, iconCells, iconSvg } from '../hooks/icons'
import { NO_JOURNAL, asJournal, caught, journalSections, journalText, journalVoice } from '../hooks/journal'
import type { Accessory, Pose } from '../hooks/sprite'
import { touchKind } from '../hooks/touch'
import { DEV } from '../hooks/dev'

const PANE = {
  plugin: 'maiyu',
  component: 'Pane',
  requestId: 'buddy',
  surface: 'terminal',
  viewport: { columns: 160, rows: 60 },
  props: { title: 'Ai-chan', isFocused: true, bodyColumns: 50, placement: 'dock', scroll: { offset: 0, bodyRows: 50 }, view: {} },
} as const

const T0 = new Date(2026, 9, 7, 15, 0).getTime()
// The pane is 50 columns: a stage of 49, the portrait 8 in from its left
const OFF = Math.floor((PANE.props.bodyColumns - 1 - 32) / 2)

const STILL: Pose = { eyes: 'open', look: 0, mouth: 'smile', arms: 'down', blush: false, sweat: false, ahoge: 0, tear: false, confetti: 0, hop: 0, beat: 0 }
const headphones = ITEMS.find(i => i.id === 'headphones') as Accessory
const scarf = SEASONAL.autumn as Accessory

const partAt = (s: ReturnType<typeof spriteWithParts>, x: number, y: number) => s.names[s.parts[y]![x]!]

test('each pixel knows what part of them it is', () => {
  const s = spriteWithParts({ ...STILL, blush: true }, DEFAULT.look, [scarf, headphones])
  expect(s.parts.length).toBe(s.rows.length)
  expect(partAt(s, 16, 6)).toBe('head')
  expect(partAt(s, 6, 25)).toBe('hair')
  expect(partAt(s, 10, 22)).toBe('cheek')
  expect(partAt(s, 16, 26)).toBe('face')
  expect(partAt(s, 4, 40)).toBe('outfit')
  // Worn things are their own parts: a headphone's cup, the scarf
  expect(partAt(s, 4, 14)).toBe('headphones')
  expect(partAt(s, 11, 28)).toBe('autumn')
  // Nothing around them
  expect(s.parts[0]![0]).toBe('.')
})

test("confetti and sparkles are no part of anything, so a click goes through them", () => {
  const plain = spriteWithParts(STILL, DEFAULT.look)
  const party = spriteWithParts({ ...STILL, confetti: 5, air: 'sparkles', drift: 3 }, DEFAULT.look)
  expect(party.rows).not.toEqual(plain.rows)
  expect(party.parts).toEqual(plain.parts)
})

test('a touch is what it lands on, until it is too much', () => {
  expect(touchKind('head', false, false)).toBe('head')
  expect(touchKind('face', false, false)).toBe('cheek')
  expect(touchKind('headphones', true, false)).toBe('worn')
  expect(touchKind('head', false, true)).toBe('tooMuch')
})

async function start($: any, on: any) {
  const clock = mock.clock(on, { now: T0 })
  on('session.start', () => ({ cwd: '/w' }))
  on('command.register', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  const saved = new Map<string, unknown>()
  on('store.get', ($: unknown, e: { key: string }) => ({ value: saved.get(e.key) }))
  on('store.set', ($: unknown, e: { key: string; value: unknown }) => {
    saved.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...saved.keys()] }))
  on('store.delete', ($: unknown, e: { key: string }) => {
    saved.delete(e.key)
    return { value: undefined }
  })
  on('ui.status', () => ({ value: undefined }))
  on('http.fetch', () => ({ value: { ok: false, status: 503, headers: {}, text: '' } }))
  on('session.id', () => ({ value: 'a' }))
  on('session.root', () => ({ value: '/w' }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: '', stderr: '' } }))
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/w' })
  return clock
}

const said = async ($: any, text: RegExp) => {
  const ui = await $.ui.mount(PANE)
  const found = await ui.find({ type: 'Text', text })
  await ui.unmount()
  return found
}

test('click the top of her head for a headpat', { timeoutMs: 30_000 }, async ($, on) => {
  await start($, on)
  await $.command.run({ command: 'frens', args: '' } as never)
  const ui = await $.ui.mount(PANE)
  // A press and release on the crown, in the portrait's cells
  await ui.pointer({ type: 'down', x: OFF + 16, y: 3, button: 'left', in: 'portrait' })
  await ui.pointer({ type: 'up', x: OFF + 16, y: 3, button: 'left', in: 'portrait' })
  expect(await ui.find({ type: 'Text', text: /headpats/ })).toBeDefined()
  // Pressed on one part and let go on another is no touch
  await ui.pointer({ type: 'down', x: OFF + 16, y: 3, button: 'left', in: 'portrait' })
  await ui.pointer({ type: 'up', x: 0, y: 0, button: 'left', in: 'portrait' })
  expect(await ui.find({ type: 'Text', text: /ahoge/ })).toBeUndefined()
  await ui.unmount()
})

test('five pokes in a row is too many, until things go quiet', { timeoutMs: 30_000 }, async ($, on) => {
  const clock = await start($, on)
  await $.command.run({ command: 'frens', args: '' } as never)
  const bondBefore = (await $.command.run({ command: 'frens', args: 'bond' } as never)).text
  const ui = await $.ui.mount(PANE)
  for (let i = 0; i < 5; i++) await ui.post({ touch: 'cheek' }, { in: 'portrait' })
  expect(await ui.find({ type: 'Text', text: /enough pokes/ })).toBeDefined()
  await ui.unmount()
  // Touching never adds to your bond
  expect((await $.command.run({ command: 'frens', args: 'bond' } as never)).text).toBe(bondBefore)

  await clock.advance(21_000)
  const poke = await $.command.run({ command: 'frens', args: 'poke' } as never)
  expect(poke.text).toMatch(/boop|button|sneak/)
})

test('what they wear answers by its name', { timeoutMs: 30_000 }, async ($, on) => {
  await start($, on)
  await $.command.run({ command: 'frens', args: 'wear headphones' } as never)
  const ui = await $.ui.mount(PANE)
  await ui.post({ touch: 'headphones' }, { in: 'portrait' })
  // Only if the headphones are unlocked are they worn; either way, never a bare placeholder
  expect(await ui.find({ type: 'Text', text: /\{item\}/ })).toBeUndefined()
  await ui.unmount()
})

test('a touch wakes them', { timeoutMs: 30_000 }, async ($, on) => {
  const clock = await start($, on)
  await $.command.run({ command: 'frens', args: '' } as never)
  for (let s = 0; s < 3 * 60; s += 10) await clock.advance(10_000)
  const poke = await $.command.run({ command: 'frens', args: 'poke' } as never)
  expect(poke.text).toMatch(/five more minutes|I'm awake/)
})

test("without a pointer, there's no pat button: /frens poke still reaches them", { timeoutMs: 30_000 }, async ($, on) => {
  await start($, on)
  await $.command.run({ command: 'frens', args: '' } as never)
  // The first time, they ask who you'd like: keep Ai-chan
  const first = await $.ui.mount(PANE)
  await first.press({ key: 'done' })
  await first.unmount()
  // The desktop draws a picture, with no portrait to click, and no pat button either
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Svg' })).toBeDefined()
  expect(await ui.find({ type: 'Client' })).toBeUndefined()
  expect(await ui.find({ key: 'pat' })).toBeUndefined()
  await ui.unmount()
  expect((await $.command.run({ command: 'frens', args: 'poke' } as never))?.text ?? '').not.toBe('')
})

test('a falling leaf is a thing of its own you can catch, and gone once caught', () => {
  const autumn: Pose = { ...STILL, air: 'leaves', fall: 40 }
  const s = spriteWithParts(autumn, DEFAULT.look)
  const leaves = [...new Set(Object.values(s.names).filter(n => n.startsWith('leaf:')))]
  expect(leaves.length > 0).toBe(true)
  expect(catchOf(leaves[0]!)).toBe('leaf')
  expect(catchOf('head')).toBeUndefined()
  // Every leaf pixel is in the open, never over them
  const plain = spriteWithParts(STILL, DEFAULT.look)
  s.parts.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (s.names[c]?.startsWith('leaf:')) expect(plain.parts[y]![x]).toBe('.')
    }),
  )
  // Caught: that one's gone, the others still fall
  const without = spriteWithParts({ ...autumn, hidden: [leaves[0]!] }, DEFAULT.look)
  expect(Object.values(without.names)).not.toContain(leaves[0])
  expect(Object.values(without.names).filter(n => n.startsWith('leaf:')).length).toBe(leaves.length - 1)
})

test('petals, snowflakes and fireflies can be caught too; sparkles and confetti cannot', () => {
  for (const [air, kind] of [['petals', 'petal'], ['snowflakes', 'snowflake'], ['fireflies', 'firefly']] as const) {
    const s = spriteWithParts({ ...STILL, air, drift: 2 }, DEFAULT.look)
    expect(Object.values(s.names).some(n => catchOf(n) === kind)).toBe(true)
  }
  const sparkles = spriteWithParts({ ...STILL, air: 'sparkles', confetti: 4 }, DEFAULT.look)
  expect(Object.values(sparkles.names).some(n => catchOf(n) !== undefined)).toBe(false)
})

test('the journal counts what you catch, in all and this season', () => {
  let j = caught(caught(NO_JOURNAL, 'leaf', '2026-autumn'), 'leaf', '2026-autumn')
  j = caught(j, 'leaf', '2025-autumn')
  j = caught(j, 'firefly', '2026-autumn')
  expect(j.caught).toEqual({ leaf: 3, '2026-autumn:leaf': 2, '2025-autumn:leaf': 1, firefly: 1, '2026-autumn:firefly': 1 })
  const text = journalText({ journal: j, specials: [], characters: [], moments: [], told: {}, days: {}, season: '2026-autumn' })
  expect(text).toMatch(/Caught in the air \(2 of 4\)/)
  expect(text).toMatch(/3 leaves \(2 this autumn\) · \?\?\? · \?\?\? · 1 firefly/)
  expect(asJournal(JSON.parse(JSON.stringify(j))).caught).toEqual(j.caught)
})

test('click a leaf as it falls: caught, and in the journal', { timeoutMs: 30_000 }, async ($, on) => {
  await start($, on)
  await $.command.run({ command: 'frens', args: '' } as never)
  const ui = await $.ui.mount(PANE)
  await ui.post({ touch: 'leaf:1:0' }, { in: 'portrait' })
  expect(await ui.find({ type: 'Text', text: /caught a leaf|red one|autumn loves you/ })).toBeDefined()
  // The same one again is already caught
  await ui.post({ touch: 'leaf:1:0' }, { in: 'portrait' })
  await ui.unmount()
  const journal = (await $.command.run({ command: 'frens', args: 'journal' } as never)).text
  expect(journal).toMatch(/Caught in the air \(1 of 4\)/)
  expect(journal).toMatch(/1 leaf/)
})

const portraitOf = async (ui: any) => (await ui.find({ key: 'portrait' }))?.props.props as { rows: string[]; names: Record<string, string> }

test('/frens preview autumn: leaves all the time, whatever the weather; off goes back', { timeoutMs: 30_000 }, async ($, on) => {
  if (!DEV) return
  await start($, on)
  await $.command.run({ command: 'frens', args: 'seasons off' } as never)
  const said = await $.command.run({ command: 'frens', args: 'preview autumn' } as never)
  expect(said.text).toMatch(/Previewing autumn/)
  let ui = await $.ui.mount(PANE)
  expect(Object.values((await portraitOf(ui)).names).some(n => n.startsWith('leaf:'))).toBe(true)
  await ui.unmount()
  await $.command.run({ command: 'frens', args: 'preview fireflies' } as never)
  ui = await $.ui.mount(PANE)
  expect(Object.values((await portraitOf(ui)).names).some(n => n.startsWith('firefly:'))).toBe(true)
  await ui.unmount()
  expect((await $.command.run({ command: 'frens', args: 'preview off' } as never)).text).toMatch(/back to today/)
  ui = await $.ui.mount(PANE)
  expect(Object.values((await portraitOf(ui)).names).some(n => n.includes(':'))).toBe(false)
  await ui.unmount()
})

test('a drag across the hair strokes it; across a cheek, squishes it', { timeoutMs: 30_000 }, async ($, on) => {
  await start($, on)
  await $.command.run({ command: 'frens', args: '' } as never)
  const ui = await $.ui.mount(PANE)
  const drag = async (cells: [number, number][]) => {
    await ui.pointer({ type: 'down', x: cells[0]![0], y: cells[0]![1], button: 'left', in: 'portrait' })
    for (const [x, y] of cells.slice(1)) await ui.pointer({ type: 'move', x, y, button: 'left', in: 'portrait' })
    const [x, y] = cells.at(-1)!
    await ui.pointer({ type: 'up', x, y, button: 'left', in: 'portrait' })
  }
  await drag([[OFF + 13, 3], [OFF + 14, 3], [OFF + 15, 3], [OFF + 16, 3], [OFF + 17, 3]])
  expect(await ui.find({ type: 'Text', text: /relaxing|sleepy|gentle/ })).toBeDefined()
  await drag([[OFF + 10, 10], [OFF + 11, 10], [OFF + 12, 10], [OFF + 13, 10]])
  expect(await ui.find({ type: 'Text', text: /cheeksh|mochi|squish attack/ })).toBeDefined()
  await ui.unmount()
})

test('a click on nothing leaves a sparkle that fades', { timeoutMs: 30_000 }, async ($, on) => {
  await start($, on)
  await $.command.run({ command: 'frens', args: '' } as never)
  const ui = await $.ui.mount(PANE)
  await ui.pointer({ type: 'down', x: 0, y: 0, button: 'left', in: 'portrait' })
  await ui.pointer({ type: 'up', x: 0, y: 0, button: 'left', in: 'portrait' })
  expect(await ui.find({ type: 'Text', text: /✦/, in: 'portrait' })).toBeDefined()
  await ui.advance(600)
  expect(await ui.find({ type: 'Text', text: /[✦✧⋆·]/, in: 'portrait' })).toBeUndefined()
  await ui.unmount()
})

test('now and then, their eyes follow your pointer', { timeoutMs: 30_000 }, async ($, on) => {
  const clock = await start($, on)
  await $.command.run({ command: 'frens', args: '' } as never)
  // Settled, eyes open (a happy face has its eyes shut)
  await clock.advance(4_000)
  const ui = await $.ui.mount(PANE)
  // The first time you come by, they look your way
  const before = (await portraitOf(ui)).rows
  await ui.post({ look: 1 }, { in: 'portrait' })
  await ui.redraw()
  expect((await portraitOf(ui)).rows).not.toEqual(before)
  await ui.post({ look: null }, { in: 'portrait' })
  // Gone a while and back: not every time
  await clock.advance(15_000)
  await ui.redraw()
  const again = (await portraitOf(ui)).rows
  await ui.post({ look: 1 }, { in: 'portrait' })
  await ui.redraw()
  expect((await portraitOf(ui)).rows).toEqual(again)
  await ui.unmount()
})

test('a sparkle fades at its own pace, however often the portrait is drawn', { timeoutMs: 30_000 }, async ($, on) => {
  const clock = await start($, on)
  await $.command.run({ command: 'frens', args: '' } as never)
  const ui = await $.ui.mount(PANE)
  // The plugin draws the portrait again every tick, before and after the click
  for (let i = 0; i < 8; i++) {
    await clock.advance(250)
    await ui.redraw()
  }
  await ui.pointer({ type: 'down', x: 0, y: 0, button: 'left', in: 'portrait' })
  await ui.pointer({ type: 'up', x: 0, y: 0, button: 'left', in: 'portrait' })
  await ui.advance(130)
  expect(await ui.find({ type: 'Text', text: /✧/, in: 'portrait' })).toBeDefined()
  await ui.unmount()
})

test('on a wider stage the portrait sits in the middle, with things in the air all across it', () => {
  const narrow = spriteWithParts({ ...STILL, air: 'petals', drift: 1 }, DEFAULT.look)
  const wide = spriteWithParts({ ...STILL, air: 'petals', drift: 1 }, DEFAULT.look, [], 70)
  expect(wide.rows.every(r => r.length === 70)).toBe(true)
  expect(wide.parts.every(r => r.length === 70)).toBe(true)
  // The same portrait, 19 columns in
  const body = (s: typeof narrow, from: number) => s.parts.map(r => r.slice(from, from + 32).replace(/[^rpfkoal0-9.]/g, '.'))
  expect(body(wide, 19)).toEqual(body(narrow, 0))
  // Petals out at the sides, and more of them
  const petals = (s: typeof narrow) => Object.values(s.names).filter(n => n.startsWith('petal:'))
  expect(petals(wide).length > petals(narrow).length).toBe(true)
  expect(wide.parts.some(r => [...r.slice(0, 19)].some(c => wide.names[c]?.startsWith('petal:')))).toBe(true)
  // Leaves too, down the open sides
  const leaves = spriteWithParts({ ...STILL, air: 'leaves', fall: 30 }, DEFAULT.look, [], 70)
  expect(Object.values(leaves.names).filter(n => n.startsWith('leaf:')).length > 6).toBe(true)
})

test('rare ones: a golden leaf, a blossom, a crystal, a shooting star, each there at once in a preview', () => {
  const named = (pose: Pose) => Object.values(spriteWithParts(pose, DEFAULT.look, [], 60).names)
  expect(named({ ...STILL, air: 'leaves', fall: 30, rare: true }).some(n => n.startsWith('goldleaf:'))).toBe(true)
  expect(named({ ...STILL, air: 'petals', frame: 5, rare: true }).some(n => n.startsWith('blossom:'))).toBe(true)
  expect(named({ ...STILL, air: 'snowflakes', frame: 5, rare: true }).some(n => n.startsWith('crystal:'))).toBe(true)
  expect(named({ ...STILL, air: 'sparkles', frame: 5, rare: true }).some(n => n.startsWith('star:'))).toBe(true)
  expect(catchOf('goldleaf:0:3')).toBe('goldleaf')
})

test('left to chance, the rare ones are rare, but they do come', () => {
  let blossoms = 0
  let petals = 0
  for (let frame = 0; frame < 40 * 600; frame += 40) {
    const names = Object.values(spriteWithParts({ ...STILL, air: 'petals', drift: frame % 8, frame }, DEFAULT.look, [], 60).names)
    blossoms += names.filter(n => n.startsWith('blossom:')).length
    petals += names.filter(n => n.startsWith('petal:')).length
  }
  expect(blossoms > 0).toBe(true)
  expect(blossoms / petals < 0.01).toBe(true)
  let stars = 0
  for (let frame = 0; frame < 30 * 4 * 200; frame += 30 * 4) {
    if (Object.values(spriteWithParts({ ...STILL, air: 'sparkles', frame }, DEFAULT.look, [], 60).names).some(n => n.startsWith('star:'))) stars++
  }
  expect(stars > 0 && stars < 60).toBe(true)
})

test('a shooting star streaks across', () => {
  const headOf = (frame: number) => {
    const s = spriteWithParts({ ...STILL, air: 'sparkles', frame, rare: true }, DEFAULT.look, [], 60)
    const y = s.rows.findIndex((row, y) => [...row].some((c, x) => c === 'W' && s.names[s.parts[y]![x]!]?.startsWith('star:')))
    return [s.rows[y]!.split('').findIndex((c, x) => c === 'W' && s.names[s.parts[y]![x]!]?.startsWith('star:')), y]
  }
  const [x0] = headOf(2)
  const [x1] = headOf(6)
  expect(x1! > x0!).toBe(true)
})

test('catch a golden leaf: a celebration, and a rare find in the journal', { timeoutMs: 30_000 }, async ($, on) => {
  await start($, on)
  await $.command.run({ command: 'frens', args: '' } as never)
  const ui = await $.ui.mount(PANE)
  await ui.post({ touch: 'goldleaf:0:3' }, { in: 'portrait' })
  expect(await ui.find({ type: 'Text', text: /GOLDEN|shining/ })).toBeDefined()
  await ui.unmount()
  const journal = (await $.command.run({ command: 'frens', args: 'journal' } as never)).text
  expect(journal).toMatch(/Rare finds \(1 of 4\)/)
  expect(journal).toMatch(/✦ golden leaf · \?\?\?/)
  expect(journal).toMatch(/Caught in the air \(0 of 4\)/)
})

test('/frens preview golden-leaf: one falls at once', { timeoutMs: 30_000 }, async ($, on) => {
  if (!DEV) return
  await start($, on)
  expect((await $.command.run({ command: 'frens', args: 'preview golden-leaf' } as never)).text).toMatch(/Previewing golden leaf/)
  const ui = await $.ui.mount(PANE)
  expect(Object.values((await portraitOf(ui)).names).some(n => n.startsWith('goldleaf:'))).toBe(true)
  await ui.unmount()
})

test('a typo gets a guess at what you meant, not the pane', async ($, on) => {
  await start($, on)
  const typo = await $.command.run({ command: 'frens', args: 'wether berlin' } as never)
  expect(typo.text).toBe('No /frens wether. Did you mean /frens weather berlin? /frens help lists them all.')
  expect((await $.command.run({ command: 'frens', args: 'xyzzy' } as never)).text).toBe('No /frens xyzzy. /frens help lists them all.')
  expect((await $.command.run({ command: 'frens', args: 'jornal' } as never)).text).toMatch(/Did you mean \/frens journal\?/)
  // Nothing at all still opens it
  expect((await $.command.run({ command: 'frens', args: '' } as never)).text).toMatch(/is here/)
})

test('a preview is named as you asked for it', async ($, on) => {
  if (!DEV) return
  await start($, on)
  expect((await $.command.run({ command: 'frens', args: 'preview crystal' } as never)).text).toMatch(/^Previewing crystal,/)
  expect((await $.command.run({ command: 'frens', args: 'preview' } as never)).text).toMatch(/^Previewing crystal;/)
  expect((await $.command.run({ command: 'frens', args: 'preview golden-leaf' } as never)).text).toMatch(/^Previewing golden leaf,/)
})

test('the journal opens in the pane, from its button or /frens journal', { timeoutMs: 30_000 }, async ($, on) => {
  await start($, on)
  await $.command.run({ command: 'frens', args: '' } as never)
  const first = await $.ui.mount(PANE)
  await first.press({ key: 'done' })
  await first.unmount()

  let ui = await $.ui.mount(PANE)
  await ui.post({ touch: 'leaf:1:0' }, { in: 'portrait' })
  await ui.press({ key: 'journal' })
  // One clean page, all of it at once: a line of stamps for each kind, the moments, a word from them, signed
  expect(await ui.find({ type: 'Text', text: /Our Journal/ })).toBeDefined()
  // The title on a pixel-art ribbon, a pressed keepsake for the season, and no photo
  expect(await ui.find({ type: 'Text', text: /^Our Journal$/ })).toBeDefined()
  expect((await ui.find({ key: 'ribbon' }))?.type).toBe('Raster')
  expect((await ui.find({ key: 'keepsake' }))?.type).toBe('Raster')
  expect(await ui.find({ key: 'polaroid' })).toBeUndefined()
  // Washi tape across the top right corner
  expect((await ui.find({ key: 'tape' }))?.type).toBe('Raster')
  expect(await ui.find({ type: 'Text', text: /October · autumn/ })).toBeDefined()
  // Only what's been found: the one leaf on its shelf, and nothing greyed out for the rest
  expect(await ui.find({ type: 'Text', text: /^in the air$/ })).toBeDefined()
  expect((await ui.find({ key: 'shelf-leaf' }))?.type).toBe('Raster')
  expect((await ui.find({ key: 'shelf-leaf' }))?.props.columns).toBe(8)
  expect(await ui.find({ key: 'shelf-petal' })).toBeUndefined()
  expect(await ui.find({ key: 'shelf-storm' })).toBeUndefined()
  for (const label of ['rare finds', 'weather', 'work', 'special days']) {
    expect(await ui.find({ type: 'Text', text: new RegExp(`^${label}$`) })).toBeUndefined()
  }
  expect(await ui.find({ type: 'Text', text: /^·$/ })).toBeUndefined()
  // The moments say what they are: none met yet in a new journal, so all three still to meet
  expect(await ui.find({ type: 'Text', text: /^moments$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^3 still to meet$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /1 thing found so far/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /— Ai-chan ♡/ })).toBeDefined()
  // Nothing to open or fold: no section buttons, no counts or bars
  expect(await ui.find({ key: 'section-0' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /\d+\/\d+/ })).toBeUndefined()
  // Done puts the buttons back
  await ui.press({ key: 'done' })
  expect(await ui.find({ type: 'Text', text: /Our Journal/ })).toBeUndefined()
  expect(await ui.find({ key: 'hi' })).toBeDefined()
  await ui.unmount()

  // The command opens it there too, and still answers in words
  const said = await $.command.run({ command: 'frens', args: 'journal' } as never)
  expect(said.text).toMatch(/Caught in the air \(1 of 4\)/)
  ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /Our Journal/ })).toBeDefined()
  await ui.unmount()
})

test('a word from them at the foot of the journal, in their own voice', () => {
  const facts = (journal: typeof NO_JOURNAL) => ({ journal, specials: [], characters: [], moments: [], told: {}, days: {}, season: '2026-autumn' })
  const empty = journalSections(facts(NO_JOURNAL))
  expect(journalVoice(empty, 'cheerful')).toBe("a fresh page! let's fill it together ✧")
  expect(journalVoice(empty, 'sassy')).toBe('empty. for now.')
  expect(journalVoice(empty, 'quiet')).toBe('…a blank page.')
  let j = NO_JOURNAL
  for (let i = 0; i < 7; i++) j = caught(j, 'leaf', '2026-autumn')
  j = caught(caught(j, 'goldleaf', '2026-autumn'), 'goldleaf', '2026-autumn')
  const some = journalSections(facts(j))
  expect(journalVoice(some, 'cheerful')).toBe('7 leaves and a golden leaf! so much left to find ✧')
  expect(journalVoice(some, 'sassy')).toBe('a golden leaf, huh. not bad. keep going.')
  expect(journalVoice(some, 'quiet')).toBe('…a good start.')
  expect(journalVoice(journalSections(facts(caught(NO_JOURNAL, 'petal', '2026-spring'))), 'cheerful')).toBe('1 thing found so far! so much left to find ✧')
})

test('every journal icon is a whole 6 × 6 picture in its own colours, as cells and as SVG', () => {
  for (const [id, icon] of Object.entries(ICONS)) {
    expect(icon.pixels.length).toBe(ICON_ROWS * 2)
    for (const row of icon.pixels) {
      expect(row.length).toBe(ICON_COLUMNS)
      for (const ch of row) expect(ch === '.' || icon.colors[ch] !== undefined).toBe(true)
    }
    expect(atob(iconCells(id, 0xf4ead5)!).length).toBe(ICON_COLUMNS * ICON_ROWS * 12)
    expect(iconSvg(id)).toMatch(/^<svg [^>]*viewBox="0 0 6 6"/)
  }
  // One for each thing to catch, and for each kind of weather
  for (const id of ['leaf', 'petal', 'snowflake', 'firefly', 'goldleaf', 'blossom', 'crystal', 'star', 'clear', 'cloudy', 'fog', 'drizzle', 'rain', 'snow', 'storm']) {
    expect(ICONS[id]).toBeDefined()
  }
})

test('golden leaves are rare: about one leaf in a thousand', () => {
  let gold = 0
  let leaves = 0
  for (let fall = 0; fall < 40_000; fall += 37) {
    const names = Object.values(spriteWithParts({ ...STILL, air: 'leaves', fall }, DEFAULT.look, [], 70).names)
    gold += new Set(names.filter(n => n.startsWith('goldleaf:'))).size
    leaves += new Set(names.filter(n => n.startsWith('leaf:') || n.startsWith('goldleaf:'))).size
  }
  expect(gold / leaves < 1 / 400).toBe(true)
})

test("what's caught in a preview doesn't go in the journal", { timeoutMs: 30_000 }, async ($, on) => {
  if (!DEV) return
  await start($, on)
  await $.command.run({ command: 'frens', args: 'preview golden-leaf' } as never)
  const ui = await $.ui.mount(PANE)
  await ui.post({ touch: 'goldleaf:0:3' }, { in: 'portrait' })
  // They still react
  expect(await ui.find({ type: 'Text', text: /GOLDEN|shining/ })).toBeDefined()
  await ui.unmount()
  expect((await $.command.run({ command: 'frens', args: 'journal' } as never)).text).toMatch(/Rare finds \(0 of 4\)/)
  await $.command.run({ command: 'frens', args: 'preview off' } as never)
})

test('the shelf icons: each a whole 8 × 8 picture, and a silhouette in one colour for what is still to find', () => {
  const paper = 0xf4ead5
  const silhouette = 0xdccdb0
  // Each cell's foreground and background colours, from a Raster's packed cells
  const coloursOf = (b64: string) => {
    const bytes = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0))
    const words = new Uint32Array(bytes.buffer)
    const out = new Set<number>()
    for (let k = 0; k < words.length; k += 3) {
      if (words[k] !== 0x20) out.add(words[k + 1]!)
      out.add(words[k + 2]!)
    }
    return out
  }
  for (const [id, icon] of Object.entries(BIG_ICONS)) {
    expect(icon.pixels.length).toBe(BIG_ROWS * 2)
    for (const row of icon.pixels) {
      expect(row.length).toBe(BIG_COLUMNS)
      for (const ch of row) expect(ch === '.' || icon.colors[ch] !== undefined).toBe(true)
    }
    expect(atob(bigCells(id, paper)!).length).toBe(BIG_COLUMNS * BIG_ROWS * 12)
    expect([...coloursOf(bigCells(id, paper, silhouette)!)].every(c => c === paper || c === silhouette)).toBe(true)
    expect([...coloursOf(bigCells(id, paper)!)].some(c => c !== paper && c !== silhouette)).toBe(true)
    expect(bigSvg(id, silhouette)).toMatch(/^<svg [^>]*viewBox="0 0 8 8"/)
  }
  // The same set as the small icons: everything to catch, and each kind of weather
  expect(Object.keys(BIG_ICONS).sort()).toEqual(Object.keys(ICONS).sort())
})

test('a pressed keepsake for every season, 8 × 8 in its own colours', () => {
  for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
    const k = KEEPSAKES[season]
    expect(k.rows.length).toBe(8)
    for (const row of k.rows) {
      expect(row.length).toBe(8)
      for (const ch of row) expect(ch === '.' || k.colors[ch] !== undefined).toBe(true)
    }
    expect(sizeOf(k)).toEqual({ columns: 8, rows: 4 })
    expect(atob(pictureCells(k, 0xf4ead5)).length).toBe(8 * 4 * 12)
  }
})

test('washi tape in their colour, striped a shade lighter, with ragged ends', () => {
  const tape = washiTape(0xff7eb6)
  expect(tape.rows.length % 2).toBe(0)
  expect(new Set(tape.rows.map(r => r.length)).size).toBe(1)
  expect(tape.colors['1']).toBe(0xff7eb6)
  expect(tape.rows.join('')).toMatch(/2/)
  // Ragged: the first and last rows are shorter than the middle
  const width = (r: string) => r.replace(/\./g, '').length
  expect(width(tape.rows[0]!)).toBeLessThan(width(tape.rows[3]!))
})

test('the ribbon fits its title, forked tails at both ends; its colour is one the pixels draw exactly', () => {
  const r = ribbon(11, 0xcc6699)
  expect(sizeOf(r)).toEqual({ columns: 11 + 4 + 8, rows: 3 })
  // The band's middle row, where the title sits, is all band colour from column 4 to the end of the band
  expect(r.rows[2]!.slice(4, 4 + 15)).toBe('A'.repeat(15))
  expect(r.rows[3]!.slice(4, 4 + 15)).toBe('A'.repeat(15))
  // Forked: the tails' outer ends are notched
  expect(r.rows[3]![0]).toBe('.')
  expect(r.rows[2]![0]).toBe('T')
  expect(pixelColor(0xf4ead5)).toBe(0xeeeedd)
  expect(pixelColor(0xffeedd)).toBe(0xffeedd)
})
