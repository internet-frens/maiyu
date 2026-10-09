// The buddy's view of your other Claude Code sessions. Each session keeps one record
// in the mod's store, which every session on this machine shares, and writes
// only its own, so no two sessions ever write the same key.

import type { Peer } from '../types'

export const PREFIX = 'session:'
// How often a session reads the others, and writes its heartbeat
export const POLL_MS = 5_000
export const HEARTBEAT_MS = 30_000
// No heartbeat this long and a session is gone (closed, or crashed)
export const STALE_MS = 3 * 60_000
// Records this old are swept away by whichever session sees them
export const FORGET_MS = 24 * 60 * 60_000

export const keyOf = (id: string) => `${PREFIX}${id}`

export const isAlive = (p: Peer, now: number) => now - p.seen < STALE_MS

// A stored value that is a usable record, whatever an older version wrote
export function asPeer(value: unknown): Peer | undefined {
  const v = value as Partial<Peer> | undefined
  if (!v || typeof v.id !== 'string' || typeof v.seen !== 'number') return undefined
  return {
    id: v.id,
    project: typeof v.project === 'string' ? v.project : 'a project',
    status: v.status === 'working' || v.status === 'done' ? v.status : 'idle',
    since: typeof v.since === 'number' ? v.since : v.seen,
    seen: v.seen,
    summary: typeof v.summary === 'string' ? v.summary : '',
  }
}

// The sessions that finished since they last looked
export function finished(before: ReadonlyMap<string, Peer['status']>, peers: readonly Peer[]): Peer[] {
  return peers.filter(p => p.status === 'done' && before.get(p.id) === 'working')
}

// Each session by its project's name, numbered where two share one
export function names(peers: readonly Peer[]): Map<string, string> {
  const out = new Map<string, string>()
  const counts = new Map<string, number>()
  for (const p of [...peers].sort((a, b) => a.since - b.since)) {
    const n = (counts.get(p.project) ?? 0) + 1
    counts.set(p.project, n)
    out.set(p.id, n === 1 ? p.project : `${p.project} (${n})`)
  }
  return out
}

// How long ago, as people say it
export function ago(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h${minutes % 60 > 0 ? ` ${minutes % 60}m` : ''}`
}

// One line about a session, in plain words
export function line(p: Peer, name: string, now: number): string {
  const time = ago(now - p.since)
  if (p.status === 'working') return `● ${name} · working${time === 'just now' ? '' : ` for ${time}`}`
  if (p.status === 'done') return `✓ ${name} · done${time === 'just now' ? ' just now' : ` ${time} ago`}`
  return `○ ${name} · resting`
}

export const projectOf = (root: string) => root.split('/').filter(Boolean).pop() ?? 'a project'

// The chip under their name: a session that just finished first, by name, then
// how many are working, done and resting
export function chip(peers: readonly Peer[], fresh: ReadonlySet<string>, label: ReadonlyMap<string, string>): string {
  const justDone = peers.filter(p => p.status === 'done' && fresh.has(p.id))
  const count = (status: Peer['status']) => peers.filter(p => p.status === status && !justDone.includes(p)).length
  const parts = [
    justDone.length === 1 ? `✓ ${label.get(justDone[0]!.id) ?? justDone[0]!.project} done` : justDone.length > 1 ? `✓ ${justDone.length} just done` : '',
    count('working') > 0 ? `● ${count('working')} working` : '',
    count('done') > 0 ? `✓ ${count('done')} done` : '',
    count('idle') > 0 ? `○ ${count('idle')} resting` : '',
  ]
  return parts.filter(Boolean).join(' · ')
}
