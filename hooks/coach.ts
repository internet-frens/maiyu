// What they makes of the work: which commands are checks, whether a check
// passed, and what that means next to how it went last time

import type { Character } from '../characters/types'
import type { Say } from '../characters/index'
import type { CheckKind, Score } from '../types'

export type Kind = CheckKind

// A package manager script, such as `npm run build` or `pnpm test`
const script = (names: string) => new RegExp(`\\b(npm|pnpm|yarn|bun)\\s+(run\\s+)?(${names})\\b`)

// Checks are told apart by the program that runs them, not a word anywhere
const KINDS: [Kind, RegExp][] = [
  ['test', script('test|t|test:\\S+')],
  ['test', /\b(jest|vitest|pytest|mocha|rspec|phpunit|ctest|tox)\b|\b(go|cargo|bun|deno|swift|dotnet)\s+test\b|\bplugin test\b|\bpython3?\s+-m\s+(pytest|unittest)\b/],
  ['typecheck', script('typecheck|type-check|tsc|check-types')],
  ['typecheck', /\b(tsc|mypy|pyright)\b|\bcargo check\b|\bplugin validate\b/],
  ['lint', script('lint|lint:\\S+')],
  ['lint', /\b(eslint|ruff|flake8|pylint|rubocop|golangci-lint|biome)\b|\bcargo clippy\b|\bprettier\s+--check\b/],
  ['build', script('build|build:\\S+')],
  ['build', /^\s*make\b|&&\s*make\b|\b(cargo|go|swift|dotnet|bazel|vite)\s+build\b|\b(gradle|gradlew|mvn|webpack)\b/],
]

const NAMES: Record<Kind, string> = { test: 'tests', typecheck: 'types', lint: 'lint', build: 'build' }

// The kind of check a shell command runs, if it runs one
export function classify(command: string): Kind | undefined {
  return KINDS.find(([, pattern]) => pattern.test(command))?.[0]
}

// Passing and failing counts, as test runners print them
export function counts(output: string): { passed?: number; failed?: number } {
  const number = (pattern: RegExp) => {
    const found = [...output.matchAll(pattern)].pop()
    return found ? Number(found[1]) : undefined
  }
  return {
    passed: number(/(\d+)\s+(?:passed|passing|pass)\b/gi),
    failed: number(/(\d+)\s+(?:failed|failing|fail|failures?|errors?)\b/gi),
  }
}

export type Verdict = {
  kind: Kind
  isPass: boolean
  passed?: number
  failed?: number
}

export function judge(kind: Kind, isError: boolean, output: string): Verdict {
  const found = counts(output)
  const isPass = !isError && (found.failed ?? 0) === 0
  return { kind, isPass, ...found }
}

export type Reaction = {
  /** A win to celebrate, a loss to share, or just good news */
  tone: 'win' | 'loss' | 'good'
  note: string
  entry: string
}

// How they take a check, given how the same check went before
export function react(v: Verdict, before: Score, say: Say): Reaction {
  const check = NAMES[v.kind]
  const last = before.checks[v.kind]
  if (v.isPass) {
    if (last?.isPass === false) {
      return { tone: 'win', note: say('greenAgain', { check }), entry: `✓ ${check} fixed` }
    }
    if (v.passed !== undefined) {
      return { tone: 'good', note: say('passing', { count: v.passed }), entry: `✓ ${v.passed} passing` }
    }
    return { tone: 'good', note: say('checkPassed', { check }), entry: `✓ ${check} pass` }
  }
  const failing = v.failed !== undefined ? `${v.failed} failing` : `${check} failed`
  if (last?.isPass === false && last.failed !== undefined && v.failed !== undefined && v.failed < last.failed) {
    return { tone: 'good', note: say('downTo', { failing }), entry: `↓ ${failing}` }
  }
  if (last?.isPass === false) {
    return { tone: 'loss', note: say('stillFailing', { failing }), entry: `✗ ${failing}` }
  }
  return { tone: 'loss', note: say('failing', { failing }), entry: `✗ ${failing}` }
}

