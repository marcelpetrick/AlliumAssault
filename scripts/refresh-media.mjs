// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

/** One entry point for every media family. Requires Chrome, Firefox, ffmpeg, matplotlib and a display/Xvfb. */
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

if (process.argv.includes('--help')) {
  console.log(
    'npm run refresh-media -- [existing-preview-url] [--metadata-only]\n--metadata-only validates existing media and refreshes coverage/chart/provenance.\nWithout a URL, builds and starts/stops a preview on :4174. Captures all images/GIFs/social videos and refreshes coverage/chart/provenance.',
  );
  process.exit(0);
}
const env = { ...process.env, ALLIUM_CAPTURE_HEADED: '1' };
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env });
    child.on('error', reject);
    child.on('exit', (code, signal) => (code === 0 ? resolve() : reject(new Error(`${command} exited ${code ?? signal}`))));
  });
}
function capture(script) {
  const args = [script, url];
  return process.env.DISPLAY ? run(process.execPath, args) : run('xvfb-run', ['-a', process.execPath, ...args]);
}
let server;
const metadataOnly = process.argv.includes('--metadata-only');
const suppliedUrl = process.argv.slice(2).find((arg) => arg !== '--metadata-only');
const url = suppliedUrl ?? 'http://localhost:4174';
try {
  if (!metadataOnly && !suppliedUrl) {
    await run('npm', ['run', 'build']);
    server = spawn(
      process.execPath,
      [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)), 'preview', '--port', '4174', '--strictPort'],
      { stdio: 'inherit', env },
    );
    server.on('error', (e) => console.error(e));
    let ready = false;
    for (let k = 0; k < 120 && !ready; k++) {
      if (server.exitCode !== null) throw new Error('Preview exited before becoming ready');
      try {
        ready = (await fetch(url, { signal: AbortSignal.timeout(1000) })).ok;
      } catch {
        /* Wait for the preview listener. */
      }
      if (!ready) await setTimeout(500);
    }
    if (!ready) throw new Error('Preview did not start');
  }
  for (const script of [
    'scripts/capture-media.mjs',
    'scripts/capture-weapons.mjs',
    'scripts/capture-features.mjs',
    'scripts/check-firefox-fire.mjs',
    'linkedin/capture-clip.mjs',
    'linkedin/capture-clip-b.mjs',
    'linkedin/capture-clip-c.mjs',
  ])
    if (!metadataOnly) await capture(script);
  // Create the linked manifest before documentation tests run; update it after the chart changes.
  await run(process.execPath, ['scripts/media-manifest.mjs']);
  await run('npm', [
    'run',
    'coverage',
    '--',
    '--coverage.reporter=text-summary',
    '--coverage.reporter=text',
    '--coverage.reporter=html',
    '--coverage.reporter=lcov',
    '--coverage.reporter=json-summary',
  ]);
  const untrackedCore = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', 'src/core'], { encoding: 'utf8' }).trim();
  let coreMatchesHead = untrackedCore.length === 0;
  try {
    execFileSync('git', ['diff', '--quiet', 'HEAD', '--', 'src/core']);
  } catch (error) {
    if (error.status !== 1) throw error;
    coreMatchesHead = false;
  }
  if (coreMatchesHead) {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const cache = JSON.parse(readFileSync('docs/history-coverage.json', 'utf8'));
    const total = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8')).total;
    cache[sha] = Object.fromEntries(['statements', 'branches', 'functions', 'lines'].map((k) => [k, total[k].pct]));
    writeFileSync('docs/history-coverage.json', `${JSON.stringify(cache, null, 2)}\n`);
  } else {
    console.log('Core differs from HEAD: historical coverage cache left unchanged.');
  }
  await run('python3', ['scripts/history_chart.py', '--no-measure']);
  await run(process.execPath, ['scripts/media-manifest.mjs']);
} finally {
  server?.kill('SIGTERM');
}
