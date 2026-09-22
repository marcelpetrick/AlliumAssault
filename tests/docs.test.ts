// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hotkeyLabel, WEAPON_ORDER, WEAPONS } from '../src/core/weapons';

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

/** The rows of the README's weapon table: hotkey, name, ammo. */
function readmeWeapons(): { key: string; name: string; ammo: string }[] {
  const lines = readFileSync('README.md', 'utf8').split('\n');
  const head = lines.findIndex((l) => l.startsWith('| Key | Weapon'));
  expect(head, 'the README has no weapon table').toBeGreaterThan(-1);
  const rows: { key: string; name: string; ammo: string }[] = [];
  for (let i = head + 2; i < lines.length && lines[i].startsWith('|'); i++) {
    const cells = lines[i]
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    rows.push({ key: cells[0], name: cells[1], ammo: cells[2] });
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
