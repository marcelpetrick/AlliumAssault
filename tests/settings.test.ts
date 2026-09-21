// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { defaultSettings, parseSettings, SETTINGS_VERSION } from '../src/ui/settings';

describe('persisted settings', () => {
  it('write the schema version, so a later build knows what it is reading', () => {
    const stored = JSON.parse(JSON.stringify({ version: SETTINGS_VERSION, ...defaultSettings() })) as { version: number };
    expect(stored.version).toBe(SETTINGS_VERSION);
    expect(parseSettings(JSON.stringify(stored))).not.toBeNull();
  });

  it('still load a config written before the store was versioned', () => {
    // Exactly what 1.57.1 and earlier wrote: no version, no quality.
    const old = {
      textSize: 'large',
      match: { ...defaultSettings().match, turnTime: 60, theme: 'candy' },
    };
    const parsed = parseSettings(JSON.stringify(old));
    expect(parsed).not.toBeNull();
    expect(parsed!.textSize).toBe('large');
    expect(parsed!.match.turnTime).toBe(60);
    expect(parsed!.match.theme).toBe('candy');
    // The field the old build never wrote comes back at its default rather than undefined.
    expect(parsed!.quality).toBe('high');
  });

  it('take what they understand from a config written by a newer build', () => {
    const future = {
      version: SETTINGS_VERSION + 99,
      textSize: 'huge',
      quality: 'low',
      soundtrack: 'jazz',
      match: { ...defaultSettings().match, turnTime: 60, weather: 'rain' },
    };
    const parsed = parseSettings(JSON.stringify(future));
    expect(parsed).not.toBeNull();
    expect(parsed!.textSize).toBe('huge');
    expect(parsed!.quality).toBe('low');
    expect(parsed!.match.turnTime).toBe(60);
    expect(parsed).not.toHaveProperty('soundtrack');
  });

  it('survive every kind of rubbish a storage entry can hold', () => {
    for (const raw of ['', 'null', 'true', '[]', '"text"', '{', 'undefined']) {
      expect(() => parseSettings(raw)).not.toThrow();
    }
    expect(parseSettings('{}')).not.toBeNull();
    // A record that is valid JSON but empty falls back to the defaults field by field.
    expect(parseSettings('{}')!.match.teams).toHaveLength(2);
  });

  it('round-trip through JSON', () => {
    const settings = defaultSettings();
    settings.textSize = 'huge';
    settings.quality = 'low';
    settings.match.turnTime = 60;
    settings.match.theme = 'candy';
    const parsed = parseSettings(JSON.stringify(settings))!;
    expect(parsed.textSize).toBe('huge');
    expect(parsed.quality).toBe('low');
    expect(parsed.match.turnTime).toBe(60);
    expect(parsed.match.theme).toBe('candy');
    expect(parsed.match.teams).toHaveLength(2);
  });

  it('fall back field by field for broken or tampered entries instead of breaking the game', () => {
    expect(parseSettings('not json')).toBeNull();
    expect(parseSettings('[]')).toBeNull();
    const defaults = defaultSettings();
    const good = defaults.match.teams[0];
    const tampered = parseSettings(
      JSON.stringify({
        textSize: 'gigantic',
        quality: 'ultra',
        match: {
          ...defaults.match,
          theme: 'lava',
          turnTime: -5,
          arsenal: 'everything',
          crates: 'lots',
          teams: [
            { ...good, aiLevel: 'godlike', controller: 'robot' },
            { ...good, name: 'Blue', color: '#3d8bfd' },
          ],
        },
      }),
    )!;
    expect(tampered.textSize).toBe('normal');
    expect(tampered.quality).toBe('high');
    expect(tampered.match.theme).toBe('meadow');
    expect(tampered.match.turnTime).toBe(45);
    expect(tampered.match.arsenal).toBe('all');
    expect(tampered.match.crates).toBe(defaults.match.crates);
    expect(tampered.match.teams[0].aiLevel).toBe('normal');
    expect(tampered.match.teams[0].controller).toBe('human');

    // Teams with unusable names or colours are replaced by the default teams as a whole.
    const badTeams = parseSettings(
      JSON.stringify({
        match: {
          ...defaults.match,
          teams: [
            { ...good, buddyNames: [42] },
            { ...good, color: 'red;"><script>' },
          ],
        },
      }),
    )!;
    expect(badTeams.match.teams).toHaveLength(2);
    for (const t of badTeams.match.teams) {
      expect(t.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t.buddyNames.every((n) => typeof n === 'string')).toBe(true);
    }
    expect(parseSettings(JSON.stringify({ match: { ...defaults.match, teams: [good] } }))!.match.teams).toHaveLength(2);
  });
});
