import { expect, mock, test } from 'claude-code/testing'

import { bonded, count, together } from '../achievements/progress'
import type { Tally } from '../achievements/types'
import { CHARACTERS, byId } from '../characters/index'
import { NO_JOURNAL, jot, journalText, nextBeat } from '../hooks/journal'
import { anniversaryOn, daysWith, heartSlots, heartsBar, heartsFor, nextAnniversary, pointsWith, progressBar, toNextHeart } from '../hooks/bond'

const NONE: Tally = { counts: {}, days: {} }

const PANE = {
  plugin: 'maiyu',
  component: 'Pane',
  requestId: 'buddy',
  surface: 'terminal',
  viewport: { columns: 160, rows: 70 },
  props: { title: 'Ai-chan', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 70 }, view: {} },
} as const

test('hearts come slowly, in points: a day together is two', () => {
  expect([0, 3, 4, 9, 10, 19, 20, 40, 69, 70, 200].map(heartsFor)).toEqual([0, 0, 1, 1, 2, 2, 3, 4, 4, 5, 7])
  expect(toNextHeart(6)).toBe(4)
  expect(toNextHeart(70)).toBe(50)
  expect(toNextHeart(560)).toBeUndefined()
  expect(heartsBar(2)).toBe('♥ ♥ · · ·')
  // Halfway from 4 to 10
  expect(progressBar(7)).toBe('▰▰▱▱▱')
})

test('past five hearts, they turn gold one by one, in the same five slots', () => {
  expect(heartsFor(119)).toBe(5)
  expect(heartsFor(120)).toBe(6)
  expect(heartsFor(10_000)).toBe(10)
  expect(heartSlots(3)).toEqual({ gold: 0, pink: 3, empty: 2 })
  expect(heartSlots(7)).toEqual({ gold: 2, pink: 3, empty: 0 })
  expect(heartSlots(10)).toEqual({ gold: 5, pink: 0, empty: 0 })
  expect(heartsBar(5)).toBe('♥ ♥ ♥ ♥ ♥')
  expect(heartsBar(7)).toBe('♥ ♥ ♥ ♥ ♥  ★ ★ ☆ ☆ ☆')
})

test('bond points: a day, and a little more for a win, a hello, a favorite, a birthday or coming back; six a day at most', () => {
  let t = together(NONE, 'aichan', '2026-10-6')
  expect(pointsWith([t], 'aichan')).toBe(2)
  t = bonded(t, 'aichan', '2026-10-6', 'win')
  t = bonded(t, 'aichan', '2026-10-6', 'win')
  t = bonded(t, 'aichan', '2026-10-6', 'hi')
  expect(pointsWith([t], 'aichan')).toBe(4)
  t = bonded(t, 'aichan', '2026-10-6', 'birthday')
  t = bonded(t, 'aichan', '2026-10-6', 'favorite')
  expect(pointsWith([t], 'aichan')).toBe(6)
  // Another session, the same day: no double counting
  const other = bonded(together(NONE, 'aichan', '2026-10-6'), 'aichan', '2026-10-6', 'win')
  expect(pointsWith([t, other], 'aichan')).toBe(6)
  // Someone else's bond is their own
  expect(pointsWith([t], 'kai')).toBe(0)
})

test('nobody loses a heart they had: days together alone still earn them', () => {
  let t = NONE
  for (let d = 1; d <= 10; d++) t = together(t, 'sora', `2026-10-${d}`)
  expect(heartsFor(pointsWith([t], 'sora'))).toBe(3)
})

test('days together are per character, counted once a day, across sessions', () => {
  let a = together(NONE, 'aichan', '2026-10-6')
  a = together(a, 'aichan', '2026-10-6')
  a = together(a, 'kai', '2026-10-6')
  const b = together(NONE, 'aichan', '2026-10-7')
  expect(daysWith([a, b], 'aichan')).toBe(2)
  expect(daysWith([a, b], 'kai')).toBe(1)
  expect(daysWith([a, b], 'sora')).toBe(0)
})

test('counting an event keeps the days together', () => {
  // Recording any event used to drop them, so hearts never grew past a day
  let t = together(NONE, 'aichan', '2026-10-5')
  t = count(t, 'prompt', '2026-10-6')
  t = together(t, 'aichan', '2026-10-6')
  expect(daysWith([t], 'aichan')).toBe(2)
})

