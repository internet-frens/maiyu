// The achievements. To add one, pick an event and a measure from ./types.ts, a
// goal, and an item from ./items.ts, or no item, for one that opens up lines.


import type { Achievement } from './types'

export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: 'green-again',
    name: 'Green again',
    description: 'Turn a failing check green 10 times',
    measure: { event: 'checkFixed', by: 'count' },
    goal: 10,
    unit: 'fixes',
    unlocks: 'party-hat',
  },
  {
    id: 'shipper',
    name: 'Shipper',
    description: '25 commits while we work together',
    measure: { event: 'commit', by: 'count' },
    goal: 25,
    unit: 'commits',
    unlocks: 'gold-pin',
  },
  {
    id: 'night-owl',
    name: 'Night owl',
    description: 'Work after midnight on 5 different days',
    measure: { event: 'lateWork', by: 'days' },
    goal: 5,
    unit: 'nights',
    unlocks: 'night-owl',
  },
  {
    id: 'regular',
    name: 'Regular',
    description: 'Code together on 7 different days',
    measure: { event: 'prompt', by: 'days' },
    goal: 7,
    unit: 'days',
    unlocks: 'lavender-hair',
  },
  {
    id: 'teamwork',
    name: 'Teamwork',
    description: 'Finish work in 3 sessions on the same day',
    measure: { event: 'turnDone', by: 'sessionsOnOneDay' },
    goal: 3,
    unit: 'sessions',
    unlocks: 'headphones',
  },
  {
    id: 'early-bird',
    name: 'Early bird',
    description: 'Work before 7 in the morning on 5 different days',
    measure: { event: 'earlyWork', by: 'days' },
    goal: 5,
    unit: 'mornings',
    unlocks: 'sunrise',
  },
  {
    id: 'best-friends',
    name: 'Best friends',
    description: 'Reach five hearts with any one character',
    measure: { by: 'hearts' },
    goal: 5,
    unit: 'hearts',
    unlocks: 'star-clip',
  },
  // These open up new lines rather than something to wear
  {
    id: 'weekend-warrior',
    name: 'Weekend warrior',
    description: 'Code together on 5 different weekend days',
    measure: { event: 'weekendWork', by: 'days' },
    goal: 5,
    unit: 'weekend days',
  },
  // A surprise: hidden until you find it
  {
    id: 'friday-deploy',
    name: 'Friday deploy',
    description: 'Push on a Friday evening',
    measure: { event: 'fridayDeploy', by: 'count' },
    goal: 1,
    unit: 'pushes',
    hidden: true,
  },

  {
    id: 'comeback',
    name: 'Comeback',
    description: 'Get a check green after it failed 5 times in a row',
    measure: { event: 'comeback', by: 'count' },
    goal: 1,
    unit: 'comebacks',
  },
  {
    id: 'fickle',
    name: 'Fickle',
    description: 'Switch characters 5 times',
    measure: { event: 'switched', by: 'count' },
    goal: 5,
    unit: 'switches',
  },
  {
    id: 'all-gold',
    name: 'All gold',
    description: 'Turn every heart gold with someone, over months together',
    measure: { event: 'goldHearts', by: 'count' },
    goal: 1,
    unit: 'friends',
    unlocks: 'gold-heart',
  },
]

