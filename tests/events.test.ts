import { expect, test } from 'claude-code/testing'

import { CHARACTERS, birthdayOf, byId, versionsOf } from '../characters/index'
import { SPECIAL_DAYS, findDay, isOn, specialDayOn } from '../events/calendar'
import { SCENES, propOn } from '../events/scenes'
import { BEANIE, RAINCOAT, SEASONAL, SUMMER_LAYERS, dressFor, layered, seasonAir, seasonMoment } from '../hooks/seasons'
import { HEIGHT, LEAF_CYCLE, TWINKLE, WIDTH, paletteOf, sprite } from '../hooks/sprite'

const on = (iso: string, country = '') => specialDayOn(new Date(`${iso}T12:00:00`), country)?.id
const base = { eyes: 'open', look: 0, mouth: 'smile', arms: 'down', blush: false, sweat: false, ahoge: 0, tear: false, confetti: 0, hop: 0, beat: 0 } as const

test('the calendar: fixed dates, lead-ups, rules, moving dates, and countries', () => {
  expect(on('2026-12-25')).toBe('christmas')
  expect(on('2026-12-20')).toBe('christmas')
  expect(on('2026-12-19')).toBeUndefined()
  expect(on('2026-10-25')).toBe('halloween')
  expect(on('2026-10-24')).toBeUndefined()
  expect(on('2026-10-12', 'CA')).toBe('thanksgiving-ca')
  expect(on('2026-10-12', 'US')).toBeUndefined()
  expect(on('2026-11-26', 'US')).toBe('thanksgiving-us')
  expect(on('2027-02-07')).toBe('lunar-new-year')
  expect(on('2026-12-07')).toBe('hanukkah')
  expect(on('2026-10-07')).toBeUndefined()
  expect(on('2027-05-05')).toBe('cinco-de-mayo')
  expect(on('2027-05-04')).toBeUndefined()
  expect(isOn({ month: 11, weekday: 4, nth: 4 }, new Date(2027, 10, 25))).toBe(true)
})

test('every special day has a line, and its look fits every character', () => {
  for (const day of SPECIAL_DAYS) {
    expect(day.line.length > 0).toBe(true)
    if (!day.wears) continue
    for (const c of CHARACTERS) {
      const palette = paletteOf(c.look.palette, [day.wears])
      for (const row of sprite(base, c.look, [day.wears])) for (const ch of row) expect(ch === '.' || palette[ch] !== undefined).toBe(true)
    }
  }
})

test('dressing for the weather', () => {
  expect(dressFor(undefined)).toEqual({ pieces: [] })
  expect(dressFor({ sky: 'rain', temperature: 12, unit: 'C' }).palette).toEqual(RAINCOAT)
  expect(dressFor({ sky: 'snow', temperature: -4, unit: 'C' }).pieces.map(p => p.id)).toEqual([BEANIE.id, 'winter'])
  expect(dressFor({ sky: 'clear', temperature: 90, unit: 'F' }).palette).toEqual(SUMMER_LAYERS)
  expect(dressFor({ sky: 'cloudy', temperature: 15, unit: 'C' })).toEqual({ pieces: [] })
  expect(seasonAir('summer', true)).toBe('fireflies')
  expect(seasonAir('winter', false)).toBeUndefined()
})

test('pieces in one slot: the later wins; other slots stack', () => {
  const witch = SPECIAL_DAYS.find(d => d.id === 'halloween')!.wears!
  // A cold Halloween: the witch hat replaces the beanie, the scarf stays
  const worn = layered([SEASONAL.autumn, BEANIE, SEASONAL.winter, witch])
  expect(worn.map(p => p.id).sort()).toEqual(['winter', 'witch-hat'])
})

test('weather and seasons draw cleanly on everyone', () => {
  const scenes = [{ air: 'heat' }, { wind: true }, { storm: true, weather: 'rain' }, { fog: true }, { air: 'bats' }, { arms: 'fanA' }] as const
  for (const c of CHARACTERS) {
    for (const scene of scenes) {
      for (let drift = 0; drift < 8; drift++) {
        const rows = sprite({ ...base, ...scene, drift }, c.look, [BEANIE])
        expect(rows.length).toBe(HEIGHT)
        for (const row of rows) expect(row.length).toBe(WIDTH)
      }
    }
  }
})

