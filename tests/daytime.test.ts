import { expect, test } from 'claude-code/testing'

import { atRest, chatEvery, dayMoment, inTone, swayOf, timeAir } from '../hooks/daytime'
import { seasonMoment } from '../hooks/seasons'
import type { Pose } from '../hooks/sprite'

const REST: Pose = {
  eyes: 'open',
  look: 0,
  mouth: 'smile',
  arms: 'down',
  blush: false,
  sweat: false,
  ahoge: 1,
  tear: false,
  confetti: 0,
  hop: 0,
  beat: 0,
}

test('the tone: bright by day, warm in the evening, calm at night, hushed late', () => {
  const line = 'Yay!! we did it! ready for more!? (◕‿◕)'
  expect(inTone(line, 'morning')).toBe(line)
  expect(inTone(line, 'afternoon')).toBe(line)
  expect(inTone(line, 'evening')).toBe('Yay! we did it! ready for more!? (◕‿◕)')
  expect(inTone(line, 'night')).toBe('Yay. we did it. ready for more? (◕‿◕)')
  expect(inTone(line, 'lateNight')).toBe('yay. we did it. ready for more? (◕‿◕)')
  // "I" and names in capitals stay
  expect(inTone("I'm here!", 'lateNight')).toBe("I'm here.")
  expect(inTone('AI time!~', 'lateNight')).toBe('AI time~')
  expect(inTone('wow!…', 'night')).toBe('wow…')
})

test('small talk: chattier in the morning, quieter late at night', () => {
  expect(chatEvery('morning')).toBeLessThan(chatEvery('afternoon'))
  expect(chatEvery('afternoon')).toBeLessThan(chatEvery('night'))
  expect(chatEvery('night')).toBeLessThan(chatEvery('lateNight'))
})

test('the day in the air never drifts past at the same time as the season', () => {
  for (let frame = 0; frame < 8 * 60 * 4 * 2; frame += 7) {
    expect(dayMoment(frame) > 0 && seasonMoment(frame) > 0).toBe(false)
  }
  expect([...Array(8 * 60 * 4).keys()].some(f => dayMoment(f) === 4)).toBe(true)
  expect([timeAir('morning'), timeAir('evening'), timeAir('night'), timeAir('lateNight')]).toEqual([undefined, 'fireflies', 'sparkles', 'sparkles'])
})

test('at rest: a dawn stretch, a morning cup, soft evening eyes, late-night yawns', () => {
  expect(atRest(REST, 'dawn', 0).arms).toBe('cheer')
  expect(atRest(REST, 'dawn', 100).eyes).toBe('lidded')
  expect(atRest(REST, 'morning', 30).arms).toBe('cup')
  expect(atRest(REST, 'morning', 2 * 60 * 4).arms).toBe('down')
  expect(atRest(REST, 'afternoon', 50)).toEqual(REST)
  expect(atRest(REST, 'evening', 40).eyes).toBe('soft')
  expect(atRest(REST, 'night', 12).eyes).toBe('blink')
  expect(atRest(REST, 'lateNight', 0).mouth).toBe('open')
  expect(atRest(REST, 'lateNight', 100)).toMatchObject({ eyes: 'lidded', mouth: 'small' })
  // A blink is never held open
  expect(atRest({ ...REST, eyes: 'blink' }, 'lateNight', 100).eyes).toBe('blink')
  expect(swayOf('lateNight')).toBeGreaterThan(swayOf('morning'))
})

test('/frens daytime tells the tone of the hour, and turns it off and on', async ($, on) => {
  const saved = new Map<string, unknown>()
  on('store.set', ($: unknown, e: { key: string; value: unknown }) => {
    saved.set(e.key, e.value)
    return { value: undefined }
  })
  const said = await $.command.run({ command: 'frens', args: 'daytime' } as never)
  expect(said.text).toMatch(/^Time of day: on\. It's \w+/)
  const off = await $.command.run({ command: 'frens', args: 'daytime off' } as never)
  expect(off.text).toMatch(/^Time of day: off/)
  expect(saved.get('daytime')).toBe('off')
  expect((await $.command.run({ command: 'frens', args: 'daytime on' } as never)).text).toMatch(/^Time of day: on/)
  expect((await $.command.run({ command: 'frens', args: 'help' } as never)).text).toMatch(/\/frens daytime/)
})
