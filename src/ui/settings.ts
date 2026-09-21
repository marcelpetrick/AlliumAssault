// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import type { AiLevel, Controller, MatchConfig, TeamConfig } from '../core/game';
import { QUALITY_OPTIONS, type Quality } from '../render/quality';
import { THEME_IDS } from '../render/themes';
import { ARSENAL_OPTIONS, CRATE_OPTIONS, GRAVITY_OPTIONS, quickMatch, randomSeed, SUDDEN_DEATH_OPTIONS, TURN_OPTIONS, WIND_OPTIONS } from './presets';

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
  /** How much the renderer may spend; Full unless the player or the URL says otherwise. */
  quality: Quality;
}

const STORAGE_KEY = 'allium.settings';

/**
 * Shape version of what is written to storage. Bump it whenever a field changes meaning rather
 * than merely appearing — a new field needs no bump, because {@link parseSettings} reads every
 * field on its own and falls back to the default when it is missing.
 *
 * 1: the original shape, written without a version at all (up to 1.57.1).
 * 2: `quality` added.
 */
export const SETTINGS_VERSION = 2;

/** What actually sits in localStorage: the settings plus the version that wrote them. */
interface StoredSettings extends Settings {
  version: number;
}

/**
 * Bring a blob written by an older build up to the current shape. Each step is responsible for one
 * version bump and nothing else, so the chain stays readable as it grows. A blob from a *newer*
 * build is left alone: the field-by-field reader takes what it understands and ignores the rest,
 * which is friendlier than throwing away settings because the user opened an older tab.
 */
function migrate(data: Record<string, unknown>): Record<string, unknown> {
  const from = typeof data.version === 'number' && Number.isFinite(data.version) ? data.version : 1;
  let out = data;
  if (from < 2) out = { ...out, quality: out.quality ?? 'high' };
  return out;
}

export const defaultSettings = (): Settings => ({ match: quickMatch(), textSize: 'normal', quality: 'high' });

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
  const stored: StoredSettings = { version: SETTINGS_VERSION, ...settings };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage full, blocked or in private mode: the settings still apply for this session.
  }
}

export function clearSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored.
  }
}

/**
 * Read stored JSON: migrate it to the current shape, then validate it field by field so an old,
 * truncated or tampered entry can never break the game. Anything unreadable falls back to the
 * default for that field alone, so one bad value never costs the player the rest of their setup.
 */
export function parseSettings(raw: string): Settings | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const data = migrate(parsed);
  const defaults = defaultSettings();
  const m = isRecord(data.match) ? data.match : {};
  const d = defaults.match;
  const teams = Array.isArray(m.teams) ? m.teams.map(parseTeam) : [];
  const match: MatchConfig = {
    seed: typeof m.seed === 'string' ? m.seed.slice(0, 24) : d.seed,
    teams: teams.length >= 2 && teams.length <= 4 && teams.every((t) => t !== null) ? teams : d.teams,
    turnTime: pick(m.turnTime, TURN_OPTIONS, d.turnTime),
    retreatTime: typeof m.retreatTime === 'number' && m.retreatTime >= 1 && m.retreatTime <= 10 ? m.retreatTime : d.retreatTime,
    windMax: pick(
      m.windMax,
      WIND_OPTIONS.map((w) => w.value),
      d.windMax,
    ),
    crates: pick(
      m.crates,
      CRATE_OPTIONS.map((c) => c.value),
      d.crates ?? 0,
    ),
    arsenal: pick(
      m.arsenal,
      ARSENAL_OPTIONS.map((a) => a.value),
      'all',
    ),
    suddenDeath: pick(
      m.suddenDeath,
      SUDDEN_DEATH_OPTIONS.map((o) => o.value),
      d.suddenDeath ?? 0,
    ),
    gravity: pick(
      m.gravity,
      GRAVITY_OPTIONS.map((g) => g.value),
      d.gravity ?? 1,
    ),
    theme: pick(m.theme, THEME_IDS, d.theme),
  };
  const quality = pick(
    data.quality,
    QUALITY_OPTIONS.map((q) => q.value),
    defaults.quality,
  );
  const textSize = pick(
    data.textSize,
    TEXT_SIZES.map((t) => t.value),
    defaults.textSize,
  );
  return { match, textSize, quality };
}

const CONTROLLERS: readonly Controller[] = ['human', 'ai'];
const AI_LEVELS: readonly AiLevel[] = ['easy', 'normal', 'hard'];

function parseTeam(value: unknown): TeamConfig | null {
  if (!isRecord(value)) return null;
  const { name, color, controller, aiLevel, buddyNames } = value;
  const names = Array.isArray(buddyNames) ? buddyNames.filter((n): n is string => typeof n === 'string' && n.length > 0 && n.length <= 24) : [];
  if (typeof name !== 'string' || !name || typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) return null;
  if (names.length < 1 || names.length > 4 || names.length !== (buddyNames as unknown[]).length) return null;
  return {
    name: name.slice(0, 18),
    color,
    controller: pick(controller, CONTROLLERS, 'human'),
    aiLevel: pick(aiLevel, AI_LEVELS, 'normal'),
    buddyNames: names,
  };
}

/** `value` if it is one of `allowed`, otherwise `fallback`. */
function pick<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.find((a) => a === value) ?? fallback;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Scale the whole HTML overlay (HUD, name tags, menus) for readability. */
export function applyTextSize(size: TextSize): void {
  const scale = TEXT_SIZES.find((s) => s.value === size)?.scale ?? 1;
  document.documentElement.style.setProperty('--ui-scale', String(scale));
  document.documentElement.dataset.textSize = size;
}
