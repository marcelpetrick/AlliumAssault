// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { defaultSettings, parseSettings } from '../src/ui/settings';

describe('persisted settings', () => {
  it('round-trip through JSON', () => {
    const settings = defaultSettings();
    settings.textSize = 'huge';
    settings.match.turnTime = 60;
    settings.match.theme = 'candy';
    const parsed = parseSettings(JSON.stringify(settings))!;
    expect(parsed.textSize).toBe('huge');
    expect(parsed.match.turnTime).toBe(60);
    expect(parsed.match.theme).toBe('candy');
    expect(parsed.match.teams).toHaveLength(2);
  });

  it('reject broken or tampered entries instead of breaking the setup screen', () => {
    expect(parseSettings('not json')).toBeNull();
    expect(parseSettings('{}')).toBeNull();
    const settings = defaultSettings();
    expect(parseSettings(JSON.stringify({ ...settings, match: { ...settings.match, theme: 'lava' } }))).toBeNull();
    expect(parseSettings(JSON.stringify({ ...settings, match: { ...settings.match, teams: [settings.match.teams[0]] } }))).toBeNull();
    expect(parseSettings(JSON.stringify({ ...settings, textSize: 'gigantic' }))!.textSize).toBe('normal');
  });
});
