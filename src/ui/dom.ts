// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

/** The HTML element matching `selector` inside `root`; the overlay markup is static, so a miss is a bug. */
export function query(root: ParentNode, selector: string): HTMLElement {
  return queryAs(root, selector, HTMLElement);
}

/** Like query(), for elements of another type (e.g. SVG), checked at runtime. */
export function queryAs<T extends Element>(root: ParentNode, selector: string, type: abstract new () => T): T {
  const found = root.querySelector(selector);
  if (!(found instanceof type)) throw new Error(`UI element ${selector} is missing`);
  return found;
}
