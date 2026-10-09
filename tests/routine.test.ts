import { expect, mock, test } from 'claude-code/testing'

import { coffeeTime, mealtime } from '../hooks/routine'
import { coffeeStep } from '../hooks/sprite'

const PANE = {
  plugin: 'maiyu',
  component: 'Pane',
  requestId: 'buddy',
  surface: 'terminal',
  viewport: { columns: 160, rows: 60 },
  props: {
    title: 'Buddy',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 50 },
    view: {},
  },
} as const

// A time today at a local hour
const at = (hour: number, minute = 0) => new Date(2026, 9, 7, hour, minute).getTime()
const onHalloween = (hour: number) => new Date(2026, 9, 31, hour).getTime()

test('knows when meals are', () => {
  expect(mealtime(at(12, 30))).toEqual({ key: '2026-10-7:lunch', name: 'lunch' })
  expect(mealtime(at(8, 5))?.name).toBe('breakfast')
  expect(mealtime(at(18, 59))?.name).toBe('dinner')
  expect(mealtime(at(15))).toBeUndefined()
})

test('one coffee a morning, at its own time each day between half nine and noon', () => {
  expect(coffeeTime(at(9))).toBeUndefined()
  expect(coffeeTime(at(11, 45))).toBe('2026-10-7:coffee')
  expect(coffeeTime(at(12))).toBeUndefined()
  expect(coffeeTime(at(15))).toBeUndefined()
  // Not always on the dot: the first minute it's time differs from day to day
  const firstMinute = (day: number) => {
    for (let m = 9 * 60 + 30; m < 12 * 60; m++) if (coffeeTime(new Date(2026, 9, day, 0, m).getTime())) return m
  }
  const starts = new Set([1, 2, 3, 4, 5, 6, 7].map(firstMinute))
  expect(starts.size > 1).toBe(true)
  for (const m of starts) expect(m! >= 9 * 60 + 30 && m! < 11 * 60 + 30).toBe(true)
})

test('the coffee goes round: held, blown on, sipped, a happy sigh', () => {
  const steps = Array.from({ length: 8 }, (_, k) => coffeeStep(k * 6))
  expect(steps).toEqual(['hold', 'hold', 'blow', 'sip', 'sip', 'sigh', 'hold', 'hold'])
})

async function start($: any, on: any, now: number) {
  const clock = mock.clock(on, { now })
  on('session.start', () => ({ cwd: '/w' }))
  on('command.register', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/w' })
  return clock
}

test('at lunch she grabs a bite once, then comes back', async ($, on) => {
  const clock = await start($, on, at(12, 10))
  await clock.advance(61_000)
  let ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /lunch time! grabbing a bite/ })).toBeDefined()
  await ui.unmount()

  // Three minutes later she's back, and she doesn't eat lunch twice
  await clock.advance(3 * 60_000 + 1000)
  ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /back! all refreshed/ })).toBeDefined()
  await ui.unmount()
  await clock.advance(60_000)
  ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /grabbing a bite/ })).toBeUndefined()
})

test('mid-morning, while you are around, she has a coffee once', async ($, on) => {
  on('prompt.edit', () => ({ text: 'hi', cursor: 2 }) as never)
  const clock = await start($, on, at(11, 35))
  await ($.prompt as any).edit({ origin: { kind: 'composer' }, text: 'h', cursor: 1, start: 1, end: 1, inputText: 'i' })
  // Once the good morning has been said
  await clock.advance(61_000)
  await clock.advance(60_000)
  let ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /coffee|\*sips\*/ })).toBeDefined()
  await ui.unmount()

  // Two minutes on she's back, and doesn't have a second one
  for (let k = 0; k < 3; k++) await clock.advance(60_000)
  ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /back! all refreshed/ })).toBeDefined()
  await ui.unmount()
})

test('no coffee with time of day off', async ($, on) => {
  on('prompt.edit', () => ({ text: 'hi', cursor: 2 }) as never)
  const store = new Map<string, unknown>()
  on('store.get', (_$: unknown, e: { key: string }) => ({ value: store.get(e.key) }))
  on('store.set', (_$: unknown, e: { key: string; value: unknown }) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  const clock = await start($, on, at(11, 35))
  await $.command.run({ command: 'frens', args: 'daytime off' } as never)
  await ($.prompt as any).edit({ origin: { kind: 'composer' }, text: 'h', cursor: 1, start: 1, end: 1, inputText: 'i' })
  await clock.advance(61_000)
  await clock.advance(60_000)
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /coffee|\*sips\*/ })).toBeUndefined()
})

