// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * SPDX / REUSE compliance check for every tracked file.
 *
 *   node scripts/spdx.mjs          check: every file carries SPDX headers or is covered by REUSE.toml
 *   node scripts/spdx.mjs --fix    add the project's header to files that can carry comments
 *
 * The official REUSE tool gives the same verdict: `npm run lint:reuse` (needs uv).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

// REUSE-IgnoreStart — the header strings below are data, not this file's license.
const COPYRIGHT = 'SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>';
const LICENSE = 'SPDX-License-Identifier: GPL-3.0-or-later';
const LICENSE_ID = /SPDX-License-Identifier:\s*([A-Za-z0-9.+-]+)/;
// REUSE-IgnoreEnd

/** Comment syntax per file type, for files that can carry a header. */
const COMMENTS = [
  { match: /\.(ts|js|mjs)$/, header: (line) => `// ${line}` },
  { match: /\.css$/, header: (line) => `/* ${line} */` },
  { match: /\.ya?ml$|(^|\/)\.gitignore$/, header: (line) => `# ${line}` },
  { match: /\.html$/, header: (line) => `<!-- ${line} -->` },
];

const fix = process.argv.includes('--fix');
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\n').filter(Boolean);
const covered = reuseTomlGlobs();
const problems = [];
const licenses = new Set();

for (const file of files) {
  // License texts themselves are exempt, as in the REUSE specification.
  if (!existsSync(file) || file.startsWith('LICENSES/') || covered.some((re) => re.test(file))) continue;
  const text = readFileSync(file, 'utf8');
  const head = text.split('\n').slice(0, 12).join('\n');
  const id = LICENSE_ID.exec(head);
  if (head.includes('SPDX-FileCopyrightText:') && id) {
    licenses.add(id[1]);
    continue;
  }
  const style = COMMENTS.find((c) => c.match.test(file));
  if (fix && style) {
    writeFileSync(file, addHeader(text, [style.header(COPYRIGHT), style.header(LICENSE)]));
    licenses.add('GPL-3.0-or-later');
    console.log(`added header: ${file}`);
  } else {
    problems.push(`${file}: no SPDX-FileCopyrightText / SPDX-License-Identifier header and not covered by REUSE.toml`);
  }
}

for (const id of licenses) {
  if (!existsSync(`LICENSES/${id}.txt`)) problems.push(`LICENSES/${id}.txt: license text missing for ${id}`);
}

if (problems.length) {
  console.error(`SPDX check failed (${problems.length}):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  console.error('Run `npm run spdx:fix` to add headers, or annotate the file in REUSE.toml.');
  process.exit(1);
}
console.log(`SPDX check passed: ${files.length} files`);

/** Keep a shebang or doctype on the first line; put the header right after it. */
function addHeader(text, lines) {
  const block = `${lines.join('\n')}\n`;
  const first = text.split('\n', 1)[0];
  if (first.startsWith('#!') || /^<!doctype/i.test(first)) return `${first}\n${block}${text.slice(first.length + 1)}`;
  return `${block}\n${text}`;
}

/** Path globs of the REUSE.toml annotations as regular expressions (`**` any path, `*` one segment). */
function reuseTomlGlobs() {
  if (!existsSync('REUSE.toml')) return [];
  const globs = [];
  for (const m of readFileSync('REUSE.toml', 'utf8').matchAll(/path\s*=\s*(\[[^\]]*\]|"[^"]*")/g)) {
    for (const g of m[1].matchAll(/"([^"]+)"/g)) globs.push(g[1]);
  }
  return globs.map((glob) => {
    const pattern = glob
      .split('**')
      .map((part) =>
        part
          .split('*')
          .map((piece) => piece.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
          .join('[^/]*'),
      )
      .join('.*');
    return new RegExp(`^${pattern}$`);
  });
}
