// One ping per session to the maiyu API: a random install id, the version, the
// surface and what kind of session it is. That tells us how many people have
// her and how often she's around; nothing else goes. The reply is the newest
// version and the oldest that still works, kept for her to suggest updating.
// /frens share off stops it along with the rest of the sharing.

export const API_URL = 'https://aichan-api.aichan-app.workers.dev'
export const PING_URL = `${API_URL}/v1/ping`
/** This version of the mod: release/release.sh keeps it in step with plugin.json */
export const VERSION = '0.16.0'

export const INSTALL_KEY = 'installId'
export const RELEASE_KEY = 'release'

const INSTALL = /^[a-f0-9]{32}$/
const SEMVER = /^\d{1,4}\.\d{1,4}\.\d{1,6}$/
const SURFACES = ['terminal', 'desktop', 'vscode', 'mobile']

export type Kind = 'install' | 'session' | 'headless'
export type Ping = { install: string; version: string; surface: string; kind: Kind }
export type Release = { latest: string; minimum: string }

export const isInstallId = (value: unknown): value is string => typeof value === 'string' && INSTALL.test(value)

/** 32 random hex characters: names no person, machine or folder */
export const newInstallId = (): string => crypto.randomUUID().replace(/-/g, '')

export const ping = (install: string, surface: string | null, kind: Kind, version = VERSION): Ping => ({
  install,
  version,
  surface: surface !== null && SURFACES.includes(surface) ? surface : 'none',
  kind,
})

export function asRelease(text: string): Release | undefined {
  try {
    const { latest, minimum } = JSON.parse(text) as Partial<Release>
    return typeof latest === 'string' && SEMVER.test(latest) && typeof minimum === 'string' && SEMVER.test(minimum) ? { latest, minimum } : undefined
  } catch {
    return undefined
  }
}

/** Whether version a comes before version b */
export function isOlder(a: string, b: string): boolean {
  const [x, y] = [a.split('.').map(Number), b.split('.').map(Number)]
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0)
  return false
}
