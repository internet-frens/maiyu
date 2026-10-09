// Things to wear, unlocked by achievements. Any character can wear any of them.

import type { Item } from './types'

export const ITEMS: readonly Item[] = [
  {
    id: 'party-hat',
    name: 'Party Hat',
    kind: 'accessory',
    slot: 'head',
    at: { x: 13, y: 0 },
    pixels: ['::33::', '::12::', ':1221:', ':2112:', '122221', '333333'],
    colors: { '1': 0xff7eb6, '2': 0xffd54a, '3': 0xfafafa },
  },
  {
    id: 'gold-heart',
    name: 'Gold Heart',
    kind: 'accessory',
    at: { x: 19, y: 35 },
    pixels: ['11:11', '12111', ':111:', '::1::'],
    colors: { '1': 0xffc83d, '2': 0xfff3b0 },
  },
  {
    id: 'gold-pin',
    name: 'Gold Pin',
    kind: 'accessory',
    at: { x: 10, y: 35 },
    pixels: [':1:', '121', ':1:'],
    colors: { '1': 0xffd54a, '2': 0xfff3b0 },
  },
  {
    id: 'headphones',
    name: 'Headphones',
    kind: 'accessory',
    slot: 'head',
    at: { x: 4, y: 1 },
    pixels: [
      ':::::::::111111',
      ':::::::11::::::11',
      ':::::11::::::::::11',
      '::::1::::::::::::::1',
      ':::1::::::::::::::::1',
      '::1::::::::::::::::::1',
      '::1::::::::::::::::::1',
      '::1::::::::::::::::::1',
      '::1::::::::::::::::::1',
      '::1::::::::::::::::::1',
      '::1::::::::::::::::::1',
      '::1::::::::::::::::::1',
      '::1::::::::::::::::::1',
      '222::::::::::::::::::222',
      '223::::::::::::::::::322',
      '223::::::::::::::::::322',
      '223::::::::::::::::::322',
      '222::::::::::::::::::222',
    ],
    colors: { '1': 0x4a4f63, '2': 0xe2404f, '3': 0x2b2d3a },
  },
  {
    id: 'night-owl',
    name: 'Night-Owl Colors',
    kind: 'palette',
    palette: { top: 0x4b3d6e, topShade: 0x342a52, inner: 0xe9e2f7, innerShade: 0xc6bce0, accent: 0xc9b6ff },
  },
  {
    id: 'sunrise',
    name: 'Sunrise Colors',
    kind: 'palette',
    palette: { top: 0xf2a65a, topShade: 0xd9843b, inner: 0xfff1dc, innerShade: 0xf0d6b0, accent: 0xff7e5f },
  },
  {
    id: 'star-clip',
    name: 'Star Clip',
    kind: 'accessory',
    slot: 'hair',
    at: { x: 19, y: 7 },
    pixels: ['::1::', '11211', ':111:', '1:::1'],
    colors: { '1': 0xffd54a, '2': 0xfff3b0 },
  },
  {
    id: 'lavender-hair',

    name: 'Lavender Hair',
    kind: 'palette',
    palette: { hair: 0xb48ad6, hairShade: 0x8a62ae, hairShine: 0xe6d4f7 },
  },
]

export const itemById = (id: unknown): Item | undefined => ITEMS.find(i => i.id === id)
