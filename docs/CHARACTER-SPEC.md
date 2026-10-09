# Character spec

Everything a character is, field by field. Today characters are TypeScript
files in `characters/` (typed by `characters/types.ts`); the JSON form, for
characters loaded from a folder or the library, has exactly the same shape.
A complete example is [`aichan.example.json`](aichan.example.json), exported
from `characters/aichan.ts`.

The one difference in JSON: colors are `"#rrggbb"` strings (in TypeScript
they're numbers, `0xrrggbb`).

## Ground rules

- **Every character is a grown-up**, drawn and written that way.
- **Wholesome:** warm and friendly, never romantic or sexual.
- **Plain words:** nothing they say contains code, commands, file names,
  paths or backticks.
- **Their own voice:** lines should sound like them, not like a template.

## Top level

| Field | Type | Required | What it is |
| --- | --- | --- | --- |
| `id` | string | yes | Lowercase, no spaces: what `/frens character <id>` takes. Unique |
| `name` | string | yes | As shown: the pane's title, the start of their status line |
| `gender` | `"woman"` \| `"man"` \| `"nonbinary"` | yes | |
| `temperament` | `"cheerful"` \| `"sassy"` \| `"quiet"` | yes | Shown when you pick a character. Each has a sheet in [`sheets/`](sheets/README.md) |
| `pronouns` | object | yes | See [Pronouns](#pronouns) |
| `birthday` | `{ "month": 1-12, "day": 1-31 }` | yes | They wear a party hat, streamers fill the air, and they say `lines.birthday` |
| `voice` | object | yes | Everything they say. See [Voice](#voice) |
| `bond` | object | yes | Your relationship. See [Bond](#bond) |
| `story` | `{ "name": string, "beats": { "after": number, "line": string }[] }` | yes | Something going on in their own life ("learning the guitar"), told a beat at a time: each once you've coded together `after` days, at most one a day. About 8 beats from 3 to 130 days; the last one is for you |
| `look` | object | yes | How they're drawn. See [Look](#look) |
| `moods` | object | no | Per-mood touches on their expressions. See [Moods](#moods) |

## Pronouns

Filled into any line as `{they}`, `{them}`, `{their}` and `{themself}`.

```json
"pronouns": { "they": "she", "them": "her", "their": "her", "themself": "herself" }
```

## Voice

| Field | Type | What it is |
| --- | --- | --- |
| `persona` | string | Who they are, for the model writing their end-of-turn line: "a cheerful anime-style woman who…". Starts lowercase; it follows "You are {name}," |
| `style` | string | How they write: tone, and whether to use kaomoji. "Warm and playful. At most one kaomoji, no emoji." |
| `lines` | object | Every sentence they say. See [Lines](#lines) |
| `spinner` | string[] | Words for Claude's spinner while it works, one per turn: "Ganbatte-ing", "Locking in". No trailing "…" |
| `verbs` | object | More spinner words. See [Verbs](#verbs) |
| `status` | object | Their status line under the prompt. See [Status](#status) |
| `world` | object | The time of day, the week, seasons and weather. See [World](#world) |
| `events` | object | Optional: their own line for any special day, by its id. See [Special days](#special-days) |
| `chatter` | object | Small talk. See [Chatter](#chatter) |

### Verbs

More words for the spinner, mixed in with `spinner`. Every list should have
at least one word.

| Field | Type | When they're used |
| --- | --- | --- |
| `seasons` | `spring`, `summer`, `autumn`, `winter` → string[] | During that season (not with `/frens seasons off`) |
| `weather` | `clear`, `cloudy`, `fog`, `rain`, `snow`, `storm`, `hot`, `cold`, `windy` → string[] | On days with that weather (drizzle counts as rain) |
| `achievements` | achievement id → string[] | For good, once that achievement unlocks: `green-again`, `shipper`, `night-owl`, `regular`, `teamwork` |

### Lines

A **line** is a string, or a list of versions taken in turn so the same one
never comes twice running: `"reading some {lang}…"` or
`["reading some {lang}…", "peeking at some {lang}… ✧"]`. Fields marked
**list** must be lists.

Any version can be **kept back** until you're close or until you've earned
something: write it as an object instead of a string. `hearts` opens it from
that many hearts on (1–10; 6–10 are the gold ones); `unlock` opens it once that achievement is earned
(its id). Every line needs at least one plain version, open from the start.

```json
"finished": ["done.", { "text": "done. good work, partner", "hearts": 3 }, { "text": "shipped. again.", "unlock": "shipper" }]
```

Each line said is known by an id made of the character, the field and the
version's place in the list: `kai.finished.1`. Reorder versions and their ids
change.

Every line can use `{name}` and the pronouns. Some lines get their own values,
listed with them. Kaomoji and symbols like ✧ ✦ ☾ ☕ ♡ are welcome; emoji are not.

**You at the prompt**

| Field | When | Values |
| --- | --- | --- |
| `typingShort` | You're typing something short | |
| `typingLong` | You're typing something long | |
| `thinking` | You sent a prompt; Claude's thinking | |

**What Claude is doing**

| Field | When | Values |
| --- | --- | --- |
| `reading` | Claude reads a file | `{lang}`: "TypeScript", "test code", "config"… |
| `searching` | Claude searches the project | |
| `web` | Claude reads the web | |
| `writing` | Claude edits a file | `{lang}` |
| `runningTests` `checkingTypes` `linting` `building` | Claude runs that check | |
| `git` | Claude uses git | |
| `command` | Claude runs another command | |
| `helper` | Claude starts a helper agent | |
| `planning` | Claude makes a plan | |
| `tool` | Claude uses any other tool | |
| `toolFailed` | A tool call failed | |

**Checks** (tests, types, lint, builds)

| Field | When | Values |
| --- | --- | --- |
| `greenAgain` | A failing check passes again: a win | `{check}`: "tests", "types", "lint", "build" |
| `passing` | Tests pass, with a count | `{count}` |
| `checkPassed` | A check passes, no count | `{check}` |
| `downTo` | Still failing, but fewer | `{failing}`: "2 failing" |
| `stillFailing` | Failing again | `{failing}` |
| `failing` | Newly failing: a loss | `{failing}` |

**Git**

| Field | When | Values |
| --- | --- | --- |
| `pullRequest` | A pull request is opened or merged | `{done}`: "is up", "merged" |
| `merged` `pushed` `committed` | A merge, push or commit | |

**The end of a turn**

| Field | When | Values |
| --- | --- | --- |
| `allWins` `mixed` `tough` | The turn had only wins, both, or only losses | |
| `niceWork` | Files changed, no checks | `{lang}` of the first file |
| `finished` | Anything else | |
| `stopped` `error` | You stopped the turn; it hit an error | |

**Their own life**

| Field | When | Values |
| --- | --- | --- |
| `sleep` | They doze off | |
| `tea` | A tea break, after a long stretch of work | |
| `meal` | Mealtime | `{meal}`: "breakfast", "lunch", "dinner" |
| `back` | Back from a break or a meal | |
| `coffee` | **list.** Once a morning, a coffee break: blowing on the mug, a sip, a happy sigh. Taken in turn by day | |
| `water` | **list.** Every hour and a half or so, a sip and a gentle reminder to drink some water (nothing to answer) | |
| `missYou` | **list.** After an hour without you; never the same one twice running | |
| `welcomeBack` | **list.** When you come back after that | |
| `birthday` | Their birthday | |
| `anniversary` | A year (or more) to the day since you met | `{years}`: "1 year", "2 years" |
| `yearLetter` | The anniversary's longer letter, when no note of their own could be written | `{years}`; `{days}`: days coded together that year |

**Touching them** (a click on the portrait, the pat button, `/frens pat` or `/frens poke`; never a heart)

| Field | When | Values |
| --- | --- | --- |
| `touchHead` | A pat on the top of the head | |
| `touchHair` | Fiddling with their hair | |
| `touchCheek` | A poke on the cheek, or anywhere on the face | |
| `touchHands` | Their hand: a high five | |
| `touchHeld` | What they're holding, when it's none of the four below | |
| `touchTea` | Their mug of tea, on a break | |
| `touchCoffee` | Their morning coffee | |
| `touchSnack` | Their snack: an onigiri | |
| `touchWater` | Their glass of water | |
| `touchOutfit` | A tug at their clothes | |
| `touchWorn` | Something they're wearing | `{item}`: "headphones", "knit scarf" |
| `touchTooMuch` | Five touches in a row; they've had enough until it's quiet for 20 seconds | |
| `touchWake` | Woken by a touch | |
| `touchStroke` | A drag across their hair, stroking it | |
| `touchSquish` | A drag across a cheek, squishing it | |
| `catchLeaf` | You caught a falling leaf | |
| `catchPetal` | You caught a petal | |
| `catchSnowflake` | You caught a snowflake | |
| `catchFirefly` | You caught a firefly | |
| `catchGoldenLeaf` | **Rare:** a golden leaf, one leaf in a few hundred | |
| `catchBlossom` | **Rare:** a whole cherry blossom among the petals | |
| `catchCrystal` | **Rare:** a snow crystal among the snowflakes | |
| `catchShootingStar` | **Rare:** a shooting star, streaking past under the stars or among the fireflies | |

**Your other sessions**

| Field | When | Values |
| --- | --- | --- |
| `peerDone` | Another session finished | `{project}`, `{summary}` |
| `peerToast` | The toast for it; start with `{name}:` | `{project}` |

**The day as a loop**

| Field | When | Values |
| --- | --- | --- |
| `letter` | The morning letter's greeting | |
| `letterWin` | A win from last time, by name, when they can't write a note of their own (offline) | `{when}`: "yesterday", "on Friday"; `{win}`: "the tests went green again" |
| `letterRecap` | A word about last time, when there's no win to name. No tallies | `{when}` |
| `letterFresh` | When there's nothing to recap | |
| `letterSoon` | A special day coming up | `{event}`, `{soon}`: "tomorrow", "in 3 days" |
| `letterSign` | How they sign the letter | |
| `wrapUp` | The evening wrap-up | `{summary}` |
| `remember` | Bringing up a past win | `{when}`: "last Tuesday", "a week ago"; `{memory}`: "the tests went green again" |
| `streak` `streakRecord` | Days in a row; a new record | `{days}` |

**Achievements**

| Field | When | Values |
| --- | --- | --- |
| `unlocked` | An achievement unlocks something | `{achievement}`, `{item}` |
| `wearing` `wearingNothing` | Putting something on; taking it all off | `{item}` |

**Replies to `/frens`**

| Field | Reply to | Values |
| --- | --- | --- |
| `opened` `closed` `hint` | Opening and closing the pane; the hint when it can't open yet | |
| `quiet` `chatty` | `/frens quiet`, `/frens chatty` | |
| `diffsHidden` `diffsShown` | `/frens diffs` | |
| `notifyOn` `notifyOff` | `/frens notify` | |
| `alone` | `/frens sessions` with no other sessions | |
| `scoreUp` `scoreDown` | `/frens score`, ahead or behind | |
| `switched` | Switching to them | |
| `returned` | **list.** Switching back to them the same day you left | |

### Status

Their line under the prompt, one for each kind of moment. Start each with
their name.

| Field | When |
| --- | --- |
| `calm` | Nothing going on |
| `watching` | You're typing |
| `working` | Claude's working |
| `win` `loss` | Just after a win or a loss |
| `rest` | A break, a meal, water |
| `away` | They miss you |
| `sleep` | They're asleep |

### World

| Field | Type | When |
| --- | --- | --- |
| `greet` | object of string[] | The first hello in each part of the day: `dawn` (5–8), `morning` (8–12), `afternoon` (12–5), `evening` (5–9), `night` (9–12), `lateNight` (12–5) |
| `friday` `weekend` | string[] | In place of a morning hello on Fridays and weekends |
| `season` | object of strings | Once, when `spring`, `summer`, `autumn` or `winter` begins |
| `sky` | object of string[] | When the weather changes: `clear`, `cloudy`, `fog`, `drizzle`, `rain`, `snow`, `storm`. `{temp}`: "12°C"; `{where}`: " in Tokyo" for a city you set, nothing for a guess (write "it's raining{where}!") |

### Special days

`events` is optional: a line for any special day by its id in
`events/calendar.ts`, used instead of the day's own line.
Ids: `new-year`, `new-years-eve`, `lunar-new-year`, `valentines`, `pi-day`,
`eid-al-fitr`, `april-fools`, `earth-day`, `cinco-de-mayo`, `programmers-day`,
`thanksgiving-ca`, `halloween`, `diwali`, `thanksgiving-us`, `hanukkah`,
`christmas`.

```json
"events": { "halloween": "happy halloween~ boo! did I scare you? (｡•̀ᴗ-)✧" }
```

### Chatter

Small talk, now and then while you're around and they're not busy. Every pool
is a **list** of at least three; each is taken in turn. Versions can be kept
back, as in [Lines](#lines), and a pool with nothing open yet stays quiet: a
quiet character can hold all their small talk until you're close.

| Field | When |
| --- | --- |
| `afterWin` `afterLoss` | In the half hour after a win or a loss |
| `longSession` | After a couple of hours of work |
| `rain` `hot` `cold` | The weather |
| `morning` `afternoon` `evening` `night` | The time of day |
| `idle` | What's on their mind: their hobbies, little thoughts, questions for you. The best place for personality |

## Bond

| Field | Type | What it is |
| --- | --- | --- |
| `moments` | exactly 10 of `{ "title": string, "lines": string[] }` | A heart moment at each heart: a little scene where they share something about themselves. 2–4 lines each. The last five come as the hearts turn gold, over months: go deeper, and give each a small talk line (`hearts`: 6–10) that points back to it |
| `title` | string | What they call you once every heart is gold: "partner in crime" |
| `warm` | string[] | Warmer hellos, used now and then from three hearts on |
| `favorites` | list of `{ "kind", "name", "line" }` | Things they love you doing; each adds a bond point once a day, with their line. `name` reads in `/frens bond`: "rainy days" |
| `hiBack` | list of versions | Their answers when you say hi; versions can be kept back, as in [Lines](#lines) |


Favorite `kind`s: `lateNight` (10pm–4am), `weekend`, `morning` (5–9am),
`rain` (rain where you are), `evening`.

## Look

How they're drawn: a 32 × 44 pixel head-and-shoulders portrait.

| Field | Values | What it is |
| --- | --- | --- |
| `theme` | color | Their color in the pane: their name, speech bubble and headings. Bright enough to read on dark and light terminals |
| `palette` | object | See [Palette](#palette) |
| `hair` | `"long"` \| `"bob"` \| `"short"` | Past the shoulders, to the jaw, or above the ears |
| `bangs` | `"swept"` \| `"parted"` \| `"straight"` | To one side, down the middle, or a blunt fringe |
| `ahoge` | boolean | The strand of hair sticking up on top |
| `face` | `"narrow"` \| `"square"` | Tapering to the chin, or a broader jaw |
| `brows` | `"thin"` \| `"thick"` | |
| `lashes` | boolean | A flick of lashes at the outer corners |
| `facialHair` | `"none"` \| `"stubble"` | |
| `outfit` | `"blazer"` \| `"suit"` \| `"jacket"` \| `"hoodie"` \| `"sweater"` | Blazer over a blouse; suit with a tie; open jacket over a tee; hoodie; crew-neck sweater |
| `glasses` | boolean | Light half-rims |
| `accessories` | list of `"earrings"` \| `"necklace"` | |

### Palette

Every color is required. `"#rrggbb"` in JSON.

| Field | What it colors |
| --- | --- |
| `hair` `hairShade` `hairShine` | Hair; its shadows and the brows; the ring of shine |
| `skin` `skinShade` | Skin; the nose, the chin's shadow |
| `eyes` `eyesDark` `eyesGlow` | The iris, the pupil, the glow at the bottom of the iris |
| `blush` `lips` | Cheeks when they blush; the mouth |
| `top` `topShade` | The outer layer (blazer, jacket, hoodie, sweater) and its lapels or folds; also their sleeves |
| `inner` `innerShade` | What shows at the neck: blouse, shirt, tee |
| `accent` | A tie, a button, earrings, a necklace |
| `detail` | Glasses frames |

## Moods

Optional, and where a temperament shows: how they move through each event,
on top of the usual expressions (which are cheerful). Any of `eyes`, `mouth`,
`arms`, `blush`; `confetti`, `hop`, `tear` or `sweat` set to `false` leaves
that out. `frames` take turns every `every` ticks (a quarter second each) over
the rest, for a gesture now and then.

```json
"moods": {
  "celebrate": { "eyes": "lidded", "mouth": "smirk", "arms": "chin", "hop": false, "frames": [{}, {}, { "arms": "fist", "mouth": "grin" }], "every": 4 },
  "comfort": { "eyes": "soft", "tear": false }
}
```

| Field | Values |
| --- | --- |
| mood | `idle`, `sleepy`, `watching`, `thinking`, `reading`, `editing`, `running`, `worried`, `happy`, `celebrate`, `comfort`, `break`, `snack`, `water`, `miss` |
| `eyes` | `open`, `blink`, `happy`, `squeeze`, `determined`, `lidded`, `sleep`, `soft` |
| `mouth` | `smile`, `open`, `grin`, `wavy`, `flat`, `small`, `smirk` |
| `arms` | `down`, `wave`, `waveB` (the hand leaning out), `cheer`, `cheerB`, `fist`, `chin`, `typeA`, `typeB`, `cheeks`, `cup`, `snack`, `water`, `fanA`, `fanB` |
| `blush` | boolean |
| `confetti` `hop` `tear` `sweat` | `false` to leave out |
| `frames` | a list of `{ eyes, mouth, arms, blush }`, taking turns |
| `every` | ticks per frame (default 4) |


## Making one

1. Copy [`aichan.example.json`](aichan.example.json) (or `characters/aichan.ts`)
   and change everything: give them their own id, voice and look.
2. Today: save it as `characters/<id>.ts` and list it in
   `characters/index.ts`. Once JSON loading lands (roadmap step 3), a `.json`
   file in a characters folder will do.
3. Run `claude plugin test`: it checks every line fills in with no `{placeholder}`
   left over, every pool and list is filled, and every mood draws cleanly.
