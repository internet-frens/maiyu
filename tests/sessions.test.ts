import { expect, mock, test } from 'claude-code/testing'

import { ago, asPeer, chip, finished, line, names } from '../hooks/sessions'
import type { Peer } from '../types'

const T0 = 1_000_000_000_000
const peer = (p: Partial<Peer>): Peer => ({ id: 'b', project: 'webapp', status: 'working', since: T0, seen: T0, summary: '', ...p })

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

test('reads records, finds finished sessions, names them', () => {
  expect(asPeer({ nope: 1 })).toBeUndefined()
  expect(asPeer({ id: 'x', seen: 5 })).toMatchObject({ id: 'x', status: 'idle', project: 'a project', since: 5 })
  const before = new Map([['b', 'working' as const]])
  expect(finished(before, [peer({ status: 'done' })]).map(p => p.id)).toEqual(['b'])
  expect(finished(new Map(), [peer({ status: 'done' })])).toEqual([])
  const two = names([peer({ id: 'b' }), peer({ id: 'c', since: T0 + 1 })])
  expect([two.get('b'), two.get('c')]).toEqual(['webapp', 'webapp (2)'])
  expect(line(peer({}), 'webapp', T0 + 4 * 60_000)).toBe('● webapp · working for 4m')
  expect(line(peer({ status: 'done' }), 'webapp', T0 + 90 * 60_000)).toBe('✓ webapp · done 1h 30m ago')
  expect(ago(10_000)).toBe('just now')
})

// A store every session shares, started with another session's record
function sharedStore(on: any, saved: Map<string, unknown>) {
  on('store.get', ($: unknown, e: { key: string }) => ({ value: saved.get(e.key) }))
  on('store.set', ($: unknown, e: { key: string; value: unknown }) => {
    saved.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', ($: unknown, e: { key: string }) => {
    saved.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...saved.keys()] }))
}

test('she tells you when another session finishes', async ($, on) => {
  const saved = new Map<string, unknown>([['session:b', peer({ seen: T0 })]])
  const toasts: string[] = []
  const clock = mock.clock(on, { now: T0 })
  sharedStore(on, saved)
  on('session.start', () => ({ cwd: '/work/maiyu' }))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.id', () => ({ value: 'a' }))
  on('session.root', () => ({ value: '/work/maiyu' }))
  on('ui.toast', ($: unknown, e: { text: string }) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('session.end', ($: unknown, e: { sessionId: string }) => ({ sessionId: e.sessionId }))
  on('prompt.submit', ($: unknown, e: { text: string }) => ({ text: e.text }))

  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work/maiyu' })
  // Her own record is there for the others
  expect(saved.get('session:a')).toMatchObject({ id: 'a', project: 'maiyu', status: 'idle' })

  await clock.advance(5_000)
  expect((await $.command.run({ command: 'frens', args: 'sessions' } as never)).text).toMatch(/● webapp · working/)

  // The other session finishes
  saved.set('session:b', peer({ status: 'done', since: T0 + 5_000, seen: T0 + 5_000, summary: 'all wins this time!' }))
  await clock.advance(5_000)
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /your session in webapp is done[!.] ✧ all wins this time[!.]/ })).toBeDefined()
  expect(toasts.filter(t => /session/.test(t))).toEqual(['Ai-chan: your session in webapp finished ✧'])
  await ui.unmount()

  // Working here shows there
  await $.prompt.submit({ text: 'go' } as never)
  expect(saved.get('session:a')).toMatchObject({ status: 'working' })

  const list = await $.command.run({ command: 'frens', args: 'sessions' } as never)
  expect(list.text).toMatch(/Your other sessions:\n {2}✓ webapp · done/)

  // Closing removes her record
  await $.session.end({ reason: 'exit', sessionId: 'a' } as never)
  expect(saved.has('session:a')).toBe(false)
})

test('a silent session drops off, and a day-old record is swept', async ($, on) => {
  const saved = new Map<string, unknown>([
    ['session:quiet', peer({ id: 'quiet', seen: T0 - 5 * 60_000 })],
    ['session:old', peer({ id: 'old', seen: T0 - 25 * 60 * 60_000 })],
  ])
  const clock = mock.clock(on, { now: T0 })
  sharedStore(on, saved)
  on('session.start', () => ({ cwd: '/w' }))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.id', () => ({ value: 'a' }))
  on('session.root', () => ({ value: '/w' }))

  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/w' })
  await clock.advance(5_000)
  const list = await $.command.run({ command: 'frens', args: 'sessions' } as never)
  expect(list.text).toMatch(/just us/)
  expect(saved.has('session:old')).toBe(false)
  expect(saved.has('session:quiet')).toBe(true)
})

