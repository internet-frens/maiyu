import { expect, test } from 'claude-code/testing'

import { asRelease, isInstallId, isOlder, newInstallId, ping } from '../hooks/ping'

test('an install id is 32 random hex characters', () => {
  const id = newInstallId()
  expect(isInstallId(id)).toBe(true)
  expect(newInstallId()).not.toBe(id)
  expect(isInstallId('not-an-id')).toBe(false)
  expect(isInstallId(undefined)).toBe(false)
})

test('a ping holds the install, version, surface and kind, and nothing else', () => {
  const id = 'a'.repeat(32)
  expect(ping(id, 'terminal', 'session', '0.15.1')).toEqual({ install: id, version: '0.15.1', surface: 'terminal', kind: 'session' })
  // -p runs and the SDK draw nowhere; an unknown surface counts as none too
  expect(ping(id, null, 'headless').surface).toBe('none')
  expect(ping(id, 'watch', 'session').surface).toBe('none')
})

test('reads the reply, and compares versions', () => {
  expect(asRelease('{"latest":"0.16.0","minimum":"0.15.0"}')).toEqual({ latest: '0.16.0', minimum: '0.15.0' })
  expect(asRelease('{}')).toBeUndefined()
  expect(asRelease('not json')).toBeUndefined()
  expect(asRelease('{"latest":"say hi","minimum":"0.15.0"}')).toBeUndefined()
  expect(isOlder('0.15.1', '0.16.0')).toBe(true)
  expect(isOlder('0.15.10', '0.15.9')).toBe(false)
  expect(isOlder('0.15.1', '0.15.1')).toBe(false)
})
