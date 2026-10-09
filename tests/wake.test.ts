import { expect, mock, test } from 'claude-code/testing'

import { CHARACTERS } from '../characters/index'
import { LONG_NAP, TALK_FOR, WAKE_FOR, WAKE_KINDS, wakeKind, wakeMark, wakePose } from '../hooks/wake'
import { paletteOf, sprite } from '../hooks/sprite'

const PANE = {
  plugin: 'maiyu',
  component: 'Pane',
  requestId: 'buddy',
  surface: 'terminal',
  viewport: { columns: 160, rows: 60 },
  props: { title: 'Buddy', isFocused: false, bodyColumns: 50, placement: 'dock', scroll: { offset: 0, bodyRows: 50 }, view: {} },
} as const
const base = { eyes: 'open', look: 0, mouth: 'smile', arms: 'down', blush: false, sweat: false, ahoge: 0, tear: false, confetti: 0, hop: 0, beat: 0 } as const

test('how they wake: in turn, but a yawn after a long nap or late at night', () => {
  expect([0, 1, 2, 3, 4].map(turn => wakeKind(turn, 100, false))).toEqual([...WAKE_KINDS, 'startle'])
  expect(wakeKind(0, LONG_NAP, false)).toBe('yawn')
  expect(wakeKind(2, 100, true)).toBe('yawn')
  // Sleep-talking: eyes shut while mumbling, then awake with a start
  expect(wakePose('sleepTalk', 0).eyes).toBe('sleep')
  expect(wakePose('sleepTalk', TALK_FOR).eyes).toBe('open')
  expect(wakeMark('startle', 0, 0)).toBe('!')
})

test('every frame of every wake-up is a whole sprite, on every character', () => {
  for (const kind of WAKE_KINDS) {
    for (let age = 0; age < WAKE_FOR[kind]; age++) {
      expect(wakeMark(kind, age, age).length <= 3).toBe(true)
      for (const c of CHARACTERS) {
        const palette = paletteOf(c.look.palette)
        const unpainted = sprite({ ...base, ...wakePose(kind, age) }, c.look).join('').split('').filter(ch => ch !== '.' && palette[ch] === undefined)
        expect(unpainted).toEqual([])
      }
    }
  }
})

// Asleep: a while after the session starts, with nobody typing
async function asleep($: any, on: any) {
  const clock = mock.clock(on, { now: new Date(2026, 9, 7, 15).getTime() })
  on('session.start', () => ({ cwd: '/work' }))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('prompt.edit', () => ({ text: 'hi', cursor: 2 }) as never)
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await clock.advance(13 * 60 * 1000)
  return clock
}
const typed = ($: any) => $.prompt.edit({ origin: { kind: 'composer' }, text: 'h', cursor: 1, start: 1, end: 1, inputText: 'i' })
const said = async ($: any, text: RegExp) => {
  const ui = await $.ui.mount(PANE)
  const found = await ui.find({ type: 'Text', text })
  await ui.unmount()
  return found !== undefined
}

test('typing wakes them, a different way each time, and more typing lets them finish', { timeoutMs: 60_000 }, async ($, on) => {
  const clock = await asleep($, on)
  expect(await said($, /oyasumi/)).toBe(true)

  // With a start
  await typed($)
  expect(await said($, /I wasn't asleep|totally awake|it's you/)).toBe(true)
  await clock.advance(1000)
  await typed($)
  expect(await said($, /I wasn't asleep|totally awake|it's you/)).toBe(true)

  // Asleep again, then a yawn
  await clock.advance(13 * 60 * 1000)
  await typed($)
  expect(await said($, /fwaaah|stretch|yaaawn/)).toBe(true)

  // Then a dream
  await clock.advance(13 * 60 * 1000)
  await typed($)
  expect(await said($, /dreamt|dream/)).toBe(true)

  // Then mumbling in their sleep, and realizing you heard
  await clock.advance(13 * 60 * 1000)
  await typed($)
  expect(await said($, /semicolon|mochi|ganbatte/)).toBe(true)
  await clock.advance(TALK_FOR * 250 + 500)
  expect(await said($, /did I say something|you heard that|didn't mean it/)).toBe(true)
})

test('saying hi wakes them too', { timeoutMs: 60_000 }, async ($, on) => {
  await asleep($, on)
  await $.command.run({ command: 'frens', args: 'hi' } as never)
  expect(await said($, /I wasn't asleep|totally awake|it's you/)).toBe(true)
})
