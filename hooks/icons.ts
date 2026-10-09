// Little pixel-art icons for the journal: 6 × 6 pixels each, three terminal
// rows of half blocks, for what drifts by, the rare finds and the weather.
// Drawn the way the portrait is: one character a pixel, '.' see-through, the
// rest from the icon's own palette

import { cells, svgOf } from './sprite'

export type Icon = { pixels: readonly string[]; colors: Record<string, number> }

// The clouds the weather icons share: light on top, a shade beneath
const CLOUD = { '1': 0xe8ecf2, '2': 0xb8c0cc }
const STORM_CLOUD = { '1': 0x8a93a6, '2': 0x5c6578 }

export const ICONS: Record<string, Icon> = {
  // What drifts by
  leaf: {
    pixels: ['..11..', '.1121.', '111211', '.1121.', '..22..', '...3..'],
    colors: { '1': 0xe8833a, '2': 0xb5521f, '3': 0x7a4a2a },
  },
  petal: {
    pixels: ['...1..', '..112.', '.1112.', '.1122.', '..12..', '......'],
    colors: { '1': 0xffb7d5, '2': 0xf08cb6 },
  },
  snowflake: {
    pixels: ['..1...', '.121..', '12221.', '.121..', '..1...', '......'],
    colors: { '1': 0x6aaee8, '2': 0xdff1ff },
  },
  firefly: {
    pixels: ['......', '.2..2.', '..11..', '.1331.', '..33..', '......'],
    colors: { '1': 0x4a4a3a, '2': 0xcfe0ff, '3': 0xffe066 },
  },
  // The rare ones
  goldleaf: {
    pixels: ['..11..', '.4121.', '111211', '.1121.', '..22..', '...3..'],
    colors: { '1': 0xf2c53d, '2': 0xc08a12, '3': 0x8a6a1a, '4': 0xfff6d0 },
  },
  blossom: {
    pixels: ['..11..', '.1111.', '112211', '112211', '.1111.', '..11..'],
    colors: { '1': 0xffd1e3, '2': 0xf2b632 },
  },
  crystal: {
    pixels: ['1.3.1.', '.121..', '32223.', '.121..', '1.3.1.', '......'],
    colors: { '1': 0x9fd0f5, '2': 0xeaf6ff, '3': 0x2f7fd0 },
  },
  star: {
    pixels: ['...111', '...131', '...111', '..2...', '.2....', '2.....'],
    colors: { '1': 0xffc83d, '2': 0xe8a33a, '3': 0xfff6d0 },
  },
  // The weather you've worked through
  clear: {
    pixels: ['.1..1.', '..22..', '122221', '122221', '..22..', '.1..1.'],
    colors: { '1': 0xffcf40, '2': 0xffa920 },
  },
  cloudy: {
    pixels: ['......', '..11..', '.1111.', '111111', '222222', '......'],
    colors: CLOUD,
  },
  fog: {
    pixels: ['......', '1111..', '......', '.1111.', '......', '..1111'],
    colors: { '1': 0xa9b6c9 },
  },
  drizzle: {
    pixels: ['.11...', '11111.', '22222.', '.3..3.', '......', '..3...'],
    colors: { ...CLOUD, '3': 0x6fb6ff },
  },
  rain: {
    pixels: ['.111..', '11111.', '22222.', '3.3.3.', '.3.3..', '3.3.3.'],
    colors: { ...CLOUD, '3': 0x4f9de8 },
  },
  snow: {
    pixels: ['.111..', '11111.', '22222.', '4.4.4.', '.4.4..', '4.4.4.'],
    colors: { ...CLOUD, '4': 0x7fb8e8 },
  },
  storm: {
    pixels: ['.111..', '11111.', '22222.', '..33..', '.33...', '..3...'],
    colors: { ...STORM_CLOUD, '3': 0xffd54a },
  },
}

export const ICON_COLUMNS = 6
export const ICON_ROWS = 3

/** An icon as a Raster's cells, its see-through pixels in the page's colour */
export function iconCells(id: string, paper: number): string | undefined {
  const icon = ICONS[id]
  return icon && cells([...icon.pixels], icon.colors, paper)
}

/** The same icon as an SVG, for the desktop app, the editor and the phone */
export function iconSvg(id: string): string | undefined {
  const icon = ICONS[id]
  return icon && svgOf([...icon.pixels], icon.colors, 4)
}

// The shelf's bigger set: 8 × 8 pixels, four terminal rows, with room for
// veins, glows and shine. Unfound ones are drawn as silhouettes of these
const BIG_CLOUD = { '1': 0xf2f4f8, '2': 0xb3bccb, '6': 0x8d97a8 }
const BIG_STORM = { '1': 0x8a93a6, '2': 0x5c6578, '6': 0x454c5c }

