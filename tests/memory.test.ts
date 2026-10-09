import { expect, mock, test } from 'claude-code/testing'

import { count } from '../achievements/progress'
import type { Tally } from '../achievements/types'
import { agoOf, bestStreak, recall, remember, streak } from '../hooks/memory'

const NONE: Tally = { counts: {}, days: {} }

const PANE = {
  plugin: 'maiyu',
  component: 'Pane',
  requestId: 'buddy',
  surface: 'terminal',
  viewport: { columns: 160, rows: 70 },
  props: { title: 'Ai-chan', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 70 }, view: {} },
} as const

test('streaks: days in a row, through yesterday, and the best ever', () => {
  const days = ['2026-9-28', '2026-9-29', '2026-9-30', '2026-10-1', '2026-10-4', '2026-10-5', '2026-10-6']
  expect(streak(days, '2026-10-7')).toBe(3)
  expect(streak([...days, '2026-10-7'], '2026-10-7')).toBe(4)
  expect(streak(days, '2026-10-9')).toBe(0)
  expect(bestStreak(days)).toBe(4)
})

test('how long ago, in words', () => {
  expect(agoOf('2026-10-6', '2026-10-7')?.when).toBe('yesterday')
  expect(agoOf('2026-10-2', '2026-10-7')?.when).toBe('last Friday')
  expect(agoOf('2026-9-28', '2026-10-7')?.when).toBe('a week ago')
  expect(agoOf('2026-9-10', '2026-10-7')?.when).toBe('4 weeks ago')
  expect(agoOf('2026-10-7', '2026-10-7')).toBeUndefined()
})

test('memories: one per win a day, about two months kept, recalled from the past', () => {
  let list = remember([], { day: '2026-10-1', what: 'the tests went green again' }, '2026-10-1')
  list = remember(list, { day: '2026-10-1', what: 'the tests went green again' }, '2026-10-1')
  list = remember(list, { day: '2026-7-1', what: 'long ago' }, '2026-7-1')
  list = remember(list, { day: '2026-10-6', what: 'a pull request got merged' }, '2026-10-7')
  expect(list.map(m => m.what)).toEqual(['the tests went green again', 'a pull request got merged'])
  expect(recall(list, '2026-10-7', 0)).toMatchObject({ what: 'the tests went green again', when: 'last Thursday' })
})

async function start($: any, on: any, at: Date, saved: Map<string, unknown>, runs: boolean[] = []) {
  const clock = mock.clock(on, { now: at.getTime() })
  on('session.start', () => ({ cwd: '/w' }))
  on('command.register', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.id', () => ({ value: 'a' }))
  on('session.root', () => ({ value: '/w' }))
  on('store.get', ($: unknown, e: { key: string }) => ({ value: saved.get(e.key) }))
  on('store.set', ($: unknown, e: { key: string; value: unknown }) => {
    saved.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...saved.keys()] }))
  on('store.delete', () => ({ value: undefined }))
  on('prompt.edit', () => ({ text: 'hi', cursor: 2 }))
  on('http.fetch', () => ({ value: { ok: false, status: 503, headers: {}, text: '' } }))
  // Each test run takes the next result: true passes, false fails
  on('tool.call', (($: unknown, e: { command?: string }) => {
    if (e.command !== 'npm test') return { result: 'ok' }
    const passes = runs.shift() ?? true
    return passes
      ? { result: { stdout: '5 passed', stderr: '', interrupted: false } }
      : { result: { stdout: '2 failed, 3 passed', stderr: '', interrupted: false }, isError: true }
  }) as never)
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/w' })
  await clock.settle()
  return clock
}

const typed = ($: any) => $.prompt.edit({ origin: { kind: 'composer' }, text: 'h', cursor: 1, start: 1, end: 1, inputText: 'i' })

test('the letter tells your streak; a win from last week comes up in the afternoon', async ($, on) => {
  let past = NONE
  for (const day of ['2026-10-4', '2026-10-5', '2026-10-6']) past = count(past, 'prompt', day)
  const saved = new Map<string, unknown>([
    ['progress:old', past],
    ['memories:old', [{ day: '2026-10-1', what: 'a pull request got merged' }]],
  ])
  const clock = await start($, on, new Date(2026, 9, 7, 14, 0), saved)
  await typed($)
  await clock.settle()
  let ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /4 days in a row, a new record/ })).toBeDefined()
  await ui.press({ key: 'letter-away' })
  await ui.unmount()

  // The afternoon hello first, then, a couple of minutes on, the memory
  for (let i = 0; i < 3; i++) {
    await typed($)
    await clock.advance(60_000)
  }
  ui = await $.ui.mount(PANE)

  expect(await ui.find({ type: 'Text', text: /remember last Thursday, when a pull request got merged\? that felt so good/ })).toBeDefined()
})

