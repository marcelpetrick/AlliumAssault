// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

/** Unwrap a value an invariant guarantees; a violation is a bug, reported with `what` went missing. */
export function defined<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`Invariant violated: ${what} is missing`);
  return value;
}