export const BIG_ICONS: Record<string, Icon> = {
  leaf: {
    pixels: ['...1....', '..124...', '.11244..', '1112444.', '1112444.', '.11244..', '..124...', '...3....'],
    colors: { '1': 0xec8a3e, '2': 0xa8461a, '3': 0x7a4a2a, '4': 0xcf6528 },
  },
  petal: {
    pixels: ['....1.1.', '...11311', '..111311', '..112111', '.112211.', '.12211..', '.1211...', '..1.....'],
    colors: { '1': 0xffb7d5, '2': 0xe97aa8, '3': 0xfff0f6 },
  },
  snowflake: {
    pixels: ['...1....', '.1.1.1..', '..111...', '1112111.', '..111...', '.1.1.1..', '...1....', '........'],
    colors: { '1': 0x5a9fe0, '2': 0xffffff },
  },
  firefly: {
    pixels: ['.2....2.', '..2..2..', '...11...', '..3113..', '.344443.', '34455443', '.344443.', '..3333..'],
    colors: { '1': 0x5a5236, '2': 0xbcd2f2, '3': 0xe6f2a8, '4': 0xc8e64a, '5': 0xfaffd0 },
  },
  goldleaf: {
    pixels: ['...1....', '..124...', '.15244..', '1512444.', '1112444.', '.11244..', '..124...', '...3....'],
    colors: { '1': 0xf5c842, '2': 0xa8740c, '3': 0x8a6a1a, '4': 0xdca623, '5': 0xfff6d0 },
  },
  blossom: {
    pixels: ['...11...', '..1221..', '11.22.11', '12233221', '12233221', '11.22.11', '..1221..', '...11...'],
    colors: { '1': 0xe9779f, '2': 0xffd1e3, '3': 0xf2b632 },
  },
  crystal: {
    pixels: ['...3....', '.3.1.3..', '..121...', '3122213.', '..121...', '.3.1.3..', '...3....', '........'],
    colors: { '1': 0x8ec8f2, '2': 0xeaf6ff, '3': 0x2f6fc0 },
  },
  star: {
    pixels: ['.....1..', '....111.', '...11311', '....111.', '...2.1..', '..2.....', '.2......', '2.......'],
    colors: { '1': 0xffc83d, '2': 0xe08a2a, '3': 0xfff6d0 },
  },
  clear: {
    pixels: ['...11...', '.1....1.', '..2222..', '1.2332.1', '1.2332.1', '..2222..', '.1....1.', '...11...'],
    colors: { '1': 0xffbf30, '2': 0xff9a1a, '3': 0xffd970 },
  },
  cloudy: {
    pixels: ['........', '...11...', '..1111..', '.111111.', '11111111', '22222222', '.666666.', '........'],
    colors: BIG_CLOUD,
  },
  fog: {
    pixels: ['........', '111111..', '........', '..111111', '........', '111111..', '........', '..1111..'],
    colors: { '1': 0x8f9db3 },
  },
  drizzle: {
    pixels: ['...11...', '..1111..', '.111111.', '.222222.', '........', '.3...3..', '........', '...3....'],
    colors: { ...BIG_CLOUD, '3': 0x4f9de8 },
  },
  rain: {
    pixels: ['...11...', '..1111..', '.111111.', '.222222.', '.3..3..3', '3..3..3.', '.3..3..3', '3..3..3.'],
    colors: { ...BIG_CLOUD, '3': 0x3c8ae0 },
  },
  snow: {
    pixels: ['...11...', '..1111..', '.111111.', '.222222.', '.4...4..', '...4...4', '.4...4..', '...4....'],
    colors: { ...BIG_CLOUD, '4': 0x6aa8e0 },
  },
  storm: {
    pixels: ['...11...', '..1111..', '.111111.', '.222222.', '...55...', '..5555..', '....5...', '...5....'],
    colors: { ...BIG_STORM, '5': 0xffcc33 },
  },
}

export const BIG_COLUMNS = 8
export const BIG_ROWS = 4

/** A big icon as a Raster's cells; given `silhouette`, every pixel in that one
 * colour, for something still to find */
export function bigCells(id: string, paper: number, silhouette?: number): string | undefined {
  const icon = BIG_ICONS[id]
  return icon && cells([...icon.pixels], silhouetteOf(icon, silhouette), paper)
}

/** The same as an SVG, for the desktop app, the editor and the phone */
export function bigSvg(id: string, silhouette?: number): string | undefined {
  const icon = BIG_ICONS[id]
  return icon && svgOf([...icon.pixels], silhouetteOf(icon, silhouette), 4)
}

const silhouetteOf = (icon: Icon, silhouette?: number): Record<string, number> =>
  silhouette === undefined ? icon.colors : Object.fromEntries(Object.keys(icon.colors).map(k => [k, silhouette]))
