// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { afterEach, describe, expect, it } from 'vitest';
import { language, LANGUAGES, missingKeys, preferredLanguage, setLanguage, t, type TextKey } from '../src/ui/i18n';
import { ARSENAL_OPTIONS, CRATE_OPTIONS, GRAVITY_OPTIONS, SUDDEN_DEATH_OPTIONS, WIND_OPTIONS } from '../src/ui/presets';
import { TEXT_SIZES } from '../src/ui/settings';
import { QUALITY_OPTIONS } from '../src/render/quality';
import { THEME_IDS, THEMES } from '../src/render/themes';
import { untranslatedWeapons, weaponBlurb, weaponName } from '../src/ui/i18nWeapons';
import { WEAPON_ORDER, WEAPONS } from '../src/core/weapons';

// setLanguage touches the document; jsdom is not loaded here, so stand in for it.
const html = { lang: 'en' };
(globalThis as unknown as { document: { documentElement: { lang: string } } }).document = { documentElement: html };

afterEach(() => {
  setLanguage('en');
});

describe('languages', () => {
  it('offer four, each named in its own words', () => {
    expect(LANGUAGES.map((l) => l.value)).toEqual(['en', 'de', 'hr', 'zh']);
    expect(LANGUAGES.map((l) => l.label)).toEqual(['English', 'Deutsch', 'Hrvatski', '中文']);
  });

  it('translate every key in every language', () => {
    for (const { value } of LANGUAGES) {
      expect(missingKeys(value), `${value} is missing keys`).toEqual([]);
    }
  });

  it('name and describe every selectable weapon in every language', () => {
    for (const { value } of LANGUAGES) {
      expect(untranslatedWeapons(value, WEAPON_ORDER), `${value} has untranslated weapons`).toEqual([]);
    }
  });

  it('actually say something different in each language', () => {
    const said = new Set<string>();
    for (const { value } of LANGUAGES) {
      setLanguage(value);
      expect(language()).toBe(value);
      said.add(t('setup.start'));
    }
    expect(said.size).toBe(LANGUAGES.length);
  });

  it('fill placeholders, and leave one alone when there is nothing to put in it', () => {
    setLanguage('en');
    expect(t('victory.wins', { name: 'Ruby' })).toBe('Ruby wins!');
    expect(t('victory.after', { turns: 12 })).toContain('12');
    expect(t('victory.wins')).toContain('{name}');
    setLanguage('de');
    expect(t('victory.wins', { name: 'Ruby' })).toBe('Ruby gewinnt!');
  });

  it('fall back to the English rather than showing a key', () => {
    setLanguage('zh');
    // Every key is translated today; the fallback is what protects the next key that is not.
    for (const { value } of LANGUAGES) {
      setLanguage(value);
      expect(t('hud.turn')).not.toContain('hud.');
      expect(t('hud.turn').length).toBeGreaterThan(0);
    }
  });

  it('give weapons their own words, and fall back to the weapon table for English', () => {
    setLanguage('en');
    for (const id of WEAPON_ORDER) {
      expect(weaponName(id)).toBe(WEAPONS[id].name);
      expect(weaponBlurb(id)).toBe(WEAPONS[id].blurb);
    }
    setLanguage('de');
    expect(weaponName('bazooka')).toBe('Bazooka');
    expect(weaponName('sheep')).toBe('Schaf');
    setLanguage('hr');
    expect(weaponName('sheep')).toBe('Ovca');
    setLanguage('zh');
    expect(weaponName('sheep')).toBe('绵羊');
  });

  it('translate every option the setup screen offers, not just its labels', () => {
    // The option values come from data modules rather than markup, which is exactly how they were
    // missed the first time: the screen said 中文 while its buttons still said "Cratyness".
    const keys: TextKey[] = [
      ...WIND_OPTIONS.map((o) => o.key),
      ...CRATE_OPTIONS.map((o) => o.key),
      ...GRAVITY_OPTIONS.map((o) => o.key),
      ...SUDDEN_DEATH_OPTIONS.map((o) => o.key),
      ...ARSENAL_OPTIONS.map((o) => o.key),
      ...QUALITY_OPTIONS.map((o) => o.key),
      ...TEXT_SIZES.map((o) => o.key),
      'opt.seconds',
      'opt.human',
      'opt.aiEasy',
      'opt.aiNormal',
      'opt.aiHard',
    ];
    for (const { value } of LANGUAGES) {
      setLanguage(value);
      for (const key of keys) {
        const text = t(key, { n: 10 });
        expect(text, `${key} is empty in ${value}`).not.toBe('');
        expect(text, `${key} still shows a placeholder in ${value}`).not.toContain('{');
      }
    }
    // And they really differ between languages rather than all falling back to English.
    const said = new Set<string>();
    for (const { value } of LANGUAGES) {
      setLanguage(value);
      said.add(WIND_OPTIONS.map((o) => t(o.key)).join('|'));
    }
    expect(said.size).toBe(LANGUAGES.length);
  });

  it('name every scenery, and keep the list in step with the table', () => {
    // THEME_IDS is written out by hand so a catalogue key built from it is checked at compile time;
    // this is what stops it drifting from the table it describes.
    expect([...THEME_IDS].sort()).toEqual(Object.keys(THEMES).sort());
    for (const { value } of LANGUAGES) {
      setLanguage(value);
      for (const id of THEME_IDS) expect(t(`theme.${id}`), `${id} in ${value}`).not.toBe('');
    }
    setLanguage('zh');
    expect(t('theme.meadow')).toBe('大蒜草原');
  });

  it('start in the browser’s language when it is one the game speaks', () => {
    expect(preferredLanguage(['de-AT', 'en'])).toBe('de');
    expect(preferredLanguage(['hr'])).toBe('hr');
    expect(preferredLanguage(['zh-Hans-CN'])).toBe('zh');
    expect(preferredLanguage(['cmn'])).toBe('zh');
    // Nothing we speak, and nothing at all, both mean English.
    expect(preferredLanguage(['fi', 'sv'])).toBe('en');
    expect(preferredLanguage([])).toBe('en');
  });

  it('tell the document which language it is in, for the browser’s sake', () => {
    setLanguage('hr');
    expect(html.lang).toBe('hr');
  });
});
