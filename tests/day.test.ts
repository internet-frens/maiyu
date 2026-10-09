import { expect, mock, test } from 'claude-code/testing'

import { count, dayOf, together } from '../achievements/progress'
import type { Tally } from '../achievements/types'
import { nextDate } from '../events/calendar'
import { comingUp, countsOn, describeDay, lastDayBefore, whenWas } from '../hooks/day'
import { isAfterBreak, keepHighlight, keepYearWin, letterBrief, tidyNote, yearBrief } from '../hooks/letter'

const NONE: Tally = { counts: {}, days: {} }
const USAGE = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

const PANE = {
  plugin: 'maiyu',
  component: 'Pane',
  requestId: 'buddy',
  surface: 'terminal',
  viewport: { columns: 160, rows: 70 },
  props: { title: 'Ai-chan', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 70 }, view: {} },
} as const

test('days add up across sessions, in plain words', () => {
  let a = NONE
  for (let i = 0; i < 6; i++) a = count(a, 'prompt', '2026-10-6')
  a = count(a, 'commit', '2026-10-6')
  let b = count(NONE, 'prompt', '2026-10-6')
  b = count(b, 'fileChanged', '2026-10-6')
  b = count(b, 'checkFixed', '2026-10-6')
  const c = countsOn([a, b], '2026-10-6')
  expect(c).toEqual({ prompt: 7, commit: 1, fileChanged: 1, checkFixed: 1 })
  expect(describeDay(c)).toEqual(['7 asks', '1 file changed', '1 commit', 'fixed a failing check'])
  expect(lastDayBefore([a, b], '2026-10-7')).toBe('2026-10-6')
  expect(lastDayBefore([a, b], '2026-10-6')).toBeUndefined()
})

test('only two weeks of days are kept', () => {
  let t = NONE
  for (let d = 1; d <= 20; d++) t = count(t, 'prompt', `2026-10-${d}`)
  expect(Object.keys(t.byDay ?? {}).length).toBe(14)
  expect(t.byDay?.['2026-10-20']).toEqual({ prompt: 1 })
  expect(t.byDay?.['2026-10-1']).toBeUndefined()
  expect(t.counts.prompt).toBe(20)
})

test('when, and what is coming up', () => {
  expect(whenWas('2026-10-6', '2026-10-7')).toBe('yesterday')
  expect(whenWas('2026-10-2', '2026-10-5')).toBe('on Friday')
  expect(nextDate({ month: 10, weekday: 1, nth: 2 }, new Date(2026, 9, 7))?.getDate()).toBe(12)
  expect(comingUp(new Date(2026, 9, 7, 9), 'CA', [])).toEqual({ name: 'Thanksgiving', inDays: 5 })
  expect(comingUp(new Date(2026, 9, 7, 9), 'CA', ['thanksgiving-ca'])).toBeUndefined()
  expect(comingUp(new Date(2026, 11, 22, 9), '', [])).toEqual({ name: 'Christmas', inDays: 3 })
})

async function start($: any, on: any, at: Date, saved: Map<string, unknown>) {
  const clock = mock.clock(on, { now: at.getTime() })
  on('session.start', () => ({ cwd: '/w' }))
  on('command.register', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
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
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/w' })
  await clock.settle()
  return clock
}

const typed = ($: any) => $.prompt.edit({ origin: { kind: 'composer' }, text: 'h', cursor: 1, start: 1, end: 1, inputText: 'i' })

test('the morning letter: yesterday, once a day, put away when you like', async ($, on) => {
  let yesterday = NONE
  for (let i = 0; i < 9; i++) yesterday = count(yesterday, 'prompt', '2026-10-6')
  yesterday = count(yesterday, 'commit', '2026-10-6')
  const saved = new Map<string, unknown>([['progress:old', yesterday]])
  const clock = await start($, on, new Date(2026, 9, 7, 9, 0), saved)

  await typed($)
  await clock.settle()
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: 'good morning! ✉ a little note for you~' })).toBeDefined()
  // A word about the day, never a tally
  expect(await ui.find({ type: 'Text', text: 'yesterday was a good one with you. thank you for letting me tag along ✧' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /asks|commit/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: '♡ Ai-chan' })).toBeDefined()
  expect(saved.get('lastLetter')).toBe(dayOf(new Date(2026, 9, 7, 9).getTime()))

  await ui.press({ key: 'letter-away' })
  expect(await ui.find({ type: 'Text', text: '♡ Ai-chan' })).toBeUndefined()
})

