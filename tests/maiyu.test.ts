import { expect, mock, test } from 'claude-code/testing'

import { NO_PICTURES, fresh, pose } from '../hooks/register'
import { DEFAULT, byId as byIdForTest, textOf, versionsOf } from '../characters/index'

import { HEIGHT, SMALLEST, WIDTH, cells, paletteOf, shrink, shrunkHeight, sprite } from '../hooks/sprite'

const PALETTE = paletteOf(DEFAULT.look.palette)
import type { Buddy } from '../types'

const PANE = {
  plugin: 'maiyu',
  component: 'Pane',
  requestId: 'buddy',
  viewport: { columns: 160, rows: 40 },
  props: {
    title: 'Buddy',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const mount = ($: any, surface: 'terminal' | 'desktop' = 'terminal') => $.ui.mount({ ...PANE, surface })
const at = (b: Partial<Buddy>): Buddy => ({ frame: 5, mood: 'idle', since: 0, look: 0, note: '', diary: [], worked: 0, lastMeal: '', lastCoffee: '', lastWater: 0, active: 0, missedFor: -1, missLine: -1, lastGreet: '', lastSeason: '', lastSky: '', lastSpecial: '', lastWrap: '', lastRecall: '', lastChat: -1_000_000, ...b })

test('shrunk, every mood keeps its shape at every size', () => {
  const palette = paletteOf(DEFAULT.look.palette)
  for (const mood of ['idle', 'sleepy', 'watching', 'thinking', 'reading', 'editing', 'running', 'worried', 'happy', 'celebrate', 'comfort', 'break', 'snack', 'water', 'coffee', 'miss'] as const) {
    const full = sprite(pose(at({ mood, frame: 3, look: 1 })), DEFAULT.look)
    for (let columns = SMALLEST; columns < WIDTH; columns++) {
      const rows = shrink(full, columns)
      expect(rows.length).toBe(shrunkHeight(columns))
      expect(rows.length % 2).toBe(0)
      for (const row of rows) expect(row.length).toBe(columns)
      expect(atob(cells(rows, palette)).length).toBe(columns * (rows.length / 2) * 12)
    }
  }
  expect(shrink(sprite(pose(at({})), DEFAULT.look), WIDTH).length).toBe(HEIGHT)
})

test('she blinks', () => {
  expect(pose(at({})).eyes).toBe('open')
  expect(pose(at({ frame: 24 })).eyes).toBe('blink')
})

test('her eyes follow where you type', () => {
  expect(pose(at({ mood: 'watching', look: -1 })).look).toBe(-1)
  expect(pose(at({ mood: 'watching', look: 1 })).look).toBe(1)
})

test('typing makes her watch and say your word', async ($, on) => {
  on('prompt.edit', () => ({ text: 'fix the parser', cursor: 14 }))
  await ($.prompt as any).edit({ origin: { kind: 'composer' }, text: 'fix the parse', cursor: 13, start: 13, end: 13, inputText: 'r' })

  const ui = await mount($)
  expect(await ui.find({ type: 'Text', text: /what are we making/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /parser/ })).toBeUndefined()
})

test('an edit shows the file, goes in the diary, and the turn ends happy', async ($, on) => {
  on('tool.call', () => ({ result: 'ok' }))
  on('turn.complete', () => ({ text: '' }))

  await $.tool.call({ tool: 'Edit', file_path: '/work/src/app.ts', old_string: 'a', new_string: 'b' })
  let ui = await mount($)
  expect(await ui.find({ type: 'Text', text: /ganbatte! writing TypeScript/ })).toBeDefined()
  await ui.unmount()

  await $.turn.complete({ turnId: 't', answer: 'done', durationMs: 10, isAborted: false, reason: 'answer' })
  for (const surface of ['terminal', 'desktop'] as const) {
    ui = await mount($, surface)
    expect(await ui.find({ type: 'Text', text: /nice work on that TypeScript!/ })).toBeDefined()
    await ui.unmount()
  }
})

test('a failed tool call worries her', async ($, on) => {
  on('tool.call', () => ({ deny: 'nope' }))
  await $.tool.call({ tool: 'Bash', command: 'npm test' })

  const ui = await mount($)
  expect(await ui.find({ type: 'Text', text: /oops, that one tripped/ })).toBeDefined()
})

test('an interrupted turn puzzles her', async ($, on) => {
  on('turn.complete', () => ({ text: '' }))
  await $.turn.complete({ turnId: 't', answer: '', durationMs: 10, isAborted: true, reason: 'aborted' })

  const ui = await mount($)
  expect(await ui.find({ type: 'Text', text: /stopped\?/ })).toBeDefined()
})

test('session.start opens the pane, and moods wear off into sleep', async ($, on) => {
  const clock = mock.clock(on)
  const opened: string[] = []
  on('session.start', () => ({ cwd: '/work' }))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', ($, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('turn.complete', () => ({ text: '' }))
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  expect(opened).toEqual(['buddy'])

  await $.turn.complete({ turnId: 't', answer: 'done', durationMs: 10, isAborted: false, reason: 'answer' })
  await clock.advance(250 * 14)
  // What they said stays until they say something new: here, falling asleep
  let ui = await mount($)
  await ui.unmount()

  await clock.advance(2 * 60 * 1000 + 1000)
  ui = await mount($)
  expect(await ui.find({ type: 'Text', text: /oyasumi/ })).toBeDefined()
})

test('/frens opens the pane', async ($, on) => {
  const opened: string[] = []
  on('ui.open', ($, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })

  const answer = await $.command.run({ command: 'frens', args: '' } as never)
  expect(opened).toEqual(['buddy'])
  expect(answer.text).toMatch(/Ai-chan is here/)
})

test('every mood and frame is a whole sprite in her palette', { timeoutMs: 30_000 }, () => {
  for (const mood of ['idle', 'sleepy', 'watching', 'thinking', 'reading', 'editing', 'running', 'worried', 'happy', 'celebrate', 'comfort', 'break', 'snack', 'water', 'coffee', 'miss'] as const) {
    for (let frame = 0; frame < 24; frame++) {
      const rows = sprite(pose(at({ mood, frame, look: -1 })), DEFAULT.look)
      expect(rows.length).toBe(HEIGHT)
      for (const row of rows) {
        expect(row.length).toBe(WIDTH)
        for (const c of row) expect(c === '.' || PALETTE[c] !== undefined).toBe(true)
      }
    }
  }
})

test('her cells hold three words per terminal cell', () => {
  const bytes = atob(cells(sprite(pose(at({})), DEFAULT.look), PALETTE))
  expect(bytes.length).toBe(WIDTH * (HEIGHT / 2) * 12)
})

test('the terminal draws her pixel art, the desktop, editor and phone the same as a picture', async $ => {
  let ui = await mount($, 'terminal')
  // A portrait you can touch, drawn by its own surface module
  const portrait = await ui.find({ key: 'portrait' })
  expect(portrait?.type).toBe('Client')
  // As wide as the pane, a column spare for the sway, so there's room to click around them
  expect(portrait?.props.width).toBe(PANE.props.bodyColumns - 1)
  expect((portrait?.props.props as { rows: string[] }).rows[0]!.length).toBe(PANE.props.bodyColumns - 1)
  expect(portrait?.props.height).toBe(HEIGHT / 2)
  await ui.unmount()

  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    ui = await $.ui.mount({ ...PANE, surface })
    const svg = await ui.find({ type: 'Svg' })
    expect(svg?.type).toBe('Svg')
    expect(svg?.props.source).toMatch(/^<svg [^>]*viewBox="0 0 32 44"[^>]*>(<rect [^>]+\/>)+<\/svg>$/)
    expect(svg?.props.source.length).toBeLessThan(131_072)
    expect(svg?.props.alt).toMatch(/Ai-chan/)
    // The buttons are there to press, and the phone, with no text fields, still gets them
    expect(await ui.find({ key: 'hi' })).toBeDefined()
    await ui.unmount()
  }
})

test('a pane too small for the portrait gets them shrunk to fit, never text art', async $ => {
  for (const size of [{ bodyColumns: 24, bodyRows: 70 }, { bodyColumns: 60, bodyRows: 20 }]) {
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, bodyColumns: size.bodyColumns, scroll: { offset: 0, bodyRows: size.bodyRows } } })
    const portrait = await ui.find({ key: 'portrait' })
    expect(portrait?.type).toBe('Raster')
    const { columns, rows } = portrait?.props as { columns: number; rows: number }
    expect(columns < WIDTH).toBe(true)
    expect(columns <= size.bodyColumns - 1).toBe(true)
    expect(rows <= size.bodyRows - 8).toBe(true)
    expect(await ui.find({ type: 'Text', text: /\.-'~'-\./ })).toBeUndefined()
    // What they say and the buttons still fit
    expect(await ui.find({ key: 'hi' })).toBeDefined()
    await ui.unmount()
  }
})

