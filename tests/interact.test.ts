import { expect, mock, test } from 'claude-code/testing'

import { DEV } from '../hooks/dev'
import { nextLine } from '../hooks/routine'

const PANE = {
  plugin: 'maiyu',
  component: 'Pane',
  requestId: 'buddy',
  surface: 'terminal',
  viewport: { columns: 160, rows: 60 },
  props: { title: 'Ai-chan', isFocused: true, bodyColumns: 50, placement: 'dock', scroll: { offset: 0, bodyRows: 50 }, view: {} },
} as const

const T0 = new Date(2026, 9, 7, 15, 0).getTime()
const HALLOWEEN = new Date(2026, 9, 31, 15, 0).getTime()

test('/frens help lists the commands, /frens off closes like close', async ($, on) => {
  const closes: string[] = []
  on('ui.close', ($: unknown, e: { id: string }) => {
    closes.push(e.id)
    return { value: undefined }
  })
  const help = await $.command.run({ command: 'frens', args: 'help' } as never)
  expect(help.text).toMatch(/^Ai-chan's commands:/)
  for (const word of ['close', 'character', 'notify', 'sessions', 'quiet', 'diffs', 'score', 'help']) {
    expect(help.text).toMatch(new RegExp(`/frens ${word}`))
  }
  const off = await $.command.run({ command: 'frens', args: 'off' } as never)
  expect(off.text).toMatch(/taking a break/)
  expect(closes).toEqual(['buddy'])
})

test('/frens notify toggles and remembers', async ($, on) => {
  const saved = new Map<string, unknown>()
  on('store.set', ($: unknown, e: { key: string; value: unknown }) => {
    saved.set(e.key, e.value)
    return { value: undefined }
  })
  expect((await $.command.run({ command: 'frens', args: 'notify off' } as never)).text).toMatch(/won't send notifications/)
  expect(saved.get('notify')).toBe(false)
  expect((await $.command.run({ command: 'frens', args: 'notify' } as never)).text).toMatch(/notification when something's done/)
  expect(saved.get('notify')).toBe(true)
})

test('the next line is never the last one', () => {
  for (let last = -1; last < 8; last++) {
    for (let frame = 0; frame < 50; frame++) {
      const next = nextLine(8, last, frame)
      expect(next >= 0 && next < 8).toBe(true)
      if (last >= 0) expect(next).not.toBe(last)
    }
  }
  expect(nextLine(1, 0, 5)).toBe(0)
})

async function start($: any, on: any, notes: string[][]) {
  const clock = mock.clock(on, { now: T0 })
  on('session.start', () => ({ cwd: '/w' }))
  on('command.register', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  // A store that keeps what's written, as the real one does
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
  on('prompt.edit', () => ({ text: 'hi', cursor: 2 }))
  on('process.run', ($: unknown, e: { argv: string[] }) => {
    notes.push(e.argv)
    return { value: { exitCode: 0, stdout: '', stderr: '' } }
  })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/w' })
  return clock
}

const typed = ($: any) => $.prompt.edit({ origin: { kind: 'composer' }, text: 'h', cursor: 1, start: 1, end: 1, inputText: 'i' })

test('after an hour away they say they miss you, once, with a notification, then welcome you back', { timeoutMs: 60_000 }, async ($, on) => {
  const notes: string[][] = []
  const clock = await start($, on, notes)
  await typed($)

  for (let minute = 0; minute < 61; minute++) await clock.advance(60_000)
  let ui = await $.ui.mount(PANE)
  const missed = await ui.find({ type: 'Text', text: /miss|while|quiet|seat|there\?|ready/ })
  expect(missed).toBeDefined()
  await ui.unmount()
  // One notification, the message passed as an argument rather than as script
  expect(notes.length).toBe(1)
  expect(notes[0]![0]).toBe('osascript')
  expect(notes[0]!.at(-2)).toBe('Ai-chan')

  // Still away two more hours: no more hellos
  for (let minute = 0; minute < 120; minute++) await clock.advance(60_000)
  expect(notes.length).toBe(1)

  // You come back
  await typed($)
  ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /back|okaeri|there you are/ })).toBeDefined()
  await ui.unmount()

  // Away another hour: a hello again, and a different one
  const first = notes[0]!.at(-1)
  for (let minute = 0; minute < 61; minute++) await clock.advance(60_000)
  expect(notes.length).toBe(2)
  expect(notes[1]!.at(-1)).not.toBe(first)
})

test('notifications off: the hello stays in the pane', { timeoutMs: 30_000 }, async ($, on) => {
  const notes: string[][] = []
  const clock = await start($, on, notes)
  await $.command.run({ command: 'frens', args: 'notify off' } as never)
  await typed($)
  for (let minute = 0; minute < 61; minute++) await clock.advance(60_000)
  expect(notes.length).toBe(0)
})

test('the pane has buttons you can press', async ($, on) => {
  const closes: string[] = []
  on('store.set', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', ($: unknown, e: { id: string }) => {
    closes.push(e.id)
    return { value: undefined }
  })

  await $.command.run({ command: 'frens', args: '' } as never)
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ key: 'pat' })).toBeUndefined()
  // Water is only a gentle reminder now: no button to answer it
  expect(await ui.find({ key: 'water' })).toBeUndefined()

  // The settings are tucked behind the ⋯
  expect(await ui.find({ key: 'notify' })).toBeUndefined()
  await ui.press({ key: 'more' })
  expect((await ui.find({ key: 'notify' }))?.props.label).toBe('notify on')
  await ui.press({ key: 'notify' })
  expect((await ui.find({ key: 'notify' }))?.props.label).toBe('notify off')

  // The characters button opens the picker; search, then pick
  await ui.press({ key: 'change' })
  expect(await ui.find({ key: 'search' })).toBeDefined()
  await ui.input({ key: 'search', text: 'he/him', kind: 'change' })
  expect(await ui.find({ key: 'pick-kai' })).toBeDefined()
  expect(await ui.find({ key: 'pick-aichan' })).toBeUndefined()
  await ui.press({ key: 'pick-kai' })
  expect(await ui.find({ type: 'Text', text: /Hey, I'm Kai/ })).toBeDefined()
  // Picking closes the picker and brings the buttons back
  expect(await ui.find({ key: 'search' })).toBeUndefined()
  expect(await ui.find({ key: 'hi' })).toBeDefined()

  await ui.press({ key: 'close' })
  expect(closes).toEqual(['buddy'])
})

test('the picker: Enter picks the first match, nothing matches, done closes it', async ($, on) => {
  on('store.set', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  await $.command.run({ command: 'frens', args: '' } as never)
  const ui = await $.ui.mount(PANE)

  await ui.press({ key: 'change' })
  await ui.input({ key: 'search', text: 'zzz', kind: 'change' })
  expect(await ui.find({ type: 'Text', text: /no one matches "zzz"/ })).toBeDefined()

  await ui.input({ key: 'search', text: 'they' })
  expect(await ui.find({ type: 'Text', text: /Hello. I'm Sora/ })).toBeDefined()

  await ui.press({ key: 'change' })
  await ui.press({ key: 'done' })
  expect(await ui.find({ key: 'search' })).toBeUndefined()
})

test('/frens characters opens the picker in the pane', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  await $.command.run({ command: 'frens', args: '' } as never)
  const list = await $.command.run({ command: 'frens', args: 'characters' } as never)
  expect(list.text).toMatch(/type in the pane to search/)
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ key: 'search' })).toBeDefined()
})

test('/frens preview plays a special moment now, then goes back to today; only while working on the mod', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('clock.now', () => ({ value: T0 }))
  if (!DEV) {
    expect((await $.command.run({ command: 'frens', args: 'preview birthday' } as never)).text).toMatch(/^No \/frens preview/)
    expect((await $.command.run({ command: 'frens', args: 'help' } as never)).text).not.toMatch(/preview/)
    return
  }
  const list = await $.command.run({ command: 'frens', args: 'preview' } as never)
  expect(list.text).toMatch(/birthday/)
  expect(list.text).toMatch(/halloween/)
  expect((await $.command.run({ command: 'frens', args: 'preview birthday' } as never)).text).toMatch(/^Previewing Ai-chan's birthday/)
  expect((await $.command.run({ command: 'frens', args: 'preview anniversary 3' } as never)).text).toMatch(/^Previewing 3 years with Ai-chan/)
  expect((await $.command.run({ command: 'frens', args: 'preview lunar new year' } as never)).text).toMatch(/^Previewing Lunar New Year/)
  expect((await $.command.run({ command: 'frens', args: 'preview moment 2' } as never)).text).toMatch(/heart 2 moment/)
  expect((await $.command.run({ command: 'frens', args: 'preview moment 9' } as never)).text).toMatch(/heart 9 moment/)
  expect((await $.command.run({ command: 'frens', args: 'preview moment 11' } as never)).text).toMatch(/hearts 1 to 10/)
  expect((await $.command.run({ command: 'frens', args: 'preview nope' } as never)).text).toMatch(/No special moment called "nope"/)
  expect((await $.command.run({ command: 'frens', args: 'preview off' } as never)).text).toMatch(/back to today/)
  expect((await $.command.run({ command: 'frens', args: 'preview off' } as never)).text).toMatch(/Nothing is being previewed/)
})

test('on a special day, ✦ celebrate plays its scenes in turn', async ($, on) => {
  const clock = mock.clock(on, { now: HALLOWEEN })
  on('session.start', () => ({ cwd: '/w' }))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('store.set', () => ({ value: undefined }))
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/w' })
  await $.command.run({ command: 'frens', args: '' } as never)
  await clock.advance(60_000)
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ key: 'celebrate' })).toBeDefined()
  await ui.press({ key: 'celebrate' })
  expect(await ui.find({ type: 'Text', text: /carved a pumpkin/ })).toBeDefined()
  await ui.press({ key: 'celebrate' })
  expect(await ui.find({ type: 'Text', text: /boo!/ })).toBeDefined()
})