export type GitOperation = {
  commit?: { sha: string; kind: string; branch?: string }
  push?: { branch: string }
  branch?: { ref: string; action: string }
  pr?: { number: number; action: string }
}

// Git moments worth a cheer
export function cheer(git: GitOperation | undefined, say: Say): Reaction | undefined {
  if (git?.pr && (git.pr.action === 'created' || git.pr.action === 'merged')) {
    const done = git.pr.action === 'merged' ? 'merged' : 'is up'
    return { tone: 'win', note: say('pullRequest', { done }), entry: `★ pull request ${done}` }
  }
  if (git?.branch?.action === 'merged') return { tone: 'win', note: say('merged'), entry: '★ merged' }
  if (git?.push) return { tone: 'win', note: say('pushed'), entry: '★ pushed' }
  if (git?.commit) return { tone: 'win', note: say('committed'), entry: '★ committed' }
  return undefined
}

// What a turn did, for their one-line comment
export type Turn = {
  prompt: string
  files: string[]
  results: string[]
  wins: number
  losses: number
}

// What the model is told, to write a character's end-of-turn line
// How close you are, for the model: closer means a little warmer, in their own way
const CLOSENESS = [
  "You're only just getting to know the programmer.",
  "You're getting to know the programmer.",
  'You and the programmer have become friends.',
  'You and the programmer are good friends.',
  "You and the programmer are close: you're a little warmer, in your own way.",
  "You and the programmer are the closest of friends: you're warmer, in your own way, and it shows.",
  // The second round, as the hearts turn gold, over months
  "You and the programmer have been through a lot together, and it shows in how easily you talk.",
  'You and the programmer know each other well: you share little jokes and remember the old days.',
  "You and the programmer are a real team: you trust them, and you're quietly proud of what you've built.",
  "You and the programmer are as close as friends get, after a long time together.",
]

export function systemFor(c: Character, hearts = 0): string {
  return [
    `You are ${c.name}, ${c.voice.persona}.`,
    hearts >= CLOSENESS.length ? `You and the programmer have been side by side for a long time: you call them your ${c.bond.title}.` : CLOSENESS[Math.max(0, hearts)],

    'Given what just happened, reply with ONE short sentence of at most 14 words.',
    'Be specific to the actual work: name the feature or result.',
    'React to wins and losses in your own voice, always on the programmer\'s side: never mean, never lecture or give step-by-step advice.',

    'Plain everyday words only: never write code, commands, file names, paths, identifiers or backticks; say "the parser" rather than its file.',
    c.voice.style,
    'No quotes, no preamble.',
  ].join(' ')
}

export function brief(turn: Turn, outcome: string): string {
  return [
    `The programmer asked: ${turn.prompt.slice(0, 300) || '(nothing)'}`,
    turn.files.length > 0 ? `Files changed: ${turn.files.slice(0, 8).join(', ')}` : 'No files changed.',
    turn.results.length > 0 ? `Results: ${turn.results.slice(-6).join('; ')}` : '',
    `Wins: ${turn.wins}. Losses: ${turn.losses}. The turn ${outcome}.`,
  ]
    .filter(Boolean)
    .join('\n')
}

// Their comment when no model answers
export function fallback(turn: Turn, outcome: string, say: Say): string {
  if (outcome !== 'finished') return say(outcome === 'was stopped' ? 'stopped' : 'error')
  if (turn.wins > 0 && turn.losses === 0) return say('allWins')
  if (turn.losses > 0 && turn.wins > 0) return say('mixed')
  if (turn.losses > 0) return say('tough')
  if (turn.files.length > 0) return say('niceWork', { lang: language(turn.files[0]!) })
  return say('finished')
}

