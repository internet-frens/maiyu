import { expect, test } from 'claude-code/testing'

import { ITEMS, itemById } from '../achievements/items'
import { ACHIEVEMENTS } from '../achievements/list'
import { asTally, count, measure, newlyDone, progress } from '../achievements/progress'
import type { Tally } from '../achievements/types'
import { CHARACTERS, versionsOf } from '../characters/index'
import { HEIGHT, WIDTH, paletteOf, sprite } from '../hooks/sprite'
import type { Accessory } from '../hooks/sprite'

const NONE: Tally = { counts: {}, days: {} }
const base = { eyes: 'open', look: 0, mouth: 'smile', arms: 'down', blush: false, sweat: false, ahoge: 0, tear: false, confetti: 0, hop: 0, beat: 0 } as const

const PANE = {
  plugin: 'maiyu',
  component: 'Pane',
  requestId: 'buddy',
  surface: 'terminal',
  viewport: { columns: 160, rows: 60 },
  props: { title: 'Ai-chan', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
} as const

test('every achievement unlocks a real item or new lines, with a unique id', () => {
  expect(new Set(ACHIEVEMENTS.map(a => a.id)).size).toBe(ACHIEVEMENTS.length)
  for (const a of ACHIEVEMENTS) {
    if (a.unlocks !== undefined) expect(itemById(a.unlocks)).toBeDefined()
    // Nothing to wear: every character keeps something back for it
    else {
      for (const c of CHARACTERS) {
        const pools = [...Object.values(c.voice.lines).flatMap(versionsOf), ...Object.values(c.voice.chatter).flat(), ...c.bond.hiBack]
        if (!pools.some(v => typeof v !== 'string' && v.unlock === a.id)) throw new Error(`${c.id} has nothing for ${a.id}`)
      }
    }
    expect(a.goal > 0).toBe(true)
  }
})

test('counts, distinct days, and sessions on one day', () => {
  let a = count(NONE, 'commit', '2026-10-7')
  a = count(a, 'commit', '2026-10-7')
  a = count(a, 'commit', '2026-10-8')
  const b = count(NONE, 'commit', '2026-10-8')
  expect(measure({ event: 'commit', by: 'count' }, [a, b])).toBe(4)
  expect(measure({ event: 'commit', by: 'days' }, [a, b])).toBe(2)
  expect(measure({ event: 'commit', by: 'sessionsOnOneDay' }, [a, b])).toBe(2)
  expect(asTally('nonsense')).toEqual({ counts: {}, days: {}, byDay: {}, with: {}, bond: {} })
})

test('progress caps at the goal, and only new ones are newly done', () => {
  let t = NONE
  for (let i = 0; i < 30; i++) t = count(t, 'commit', `2026-10-${(i % 7) + 1}`)
  const all = progress([t])
  const shipper = all.find(p => p.achievement.id === 'shipper')!
  expect(shipper).toMatchObject({ value: 25, isDone: true })
  expect(newlyDone(all, []).map(p => p.achievement.id)).toEqual(['shipper'])
  expect(newlyDone(all, ['shipper'])).toEqual([])
})

test('every item fits every character', () => {
  for (const c of CHARACTERS) {
    for (const item of ITEMS) {
      const accessory = item.kind === 'accessory' ? (item as Accessory) : undefined
      const look = item.kind === 'palette' ? { ...c.look, palette: { ...c.look.palette, ...item.palette } } : c.look
      const palette = paletteOf(look.palette, accessory ? [accessory] : [])
      const rows = sprite(base, look, accessory ? [accessory] : [])
      expect(rows.length).toBe(HEIGHT)
      for (const row of rows) {
        expect(row.length).toBe(WIDTH)
        for (const ch of row) expect(ch === '.' || palette[ch] !== undefined).toBe(true)
      }
    }
  }
})

// A store shared by the test's sessions
function store(on: any, saved: Map<string, unknown>) {
  on('store.get', ($: unknown, e: { key: string }) => ({ value: saved.get(e.key) }))
  on('store.set', ($: unknown, e: { key: string; value: unknown }) => {
    saved.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...saved.keys()] }))
  on('ui.toast', () => ({ value: undefined }))
  on('clock.now', () => ({ value: new Date(2026, 9, 7, 15).getTime() }))
}

test('the 25th commit unlocks the gold pin, which goes straight on', async ($, on) => {
  const nearly: Tally = { counts: { commit: 24 }, days: { commit: ['2026-10-6'] } }
  const saved = new Map<string, unknown>([['progress:other', nearly]])
  store(on, saved)
  on('tool.call', () => ({ result: { stdout: '', stderr: '', interrupted: false, gitOperation: { commit: { sha: 'abc', kind: 'committed' } } } }) as never)

  await $.tool.call({ tool: 'Bash', command: 'git commit -m x' })
  // Reading achievements waits for the recording to finish
  await $.command.run({ command: 'frens', args: 'achievements' } as never)

  expect(saved.get('unlocked')).toEqual(['shipper'])
  expect(saved.get('wearing')).toEqual({ accessory: 'gold-pin' })
  const list = await $.command.run({ command: 'frens', args: 'achievements' } as never)
  expect(list.text).toMatch(/Achievements, 1 of 12:[^]*\n {2}\? one more, hidden until you find it$/)
  expect(list.text).toMatch(/✓ Shipper: gold pin/)
  expect(list.text).toMatch(/▱▱▱▱▱ Green again 0\/10 fixes → party hat/)

  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /gold pin/ })).toBeDefined()
})

test('wearing: only what you have unlocked, and none takes it all off', async ($, on) => {
  const saved = new Map<string, unknown>([['unlocked', ['regular']]])
  store(on, saved)
  // The poll would load these; here the session starts without sharing
  const locked = await $.command.run({ command: 'frens', args: 'wear party-hat' } as never)
  expect(locked.text).toMatch(/Not unlocked yet/)
  const missing = await $.command.run({ command: 'frens', args: 'wear crown' } as never)
  expect(missing.text).toMatch(/No item called "crown"/)
  const off = await $.command.run({ command: 'frens', args: 'wear none' } as never)
  expect(off.text).toMatch(/usual look/)
  expect(saved.get('wearing')).toEqual({})
})

test('best friends counts the most hearts with any one character', () => {
  // Thirty-five days with Kai is 70 points: five hearts. A few with Sora isn't
  const days = (n: number) => Array.from({ length: n }, (_, i) => `2026-${1 + Math.floor(i / 28)}-${1 + (i % 28)}`)
  const t: Tally = { ...NONE, with: { kai: days(35), sora: days(3) } }
  expect(measure({ by: 'hearts' }, [t])).toBe(5)
  expect(measure({ by: 'hearts' }, [{ ...NONE, with: { sora: days(3) } }])).toBe(1)
  expect(measure({ by: 'hearts' }, [NONE])).toBe(0)
})

test('hidden achievements stay out of the list until found', () => {
  const hidden = ACHIEVEMENTS.filter(a => a.hidden)
  expect(hidden.map(a => a.id)).toEqual(['friday-deploy'])
})
