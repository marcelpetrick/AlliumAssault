// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { afterEach, describe, expect, it } from 'vitest';
import { language, LANGUAGES, missingKeys, preferredLanguage, setLanguage, t } from '../src/ui/i18n';
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
