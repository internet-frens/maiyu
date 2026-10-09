import { expect, test } from 'claude-code/testing'

import { fit, record, shown } from '../hooks/diffs'

const PATCH = { oldStart: 3, oldLines: 2, newStart: 3, newLines: 3, lines: [' keep', '-old', '+new', '+more'] }

const PANE = {
  plugin: 'maiyu',
  component: 'Pane',
  requestId: 'buddy',
  surface: 'terminal',
  viewport: { columns: 160, rows: 60 },
  props: {
    title: 'Buddy',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 50 },
    view: {},
  },
} as const

test('keeps each file once, newest first, with its counts', () => {
  let list = record([], '/w/a.ts', [PATCH])
  list = record(list, '/w/b.ts', [PATCH])
  list = record(list, '/w/a.ts', [PATCH])
  expect(list.map(c => c.path)).toEqual(['/w/a.ts', '/w/b.ts'])
  expect(list[0]).toMatchObject({ added: 4, removed: 2 })
  expect(list[0]!.hunks[0]).toBe('@@ -3,2 +3,3 @@\n keep\n-old\n+new\n+more')
})

test('fits whole hunks, or cuts one and redoes its header', () => {
  const [change] = record([], '/w/a.ts', [PATCH, { ...PATCH, oldStart: 20, newStart: 21 }])
  expect(fit(change!, 10).rows).toBe(10)
  expect(fit(change!, 6).source).toBe('@@ -20,2 +21,3 @@\n keep\n-old\n+new\n+more')
  expect(fit(change!, 3).source).toBe('@@ -20,2 +21,1 @@\n keep\n-old')
  expect(shown('/w/src/a.ts', '/w')).toBe('src/a.ts')
})

test('an edit shows as a diff under her', async ($, on) => {
  on('tool.call', () => ({
    result: { filePath: '/w/src/parser.ts', structuredPatch: [PATCH], oldString: 'old', newString: 'new' },
  }) as never)
  await $.tool.call({ tool: 'Edit', file_path: '/w/src/parser.ts', old_string: 'old', new_string: 'new' })
  // Off by default; turned on
  await $.command.run({ command: 'frens', args: 'diffs' } as never)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /changes · 1 file/ })).toBeDefined()
    const code = await ui.find({ type: 'Code' })
    expect(code?.props.format).toBe('diff')
    expect(code?.props.source).toMatch(/^@@ -3,2 \+3,3 @@/)
    await ui.unmount()
  }
})

test('diffs are off by default; /frens diffs shows and hides them', async ($, on) => {
  on('tool.call', () => ({ result: { filePath: '/w/a.ts', structuredPatch: [PATCH] } }) as never)
  await $.tool.call({ tool: 'Edit', file_path: '/w/a.ts', old_string: 'old', new_string: 'new' })
  let ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Code' })).toBeUndefined()
  await ui.unmount()

  const shown = await $.command.run({ command: 'frens', args: 'diffs' } as never)
  expect(shown.text).toMatch(/shown/)
  ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Code' })).toBeDefined()
  await ui.unmount()

  const hidden = await $.command.run({ command: 'frens', args: 'diffs' } as never)
  expect(hidden.text).toMatch(/hidden/)
  ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Code' })).toBeUndefined()
})