test('after /clear she shares on under the new session id', async ($, on) => {
  const saved = new Map<string, unknown>()
  let id = 'a'
  const clock = mock.clock(on, { now: T0 })
  sharedStore(on, saved)
  on('session.start', () => ({ cwd: '/w' }))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.id', () => ({ value: id }))
  on('session.root', () => ({ value: '/w' }))
  on('session.end', ($: unknown, e: { sessionId: string }) => ({ sessionId: e.sessionId }))

  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/w' })
  await $.session.end({ reason: 'clear', sessionId: 'a' } as never)
  id = 'a2'
  await clock.advance(30_000)
  expect(saved.has('session:a')).toBe(false)
  expect(saved.get('session:a2')).toMatchObject({ id: 'a2', project: 'w' })
})

test('the chip: a session that just finished by name, then the counts', () => {
  const all = [peer({ id: 'b' }), peer({ id: 'c', project: 'site', status: 'done' }), peer({ id: 'd', project: 'api', status: 'idle' })]
  const label = names(all)
  expect(chip(all, new Set(), label)).toBe('● 1 working · ✓ 1 done · ○ 1 resting')
  expect(chip(all, new Set(['c']), label)).toBe('✓ site done · ● 1 working · ○ 1 resting')
})

test('your other sessions under their name: press it for the list; a finished one stands out until you look', async ($, on) => {
  const saved = new Map<string, unknown>([['session:b', peer({ seen: T0, summary: 'tidying the tests' })]])
  const clock = mock.clock(on, { now: T0 })
  sharedStore(on, saved)
  on('session.start', () => ({ cwd: '/work/maiyu' }))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.id', () => ({ value: 'a' }))
  on('session.root', () => ({ value: '/work/maiyu' }))
  on('ui.toast', () => ({ value: undefined }))
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work/maiyu' })

  await clock.advance(5_000)
  let ui = await $.ui.mount(PANE)
  expect((await ui.find({ key: 'sessions' }))?.props.label).toBe('● 1 working')

  // It finishes: named in the chip
  saved.set('session:b', peer({ status: 'done', since: T0 + 5_000, seen: T0 + 5_000, summary: 'fixed the build' }))
  await clock.advance(5_000)
  await ui.unmount()
  ui = await $.ui.mount(PANE)
  expect((await ui.find({ key: 'sessions' }))?.props.label).toBe('✓ webapp done')

  // The list: each session and its summary; opening it settles the chip
  await ui.press({ key: 'sessions' })
  expect(await ui.find({ type: 'Text', text: /✓ webapp · done/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /fixed the build/ })).toBeDefined()
  expect((await ui.find({ key: 'sessions' }))?.props.label).toBe('✓ 1 done')
  await ui.press({ key: 'done' })
  expect(await ui.find({ key: 'hi' })).toBeDefined()

  // On your own: no chip
  saved.delete('session:b')
  await clock.advance(5_000)
  await ui.unmount()
  ui = await $.ui.mount(PANE)
  expect(await ui.find({ key: 'sessions' })).toBeUndefined()
})

test('a session that finishes while they are busy: they tell you once they are free', async ($, on) => {
  const saved = new Map<string, unknown>([['session:b', peer({ seen: T0 })]])
  const clock = mock.clock(on, { now: T0 })
  sharedStore(on, saved)
  on('session.start', () => ({ cwd: '/work/maiyu' }))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.id', () => ({ value: 'a' }))
  on('session.root', () => ({ value: '/work/maiyu' }))
  on('ui.toast', () => ({ value: undefined }))
  on('tool.call', () => ({ result: 'ok' }))
  on('turn.complete', () => ({ text: '' }))
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work/maiyu' })
  await clock.advance(5_000)

  // Busy editing when it finishes: not yet
  await $.tool.call({ tool: 'Edit', file_path: '/work/maiyu/a.ts', old_string: 'a', new_string: 'b' })
  saved.set('session:b', peer({ status: 'done', since: T0 + 5_000, seen: T0 + 5_000, summary: 'all green' }))
  await clock.advance(5_000)
  let ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /your session in webapp is done/ })).toBeUndefined()
  await ui.unmount()

  // The turn ends and they settle: the heads-up comes
  await $.turn.complete({ turnId: 't', answer: 'done', durationMs: 10, isAborted: false, reason: 'answer' })
  for (let i = 0; i < 12; i++) await clock.advance(5_000)
  ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /your session in webapp is done/ })).toBeDefined()
})