test('after a long stretch of work she takes a tea break, and work calls her back', async ($, on) => {
  on('tool.call', () => ({ result: 'ok' }))
  on('turn.complete', () => ({ text: '' }))
  const clock = await start($, on, at(15))
  // Claude reads for 46 minutes straight
  await $.tool.call({ tool: 'Read', file_path: '/w/a.ts' })
  for (let minute = 0; minute < 46; minute++) await clock.advance(60_000)
  // Then things go quiet: the turn ends
  await $.turn.complete({ turnId: 't', answer: '', durationMs: 1, isAborted: false, reason: 'answer' })
  await clock.advance(6000)
  let ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /tea break/ })).toBeDefined()
  await ui.unmount()

  // Claude starts again: she's straight back to it
  await $.tool.call({ tool: 'Read', file_path: '/w/b.ts' })
  ui = await $.ui.mount(PANE)
  // Any version of the reading line
  expect(await ui.find({ type: 'Text', text: /TypeScript/ })).toBeDefined()
})

test('every hour and a half, while you are around, a sip and a gentle water reminder', async ($, on) => {
  on('prompt.edit', () => ({ text: 'hi', cursor: 2 }) as never)
  const clock = await start($, on, at(15))
  const typed = () => ($.prompt as any).edit({ origin: { kind: 'composer' }, text: 'h', cursor: 1, start: 1, end: 1, inputText: 'i' })

  // Under an hour and a half: nothing
  for (let minute = 0; minute < 85; minute++) await clock.advance(60_000)
  await typed()
  await clock.advance(5_000)
  let ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /water/ })).toBeUndefined()
  await ui.unmount()

  // Past it, and you typed a minute ago: one of her water lines
  for (let minute = 0; minute < 6; minute++) await clock.advance(60_000)
  ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /water|hydrated/ })).toBeDefined()
  await ui.unmount()

  // Nothing to answer: /frens water is gone
  expect((await $.command.run({ command: 'frens', args: 'water' } as never)).text).not.toMatch(/proud of you/)
})

test('no water nagging while you are away', async ($, on) => {
  const clock = await start($, on, at(15))
  for (let minute = 0; minute < 100; minute++) await clock.advance(60_000)
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /water/ })).toBeUndefined()
})

test('on a special day, a scene plays by itself about once an hour, while you are around', { timeoutMs: 60_000 }, async ($, on) => {
  on('prompt.edit', () => ({ text: 'hi', cursor: 2 }) as never)
  const saved = new Map<string, unknown>()
  on('store.get', ($: unknown, e: { key: string }) => ({ value: saved.get(e.key) }))
  on('store.set', ($: unknown, e: { key: string; value: unknown }) => {
    saved.set(e.key, e.value)
    return { value: undefined }
  })
  const clock = await start($, on, onHalloween(15))
  const typed = () => ($.prompt as any).edit({ origin: { kind: 'composer' }, text: 'h', cursor: 1, start: 1, end: 1, inputText: 'i' })
  await $.command.run({ command: 'frens', args: 'character kai' } as never)

  // The minute each scene's line first shows, typing now and then to stay around
  const seen: Record<string, number> = {}
  for (let minute = 1; minute <= 70; minute++) {
    if (minute % 5 === 1) await typed()
    await clock.advance(60_000)
    const ui = await $.ui.mount(PANE)
    if (seen.pumpkin === undefined && (await ui.find({ type: 'Text', text: /carved a pumpkin/ }))) seen.pumpkin = minute
    if (seen.ghost === undefined && (await ui.find({ type: 'Text', text: /the ghost's scarier/ }))) seen.ghost = minute
    await ui.unmount()
  }
  // The first soon after the hello, the next an hour on
  expect(seen.pumpkin !== undefined && seen.pumpkin <= 3).toBe(true)
  expect(seen.ghost !== undefined && seen.ghost - seen.pumpkin! >= 60).toBe(true)
})

test('no scenes by themselves on an ordinary day, or while you are away', { timeoutMs: 60_000 }, async ($, on) => {
  on('store.set', () => ({ value: undefined }))
  const clock = await start($, on, onHalloween(15))
  await $.command.run({ command: 'frens', args: 'character kai' } as never)
  for (let minute = 0; minute < 20; minute++) await clock.advance(60_000)
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /carved a pumpkin/ })).toBeUndefined()
})