test('every character has ten moments, a title for all gold, warm hellos and a story told over months', () => {
  for (const c of CHARACTERS) {
    expect(c.bond.moments.length).toBe(10)
    expect(c.bond.title.length > 0).toBe(true)
    expect(c.story.name.length > 0).toBe(true)
    // Beats come further apart, never sooner than the last
    const after = c.story.beats.map(b => b.after)
    expect(after).toEqual([...after].sort((a, b) => a - b))
    expect(c.story.beats.length >= 5).toBe(true)
    for (const m of c.bond.moments) {
      expect(m.title.length > 0).toBe(true)
      expect(m.lines.length >= 2).toBe(true)
    }
    expect(c.bond.warm.length > 0).toBe(true)
  }
})

async function start($: any, on: any, saved: Map<string, unknown>) {
  const clock = mock.clock(on, { now: new Date(2026, 9, 7, 15, 0).getTime() })
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

test('the first heart brings a moment, once; the pane shows the hearts', async ($, on) => {
  let past = together(NONE, 'aichan', '2026-10-5')
  past = together(past, 'aichan', '2026-10-6')
  past = count(past, 'prompt', '2026-10-6')
  // Today's letter is already read, so the moment has the stage
  const saved = new Map<string, unknown>([['progress:old', past], ['lastLetter', '2026-10-7']])
  const clock = await start($, on, saved)
  // The hello first, then, a couple of minutes on, the moment
  for (let i = 0; i < 3; i++) {
    await typed($)
    await clock.advance(60_000)
  }

  let ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: 'you know what I like about working beside someone?' })).toBeDefined()

  // Your hearts, beside their name, a space between each
  expect(await ui.find({ type: 'Text', text: ' ♥' })).toBeDefined()
  expect(saved.get('moments')).toEqual(['aichan:1'])
  await ui.press({ key: 'letter-away' })
  await ui.unmount()

  // It doesn't come back
  await typed($)
  await clock.advance(60_000)
  ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: 'you know what I like about working beside someone?' })).toBeUndefined()

  const bond = await $.command.run({ command: 'frens', args: 'bond' } as never)
  expect(bond.text).toMatch(/♥ · · · · ▱▱▱▱▱ {2}Ai-chan +4 points, 2 days together · 6 to the next heart/)
  expect(bond.text).toMatch(/· · · · · ▱▱▱▱▱ {2}Kai +0 points, 0 days together/)
  expect(bond.text).toMatch(/Today with Ai-chan: ○ a day together · ○ a win together · ○ say hi · ○ something Ai-chan loves \(late nights together or weekend projects\)/)

  // Saying hi: an answer every time, a point once a day
  const hi = await $.command.run({ command: 'frens', args: 'hi' } as never)
  expect(hi.text).toMatch(/hi|hello/)
  const after = await $.command.run({ command: 'frens', args: 'bond' } as never)
  expect(after.text).toMatch(/Ai-chan +5 points/)
  expect(after.text).toMatch(/✓ say hi/)
})

test('one of their favorite things counts once a day, with a line', async ($, on) => {
  // A Saturday, late at night: Ai-chan loves late nights together and weekends
  const saved = new Map<string, unknown>([['lastLetter', '2026-10-10']])
  const clock = mock.clock(on, { now: new Date(2026, 9, 10, 23, 0).getTime() })
  on('session.start', () => ({ cwd: '/w' }))
  on('command.register', () => ({ value: undefined }) as never)
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
  on('prompt.submit', ($: unknown, e: { text: string }) => ({ text: e.text }))
  on('http.fetch', () => ({ value: { ok: false, status: 503, headers: {}, text: '' } }))
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/w' })
  await clock.settle()

  await $.prompt.submit({ text: 'one more thing' } as never)
  await $.prompt.submit({ text: 'and another' } as never)
  const bond = await $.command.run({ command: 'frens', args: 'bond' } as never)
  // A day together and a favorite: 3 points, the favorite once
  expect(bond.text).toMatch(/Ai-chan +3 points/)
  expect(bond.text).toMatch(/✓ something Ai-chan loves/)
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /staying up with me\? this is my favorite/ })).toBeDefined()
})

