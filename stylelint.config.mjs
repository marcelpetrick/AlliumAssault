// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard'],
  rules: {
    // The stylesheet is organised by component; this rule compares unrelated selectors across
    // components (e.g. `.logo h1 span` and `.stepper span`) that never match the same element.
    'no-descending-specificity': null,
  },
};
