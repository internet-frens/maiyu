import { expect, mock, test } from 'claude-code/testing'

import { brief, cheer, classify, counts, describe, fallback, judge, language, looksLikeCode, react, tidy } from '../hooks/coach'
import { DEFAULT, voiceOf } from '../characters/index'
import type { Score } from '../types'

const say = voiceOf(DEFAULT)

const NONE: Score = { checks: {}, wins: 0, losses: 0, isQuiet: false, hidesDiffs: false }

const PANE = {
  plugin: 'maiyu',
  component: 'Pane',
  requestId: 'buddy',
  surface: 'terminal',
  viewport: { columns: 160, rows: 40 },
  props: {
    title: 'Buddy',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const BLANK = { cwd: '/work' }

test('knows which commands are checks', () => {
  expect(classify('npm test')).toBe('test')
  expect(classify('pytest -q tests/')).toBe('test')
  expect(classify('claude plugin test')).toBe('test')
  expect(classify('npx tsc -p .')).toBe('typecheck')
  expect(classify('npm run lint')).toBe('lint')
  expect(classify('cargo build --release')).toBe('build')
  expect(classify('ls -la')).toBeUndefined()
})

test('reads pass and fail counts', () => {
  expect(counts(' 14 pass\n 0 fail\n')).toEqual({ passed: 14, failed: 0 })
  expect(counts('=== 3 failed, 10 passed in 0.4s ===')).toEqual({ passed: 10, failed: 3 })
  expect(counts('Found 2 errors in 1 file.')).toEqual({ passed: undefined, failed: 2 })
})

test('celebrates red turning green, and shares a loss kindly', () => {
  const red = { ...NONE, checks: { test: { isPass: false, failed: 3 } } }
  expect(react(judge('test', false, '12 passed'), red, say).tone).toBe('win')
  expect(react(judge('test', false, '12 passed'), red, say).note).toMatch(/green again/)
  expect(react(judge('test', true, '1 failed, 11 passed'), red, say).note).toMatch(/down to 1 failing/)
  expect(react(judge('test', true, '3 failed'), red, say).note).toMatch(/still 3 failing/)
  expect(react(judge('test', true, '2 failed'), NONE, say).tone).toBe('loss')
  expect(react(judge('test', false, '9 passed'), NONE, say)).toMatchObject({ tone: 'good', note: '9 passing ✓ nice' })
})

test('cheers commits, pushes and PRs', () => {
  expect(cheer({ commit: { sha: 'abc1234def', kind: 'committed' } }, say)?.note).toBe('committed! another step done ✦')
  expect(cheer({ push: { branch: 'main' } }, say)?.note).toBe('pushed it up! ✦')
  expect(cheer({ pr: { number: 12, action: 'created' } }, say)?.note).toBe('pull request is up! ✦')
  expect(cheer(undefined, say)).toBeUndefined()
})

test('turns a model reply into one clean line', () => {
  expect(tidy('"Parser tests are green, nice work! (^▽^)"\nextra')).toBe('Parser tests are green, nice work! (^▽^)')
  expect(brief({ prompt: 'fix it', files: ['a.ts'], results: ['test passed'], wins: 1, losses: 0 }, 'finished')).toMatch(/a\.ts[\s\S]*test passed/)
  expect(fallback({ prompt: '', files: [], results: [], wins: 0, losses: 2 }, 'finished', say)).toMatch(/next time/)
})

test('a failing then passing test run goes from comfort to celebration', async ($, on) => {
  let isFailing = true
  on('tool.call', () => ({
    result: { stdout: isFailing ? '2 failed, 5 passed' : '7 passed', stderr: '', interrupted: false },
    isError: isFailing,
  }) as never)

  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  let ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /2 failing, we'll get it/ })).toBeDefined()
  await ui.unmount()

  isFailing = false
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /tests green again/ })).toBeDefined()
})