test('no ✦ celebrate on an ordinary day', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('store.set', () => ({ value: undefined }))
  on('clock.now', () => ({ value: T0 }))
  await $.command.run({ command: 'frens', args: '' } as never)
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ key: 'celebrate' })).toBeUndefined()
})

// A session with a store you can see, and nothing else going on
async function fresh($: any, on: any, saved: Map<string, unknown>, toasts: string[] = []) {
  const clock = mock.clock(on, { now: T0 })
  on('session.start', () => ({ cwd: '/w' }))
  on('command.register', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', ($: unknown, e: { text: string }) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('session.id', () => ({ value: 'a' }))
  on('session.root', () => ({ value: '/w' }))
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
  on('http.fetch', () => ({ value: { ok: false, status: 503, headers: {}, text: '' } }))
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/w' })
  await clock.settle()
  return clock
}

test('the first time ever, you pick your buddy; it is saved, and not counted as a switch', async ($, on) => {
  const saved = new Map<string, unknown>()
  await fresh($, on, saved)
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /pick your buddy/ })).toBeDefined()
  // Each one shows how they sound
  expect(await ui.find({ type: 'Text', text: /the tests green again\. …good\./ })).toBeDefined()
  await ui.press({ key: 'pick-kai' })
  expect(saved.get('character')).toBe('kai')
  expect(await ui.find({ type: 'Text', text: /pick your buddy/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /Hey, I'm Kai/ })).toBeDefined()
  expect(JSON.stringify([...saved.entries()])).not.toMatch(/switched/)
})

test('keeping the first character saves the choice too', async ($, on) => {
  const saved = new Map<string, unknown>()
  await fresh($, on, saved)
  const ui = await $.ui.mount(PANE)
  await ui.press({ key: 'done' })
  expect(saved.get('character')).toBe('aichan')
})

test('no welcome once you have picked, or once you have history', async ($, on) => {
  const saved = new Map<string, unknown>([['progress:old', { counts: { prompt: 3 }, days: {} }]])
  await fresh($, on, saved)
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /pick your buddy/ })).toBeUndefined()
  expect(await ui.find({ key: 'hi' })).toBeDefined()
})