test('a terminal with no colors says where to see them, as the session starts and in the pane', async ($, on) => {
  const toasts: string[] = []
  mock.clock(on)
  mock.env(on, { TERM: 'dumb' })
  on('session.start', () => ({ cwd: '/work' }))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined } as never
  })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as never)
  expect(toasts).toContain(NO_PICTURES)
  const ui = await mount($)
  expect(await ui.find({ key: 'portrait' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /pixel art/ })).toBeDefined()
  await ui.unmount()
})

test('a -p run or the SDK: no pane, no hint, but the commands still answer', async ($, on) => {
  const opens: string[] = []
  const toasts: string[] = []
  mock.clock(on)
  on('session.start', () => ({ cwd: '/work' }))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', ($, e) => {
    opens.push(e.id)
    return { value: { isPlaced: false, reason: 'narrow' } } as never
  })
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined } as never
  })
  on('prompt.submit', ($, e) => ({ text: e.text }) as never)
  await $.session.start({ surface: null, isInteractive: false, cwd: '/work' } as never)
  await $.prompt.submit({ text: 'hello' } as never)
  expect(opens).toEqual([])
  expect(toasts).toEqual([])
  expect((await $.command.run({ command: 'frens', args: 'help' } as never)).text).toMatch(/commands/)
})

