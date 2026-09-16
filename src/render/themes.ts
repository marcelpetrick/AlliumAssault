// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { Color3 } from '@babylonjs/core';

export interface Theme {
  id: string;
  name: string;
  skyTop: Color3;
  skyHorizon: Color3;
  fog: Color3;
  fogDensity: number;
  sunDirection: [number, number, number];
  sunColor: Color3;
  sunIntensity: number;
  ambientSky: Color3;
  ambientGround: Color3;
  ambientIntensity: number;
  grass: Color3;
  grassDark: Color3;
  dirt: Color3;
  rock: Color3;
  rockDark: Color3;
  waterShallow: Color3;
  waterDeep: Color3;
  hills: [Color3, Color3, Color3];
  foliage: Color3;
  trunk: Color3;
  clouds: Color3;
  stars: boolean;
  exposure: number;
  /** Props: forest (pines, flowers, mushrooms), candy (lollipops, gumdrops, candy canes) or snow (snowy pines, snowballs, ice). */
  style?: 'forest' | 'candy' | 'snow';
  /** Second prop colour, e.g. lollipop swirls and candy stripes. */
  accent?: Color3;
}

const hex = (value: string) => Color3.FromHexString(value);

export const THEMES: Record<string, Theme> = {
  meadow: {
    id: 'meadow',
    name: 'Garlic Meadow',
    skyTop: hex('#1c6ad8'),
    skyHorizon: hex('#a6daf6'),
    fog: hex('#b6dcf0'),
    fogDensity: 0.0022,
    sunDirection: [-0.45, -0.8, 0.55],
    sunColor: hex('#fff1d6'),
    sunIntensity: 1.5,
    ambientSky: hex('#dcefff'),
    ambientGround: hex('#9a8a72'),
    ambientIntensity: 0.6,
    grass: hex('#74c94c'),
    grassDark: hex('#3f8f34'),
    dirt: hex('#8a5a3b'),
    rock: hex('#a8835f'),
    rockDark: hex('#66503e'),
    waterShallow: hex('#46c0d8'),
    waterDeep: hex('#155a8a'),
    hills: [hex('#6fa77c'), hex('#8fbcae'), hex('#b3d3d9')],
    foliage: hex('#4c9a3a'),
    trunk: hex('#6b4a2e'),
    clouds: hex('#ffffff'),
    stars: false,
    exposure: 1.05,
  },
  sunset: {
    id: 'sunset',
    name: 'Golden Sunset',
    skyTop: hex('#3a3c7e'),
    skyHorizon: hex('#ffae68'),
    fog: hex('#f2a27c'),
    fogDensity: 0.0032,
    sunDirection: [0.55, -0.32, 0.77],
    sunColor: hex('#ffc088'),
    sunIntensity: 1.7,
    ambientSky: hex('#ffcfa6'),
    ambientGround: hex('#7a5a66'),
    ambientIntensity: 0.55,
    grass: hex('#9cc43f'),
    grassDark: hex('#5f8a2c'),
    dirt: hex('#9a5f3a'),
    rock: hex('#b9846a'),
    rockDark: hex('#6a4448'),
    waterShallow: hex('#6a9cc0'),
    waterDeep: hex('#283d6c'),
    hills: [hex('#7c4f68'), hex('#a8697a'), hex('#d38f86')],
    foliage: hex('#5f8a3a'),
    trunk: hex('#5a3a2a'),
    clouds: hex('#ffd6b8'),
    stars: false,
    exposure: 1.05,
  },
  night: {
    id: 'night',
    name: 'Moonlit Grove',
    skyTop: hex('#050a22'),
    skyHorizon: hex('#2a4478'),
    fog: hex('#1d2d52'),
    fogDensity: 0.004,
    sunDirection: [-0.3, -0.75, 0.6],
    sunColor: hex('#c4d4ff'),
    sunIntensity: 1.6,
    ambientSky: hex('#8090d0'),
    ambientGround: hex('#5a5078'),
    ambientIntensity: 0.85,
    grass: hex('#62c47e'),
    grassDark: hex('#3a8a58'),
    dirt: hex('#8a6460'),
    rock: hex('#9a94b4'),
    rockDark: hex('#5c5678'),
    waterShallow: hex('#2f78a6'),
    waterDeep: hex('#08203f'),
    hills: [hex('#1f2d4c'), hex('#2b3d60'), hex('#3b5076')],
    foliage: hex('#2e6a4a'),
    trunk: hex('#3a2a2a'),
    clouds: hex('#8090c0'),
    stars: true,
    exposure: 1.25,
  },
  candy: {
    id: 'candy',
    name: 'Candy Shop',
    skyTop: hex('#ff8fc8'),
    skyHorizon: hex('#ffe3f1'),
    fog: hex('#ffd6ea'),
    fogDensity: 0.0026,
    sunDirection: [-0.4, -0.8, 0.5],
    sunColor: hex('#fff4fa'),
    sunIntensity: 1.45,
    ambientSky: hex('#ffe8f5'),
    ambientGround: hex('#a86a8a'),
    ambientIntensity: 0.7,
    // Pink frosting over chocolate cake.
    grass: hex('#ff9fd0'),
    grassDark: hex('#f06aae'),
    dirt: hex('#6b3a26'),
    rock: hex('#8a4f33'),
    rockDark: hex('#4e2a1c'),
    // Strawberry milk.
    waterShallow: hex('#ffb3d4'),
    waterDeep: hex('#d9588f'),
    hills: [hex('#c9a0ff'), hex('#9fe3d0'), hex('#ffd59a')],
    foliage: hex('#ff5fa2'),
    trunk: hex('#fffaf2'),
    clouds: hex('#ffffff'),
    stars: false,
    exposure: 1.02,
    style: 'candy',
    accent: hex('#fff6a8'),
  },
  frost: {
    id: 'frost',
    name: 'Frosty Peaks',
    skyTop: hex('#5e8fd6'),
    skyHorizon: hex('#e6f2fb'),
    fog: hex('#dbe9f5'),
    fogDensity: 0.003,
    sunDirection: [0.45, -0.6, 0.65],
    sunColor: hex('#f4f8ff'),
    sunIntensity: 1.4,
    ambientSky: hex('#e8f2ff'),
    ambientGround: hex('#7f8fa8'),
    ambientIntensity: 0.75,
    // Snow over icy blue-grey rock.
    grass: hex('#f4f9ff'),
    grassDark: hex('#c9dcef'),
    dirt: hex('#7d8ea6'),
    rock: hex('#8fa3bd'),
    rockDark: hex('#4f5f78'),
    waterShallow: hex('#9fd8ef'),
    waterDeep: hex('#1f5b86'),
    hills: [hex('#b7c9dd'), hex('#cfdceb'), hex('#e4edf6')],
    foliage: hex('#2f5e4c'),
    trunk: hex('#4f3a2e'),
    clouds: hex('#f7fbff'),
    stars: false,
    exposure: 0.98,
    style: 'snow',
    accent: hex('#ffffff'),
  },
};

export const THEME_IDS = Object.keys(THEMES);
