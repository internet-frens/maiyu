// The portrait you can touch: the same pixel art as the Raster, drawn as half
// blocks in Text, so a click knows where it landed. A press and release on one
// part (the hair, a cheek, the scarf, a leaf drifting past) tells the hooks
// module which; a drag across the hair or a cheek is a stroke. Whatever is
// under the pointer lights up a little, so you can see what's touchable, and a
// click leaves a little sparkle where it landed. Which way the pointer is,
// left, middle or right, goes to the hooks module too, for their eyes to follow
// now and then

import type { ClientModule, ClientPointerEvent } from 'claude-code'

export type PortraitProps = {
  /** The sprite, one character a pixel, as `sprite()` gives it */
  rows: string[]
  /** What each pixel belongs to, as `spriteWithParts()` gives it */
  parts: string[]
  /** A part's character to its name, or a worn item's id */
  names: Record<string, string>
  /** A pixel's character to its color, '#rrggbb' */
  colors: Record<string, string>
}

/** What the module posts: a touch (`stroke` for a drag), or which way the
 * pointer is, `null` once it's gone */
export type PortraitPost = { touch: string; stroke?: true } | { look: -1 | 0 | 1 | null }

// A sparkle where you clicked, in cells, fading as it ages
type Spark = { x: number; y: number; age: number }

type State = {
  hover?: string
  /** What the press went down on, and how many cells the drag has crossed since */
  down?: string
  crossed?: number
  cell?: string
  /** Which way the pointer was, as last posted */
  side?: -1 | 0 | 1
  sparks?: Spark[]
}

const NONE = '.'
// The pixels around one, nearest first
const NEAR = [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]] as const
// Parts a drag strokes, and how many cells make it a stroke
const STROKABLE = new Set(['head', 'hair', 'cheek', 'face'])
const STROKE_CELLS = 3
const SPARK = ['✦', '✧', '⋆', '·']
const SPARK_COLOR = '#fff3b0'
// Instances whose sparkle clock is going: once each, however often they're drawn
const ticking = new WeakSet<object>()

// A touch lighter, for the part under the pointer
function lighter(color: string): string {
  const n = parseInt(color.slice(1), 16)
  const up = (shift: number) => {
    const c = (n >> shift) & 255
    return Math.round(c + (255 - c) * 0.25) << shift
  }
  return `#${(up(16) | up(8) | up(0)).toString(16).padStart(6, '0')}`
}

const Portrait: ClientModule<PortraitProps, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  if (!ticking.has(surface)) {
    ticking.add(surface)
    // Sparkles fade on a clock of their own
    surface.every(120, () => {
      const s = surface.state
      if (!s?.sparks?.length) return
      surface.setState({ ...s, sparks: s.sparks.map(p => ({ ...p, age: p.age + 1 })).filter(p => p.age < SPARK.length) })
    })
  }
  const state = surface.state ?? {}
  const width = props.rows[0]?.length ?? 0

  // The part under a cell: the half the pointer is in where the terminal says,
  // else the top half, or the bottom when nothing is in the top. Things in the
  // air are a pixel or two and drifting, so a click next to one catches it too
  const partAt = (e: ClientPointerEvent): string | undefined => {
    const x = Math.floor(e.fine?.x ?? e.x)
    const halves = e.fine !== undefined ? [Math.floor(e.fine.y * 2)] : [e.y * 2, e.y * 2 + 1]
    const at = (px: number, py: number) => {
      const c = props.parts[py]?.[px]
      return c === undefined || c === NONE ? undefined : props.names[c]
    }
    for (const y of halves) {
      const hit = at(x, y)
      if (hit !== undefined) return hit
    }
    for (const y of halves) {
      for (const [dx, dy] of NEAR) {
        const hit = at(x + dx, y + dy)
        if (hit?.includes(':')) return hit
      }
    }
    return undefined
  }

  const post = (data: PortraitPost) => surface.post(data)
  const sparkAt = (e: ClientPointerEvent, s: State): Spark[] => [...(s.sparks ?? []), { x: e.x, y: e.y, age: 0 }]
  // Left, middle or right of the portrait
  const sideOf = (e: ClientPointerEvent): -1 | 0 | 1 => (e.x < width / 3 ? -1 : e.x >= (2 * width) / 3 ? 1 : 0)

  // Set on every draw, so it always reads the latest frame's parts
  surface.onPointer(e => {
    const at = partAt(e)
    const cell = `${e.x},${e.y}`
    if (e.type === 'down') {
      if (e.button === 'left') surface.setState({ ...state, down: at, crossed: 0, cell })
      return
    }
    if (e.type === 'up') {
      const isStroke = state.down !== undefined && STROKABLE.has(state.down) && (state.crossed ?? 0) >= STROKE_CELLS
      if (isStroke) post({ touch: state.down!, stroke: true })
      else if (at !== undefined && at === state.down) post({ touch: at })
      // A click on nothing, or a catch, leaves a sparkle
      const sparkles = !isStroke && (at === undefined || at.includes(':')) && state.down === at
      surface.setState({ hover: at, side: state.side, sparks: sparkles ? sparkAt(e, state) : state.sparks })
      return
    }
    if (e.type === 'leave') {
      if (state.side !== undefined) post({ look: null })
      surface.setState({ sparks: state.sparks })
      return
    }
    // A move, or coming in: which way it is, and a drag going on
    const side = sideOf(e)
    if (side !== state.side) post({ look: side })
    const dragging = e.button !== undefined && state.down !== undefined
    const crossed = dragging && cell !== state.cell ? (state.crossed ?? 0) + 1 : state.crossed
    if (at !== state.hover || side !== state.side || crossed !== state.crossed) surface.setState({ ...state, hover: at, side, crossed, cell })
  })

  const colorAt = (x: number, y: number): string | undefined => {
    const c = props.rows[y]?.[x]
    const color = c === undefined || c === NONE ? undefined : props.colors[c]
    if (color === undefined) return undefined
    const p = props.parts[y]?.[x]
    return state.hover !== undefined && p !== undefined && props.names[p] === state.hover ? lighter(color) : color
  }

  // Each terminal row: runs of cells that share their colors, one Text each
  const lines = []
  for (let y = 0; y < props.rows.length; y += 2) {
    const runs: { text: string; color?: string; backgroundColor?: string }[] = []
    for (let x = 0; x < width; x++) {
      const spark = state.sparks?.find(p => p.x === x && p.y === y / 2)
      const top = colorAt(x, y)
      const bottom = colorAt(x, y + 1)
      const cell =
        spark !== undefined
          ? { glyph: SPARK[spark.age]!, color: SPARK_COLOR }
          : top === undefined && bottom === undefined
            ? { glyph: ' ' }
            : top === undefined
              ? { glyph: '▄', color: bottom }
              : { glyph: '▀', color: top, backgroundColor: bottom }
      const last = runs.at(-1)
      if (last !== undefined && last.color === cell.color && last.backgroundColor === cell.backgroundColor) last.text += cell.glyph
      else runs.push({ text: cell.glyph, color: cell.color, backgroundColor: cell.backgroundColor })
    }
    lines.push(
      <Text>
        {runs.map(r => (
          <Text color={r.color} backgroundColor={r.backgroundColor}>
            {r.text}
          </Text>
        ))}
      </Text>,
    )
  }
  return <Box flexDirection="column">{lines}</Box>
}

export default Portrait
