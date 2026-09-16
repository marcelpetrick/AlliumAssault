// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import type { MatchConfig } from '../core/game';
import { THEME_IDS } from '../render/themes';
import { quickMatch, randomSeed } from './presets';

export type TextSize = 'normal' | 'large' | 'huge';

export const TEXT_SIZES: { label: string; value: TextSize; scale: number }[] = [
  { label: 'Normal', value: 'normal', scale: 1 },
  { label: 'Large', value: 'large', scale: 1.25 },
  { label: 'Huge', value: 'huge', scale: 1.5 },
];

/** What the player chose last time, restored for the next game and after a reload. */
export interface Settings {
  match: MatchConfig;
  textSize: TextSize;
}

const STORAGE_KEY = 'allium.settings';

export const defaultSettings = (): Settings => ({ match: quickMatch(), textSize: 'normal' });

/** Stored settings, or defaults when there are none or they are unreadable. The map seed is always fresh. */
export function loadSettings(): Settings {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage blocked (private mode, sandbox): play with defaults.
  }
  const settings = raw ? parseSettings(raw) : null;
  if (!settings) return defaultSettings();
  settings.match.seed = randomSeed();
  return settings;
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Not persisted; the settings still apply for this session.
  }
}

export function clearSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored.
  }
}

/** Validate stored JSON so an old or tampered entry can never break the setup screen. */
export function parseSettings(raw: string): Settings | null {
  try {
    const data = JSON.parse(raw) as Partial<Settings>;
    const m = data.match;
    const validTeams =
      Array.isArray(m?.teams) &&
      m.teams.length >= 2 &&
      m.teams.length <= 4 &&
      m.teams.every(
        (t) => typeof t.name === 'string' && typeof t.color === 'string' && Array.isArray(t.buddyNames) && t.buddyNames.length >= 1 && t.buddyNames.length <= 4,
      );
    if (!m || !validTeams || typeof m.turnTime !== 'number' || typeof m.windMax !== 'number' || !THEME_IDS.includes(m.theme)) return null;
    const textSize = TEXT_SIZES.find((s) => s.value === data.textSize)?.value ?? 'normal';
    return { match: { ...m, retreatTime: typeof m.retreatTime === 'number' ? m.retreatTime : 5 }, textSize };
  } catch {
    return null;
  }
}

/** Scale the whole HTML overlay (HUD, name tags, menus) for readability. */
export function applyTextSize(size: TextSize): void {
  const scale = TEXT_SIZES.find((s) => s.value === size)?.scale ?? 1;
  document.documentElement.style.setProperty('--ui-scale', String(scale));
  document.documentElement.dataset.textSize = size;
}
