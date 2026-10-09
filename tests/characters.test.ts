import { expect, mock, test } from 'claude-code/testing'

import { ACHIEVEMENTS } from '../achievements/list'
import { CHARACTERS, DEFAULT, byId, describeCharacter, openOf, search, spinnerWords, textOf, versionsOf, voiceOf } from '../characters/index'
import type { LineKey } from '../characters/index'
import type { Version } from '../characters/types'
import { systemFor } from '../hooks/coach'
import { pose } from '../hooks/register'

import { HEIGHT, WIDTH, cells, paletteOf, sprite } from '../hooks/sprite'
import type { Buddy, Mood } from '../types'

const MOODS: Mood[] = ['idle', 'sleepy', 'watching', 'thinking', 'reading', 'editing', 'running', 'worried', 'happy', 'celebrate', 'comfort', 'break', 'snack', 'water', 'coffee', 'miss']
const at = (b: Partial<Buddy>): Buddy => ({ frame: 5, mood: 'idle', since: 0, look: 0, note: '', diary: [], worked: 0, lastMeal: '', lastCoffee: '', lastWater: 0, active: 0, missedFor: -1, missLine: -1, lastGreet: '', lastSeason: '', lastSky: '', lastSpecial: '', lastWrap: '', lastRecall: '', lastChat: -1_000_000, ...b })

const PANE = {
  plugin: 'maiyu',
  component: 'Pane',
  requestId: 'buddy',
  surface: 'terminal',
  viewport: { columns: 160, rows: 60 },
  props: { title: 'Buddy', isFocused: false, bodyColumns: 50, placement: 'dock', scroll: { offset: 0, bodyRows: 50 }, view: {} },
} as const

test('every character has a unique id and a full voice', () => {
  const ids = CHARACTERS.map(c => c.id)
  expect(new Set(ids).size).toBe(ids.length)
  for (const c of CHARACTERS) {
    expect(c.voice.lines.water.length > 0).toBe(true)
  }
  expect(byId('kai')?.gender).toBe('man')
  expect(byId('sora')?.pronouns.they).toBe('they')
})

test('every line fills in, with no placeholder left and no code', () => {
  const vars = { lang: 'TypeScript', check: 'tests', count: 3, failing: '2 failing', done: 'is up', meal: 'lunch', project: 'webapp', summary: 'all good', when: 'yesterday', soon: 'tomorrow', event: 'Halloween', memory: 'the tests went green again', win: 'the build worked again', days: 4, achievement: 'Shipper', item: 'gold pin', years: '2 years' }
  // Close, with everything earned: every version is open, and each one gets said
  const everything = () => ({ hearts: 5, unlocked: ACHIEVEMENTS.map(a => a.id) })
  for (const c of CHARACTERS) {
    const say = voiceOf(c, everything)
    for (const key of Object.keys(c.voice.lines) as LineKey[]) {
      if (key === 'water' || key === 'coffee' || key === 'missYou' || key === 'welcomeBack' || key === 'returned') continue
      for (let i = 0; i < versionsOf(c.voice.lines[key]).length; i++) {
        const line = say(key, vars)
        expect(line).not.toMatch(/\{\w+\}/)
        expect(line.length > 0).toBe(true)
      }
    }
  }

  expect(voiceOf(byId('kai')!)('closed')).toBe('Kai is stepping out. /frens brings him back.')
  expect(voiceOf(byId('sora')!)('quiet')).toBe('Sora will keep their thoughts to themself.')
})

test('every character draws every mood in their own palette', { timeoutMs: 30_000 }, () => {
  for (const c of CHARACTERS) {
    const palette = paletteOf(c.look.palette)
    for (const mood of MOODS) {
      for (let frame = 0; frame < 8; frame++) {
        const rows = sprite(pose(at({ mood, frame }), c), c.look)
        expect(rows.length).toBe(HEIGHT)
        for (const row of rows) {
          expect(row.length).toBe(WIDTH)
          for (const ch of row) expect(ch === '.' || palette[ch] !== undefined).toBe(true)
        }
      }
    }
    expect(atob(cells(sprite(pose(at({}), c), c.look), palette)).length).toBe(WIDTH * (HEIGHT / 2) * 12)
  }
})