test('a narrow terminal gets a hint, and the next prompt opens her', async ($, on) => {
  const opens: string[] = []
  const toasts: string[] = []
  let isPlaced = false
  mock.clock(on)
  on('session.start', () => ({ cwd: '/work' }))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', ($, e) => {
    opens.push(e.id)
    return { value: isPlaced ? { isPlaced: true } : { isPlaced: false, reason: 'narrow' } } as never
  })
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined } as never
  })
  on('prompt.submit', ($, e) => ({ text: e.text }) as never)

  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  expect(toasts[0]).toMatch(/next prompt/)

  isPlaced = true
  await $.prompt.submit({ text: 'hello' } as never)
  await $.prompt.submit({ text: 'again' } as never)
  // Opened at the start and on the first prompt, then left alone
  expect(opens).toEqual(['buddy', 'buddy'])
})

test('a value saved by an older version, with no diary, is filled in', () => {
  // What a session held from before the diary existed
  const old = { frame: 3, mood: 'idle', since: 0, look: 0, note: '' } as Partial<Buddy>
  expect(fresh(old)).toEqual({ frame: 3, mood: 'idle', since: 0, look: 0, note: '', diary: [], worked: 0, lastMeal: '', lastCoffee: '', lastWater: 0, active: -1_000_000, missedFor: -1, missLine: -1, lastGreet: '', lastSeason: '', lastSky: '', lastSpecial: '', lastWrap: '', lastRecall: '', lastChat: -1_000_000 })
  expect(fresh(undefined).diary).toEqual([])
  expect(() => sprite(pose(fresh(old)), DEFAULT.look)).not.toThrow()
})

test('/frens close closes her, and prompts leave her closed until /frens', async ($, on) => {
  const opens: string[] = []
  const closes: string[] = []
  on('ui.open', ($, e) => {
    opens.push(e.id)
    return { value: { isPlaced: true } } as never
  })
  on('ui.close', ($, e) => {
    closes.push(e.id)
    return { value: undefined } as never
  })
  on('prompt.submit', ($, e) => ({ text: e.text }) as never)

  const closed = await $.command.run({ command: 'frens', args: 'close' } as never)
  expect(closed.text).toMatch(/taking a break/)
  expect(closes).toEqual(['buddy'])

  await $.prompt.submit({ text: 'hello' } as never)
  expect(opens).toEqual([])

  await $.command.run({ command: 'frens', args: '' } as never)
  expect(opens).toEqual(['buddy'])
})

test('typing keeps one line, and changes it only once, when it grows long', async ($, on) => {
  let text = ''
  on('prompt.edit', () => ({ text, cursor: text.length }) as never)
  const lines: string[] = []
  for (let i = 1; i <= 50; i++) {
    text = 'x'.repeat(i)
    await ($.prompt as any).edit({ origin: { kind: 'composer' }, text: text.slice(1), cursor: i - 1, start: i - 1, end: i - 1, inputText: 'x' })
    const ui = await mount($)
    for (const l of [...lineList('typingShort'), ...lineList('typingLong')]) {
      if (await ui.find({ type: 'Text', text: new RegExp(escape(l)) })) {
        if (lines.at(-1) !== l) lines.push(l)
      }
    }
    await ui.unmount()
  }
  // A short line from the first key, a long one from the fortieth, and nothing in between
  expect(lines.length).toBe(2)
})

const lineList = (key: 'typingShort' | 'typingLong') => {
  return versionsOf(byIdForTest('aichan')!.voice.lines[key]).map(textOf)

}
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
