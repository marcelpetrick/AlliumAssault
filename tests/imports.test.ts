// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Every `.ts` file under `src`, so the rule cannot be dodged by adding a new module. */
function sources(dir = 'src'): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

describe('Babylon imports', () => {
  /**
   * `@babylonjs/core` is a barrel that re-exports the whole engine, and importing it defeats
   * tree-shaking: the bundle went from 1.5 MB to 6.9 MB the last time one slipped in. Nothing about
   * that shows up in a typecheck or a unit test, so the rule is checked here instead.
   */
  it('never come from the package root, only from a symbol’s own module', () => {
    const offenders = sources().filter((path) => readFileSync(path, 'utf8').includes("from '@babylonjs/core'"));
    expect(offenders).toEqual([]);
  });

  /** The same barrel, imported only for its side effects. */
  it('never pull the whole engine in for side effects', () => {
    const offenders = sources().filter((path) => readFileSync(path, 'utf8').includes("import '@babylonjs/core';"));
    expect(offenders).toEqual([]);
  });

  /**
   * Part of Babylon's API is installed on `Scene.prototype` by a module whose only job is that side
   * effect. `createPickingRay` is one of them: without it every weapon aimed by clicking the map
   * silently does nothing, and only the browser suite notices.
   */
  it('ask for the picking-ray side effect by name wherever a picking ray is built', () => {
    for (const path of sources()) {
      const code = readFileSync(path, 'utf8');
      if (!code.includes('createPickingRay')) continue;
      expect(code, `${path} builds a picking ray`).toContain("import '@babylonjs/core/Culling/ray'");
    }
  });
});