test('each temperament moves through the same event its own way', () => {
  const kai = byId('kai')!
  const sora = byId('sora')!
  // A win: Ai-chan cheers and hops in confetti
  const cheer = pose(at({ mood: 'celebrate', frame: 0, since: 0 }), DEFAULT)
  expect([cheer.arms, cheer.hop, cheer.confetti > 0]).toEqual(['cheer', 1, true])
  // Kai puts a hand to his chin with a smirk, then punches a fist up
  const smug = pose(at({ mood: 'celebrate', frame: 0, since: 0 }), kai)
  expect([smug.arms, smug.mouth, smug.hop]).toEqual(['chin', 'smirk', 0])
  expect(pose(at({ mood: 'celebrate', frame: 8, since: 0 }), kai).arms).toBe('pump')
  // Sora smiles softly and blushes in the confetti, but doesn't hop
  const soft = pose(at({ mood: 'celebrate', frame: 0, since: 0 }), sora)
  expect([soft.eyes, soft.arms, soft.confetti > 0, soft.hop, soft.blush]).toEqual(['soft', 'down', true, 0, true])
  // A loss: Ai-chan sheds a tear, Kai doesn't
  expect(pose(at({ mood: 'comfort', frame: 0, since: 0 }), DEFAULT).tear).toBe(true)
  expect(pose(at({ mood: 'comfort', frame: 0, since: 0 }), kai).tear).toBe(false)
})


test('/frens characters lists them, and /frens character switches and remembers', async ($, on) => {
  const saved = new Map<string, unknown>()
  const titles: string[] = []
  on('store.set', ($: unknown, e: { key: string; value: unknown }) => {
    saved.set(e.key, e.value)
    return { value: undefined }
  })
  on('ui.open', ($: unknown, e: { id: string; title?: string }) => {
    titles.push(e.title ?? '')
    return { value: { isPlaced: true } }
  })

  const list = await $.command.run({ command: 'frens', args: 'characters' } as never)
  expect(list.text).toMatch(/● aichan +Ai-chan, woman \(she\/her\)/)
  expect(list.text).toMatch(/○ kai +Kai, man \(he\/him\), birthday 21 August/)

  await $.command.run({ command: 'frens', args: '' } as never)
  const switched = await $.command.run({ command: 'frens', args: 'character kai' } as never)
  expect(switched.text).toBe("Hey, I'm Kai. Let's get to work.")
  expect(saved.get('character')).toBe('kai')
  expect(titles).toEqual(['Ai-chan', 'Kai'])

  // He speaks in his own voice from then on
  const closed = await $.command.run({ command: 'frens', args: 'quiet' } as never)
  expect(closed.text).toBe('Kai will keep his thoughts to himself.')

  const missing = await $.command.run({ command: 'frens', args: 'character nobody' } as never)
  expect(missing.text).toMatch(/No character called "nobody"/)
})

test('the pane draws the chosen character', async ($, on) => {
  on('store.set', () => ({ value: undefined }))
  await $.command.run({ command: 'frens', args: 'character sora' } as never)
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ key: 'portrait' })).toBeDefined()
  const said = await ui.find({ type: 'Text', text: /Hello. I'm Sora/ })
  expect(said).toBeDefined()
})

test('every character has spinner words and a status for every mood', () => {
  for (const c of CHARACTERS) {
    expect(c.voice.spinner.length > 0).toBe(true)
    for (const key of ['calm', 'watching', 'working', 'win', 'loss', 'rest', 'away', 'sleep'] as const) {
      expect(c.voice.status[key].startsWith(c.name)).toBe(true)
    }
  }
})

test('the spinner speaks the character’s language in the terminal', async ($, on) => {
  on('store.set', () => ({ value: undefined }))
  on('ui.render', (($: unknown, e: { props: { word: string } }) => ({ type: 'Text', props: {}, children: [e.props.word] })) as never)
  const SPINNER = { plugin: 'maiyu', component: 'Spinner', viewport: { columns: 100, rows: 30 }, props: { word: 'Thinking', message: null, suffix: '…', mode: 'thinking' } } as const

  let ui: any = await $.ui.mount({ ...SPINNER, surface: 'terminal' })
  expect(byId('aichan')!.voice.spinner).toContain((await ui.find({ type: 'Text' }))?.children[0])
  await ui.unmount()

  await $.command.run({ command: 'frens', args: 'character kai' } as never)
  ui = await $.ui.mount({ ...SPINNER, surface: 'terminal' })
  expect(byId('kai')!.voice.spinner).toContain((await ui.find({ type: 'Text' }))?.children[0])
  await ui.unmount()

  // The desktop's spinner says what the step is doing, so it's left alone
  ui = await $.ui.mount({ ...SPINNER, surface: 'desktop' })
  expect((await ui.find({ type: 'Text' }))?.children[0]).toBe('Thinking')
})

