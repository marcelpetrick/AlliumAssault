// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

/** Validate all media formats and retain hashes/provenance alongside the recorded files. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]));
}
const sha256 = (content) => createHash('sha256').update(content).digest('hex');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const runtime = [...files('src'), 'index.html', 'vite.config.ts'].sort();
const hash = createHash('sha256');
for (const path of runtime) hash.update(path).update('\0').update(readFileSync(path)).update('\0');
hash.update(JSON.stringify({ dependencies: pkg.dependencies, overrides: pkg.overrides }));
const index = readFileSync('dist/index.html', 'utf8');
const entry = index.match(/src="\.\/([^"]+\.js)"/)[1];
const assets = ['docs/screenshots', 'docs/weapons', 'docs/features', 'linkedin']
  .flatMap(files)
  .filter((p) => /\.(png|jpg|gif|mp4)$/.test(p))
  .sort();
const media = assets.map((path) => {
  const bytes = readFileSync(path);
  const probe = JSON.parse(
    execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-count_frames',
        '-show_entries',
        'stream=codec_name,width,height,nb_read_frames,r_frame_rate:format=duration',
        '-of',
        'json',
        path,
      ],
      { encoding: 'utf8' },
    ),
  );
  const stream = probe.streams[0];
  assert.ok(stream.width > 0 && stream.height > 0, `${path}: dimensions`);
  const frames = Number(stream.nb_read_frames ?? 1);
  assert.ok(frames > 0, `${path}: decoded frames`);
  if (path.endsWith('.gif')) {
    assert.ok(frames > 1, `${path}: must animate`);
    const loop = bytes.indexOf('NETSCAPE2.0');
    assert.ok(loop >= 0 && bytes.readUInt16LE(loop + 13) === 0, `${path}: infinite GIF loop`);
  }
  return {
    path,
    sha256: sha256(bytes),
    bytes: bytes.length,
    width: stream.width,
    height: stream.height,
    frames,
    codec: stream.codec_name,
    durationSeconds: probe.format.duration ? Number(probe.format.duration) : null,
    modifiedAt: statSync(path).mtime.toISOString(),
  };
});
const manifest = {
  packageVersion: pkg.version,
  recordedAt: new Date().toISOString(),
  sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  runtimeSourceSha256: hash.digest('hex'),
  buildEntry: entry,
  buildEntrySha256: sha256(readFileSync(join('dist', entry))),
  buildStyles: [...index.matchAll(/href="\.\/([^"]+\.css)"/g)].map((match) => ({
    path: match[1],
    sha256: sha256(readFileSync(join('dist', match[1]))),
  })),
  note: 'Authored capture fixtures use real rules and rendering. Source fingerprint describes the working tree; sourceRevision identifies checkout HEAD at recording time. History chart describes committed history.',
  media,
};
writeFileSync('docs/media-capture.json', `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Validated ${media.length} images/animations; manifest written for ${pkg.version}`);
