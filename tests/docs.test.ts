// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hotkeyLabel, WEAPON_ORDER, WEAPONS, type WeaponId } from '../src/core/weapons';

/** Every Markdown file in the repository, minus the ones nobody wrote by hand. */
function documents(dir = '.'): string[] {
  const skip = new Set(['node_modules', 'dist', 'coverage', 'test-results', 'playwright-report', '.git']);
  return readdirSync(dir).flatMap((name) => {
    if (skip.has(name)) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return documents(path);
    return name.endsWith('.md') ? [path] : [];
  });
}

/** The rows of the README's weapon table: hotkey, name, ammo, damage. */
function readmeWeapons(): { key: string; name: string; ammo: string; damage: string }[] {
  const lines = readFileSync('README.md', 'utf8').split('\n');
  const head = lines.findIndex((l) => l.startsWith('| Key | Weapon'));
  expect(head, 'the README has no weapon table').toBeGreaterThan(-1);
  const rows: { key: string; name: string; ammo: string; damage: string }[] = [];
  for (let i = head + 2; i < lines.length && lines[i].startsWith('|'); i++) {
    const cells = lines[i]
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    rows.push({ key: cells[0], name: cells[1], ammo: cells[2], damage: cells[3] });
  }
  return rows;
}

describe('the README weapon table', () => {
  /**
   * It is the first place a reader looks and the easiest thing in the repository to get wrong by
   * hand — a row edited twice, a weapon added to the code and not the table, a hotkey that moved.
   * Checking it against the weapon order costs nothing and means the page cannot quietly drift.
   */
  it('lists every weapon exactly once, in the order the weapon bar shows them', () => {
    const rows = readmeWeapons();
    expect(rows.map((r) => r.name)).toEqual(WEAPON_ORDER.map((id) => `${WEAPONS[id].icon} ${WEAPONS[id].name}`));
    // Stated separately, because a duplicated row is the mistake this test exists for.
    expect(new Set(rows.map((r) => r.name)).size).toBe(rows.length);
  });

  it('gives each weapon the hotkey the game actually binds', () => {
    const rows = readmeWeapons();
    for (const [k, row] of rows.entries()) {
      expect({ weapon: row.name, key: row.key }).toEqual({ weapon: row.name, key: hotkeyLabel(k) });
    }
  });

  it('states the ammo the weapon table gives out', () => {
    const rows = readmeWeapons();
    for (const [k, row] of rows.entries()) {
      const ammo = WEAPONS[WEAPON_ORDER[k]].ammo;
      expect({ weapon: row.name, ammo: row.ammo }).toEqual({ weapon: row.name, ammo: ammo === Infinity ? '∞' : String(ammo) });
    }
  });
  /**
   * Every number a weapon can do, from the weapon table: its own blast, and whatever its payload
   * does — the fragments of a cluster, the bombs of a strike, the gobs of a spray. A table that
   * says "50 dmg" for a cluster bomb and stops there is telling a reader less than half the story.
   */
  function damageFigures(id: WeaponId): number[] {
    const def = WEAPONS[id];
    const payloads = [def.cluster?.weapon, def.strike?.weapon, def.spray?.weapon];
    const numbers = [def.damage, ...payloads.map((p) => (p ? WEAPONS[p].damage : 0))];
    return [...new Set(numbers.filter((n) => n > 0))];
  }

  it('states the damage the weapon table really deals, payloads included', () => {
    const rows = readmeWeapons();
    for (const [k, row] of rows.entries()) {
      const id = WEAPON_ORDER[k];
      const figures = damageFigures(id);
      if (!figures.length) {
        // Nothing this weapon does hurts anybody; say so rather than leaving the cell to guesswork.
        expect({ weapon: row.name, damage: row.damage }).toEqual({ weapon: row.name, damage: '—' });
        continue;
      }
      const stated = [...row.damage.matchAll(/\d+/g)].map((m) => Number(m[0]));
      for (const figure of figures) {
        expect(stated, `${row.name}: the table deals ${String(figure)}, the README says "${row.damage}"`).toContain(figure);
      }
    }
  });
});

describe('the weapon count in prose', () => {
  /** How the documents spell the numbers they are likely to reach. */
  const WORDS: Record<number, string> = {
    20: 'twenty',
    21: 'twenty-one',
    22: 'twenty-two',
    23: 'twenty-three',
    24: 'twenty-four',
    25: 'twenty-five',
    26: 'twenty-six',
  };

  /**
   * "Twenty-three weapons" is written in five documents and is wrong the moment a weapon is added.
   * The README's table is checked row by row above; this catches the sentences around it.
   */
  it('matches the weapon order everywhere it is stated', () => {
    const expected = WEAPON_ORDER.length;
    const word = WORDS[expected];
    expect(word, `no spelling known for ${String(expected)} — add it to WORDS`).toBeDefined();
    const wrong: string[] = [];
    for (const path of documents()) {
      for (const [i, line] of readFileSync(path, 'utf8').split('\n').entries()) {
        // A changelog, a task list, the archive and the LinkedIn notes all record what was true
        // when they were written — "hotkeys for 15 weapons" was correct in 1.26, and "four weapons
        // to seventeen" is the story of a particular week. Correcting those would be a lie. This
        // applies to the documents that describe the game as it is now.
        if (path.endsWith('CHANGELOG.md') || path.endsWith('tasks.md') || path.includes('archive') || path.includes('linkedin')) continue;
        for (const m of line.matchAll(/(\d+)\s+weapons\b/gi)) {
          if (Number(m[1]) !== expected) wrong.push(`${path}:${String(i + 1)} says ${m[1]}, not ${String(expected)}`);
        }
        for (const m of line.matchAll(/([A-Za-z]+(?:-[a-z]+)?)\s+weapons\b/gi)) {
          const said = m[1].toLowerCase();
          if (Object.values(WORDS).includes(said) && said !== word) wrong.push(`${path}:${String(i + 1)} says "${m[1]}", not "${word}"`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });
});

describe('every document', () => {
  /**
   * A table row repeated is the one documentation bug a reader always notices and a diff never
   * does. Rows are identified by their first cell, within one table — the same key in two different
   * tables is ordinary.
   */
  it('has no table row repeated within a table', () => {
    const offenders: string[] = [];
    for (const path of documents()) {
      const lines = readFileSync(path, 'utf8').split('\n');
      let table: { key: string; line: number }[] = [];
      const check = () => {
        const counts = new Map<string, number[]>();
        for (const { key, line } of table) counts.set(key, [...(counts.get(key) ?? []), line]);
        for (const [key, at] of counts) {
          // A date or a blank first cell legitimately repeats; a weapon or a setting does not.
          if (at.length > 1 && key && !/^\d{4}-\d{2}-\d{2}$/.test(key)) offenders.push(`${path}:${at.join(',')} — "${key}"`);
        }
        table = [];
      };
      for (const [i, line] of lines.entries()) {
        const isRow = line.trimStart().startsWith('|') && line.split('|').length >= 4 && !/^\|[\s:|-]+\|/.test(line.trim());
        if (isRow) table.push({ key: line.split('|')[1].trim(), line: i + 1 });
        else if (table.length) check();
      }
      if (table.length) check();
    }
    expect(offenders).toEqual([]);
  });
});