test('the status line follows their mood, and goes with /frens off', async ($, on) => {
  const statuses: (string | undefined)[] = []
  const clock = mock.clock(on)
  on('session.start', () => ({ cwd: '/w' }))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.status', ($: unknown, e: { text?: string }) => {
    statuses.push(e.text)
    return { value: undefined }
  })
  on('tool.call', () => ({ result: 'ok' }))
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/w' })
  await clock.advance(250)
  expect(statuses.at(-1)).toBe('Ai-chan (◕‿◕) by your side')

  await $.tool.call({ tool: 'Read', file_path: '/w/a.ts' })
  await clock.advance(250)
  expect(statuses.at(-1)).toBe('Ai-chan ✧ cheering you on')

  await $.command.run({ command: 'frens', args: 'off' } as never)
  expect(statuses.at(-1)).toBeUndefined()
})

test('search: names as you type them, pronouns only whole', () => {
  expect(search('').map(c => c.id)).toEqual(['aichan', 'kai', 'sora'])
  expect(search('KA').map(c => c.id)).toEqual(['kai'])
  expect(search('ai-').map(c => c.id)).toEqual(['aichan'])
  expect(search('he').map(c => c.id)).toEqual(['kai'])
  expect(search('he/him').map(c => c.id)).toEqual(['kai'])
  expect(search('she').map(c => c.id)).toEqual(['aichan'])
  expect(search('nonbinary they').map(c => c.id)).toEqual(['sora'])
  expect(search('wom').map(c => c.id)).toEqual(['aichan'])
  expect(search('man').map(c => c.id)).toEqual(['kai'])
})

test('weather lines name a place only through {where}, which a guess leaves empty', () => {
  for (const c of CHARACTERS) for (const lines of Object.values(c.voice.world.sky)) for (const line of lines) expect(line).not.toMatch(/\{place\}/)
})

test('leave someone and come back the same day: they notice', async ($, on) => {
  const saved = new Map<string, unknown>()
  on('store.get', ($: unknown, e: { key: string }) => ({ value: saved.get(e.key) }))
  on('store.set', ($: unknown, e: { key: string; value: unknown }) => {
    saved.set(e.key, e.value)
    return { value: undefined }
  })
  on('clock.now', () => ({ value: new Date(2026, 9, 7, 15).getTime() }))

  const toKai = await $.command.run({ command: 'frens', args: 'character kai' } as never)
  expect(toKai.text).toBe("Hey, I'm Kai. Let's get to work.")
  const toSora = await $.command.run({ command: 'frens', args: 'character sora' } as never)
  expect(toSora.text).toBe("Hello. I'm Sora.")

  // Back to Ai-chan, whom you left first
  const back = await $.command.run({ command: 'frens', args: 'character aichan' } as never)
  expect(byId('aichan')!.voice.lines.returned).toContain(back.text)
  // And Kai, left after her
  const kai = await $.command.run({ command: 'frens', args: 'character kai' } as never)
  expect(byId('kai')!.voice.lines.returned).toContain(kai.text)
})

test('a new day forgets who you left', async ($, on) => {
  const saved = new Map<string, unknown>([['leftToday', { day: '2026-10-6', ids: ['kai'] }]])
  on('store.get', ($: unknown, e: { key: string }) => ({ value: saved.get(e.key) }))
  on('store.set', ($: unknown, e: { key: string; value: unknown }) => {
    saved.set(e.key, e.value)
    return { value: undefined }
  })
  on('clock.now', () => ({ value: new Date(2026, 9, 7, 9).getTime() }))
  const kai = await $.command.run({ command: 'frens', args: 'character kai' } as never)
  expect(kai.text).toBe("Hey, I'm Kai. Let's get to work.")
})

test('every character has came-back lines', () => {
  for (const c of CHARACTERS) expect(c.voice.lines.returned.length > 0).toBe(true)
})