test('birthdays are in every character and shown as people say them', () => {
  for (const c of CHARACTERS) expect(versionsOf(c.voice.lines.birthday).length > 0).toBe(true)

  expect(birthdayOf(byId('aichan')!)).toBe('3 April')
  expect(birthdayOf(byId('sora')!)).toBe('9 November')
})

test('days are found by id or name, however typed, and turned-off days are skipped', () => {
  expect(findDay('halloween')?.id).toBe('halloween')
  expect(findDay('Lunar New Year')?.id).toBe('lunar-new-year')
  expect(findDay('cinco-de-mayo')?.id).toBe('cinco-de-mayo')
  expect(findDay('nope')).toBeUndefined()
  expect(specialDayOn(new Date(2026, 9, 31, 12), '', ['halloween'])).toBeUndefined()
})

test('/frens events lists them, and turns them off and on, remembered for every session', async ($, on) => {
  const saved = new Map<string, unknown>()
  on('store.set', ($: unknown, e: { key: string; value: unknown }) => {
    saved.set(e.key, e.value)
    return { value: undefined }
  })
  on('clock.now', () => ({ value: new Date(2026, 9, 31, 12).getTime() }))

  const list = await $.command.run({ command: 'frens', args: 'events' } as never)
  expect(list.text).toMatch(/● on  {2}Halloween/)
  expect(list.text).toMatch(/● on  {2}Birthdays \(Ai-chan 3 April, Kai 21 August, Sora 9 November\)/)
  expect(list.text).toMatch(/Thanksgiving \(CA\)/)

  expect((await $.command.run({ command: 'frens', args: 'events off halloween' } as never)).text).toBe('Halloween turned off.')
  expect(saved.get('eventsOff')).toEqual(['halloween'])
  expect((await $.command.run({ command: 'frens', args: 'events' } as never)).text).toMatch(/○ off {2}Halloween/)

  await $.command.run({ command: 'frens', args: 'events off all' } as never)
  expect((saved.get('eventsOff') as string[]).length).toBe(SPECIAL_DAYS.length + 2)
  expect((await $.command.run({ command: 'frens', args: 'events on all' } as never)).text).toBe('All special days turned on.')
  expect(saved.get('eventsOff')).toEqual([])

  expect((await $.command.run({ command: 'frens', args: 'events off birthdays' } as never)).text).toBe('Birthdays turned off.')
  expect((await $.command.run({ command: 'frens', args: 'events off nonsense' } as never)).text).toMatch(/No special day called "nonsense"/)
})

test('a seasonal moment: a minute after something happens, fading in and out, at most four', () => {
  const minute = 60 * 4
  const counts = Array.from({ length: 8 * minute }, (_, age) => seasonMoment(age))
  expect(counts.filter(n => n > 0).length).toBe(minute)
  expect(seasonMoment(-5)).toBe(0)

  expect(Math.max(...counts)).toBe(4)
  expect(counts[0]).toBe(1)
  expect(counts[minute / 2]).toBe(4)
  expect(counts[minute + 10]).toBe(0)
})

test('/frens seasons switches between subtle, full and off', async ($, on) => {
  on('store.set', () => ({ value: undefined }))
  expect((await $.command.run({ command: 'frens', args: 'seasons' } as never)).text).toMatch(/^Seasons: subtle/)
  expect((await $.command.run({ command: 'frens', args: 'seasons off' } as never)).text).toMatch(/^Seasons: off/)
  expect((await $.command.run({ command: 'frens', args: 'seasons full' } as never)).text).toMatch(/^Seasons: full/)
})

