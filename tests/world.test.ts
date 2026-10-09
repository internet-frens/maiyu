import { expect, mock, test } from 'claude-code/testing'

import { dayKind, describeWorld, partOfDay, readForecast, readGeocode, readIpLookup, seasonOf, skyOf } from '../hooks/world'

const PANE = {
  plugin: 'maiyu',
  component: 'Pane',
  requestId: 'buddy',
  surface: 'terminal',
  viewport: { columns: 160, rows: 60 },
  props: { title: 'Ai-chan', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
} as const

test('the moment: part of day, season by hemisphere, kind of day', () => {
  expect([3, 6, 9, 14, 19, 23].map(partOfDay)).toEqual(['lateNight', 'dawn', 'morning', 'afternoon', 'evening', 'night'])
  expect(seasonOf(9, 43)).toBe('autumn')
  expect(seasonOf(9, -33)).toBe('spring')
  expect(seasonOf(0)).toBe('winter')
  expect([0, 3, 5, 6].map(dayKind)).toEqual(['weekend', 'weekday', 'friday', 'weekend'])
  expect([0, 3, 45, 53, 63, 73, 95].map(skyOf)).toEqual(['clear', 'cloudy', 'fog', 'drizzle', 'rain', 'snow', 'storm'])
})

test('reads the services, Fahrenheit in the US, and nothing on nonsense', () => {
  const nyc = { latitude: 40.7, longitude: -74, name: 'New York', country: 'US' }
  const w = readForecast('{"current":{"temperature_2m":20,"weather_code":61,"is_day":1}}', nyc)
  expect(w).toMatchObject({ sky: 'rain', unit: 'F', place: 'New York' })
  expect(Math.round(w!.temperature)).toBe(68)
  expect(readForecast('not json', nyc)).toBeUndefined()
  expect(readGeocode('{"results":[{"latitude":35.7,"longitude":139.7,"name":"Tokyo","country_code":"JP"}]}')?.name).toBe('Tokyo')
  expect(readGeocode('{}')).toBeUndefined()
  expect(readIpLookup('{"success":true,"latitude":44,"longitude":-79,"city":"Newmarket","country_code":"CA"}')?.name).toBe('Newmarket')
  expect(readIpLookup('{"success":false}')).toBeUndefined()
  expect(describeWorld(w, 'evening')).toBe('☂ 68°F · evening')
  expect(describeWorld({ ...w!, isChosen: true }, 'evening')).toBe('☂ 68°F New York · evening')
  expect(describeWorld(undefined, 'lateNight')).toBe('late night')
})

async function start($: any, on: any, at: Date, urls: string[]) {
  const clock = mock.clock(on, { now: at.getTime() })
  const saved = new Map<string, unknown>()
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
  on('prompt.edit', () => ({ text: 'hi', cursor: 2 }))
  on('http.fetch', ($: unknown, e: { url: string }) => {
    urls.push(e.url)
    if (e.url.includes('ipwho.is')) return { value: { ok: true, status: 200, headers: {}, text: '{"latitude":43.6,"longitude":-79.4,"city":"Toronto","country_code":"CA"}' } }
    if (e.url.includes('geocoding')) return { value: { ok: true, status: 200, headers: {}, text: '{"results":[{"latitude":35.7,"longitude":139.7,"name":"Tokyo","country_code":"JP"}]}' } }
    return { value: { ok: true, status: 200, headers: {}, text: '{"current":{"temperature_2m":8,"weather_code":63,"is_day":1}}' } }
  })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/w' })
  await clock.settle()
  return { clock, saved }
}

const typed = ($: any) => $.prompt.edit({ origin: { kind: 'composer' }, text: 'h', cursor: 1, start: 1, end: 1, inputText: 'i' })

test('a Friday morning hello, then a word about the rain, with the weather but not the place in the pane', async ($, on) => {
  const urls: string[] = []
  // Friday 9 October 2026, 9:00
  const { clock } = await start($, on, new Date(2026, 9, 9, 9, 0), urls)
  // Asking about the weather waits for the first look
  await $.command.run({ command: 'frens', args: 'weather' } as never)
  expect(urls.some(u => u.includes('ipwho.is'))).toBe(true)
  // Coordinates go out rounded to one decimal
  expect(urls.find(u => u.includes('forecast'))).toMatch(/latitude=43\.6&longitude=-79\.4/)

  await typed($)
  await clock.advance(60_000)
  let ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /Friday/ })).toBeDefined()
  // Where you are is never shown
  expect(await ui.find({ type: 'Text', text: /Toronto/ })).toBeUndefined()
  await ui.unmount()

  // A couple of minutes after the hello, the rain
  for (let i = 0; i < 2; i++) {
    await typed($)
    await clock.advance(60_000)
  }
  ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /raining|the rain/ })).toBeDefined()

  expect(await ui.find({ type: 'Text', text: /Toronto/ })).toBeUndefined()
})

test('/frens weather <city> overrides the guess; off stops looking anything up', async ($, on) => {
  const urls: string[] = []
  await start($, on, new Date(2026, 9, 7, 15, 0), urls)
  await $.command.run({ command: 'frens', args: 'weather' } as never)
  const tokyo = await $.command.run({ command: 'frens', args: 'weather Tokyo' } as never)
  expect(tokyo.text).toBe('Weather, for Tokyo: ☂ 8°C Tokyo · afternoon')
  expect(urls.some(u => u.includes('geocoding') && u.includes('Tokyo'))).toBe(true)

  const asked = urls.length
  const off = await $.command.run({ command: 'frens', args: 'weather off' } as never)
  expect(off.text).toMatch(/nothing is looked up/)
  expect(urls.length).toBe(asked)
})

test('no hello to an empty room', async ($, on) => {
  const urls: string[] = []
  const { clock } = await start($, on, new Date(2026, 9, 7, 9, 0), urls)
  // You haven't typed: an hour passes with no greeting
  for (let minute = 0; minute < 15; minute++) await clock.advance(60_000)
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /ohayo|good morning/ })).toBeUndefined()
})