test('lines with versions take them in turn, never the same twice running', () => {
  const say = voiceOf(byId('kai')!)
  const first = say('reading', { lang: 'Go' })
  const second = say('reading', { lang: 'Go' })
  const third = say('reading', { lang: 'Go' })
  expect(first).toBe('reading the Go. somebody has to')
  expect(second).not.toBe(first)
  expect(third).not.toBe(second)
  expect(say('reading', { lang: 'Go' })).toBe(first)
})

test('every character has small talk for every moment', () => {
  for (const c of CHARACTERS) for (const pool of Object.values(c.voice.chatter)) expect(pool.length >= 3).toBe(true)
})

test('small talk: now and then while you are around, fitting the moment, never while busy', { timeoutMs: 60_000 }, async ($, on) => {
  const saved = new Map<string, unknown>([['lastLetter', '2026-10-7']])
  const clock = mock.clock(on, { now: new Date(2026, 9, 7, 15, 0).getTime() })
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
  on('prompt.edit', () => ({ text: 'hi', cursor: 2 }))
  on('http.fetch', () => ({ value: { ok: false, status: 503, headers: {}, text: '' } }))
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/w' })
  await clock.settle()

  const typed = () => ($.prompt as any).edit({ origin: { kind: 'composer' }, text: 'h', cursor: 1, start: 1, end: 1, inputText: 'i' })
  const said: string[] = []
  for (let minute = 0; minute < 26; minute++) {
    if (minute % 5 === 0) await typed()
    await clock.advance(60_000)
    const ui = await $.ui.mount(PANE)
    const all = [...aichan.chatter.afternoon, ...aichan.chatter.idle].map(textOf)
    for (const line of all) if ((await ui.find({ type: 'Text', text: line })) && !said.includes(line)) said.push(line)
    await ui.unmount()
  }
  // About every twelve minutes: twice in 26, an afternoon line and an idle one
  expect(said.length).toBe(2)
  expect(aichan.chatter.afternoon).toContain(said[0])
  expect(aichan.chatter.idle).toContain(said[1])
})

const aichan = byId('aichan')!.voice

test('every character has verbs for every season, kind of weather and achievement', () => {
  const achievements = ['green-again', 'shipper', 'night-owl', 'regular', 'teamwork']
  const weather = ['clear', 'cloudy', 'fog', 'rain', 'snow', 'storm', 'hot', 'cold', 'windy'] as const
  for (const c of CHARACTERS) {
    for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) expect(c.voice.verbs.seasons[season].length > 0).toBe(true)
    for (const kind of weather) expect((c.voice.verbs.weather[kind] ?? []).length > 0).toBe(true)
    for (const id of achievements) expect((c.voice.verbs.achievements[id] ?? []).length > 0).toBe(true)
  }
})

test('the spinner words: their own, the season, the weather, and unlocked ones', () => {
  const kai = byId('kai')!
  expect(spinnerWords(kai, undefined, [], [])).toEqual(kai.voice.spinner)
  const words = spinnerWords(kai, 'autumn', ['rain', 'windy'], ['shipper'])
  expect(words).toContain('Raking')
  expect(words).toContain('Riding out the rain')
  expect(words).toContain('Leaning into the wind')
  expect(words).toContain('Pushing it out')
  expect(words).not.toContain('Bundling up')
})

test('the spinner uses unlocked words', async ($, on) => {
  on('store.set', () => ({ value: undefined }))
  on('store.get', ($: unknown, e: { key: string }) => ({ value: e.key === 'unlocked' ? ['shipper', 'night-owl', 'regular', 'teamwork', 'green-again'] : undefined }))
  on('store.keys', () => ({ value: [] }))
  on('clock.now', () => ({ value: new Date(2026, 9, 7, 15).getTime() }))
  on('ui.render', (($: unknown, e: { props: { word: string } }) => ({ type: 'Text', props: {}, children: [e.props.word] })) as never)
  // Reading achievements brings the unlocked list up to date
  await $.command.run({ command: 'frens', args: 'achievements' } as never)
  const SPINNER = { plugin: 'maiyu', component: 'Spinner', surface: 'terminal', viewport: { columns: 100, rows: 30 }, props: { word: 'Thinking', message: null, suffix: '…', mode: 'thinking' } } as const
  const all = spinnerWords(byId('aichan')!, 'spring', [], ['green-again', 'shipper', 'night-owl', 'regular', 'teamwork'])
  const ui = await $.ui.mount(SPINNER)
  expect(all).toContain((await ui.find({ type: 'Text' }))?.children[0])
})

