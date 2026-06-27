export interface TerrainTheme {
  id: string;
  // Sky gradient (top → horizon)
  skyTop: number;
  skyHorizon: number;
  // Background features
  hasMoon: boolean;
  hasStars: boolean;
  hasTreeSilhouettes: boolean;
  // Terrain paint layers (depth = distance in px from top surface)
  grassTop: number; // depth 0
  grassMid: number; // depth 1
  grassDark: number; // depth 2
  soilLight: number; // depth 3–5
  soilDark: number; // depth 6–10
  rockA: number; // rock main colour
  rockB: number; // rock lighter strata band
  rockC: number; // rock darker crevice band
  outline: number; // side + bottom edge pixels
  // Water (3 layers)
  waterDeep: number;
  waterMid: number;
  waterShimmer: number;
  // Decoration style
  decorStyle: 'forest' | 'beach' | 'hell' | 'snow' | 'cheese';
}

export const THEMES: Record<string, TerrainTheme> = {
  forest: {
    id: 'forest',
    skyTop: 0x0d1b3e,
    skyHorizon: 0x1d3d70,
    hasMoon: true,
    hasStars: true,
    hasTreeSilhouettes: true,
    grassTop: 0x6aca35,
    grassMid: 0x4ea324,
    grassDark: 0x3a7c1a,
    soilLight: 0x8b5a2a,
    soilDark: 0x6b3f1a,
    rockA: 0x5a3412,
    rockB: 0x7b5030,
    rockC: 0x3d2208,
    outline: 0x1a0a00,
    waterDeep: 0x0a3070,
    waterMid: 0x1a4fa8,
    waterShimmer: 0x5099cc,
    decorStyle: 'forest',
  },
  beach: {
    id: 'beach',
    skyTop: 0x42b3d8,
    skyHorizon: 0x98e0f5,
    hasMoon: false,
    hasStars: false,
    hasTreeSilhouettes: false,
    grassTop: 0xe8c86c,
    grassMid: 0xd4a84a,
    grassDark: 0xbe8e30,
    soilLight: 0xc4963a,
    soilDark: 0xa07228,
    rockA: 0x907020,
    rockB: 0xa88030,
    rockC: 0x785818,
    outline: 0x3a2800,
    waterDeep: 0x0a6b9e,
    waterMid: 0x1a8abe,
    waterShimmer: 0x66cce8,
    decorStyle: 'beach',
  },
  hell: {
    id: 'hell',
    skyTop: 0x0a0000,
    skyHorizon: 0x4a0808,
    hasMoon: false,
    hasStars: false,
    hasTreeSilhouettes: false,
    grassTop: 0xa82020,
    grassMid: 0x882010,
    grassDark: 0x681808,
    soilLight: 0x7a1a0a,
    soilDark: 0x5a1008,
    rockA: 0x4a0c06,
    rockB: 0x6a1a10,
    rockC: 0x300a04,
    outline: 0x100000,
    waterDeep: 0xcc2200,
    waterMid: 0xff4400,
    waterShimmer: 0xff9900,
    decorStyle: 'hell',
  },
  snow: {
    id: 'snow',
    skyTop: 0x060a1a,
    skyHorizon: 0x1a2a4a,
    hasMoon: true,
    hasStars: true,
    hasTreeSilhouettes: false,
    grassTop: 0xeef4ff,
    grassMid: 0xc8dcf0,
    grassDark: 0xa0c0e0,
    soilLight: 0x8bb0d0,
    soilDark: 0x6a90b8,
    rockA: 0x3a5878,
    rockB: 0x4a6a90,
    rockC: 0x283a54,
    outline: 0x0a1020,
    waterDeep: 0x0a2040,
    waterMid: 0x1a3a6a,
    waterShimmer: 0x4a7aaa,
    decorStyle: 'snow',
  },
  cheese: {
    id: 'cheese',
    skyTop: 0x08001a,
    skyHorizon: 0x1a0840,
    hasMoon: false,
    hasStars: true,
    hasTreeSilhouettes: false,
    grassTop: 0xf0d820,
    grassMid: 0xd4b812,
    grassDark: 0xb89808,
    soilLight: 0xc8a810,
    soilDark: 0xa88808,
    rockA: 0x907008,
    rockB: 0xb08010,
    rockC: 0x705800,
    outline: 0x201800,
    waterDeep: 0x1a0080,
    waterMid: 0x3000c0,
    waterShimmer: 0x7040ff,
    decorStyle: 'cheese',
  },
};

export function getTheme(id: string): TerrainTheme {
  return THEMES[id] ?? (THEMES['forest'] as TerrainTheme);
}

export function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bv = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bv;
}