test('a commit gets a cheer', async ($, on) => {
  on('tool.call', () => ({
    result: { stdout: '', stderr: '', interrupted: false, gitOperation: { commit: { sha: 'feedbee1234', kind: 'committed' } } },
  }) as never)
  await $.tool.call({ tool: 'Bash', command: 'git commit -m "x"' })

  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /committed! another step done/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /feedbee/ })).toBeUndefined()
})

test('after a turn with wins she says a line of her own', async ($, on) => {
  const clock = mock.clock(on)
  const asked: string[] = []
  on('prompt.submit', ($, e) => ({ text: e.text }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('tool.call', () => ({ result: { stdout: '4 passed', stderr: '', interrupted: false } }) as never)
  on('turn.complete', () => ({ text: '' }))
  on('model.complete', ($, e) => {
    asked.push(e.prompt)
    return { value: { isAnswered: true, text: 'Parser tests all pass, yatta! (^▽^)', usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } } as never
  })

  await $.prompt.submit({ text: 'fix the parser' } as never)
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  await $.turn.complete({ turnId: 't', answer: 'done', durationMs: 10, isAborted: false, reason: 'answer' })
  await clock.settle()

  expect(asked[0]).toMatch(/fix the parser[\s\S]*test passed/)
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /Parser tests all pass/ })).toBeDefined()
})

test('/frens quiet stops her comments, /frens score counts wins', async ($, on) => {
  let calls = 0
  on('tool.call', () => ({ result: { stdout: '', stderr: '', interrupted: false, gitOperation: { push: { branch: 'main' } } } }) as never)
  on('turn.complete', () => ({ text: '' }))
  on('model.complete', () => {
    calls += 1
    return { value: { isAnswered: true, text: 'hi', usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } } as never
  })

  const quiet = await $.command.run({ command: 'frens', args: 'quiet' } as never)
  expect(quiet.text).toMatch(/keep her comments/)
  await $.tool.call({ tool: 'Bash', command: 'git push' })
  await $.turn.complete({ turnId: 't', answer: 'done', durationMs: 10, isAborted: false, reason: 'answer' })
  expect(calls).toBe(0)

  const tally = await $.command.run({ command: 'frens', args: 'score' } as never)
  expect(tally.text).toMatch(/1 wins, 0 losses/)
  void BLANK
})

test('describes work in plain words, never the command or path', () => {
  expect(describe('Bash', { command: 'npm test -- --watch=false' }, say).note).toBe('running the tests…')
  expect(describe('Bash', { command: 'git commit -m "wip"' }, say).note).toBe('working with git…')
  expect(describe('Bash', { command: 'rm -rf build && ls' }, say).note).toBe('running a command…')
  expect(describe('Edit', { file_path: '/work/src/parser.ts' }, say).note).toBe('ganbatte! writing TypeScript…')
  expect(describe('Read', { file_path: '/work/tests/parser.test.ts' }, say).note).toBe('reading some test code…')
  expect(describe('Grep', { pattern: 'fooBar\\(' }, say).note).toBe('looking through the project…')
  expect(language('/x/README.md')).toBe('writing')
})

test('spots code in her lines and drops it', () => {
  for (const code of ['run `npm test`', 'fixed parseArgs', 'edited src/app.ts', 'x = 1;', 'call render()', 'the snake_case thing']) {
    expect(looksLikeCode(code)).toBe(true)
  }
  for (const words of ['Parser tests are green, yatta! (^▽^)', 'tough one… we will get it (ง •̀_•́)ง', 'nice work on that TypeScript! ✧']) {
    expect(looksLikeCode(words)).toBe(false)
  }
  expect(tidy('Nice, `parse()` works now!')).toBe('')
})

test('a word in a path is not a check', () => {
  expect(classify('rm -rf build && ls')).toBeUndefined()
  expect(classify('cat tests/parser.ts')).toBeUndefined()
  expect(classify('test -f package.json')).toBeUndefined()
  expect(classify('npm run build')).toBe('build')
  expect(classify('make && ./run')).toBe('build')
  expect(classify('pnpm lint')).toBe('lint')
  expect(classify('python -m pytest -q')).toBe('test')
})