// Text that reads like code rather than words: backticks, braces, operators,
// paths, file names or calls
export function looksLikeCode(text: string): boolean {
  return /[`{}<>;=$\\|]|\w\(|\/\w|\w\.\w{1,5}\b|\b\w+_\w+\b|\b[a-z]+[A-Z]\w*\b/.test(text)
}

// One clean sentence from a model's reply, or nothing when it reads like code
export function tidy(text: string): string {
  const line = text.trim().split('\n')[0]?.replace(/^["'“]|["'”]$/g, '').trim() ?? ''
  if (looksLikeCode(line)) return ''
  return line.length > 120 ? `${line.slice(0, 119)}…` : line
}

const LANGUAGES: [RegExp, string][] = [
  [/\.(ts|tsx|mts|cts)$/, 'TypeScript'],
  [/\.(js|jsx|mjs|cjs)$/, 'JavaScript'],
  [/\.py$/, 'Python'],
  [/\.rs$/, 'Rust'],
  [/\.go$/, 'Go'],
  [/\.(rb|erb)$/, 'Ruby'],
  [/\.(java|kt)$/, 'Java'],
  [/\.swift$/, 'Swift'],
  [/\.(c|h|cc|cpp|hpp)$/, 'C'],
  [/\.(css|scss|sass)$/, 'styling'],
  [/\.(html|svelte|vue)$/, 'page markup'],
  [/\.(md|mdx|txt|rst)$/, 'writing'],
  [/\.(json|ya?ml|toml|ini)$|rc$/, 'config'],
  [/\.(sh|zsh|bash)$/, 'shell script'],
  [/\.(test|spec)\.\w+$/, 'tests'],
]

// What kind of work a file is, in words
export function language(path: string): string {
  if (/\.(test|spec)\.\w+$|(^|\/)tests?\//.test(path)) return 'test code'
  return LANGUAGES.find(([pattern]) => pattern.test(path))?.[1] ?? 'code'
}

const ACTIVITIES: [Kind, 'runningTests' | 'checkingTypes' | 'linting' | 'building', string][] = [
  ['test', 'runningTests', 'running the tests'],
  ['typecheck', 'checkingTypes', 'checking the types'],
  ['lint', 'linting', 'tidying with the linter'],
  ['build', 'building', 'building'],
]

// What a tool call is doing, in plain words: a note in the character's voice
// while it runs and a neutral diary line, never the command or path itself
export function describe(
  tool: string,
  input: Record<string, unknown>,
  say: Say,
): { activity: 'reading' | 'editing' | 'running' | 'thinking'; note: string; entry: string } {
  const path = String(input.file_path ?? input.notebook_path ?? '')
  const lang = language(path)
  switch (tool) {
    case 'Read':
      return { activity: 'reading', note: say('reading', { lang }), entry: `read ${lang}` }
    case 'Grep':
    case 'Glob':
    case 'LS':
      return { activity: 'reading', note: say('searching'), entry: 'searched the project' }
    case 'WebFetch':
    case 'WebSearch':
      return { activity: 'reading', note: say('web'), entry: 'read the web' }
    case 'Edit':
    case 'Write':
    case 'MultiEdit':
    case 'NotebookEdit':
      return { activity: 'editing', note: say('writing', { lang }), entry: `wrote ${lang}` }
    case 'Bash': {
      const command = String(input.command ?? '')
      const kind = classify(command)
      const found = kind ? ACTIVITIES.find(([k]) => k === kind) : undefined
      if (found) return { activity: 'running', note: say(found[1]), entry: found[2] }
      if (/^\s*git\b/.test(command)) return { activity: 'running', note: say('git'), entry: 'working with git' }
      return { activity: 'running', note: say('command'), entry: 'running a command' }
    }
    case 'Agent':
    case 'Task':
      return { activity: 'thinking', note: say('helper'), entry: 'asked a helper' }
    case 'TodoWrite':
      return { activity: 'thinking', note: say('planning'), entry: 'made a plan' }
    default:
      return { activity: 'thinking', note: say('tool'), entry: 'used a tool' }
  }
}