test('usage sharing is on unless you turn it off, said once, counts lines by id, and forgets when turned off', async ($, on) => {
  const saved = new Map<string, unknown>([['character', 'aichan']])
  const toasts: string[] = []
  const clock = await fresh($, on, saved, toasts)
  // Said plainly, once
  expect(toasts.filter(t => /share off/.test(t))).toHaveLength(1)
  expect(saved.get('shareNoticed')).toBe(true)

  // On: lines said are counted by id, never their words, and the report shows it all
  await $.command.run({ command: 'frens', args: 'hi' } as never)
  await $.command.run({ command: 'frens', args: 'notify off' } as never)
  await clock.settle()
  const report = (await $.command.run({ command: 'frens', args: 'share' } as never)).text
  expect(report).toMatch(/^Usage sharing is on/)
  expect(report).toMatch(/nowhere to send it yet/)
  expect(report).toMatch(/"aichan\.hiBack\.\d": 1/)
  expect(report).toMatch(/"aichan\.notifyOff\.0": 1/)
  expect(report).toMatch(/"character": "aichan"/)
  expect(report).not.toMatch(/\/w|won't send/)

  // Off: what was counted is gone, and nothing more is
  await $.command.run({ command: 'frens', args: 'share off' } as never)
  expect([...saved.keys()].some(k => k.startsWith('usage:'))).toBe(false)
  expect(saved.get('shareUsage')).toBe(false)
  await $.command.run({ command: 'frens', args: 'hi' } as never)
  await clock.settle()
  expect([...saved.keys()].some(k => k.startsWith('usage:'))).toBe(false)
  expect((await $.command.run({ command: 'frens', args: 'share' } as never)).text).toMatch(/^Usage sharing is off/)
})