test('anniversaries: a year to the day you met, a leap day kept on the 28th', () => {
  expect(anniversaryOn('2025-10-7', new Date(2026, 9, 7, 15))).toBe(1)
  expect(anniversaryOn('2024-10-7', new Date(2026, 9, 7))).toBe(2)
  expect(anniversaryOn('2026-10-7', new Date(2026, 9, 7))).toBeUndefined()
  expect(anniversaryOn('2025-10-7', new Date(2026, 9, 8))).toBeUndefined()
  expect(anniversaryOn(undefined, new Date(2026, 9, 7))).toBeUndefined()
  expect(anniversaryOn('2024-2-29', new Date(2025, 1, 28))).toBe(1)
  expect(anniversaryOn('2024-2-29', new Date(2028, 1, 29))).toBe(4)
  expect(anniversaryOn('2024-2-29', new Date(2028, 1, 28))).toBeUndefined()
  expect(nextAnniversary('2025-10-12', new Date(2026, 9, 7))).toEqual({ inDays: 5, years: 1 })
  expect(nextAnniversary('2025-10-1', new Date(2026, 9, 7))).toEqual({ inDays: 359, years: 2 })
  expect(nextAnniversary('2026-10-7', new Date(2026, 9, 7))).toEqual({ inDays: 365, years: 1 })
})

test('on the anniversary of the day you met, it is the special day', async ($, on) => {
  const store = new Map<string, unknown>([['met', { aichan: '2025-10-7' }]])
  on('store.get', ($: unknown, e: { key: string }) => ({ value: store.get(e.key) }))
  on('store.set', ($: unknown, e: { key: string; value: unknown }) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('clock.now', () => ({ value: new Date(2026, 9, 7, 10).getTime() }))
  on('command.register', () => ({ value: undefined }) as never)
  on('store.keys', () => ({ value: [...store.keys()] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', () => ({ cwd: '/w' }))
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/w' })
  const events = await $.command.run({ command: 'frens', args: 'events' } as never)
  expect(events.text).toMatch(/● on  {2}Anniversaries/)
  const bond = await $.command.run({ command: 'frens', args: 'bond' } as never)
  expect(bond.text).toMatch(/since 7 October 2025/)
  expect((await $.command.run({ command: 'frens', args: 'events off anniversaries' } as never)).text).toBe('Anniversaries turned off.')
})

test('their story moves on as you spend days together: a beat a day at most, and /frens stories off keeps it to themselves', async ($, on) => {
  let past = NONE
  for (const d of ['2026-10-4', '2026-10-5', '2026-10-6']) past = together(past, 'aichan', d)
  // The first heart's moment already shared, and today's letter read
  const saved = new Map<string, unknown>([['progress:old', past], ['lastLetter', '2026-10-7'], ['moments', ['aichan:1']]])
  const clock = await start($, on, saved)
  const first = byId('aichan')!.story.beats[0]!.line
  for (let i = 0; i < 6 && saved.get('stories') === undefined; i++) {
    await typed($)
    await clock.advance(60_000)
  }
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: first })).toBeDefined()
  expect(saved.get('stories')).toEqual({ aichan: 1 })
  expect(saved.get('storyDay')).toBe('2026-10-7')

  const journal = (await $.command.run({ command: 'frens', args: 'journal' } as never)).text
  expect(journal).toMatch(/Ai-chan +1 of 10 moments · .+, 1 of 8 told/)
  expect(journal).toMatch(/\?\?\? · not met yet/)

  const off = (await $.command.run({ command: 'frens', args: 'stories off' } as never)).text
  expect(off).toMatch(/Stories: off/)
  expect(saved.get('storiesOn')).toBe('off')
})

test('the journal: things found by name, blanks for the rest; stories wait for enough days together', () => {
  const j = jot(jot(NO_JOURNAL, 'skies', 'rain')!, 'work', 'Python')!
  expect(jot(j, 'skies', 'rain')).toBeUndefined()
  const kai = byId('kai')!
  expect(nextBeat(kai.story, 0, 2)).toBeUndefined()
  expect(nextBeat(kai.story, 0, 3)?.index).toBe(0)
  expect(nextBeat(kai.story, kai.story.beats.length, 999)).toBeUndefined()
  const text = journalText({
    journal: { ...j, specials: ['halloween'] },
    specials: [{ id: 'halloween', name: 'Halloween' }, { id: 'valentines', name: "Valentine's Day" }],
    characters: CHARACTERS,
    moments: ['kai:1', 'kai:2'],
    told: { kai: 8 },
    days: { kai: 140 },
  })
  expect(text).toMatch(/Special days together \(1 of 2\)\n {2}Halloween · and 1 more to find/)
  expect(text).toMatch(/\?\?\? · \?\?\? · \?\?\? · \?\?\? · rain · \?\?\?/)
  expect(text).toMatch(/Python/)
  expect(text).toMatch(/Kai +2 of 10 moments · learning the guitar, the whole story/)
})
