// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * How much the renderer is allowed to spend. It lives in its own module, free of Babylon, because
 * the setup screen and the persisted settings need the vocabulary without pulling in the engine.
 */
export type Quality = 'high' | 'low';

/**
 * Full is the default and stays the default: shadows, bloom, antialiasing and the full pixel
 * density, even where that costs frames. Low is for weak GPUs and is what `?quality=low` selects.
 */
export const QUALITY_OPTIONS: { key: 'opt.full' | 'opt.lowGpu'; value: Quality }[] = [
  { key: 'opt.full', value: 'high' },
  { key: 'opt.lowGpu', value: 'low' },
];