test('no second letter the same day, even in another session', async ($, on) => {
  const saved = new Map<string, unknown>([['lastLetter', '2026-10-7']])
  const clock = await start($, on, new Date(2026, 9, 7, 11, 0), saved)
  await typed($)
  await clock.settle()
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ key: 'letter-away' })).toBeUndefined()
})

test('the evening wrap-up, once, after you wind down', async ($, on) => {
  let today = NONE
  for (let i = 0; i < 6; i++) today = count(today, 'prompt', '2026-10-7')
  today = count(today, 'commit', '2026-10-7')
  today = count(today, 'commit', '2026-10-7')
  const saved = new Map<string, unknown>([['progress:old', today], ['lastLetter', '2026-10-7']])
  const clock = await start($, on, new Date(2026, 9, 7, 19, 0), saved)
  await typed($)

  for (let minute = 0; minute < 16; minute++) await clock.advance(60_000)
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /what a day! 6 asks · 2 commits ✧ rest well/ })).toBeDefined()
})

test('a letter waits for a night break: up past midnight brings none, the morning after does', async ($, on) => {
  let yesterday = NONE
  for (let i = 0; i < 4; i++) yesterday = count(yesterday, 'prompt', '2026-10-7')
  // You were typing five minutes ago, last night
  const saved = new Map<string, unknown>([
    ['progress:old', yesterday],
    ['lastLetter', '2026-10-7'],
    ['lastActive', new Date(2026, 9, 8, 0, 0).getTime()],
  ])
  const clock = await start($, on, new Date(2026, 9, 8, 0, 5), saved)
  await typed($)
  await clock.settle()
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ key: 'letter-away' })).toBeUndefined()
  expect(saved.get('lastLetter')).toBe('2026-10-7')
  await ui.unmount()

  // Still at it twenty minutes later: still none
  for (let minute = 0; minute < 20; minute++) {
    await clock.advance(60_000)
    await typed($)
  }
  await clock.settle()
  expect(saved.get('lastLetter')).toBe('2026-10-7')
})

test('the morning after a night break, the letter comes, streak and all', async ($, on) => {
  let days = NONE
  for (const d of ['2026-10-5', '2026-10-6', '2026-10-7']) days = count(days, 'prompt', d)
  // Last typed at half past midnight; back at eight
  const saved = new Map<string, unknown>([
    ['progress:old', days],
    ['lastLetter', '2026-10-7'],
    ['lastActive', new Date(2026, 9, 8, 0, 30).getTime()],
  ])
  const clock = await start($, on, new Date(2026, 9, 8, 8, 0), saved)
  await typed($)
  await clock.settle()
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ key: 'letter-away' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /4 days in a row/ })).toBeDefined()
  expect(saved.get('lastLetter')).toBe('2026-10-8')
})

test('the letter names a win, and with something real to say, they write it themselves', async ($, on) => {
  const yesterday = count(NONE, 'prompt', '2026-10-7')
  const saved = new Map<string, unknown>([
    ['progress:old', yesterday],
    ['lastLetter', '2026-10-7'],
    ['lastActive', new Date(2026, 9, 7, 22, 0).getTime()],
    ['memories:old', [{ day: '2026-10-7', what: 'the tests went green again' }]],
    ['highlights:old', [{ day: '2026-10-7', asked: 'make the login remember people', said: 'the login remembers you now ✧' }]],
  ])
  const asked: string[] = []
  const answer = ''
  on('model.complete', ($: unknown, e: { prompt: string }) => {
    asked.push(e.prompt)
    return { value: { isAnswered: answer !== '', text: answer, usage: USAGE } } as never
  })
  // No answer: their own words, naming the win
  const clock = await start($, on, new Date(2026, 9, 8, 8, 0), saved)
  await typed($)
  await clock.settle()
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /yesterday, the tests went green again|thinking about yesterday, when the tests went green again/ })).toBeDefined()
  expect(asked[0]).toMatch(/make the login remember people/)
  expect(asked[0]).toMatch(/the tests went green again/)
  expect(asked[0]).not.toMatch(/asks|commits/)
})

