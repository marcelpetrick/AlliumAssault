# LinkedIn kit

Everything needed for the Allium Assault post in one place: the research, three finished clips to
pick from, the post copy and the harness that recorded them.

| File                 | What it is                                                           |
| -------------------- | -------------------------------------------------------------------- |
| `notes.md`           | What landed since the four-weapon core, from the git history         |
| `post.md`            | Post copy, one draft per clip, plus hashtags and a first comment     |
| `clip-a-tour.mp4`    | Clip A — the tour: headline, menu, banana bomb, air strike, sheep    |
| `clip-b-shiplog.mp4` | Clip B — the ship log: 04 → 17 weapons, a montage, then the receipts |
| `clip-c-browser.mp4` | Clip C — it is just a link: the whole clip inside browser chrome     |
| `clip-*-poster.jpg`  | Poster frame for each clip                                           |
| `clipkit.mjs`        | Recording harness: overlays, frame stepping, camera, encoding        |
| `capture-clip.mjs`   | Clip A scene script                                                  |
| `capture-clip-b.mjs` | Clip B scene script                                                  |
| `capture-clip-c.mjs` | Clip C scene script                                                  |

## Which clip to post

All three are twenty seconds and loop, so they suit the same slot — they argue different things.

- **Clip A, the tour.** Leads with "fully playable", then shows the menu and three weapons. Best if
  the point is _come and play it_, and for anyone who does not read a changelog for fun.
- **Clip B, the ship log.** Opens on day one's four weapons, cuts a montage while a counter climbs
  to seventeen, and closes on commits, tests and the licence. Best for a developer feed, where the
  pace of the build is the story and the game is the proof.
- **Clip C, it is just a link.** The one that actually _shows_ what the other two only claim: the
  whole clip plays inside browser chrome, the address bar types the URL, a cursor clicks Quick
  Match and the game is running. Best if the goal is clicks rather than applause — nobody has to
  take "no install" on trust.

## Format

1080 × 1350, 4:5, 30 fps, H.264 High in MP4, with a silent AAC track. Reasoning:

- 4:5 takes about 25 % more feed height than a square and roughly double a 16:9 clip, without
  tipping LinkedIn into its full-screen vertical player.
- The game renders natively at 4:5, so nothing is letterboxed or cropped — the camera simply frames
  a taller slice of the island.
- Under twenty seconds keeps it looping in the feed; LinkedIn autoplays **muted**, which is why
  every scene carries its own caption and no beat depends on sound.
- H.264 in MP4 is what LinkedIn asks for; a silent audio track avoids players that mishandle a
  video-only file.

Sources: [LinkedIn video specs 2026](https://www.linkboost.co/blog/linkedin-video-specs-requirements-2026/),
[LinkedIn Help: video specifications](https://www.linkedin.com/help/linkedin/answer/a1311816),
[specs that survive the upload](https://www.ffmpeg-micro.com/blog/linkedin-video-specs-that-survive-the-upload-2026).

## Re-recording

Needs ffmpeg on the PATH and a preview build being served:

```bash
npm run build
npm run preview                  # serves http://localhost:4173
node linkedin/capture-clip.mjs   # clip A
node linkedin/capture-clip-b.mjs # clip B
```

Both scripts drive the game through the `window.__allium` test hook with fixed seeds and a fixed
frame step, the same way `scripts/capture-media.mjs` makes the README media, so a re-run produces
the same clip rather than whatever the renderer happened to do that second. Captions are DOM
overlays injected into the page, so they use the game's own Fredoka font, and they are advanced
frame by frame rather than by CSS animation — otherwise they would drift out of sync with the
stepped simulation.

Recording takes a few minutes: headless Chrome renders with SwiftShader at roughly three frames a
second, and each clip is 600 screenshots.