test('a check going green again is remembered, and /frens memories lists it', async ($, on) => {
  const saved = new Map<string, unknown>([['lastLetter', '2026-10-7']])
  const clock = await start($, on, new Date(2026, 9, 7, 10, 0), saved, [false, true])
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  await clock.settle()
  // Reading memories waits for the recording to finish
  const list = await $.command.run({ command: 'frens', args: 'memories' } as never)
  expect(saved.get('memories:a')).toEqual([{ day: '2026-10-7', what: 'the tests went green again' }])
  expect(list.text).toMatch(/^Streak: 0 days in a row · best 0 days\nToday\n {2}· the tests went green again/)
})

test('a check won after five failures in a row is a comeback, and earns Comeback', async ($, on) => {
  const saved = new Map<string, unknown>([['lastLetter', '2026-10-7']])
  const clock = await start($, on, new Date(2026, 9, 7, 10, 0), saved, [false, false, false, false, false, true])
  for (let i = 0; i < 6; i++) await $.tool.call({ tool: 'Bash', command: 'npm test' })
  await clock.settle()
  expect((saved.get('memories:a') as unknown[])[0]).toEqual({ day: '2026-10-7', what: 'the tests went green again, after 6 tries', kind: 'comeback' })
  expect(saved.get('unlocked')).toEqual(['comeback'])
})

test('a run failing after an earlier comeback brings it up, once a day', async ($, on) => {
  const comeback = { day: '2026-10-6', what: 'the tests went green again, after 6 tries', kind: 'comeback' }
  const saved = new Map<string, unknown>([['lastLetter', '2026-10-7'], ['memories:old', [comeback]]])
  await start($, on, new Date(2026, 9, 7, 10, 0), saved, [false, true, false])
  const ui = await $.ui.mount(PANE)
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  expect(await ui.find({ type: 'Text', text: /yesterday.? the tests went green again, after 6 tries/ })).toBeDefined()
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  expect(await ui.find({ type: 'Text', text: /after 6 tries/ })).toBeUndefined()
})

test('early mornings and weekends count from your prompts', async ($, on) => {

  // Saturday at 6 in the morning
  const saved = new Map<string, unknown>([['lastLetter', '2026-10-10']])
  on('prompt.submit', ($: unknown, e: { text: string }) => ({ text: e.text }) as never)
  const clock = await start($, on, new Date(2026, 9, 10, 6, 0), saved)

  await $.prompt.submit({ text: 'morning' } as never)
  await clock.settle()
  const t = saved.get('progress:a') as { counts: Record<string, number> }
  expect(t.counts.earlyWork).toBe(1)
  expect(t.counts.weekendWork).toBe(1)
  expect(t.counts.fridayDeploy).toBeUndefined()
})

test('a push on a Friday evening finds the hidden Friday deploy', async ($, on) => {
  const saved = new Map<string, unknown>([['lastLetter', '2026-10-9']])
  const clock = mock.clock(on, { now: new Date(2026, 9, 9, 18, 30).getTime() })
  on('ui.toast', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('store.get', ($: unknown, e: { key: string }) => ({ value: saved.get(e.key) }))
  on('store.set', ($: unknown, e: { key: string; value: unknown }) => {
    saved.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...saved.keys()] }))
  on('tool.call', () => ({ result: { stdout: '', stderr: '', interrupted: false, gitOperation: { push: { branch: 'main' } } } }) as never)
  await $.tool.call({ tool: 'Bash', command: 'git push' })
  await clock.settle()
  const list = await $.command.run({ command: 'frens', args: 'achievements' } as never)
  expect(saved.get('unlocked')).toEqual(['friday-deploy'])
  expect(list.text).toMatch(/✓ Friday deploy: new lines/)
  expect(list.text).not.toMatch(/hidden/)
})
