// The journal's decorations, in pixel art like its icons: a pressed keepsake
// for the season. One character a pixel, '.' see-through

import type { Season } from './world'
import { cells, svgOf } from './sprite'

export type Picture = { rows: string[]; colors: Record<string, number> }

/** A pressed keepsake for the season, 8 × 8, its colours a little faded */
export const KEEPSAKES: Record<Season, Picture> = {
  autumn: {
    rows: ['...1....', '.1.1.1..', '.11211..', '1112111.', '.11211..', '..121...', '...3....', '...3....'],
    colors: { '1': 0xd0643a, '2': 0x9c3d22, '3': 0x6b3a1e },
  },
  spring: {
    rows: ['..1..1..', '.111111.', '.112211.', '11233211', '11233211', '.112211.', '.111111.', '..1..1..'],
    colors: { '1': 0xf7c4d8, '2': 0xe99abb, '3': 0xe8b23a },
  },
  summer: {
    rows: ['.1.11.1.', '..1111..', '11222211', '.123321.', '.123321.', '11222211', '..1111..', '.1.11.1.'],
    colors: { '1': 0xf5c842, '2': 0xeca22e, '3': 0x6b4226 },
  },
  winter: {
    rows: ['...1....', '.1.1.1..', '..111...', '1112111.', '..111...', '.1.1.1..', '...1....', '........'],
    colors: { '1': 0x6aaee8, '2': 0xeaf6ff },
  },
}

/** A picture as a Raster's cells, see-through pixels in the page's colour */
export const pictureCells = (p: Picture, paper: number) => cells(p.rows, p.colors, paper)
/** The same picture as an SVG, for the desktop app, the editor and the phone */
export const pictureSvg = (p: Picture) => svgOf(p.rows, p.colors, 4)
/** How many columns and terminal rows a picture takes */
export const sizeOf = (p: Picture) => ({ columns: p.rows[0]?.length ?? 0, rows: Math.ceil(p.rows.length / 2) })

/** A strip of washi tape across the page's top right corner, as if taping it
 * into the book: three pixels wide, running down to the right, striped in a
 * lighter shade of `color`, its ends a little ragged */
export function washiTape(color: number): Picture {
  const LENGTH = 9
  const THICK = 4
  const width = LENGTH + THICK
  const grid = Array.from({ length: LENGTH + (LENGTH % 2) }, () => Array<string>(width).fill('.'))
  for (let k = 0; k < LENGTH; k++) {
    for (let t = 0; t < THICK; t++) {
      // Torn, not cut: the first and last steps keep only part of their width
      if ((k === 0 && t < 2) || (k === LENGTH - 1 && t >= THICK - 2)) continue
      // Stripes across the tape, every third step
      grid[k]![k + t] = k % 3 === 1 ? '2' : '1'
    }
  }
  const lighter = (n: number) => {
    const mix = (s: number) => Math.round(((n >> s) & 255) + (255 - ((n >> s) & 255)) * 0.5) << s
    return mix(16) | mix(8) | mix(0)
  }
  return { rows: grid.map(row => row.join('')), colors: { '1': color, '2': lighter(color) } }
}

/** A colour as the terminal's pixel art draws it: each channel rounded to one
 * of sixteen steps (0x00, 0x11 … 0xff). Text and boxes drawn in the same
 * colour then match the pixels exactly */
export function pixelColor(color: number): number {
  const step = (s: number) => Math.round(((color >> s) & 255) / 17) * 17
  return (step(16) << 16) | (step(8) << 8) | step(0)
}

/** A ribbon for a title `width` columns long: a band with a light top edge and
 * a shaded underside, its forked tails folding behind it at both ends. The
 * title goes on the band's middle row, two columns in from where it starts
 * (the band starts four columns in) */
export function ribbon(width: number, color: number): Picture {
  const band = width + 4
  const total = band + 8
  const grid = Array.from({ length: 6 }, () => Array<string>(total).fill('.'))
  for (let x = 4; x < 4 + band; x++) {
    grid[1]![x] = 'L'
    grid[2]![x] = 'A'
    grid[3]![x] = 'A'
    grid[4]![x] = 'S'
  }
  // The tails behind the band, forked at their outer ends, folded in shadow where they meet it
  const tail = ['TTTT', '.TTT', '.TTF', 'TTTF']
  tail.forEach((row, k) =>
    [...row].forEach((c, x) => {
      if (c === '.') return
      grid[k + 2]![x] = c
      grid[k + 2]![total - 1 - x] = c
    }),
  )
  const mix = (n: number, to: number, amount: number) => {
    const m = (s: number) => Math.round(((n >> s) & 255) * (1 - amount) + ((to >> s) & 255) * amount) << s
    return m(16) | m(8) | m(0)
  }
  return {
    rows: grid.map(row => row.join('')),
    colors: { A: color, L: mix(color, 0xffffff, 0.3), S: mix(color, 0x000000, 0.25), T: mix(color, 0x000000, 0.18), F: mix(color, 0x000000, 0.45) },
  }
}