// Every version kept back names a real achievement and a heart that exists,
// and every line and pool has something open from the start
test('kept-back versions are well formed, and every line has one open to a newcomer', () => {
  const ids = ACHIEVEMENTS.map(a => a.id)
  const check = (where: string, list: readonly Version[]) => {
    for (const v of list) {
      if (typeof v === 'string') continue
      if (v.unlock !== undefined && !ids.includes(v.unlock)) throw new Error(`${where}: no achievement "${v.unlock}"`)
      if (v.hearts !== undefined && !(v.hearts >= 1 && v.hearts <= 10)) throw new Error(`${where}: hearts ${v.hearts}`)
    }
  }
  const newcomer = { hearts: 0, unlocked: [] }
  for (const c of CHARACTERS) {
    for (const [key, raw] of Object.entries(c.voice.lines)) {
      check(`${c.id}.${key}`, versionsOf(raw))
      expect(openOf(raw, newcomer).length > 0).toBe(true)
    }
    for (const [pool, list] of Object.entries(c.voice.chatter)) check(`${c.id}.chatter.${pool}`, list)
    check(`${c.id}.hiBack`, c.bond.hiBack)
    expect(openOf(c.bond.hiBack, newcomer).length > 0).toBe(true)
  }
})

test('a version kept back opens with hearts or an achievement, and each line said reports its id', () => {
  const c = { ...DEFAULT, voice: { ...DEFAULT.voice, lines: { ...DEFAULT.voice.lines, finished: ['done', { text: 'done, partner', hearts: 3 }, { text: 'shipped', unlock: 'shipper' }] } } }
  const heard: string[] = []
  let s = { hearts: 0, unlocked: [] as string[] }
  const say = voiceOf(c, () => s, id => heard.push(id))
  expect([say('finished'), say('finished')]).toEqual(['done', 'done'])
  s = { hearts: 3, unlocked: ['shipper'] }
  expect([say('finished'), say('finished'), say('finished')].sort()).toEqual(['done', 'done, partner', 'shipped'])
  expect(heard.slice(0, 3)).toEqual(['aichan.finished.0', 'aichan.finished.0', expect.stringMatching(/^aichan\.finished\.[0-2]$/)])
  expect(describeCharacter(byId('kai')!)).toMatch(/^sassy · man/)
})

test('switching characters five times earns Fickle', async ($, on) => {
  const saved = new Map<string, unknown>()
  mock.clock(on, { now: new Date(2026, 9, 7, 10, 0).getTime() })
  on('store.get', ($: unknown, e: { key: string }) => ({ value: saved.get(e.key) }))
  on('store.set', ($: unknown, e: { key: string; value: unknown }) => {
    saved.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...saved.keys()] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  for (const id of ['kai', 'sora', 'kai', 'sora', 'kai']) await $.command.run({ command: 'frens', args: `character ${id}` } as never)
  // Achievements wait for the recording to finish
  await $.command.run({ command: 'frens', args: 'achievements' } as never)
  expect(saved.get('unlocked')).toEqual(['fickle'])
  const list = await $.command.run({ command: 'frens', args: 'achievements' } as never)
  expect(list.text).toMatch(/✓ Fickle: new lines/)
})


test('the end-of-turn comment knows how close you are', () => {
  expect(systemFor(byId('kai')!)).toMatch(/only just getting to know/)
  expect(systemFor(byId('kai')!, 5)).toMatch(/closest of friends/)
  expect(systemFor(byId('kai')!, 5)).toMatch(/never mean/)
})

test('a quiet character keeps their small talk until you are close', () => {
  const sora = byId('sora')!
  const newcomer = { hearts: 0, unlocked: [] }
  expect(openOf(sora.voice.chatter.idle, newcomer)).toEqual([])
  expect(openOf(sora.voice.chatter.idle, { hearts: 2, unlocked: [] }).length > 0).toBe(true)
  const earned = sora.voice.chatter.idle.filter(v => typeof v !== 'string' && v.unlock !== undefined).length
  expect(openOf(sora.voice.chatter.idle, { hearts: 10, unlocked: [] }).length).toBe(sora.voice.chatter.idle.length - earned)
})