test('on the anniversary of the day you met, a longer letter about the year, in their words', async ($, on) => {
  let year = NONE
  for (const d of ['2026-3-2', '2026-3-3', '2026-3-4', '2026-9-1', '2026-10-7']) year = together(count(year, 'prompt', d), 'aichan', d)
  year = count(year, 'lateWork', '2026-3-3')
  const saved = new Map<string, unknown>([
    ['progress:old', year],
    ['lastLetter', '2026-10-7'],
    ['lastActive', new Date(2026, 9, 7, 22, 0).getTime()],
    ['met', { aichan: '2025-10-8' }],
    ['yearbook:aichan', [{ month: '2026-3', what: 'the login shipped' }]],
  ])
  const asked: { system?: string; prompt: string }[] = []
  on('model.complete', ($: unknown, e: { system?: string; prompt: string }) => {
    asked.push(e)
    return { value: { isAnswered: true, text: 'A whole year. I still think about the night the login finally shipped.', usage: USAGE } } as never
  })
  const clock = await start($, on, new Date(2026, 9, 8, 8, 0), saved)
  await typed($)
  await clock.settle()
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /1 year with Ai-chan/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /A whole year\. I still think about the night the login finally shipped\./ })).toBeDefined()
  expect(asked[0]!.system ?? '').toMatch(/1 year since you met/)
  expect(asked[0]!.prompt).toMatch(/5 days coding together/)
  expect(asked[0]!.prompt).toMatch(/longest run: 3 days in a row/)
  expect(asked[0]!.prompt).toMatch(/1 late nights|1 late night/)
  expect(asked[0]!.prompt).toMatch(/a win: the login shipped/)
})

test('the year keeps one win a month, for two years', () => {
  let list = keepYearWin([], '2026-3', 'the login shipped')!
  expect(keepYearWin(list, '2026-3', 'something else')).toBeUndefined()
  list = keepYearWin(list, '2026-4', 'the tests went green')!
  expect(list.map(w => w.what)).toEqual(['the login shipped', 'the tests went green'])
  expect(yearBrief({ years: '2 years', days: 80, streak: 1, lateNights: 0, wins: [], hearts: 7 })).not.toMatch(/in a row|late nights/)
})

test('a note of their own replaces the stand-in, and code never gets in', async ($, on) => {
  const saved = new Map<string, unknown>([
    ['progress:old', count(NONE, 'prompt', '2026-10-7')],
    ['lastLetter', '2026-10-7'],
    ['lastActive', new Date(2026, 9, 7, 22, 0).getTime()],
    ['highlights:old', [{ day: '2026-10-7', asked: 'fix the signup bug', said: 'signup works again!' }]],
  ])
  on('model.complete', () => ({ value: { isAnswered: true, text: 'Getting signup working again last night felt so good. I hope you slept well!', usage: USAGE } }))
  const clock = await start($, on, new Date(2026, 9, 8, 8, 0), saved)
  await typed($)
  await clock.settle()
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: 'Getting signup working again last night felt so good. I hope you slept well!' })).toBeDefined()
})

test('the letter rules: a break, a tidy note, a few days of highlights', () => {
  const HOUR = 60 * 60_000
  // Past midnight, still going
  expect(isAfterBreak(0, 5 * 60_000)).toBe(false)
  expect(isAfterBreak(2, 2 * HOUR)).toBe(false)
  // A real break, any hour; or morning and a pause
  expect(isAfterBreak(2, 3 * HOUR)).toBe(true)
  expect(isAfterBreak(7, 40 * 60_000)).toBe(true)
  expect(isAfterBreak(7, 5 * 60_000)).toBe(false)

  expect(tidyNote('"We fixed the parser.\nIt felt great!"')).toBe('We fixed the parser. It felt great!')
  expect(tidyNote('We changed `parse()` in src/parser.ts')).toBe('')
  expect(tidyNote('A sentence. '.repeat(40)).length).toBeLessThanOrEqual(300)

  let list = keepHighlight([], { day: '2026-10-1', asked: 'a', said: 'old' }, '2026-10-1')
  list = keepHighlight(list, { day: '2026-10-7', asked: 'b', said: 'new' }, '2026-10-7')
  list = keepHighlight(list, { day: '2026-10-7', asked: 'b', said: 'new' }, '2026-10-7')
  expect(list).toEqual([{ day: '2026-10-7', asked: 'b', said: 'new' }])
  expect(letterBrief({ when: 'yesterday', highlights: list, wins: ['the build worked again'] })).toMatch(/they asked: b \/ you said after: new\n- the build worked again/)
})
