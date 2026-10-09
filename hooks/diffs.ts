// The changes Claude made this session, kept as unified-diff hunks per file
// and cut to fit the rows under the buddy

import type { Change } from '../types'

export type Patch = { oldStart: number; oldLines: number; newStart: number; newLines: number; lines: string[] }

const MAX_FILES = 12
const MAX_HUNKS = 8
// A Code element holds at most 10000 characters
const MAX_SOURCE = 9000

const header = (oldStart: number, oldLines: number, newStart: number, newLines: number) =>
  `@@ -${oldStart},${oldLines} +${newStart},${newLines} @@`

export function toHunks(patches: readonly Patch[]): string[] {
  return patches.map(p => [header(p.oldStart, p.oldLines, p.newStart, p.newLines), ...p.lines].join('\n'))
}

// Folds a new edit into the session's changes: its file moves to the front
export function record(changes: readonly Change[], path: string, patches: readonly Patch[]): Change[] {
  const lines = patches.flatMap(p => p.lines)
  const added = lines.filter(l => l.startsWith('+')).length
  const removed = lines.filter(l => l.startsWith('-')).length
  const before = changes.find(c => c.path === path)
  const change: Change = {
    path,
    hunks: [...(before?.hunks ?? []), ...toHunks(patches)].slice(-MAX_HUNKS),
    added: (before?.added ?? 0) + added,
    removed: (before?.removed ?? 0) + removed,
  }
  return [change, ...changes.filter(c => c.path !== path)].slice(0, MAX_FILES)
}

// The first `rows` lines of one hunk, its header counts redone so it still parses
function cut(hunk: string, rows: number): string {
  const [head = '', ...body] = hunk.split('\n')
  const found = /^@@ -(\d+),?\d* \+(\d+),?\d* @@/.exec(head)
  const kept = body.slice(0, Math.max(1, rows - 1))
  if (!found) return [head, ...kept].join('\n')
  const oldLines = kept.filter(l => !l.startsWith('+')).length
  const newLines = kept.filter(l => !l.startsWith('-')).length
  return [header(Number(found[1]), oldLines, Number(found[2]), newLines), ...kept].join('\n')
}

// The newest hunks of a change that fit in `rows`, one row a line
export function fit(change: Change, rows: number): { source: string; rows: number } {
  const picked: string[] = []
  let used = 0
  let size = 0
  for (const hunk of [...change.hunks].reverse()) {
    const lines = hunk.split('\n').length
    if (used + lines <= rows && size + hunk.length <= MAX_SOURCE) {
      picked.unshift(hunk)
      used += lines
      size += hunk.length + 1
    } else {
      if (picked.length === 0 && rows >= 2) {
        const part = cut(hunk, rows).slice(0, MAX_SOURCE)
        picked.unshift(part)
        used = part.split('\n').length
      }
      break
    }
  }
  return { source: picked.join('\n'), rows: used }
}

// A path as the person reads it: under the project, relative to it
export function shown(path: string, root: string): string {
  return root && path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path
}