test('autumn leaves fall slowly, sway as they go, and loop without a jump', () => {
  const c = CHARACTERS[0]!
  const rest = { eyes: 'open', look: 0, mouth: 'smile', arms: 'down', blush: false, sweat: false, ahoge: 1, tear: false, confetti: 0, hop: 0, beat: 0, air: 'leaves' } as const
  // Two leaves: the second falls down the open right side, in plain view
  const stems = (fall: number) =>
    sprite({ ...rest, fall, airCount: 2 }, c.look).flatMap((row, y) => [...row].flatMap((p, x) => (p === 'N' && x >= 20 ? [{ x, y }] : [])))
  expect(stems(0).length).toBe(1)
  // Slow: never more than a pixel a frame, and only about a pixel a second
  for (let f = 0; f < 40; f++) {
    const [now, next] = [stems(f)[0], stems(f + 1)[0]]
    if (now && next) expect(Math.abs(next.y - now.y)).toBeLessThanOrEqual(1)
  }
  const [start, later] = [stems(0)[0]!, stems(40)[0]!]
  expect(later.y - start.y).toBeGreaterThanOrEqual(8)
  expect(later.y - start.y).toBeLessThanOrEqual(14)
  // Sways: over one swing a leaf's stem moves side to side
  const xs = new Set([...Array(48).keys()].map(f => stems(f)[0]?.x))
  expect(xs.size).toBeGreaterThan(1)
  // The loop comes round exactly
  expect(sprite({ ...rest, fall: LEAF_CYCLE }, c.look)).toEqual(sprite({ ...rest, fall: 0 }, c.look))
})

test('stars and fireflies twinkle slowly and never go out', () => {
  const c = CHARACTERS[0]!
  const rest = { eyes: 'open', look: 0, mouth: 'smile', arms: 'down', blush: false, sweat: false, ahoge: 1, tear: false, confetti: 0, hop: 0, beat: 0 } as const
  for (const [air, lit, dim] of [['sparkles', 'W', 'n'], ['fireflies', 'Y', 'y']] as const) {
    const lights = (fall: number) => {
      const rows = sprite({ ...rest, air, fall }, c.look)
      // The eye shine is white too: count only what's around them
      return rows.flatMap((row, y) => [...row].map((p, x) => ({ p, x, y }))).filter(({ p, x }) => (p === lit || p === dim) && (x < 6 || x > 25))
    }
    const counts = [...Array(TWINKLE).keys()].map(f => lights(f).length)
    // Always the same number in the sky: dimmed, never gone
    expect(new Set(counts).size).toBe(1)
    // And from one frame to the next, at most a couple change
    for (let f = 0; f < TWINKLE; f++) {
      const changed = lights(f).filter((l, i) => l.p !== lights((f + 1) % TWINKLE)[i]?.p).length
      expect(changed).toBeLessThanOrEqual(2)
    }
  }
})

test('every special day has scenes, and every prop draws on every character', () => {
  for (const id of ['birthday', 'anniversary', ...SPECIAL_DAYS.map(d => d.id)]) {
    const scenes = SCENES[id] ?? []
    expect(scenes.length >= 2).toBe(true)
    for (const scene of scenes) {
      expect(scene.line.length > 0).toBe(true)
      if (!scene.prop) continue
      const { prop } = scene
      for (const rows of prop.frames) {
        // Every row the same width, inside the portrait, every color named
        expect(new Set(rows.map(r => r.length)).size).toBe(1)
        expect(prop.at.x >= 0 && prop.at.x + rows[0]!.length <= WIDTH).toBe(true)
        expect(prop.at.y >= 1 && prop.at.y + rows.length <= HEIGHT).toBe(true)
        for (const ch of rows.join('')) expect(ch === ':' || prop.colors[ch as '1'] !== undefined).toBe(true)
      }
      // Each frame, bobbing or not, once
      const pieces = new Map([0, 1, 2, 3, 4, 5, 6, 7].map(f => propOn(prop, f)).map(p => [p.id, p]))
      for (const piece of pieces.values()) {
        for (const c of CHARACTERS) {
          const palette = paletteOf(c.look.palette, [piece])
          const unpainted = sprite({ ...base, arms: scene.arms ?? 'hold' }, c.look, [piece]).join('').split('').filter(ch => ch !== '.' && palette[ch] === undefined)
          expect(unpainted).toEqual([])
        }
      }
    }
  }
  // A character's own scene lines, one for each scene
  for (const c of CHARACTERS) {
    for (const [id, lines] of Object.entries(c.voice.scenes ?? {})) expect(lines?.length).toBe(SCENES[id]?.length)
  }
})
