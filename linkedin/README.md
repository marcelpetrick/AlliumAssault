# LinkedIn media kit

Current draft copy and three freshly recorded social clips for Allium Assault. These are local
assets ready for review; capture scripts do not post to LinkedIn.

| File                                     | Purpose                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------- |
| [post.md](post.md)                       | Current drafts matching the game and refreshed clips                            |
| [notes.md](notes.md)                     | Dated September research, retained as historical context                        |
| [finalLI.md](finalLI.md)                 | Earlier final post copy, explicitly historical                                  |
| [clip-a-tour.mp4](clip-a-tour.mp4)       | Tour: current setup, banana bomb, air strike and sheep                          |
| [clip-b-shiplog.mp4](clip-b-shiplog.mp4) | Arsenal growth from four to twenty-six, gameplay and current verification facts |
| [clip-c-browser.mp4](clip-c-browser.mp4) | Illustrative browser frame, actual Quick Match control and gameplay             |
| [clip-a-poster.jpg](clip-a-poster.jpg)   | Tour poster                                                                     |
| [clip-b-poster.jpg](clip-b-poster.jpg)   | Ship-log poster                                                                 |
| [clip-c-poster.jpg](clip-c-poster.jpg)   | Browser-story poster                                                            |
| `clipkit.mjs`                            | Shared capture, captions, camera and encoding                                   |
| `capture-clip*.mjs`                      | Scene scripts for the three clips                                               |

## Format and scope

1080×1350, 4:5, 30 fps, H.264 High in MP4 with a silent AAC track. These are the repository's
chosen output settings, not a claim about current LinkedIn platform limits or recommendation
algorithms. Every scene records the actual game; the tab/address bar, cursor and captions in clip C
are illustrative overlays. Gameplay runs locally against a production preview during recording.

The current game has 26 weapons, optional named factions, a six-second jetpack, crate-only homing
rockets, varied terrain and improved crate/rope AI. The full game still needs keyboard and mouse;
a touchscreen overlay is only a [design study](../docs/touchdisplay-support.md).

## Re-record

```bash
npm run build
npm run preview
node linkedin/capture-clip.mjs http://localhost:4173
node linkedin/capture-clip-b.mjs http://localhost:4173
node linkedin/capture-clip-c.mjs http://localhost:4173
```

Set `ALLIUM_CAPTURE_HEADED=1` to use a headed GPU-backed Chrome session; prefix with `xvfb-run -a`
on Linux without a display. The [complete refresh command](../docs/MEDIA.md) captures these videos,
all game screenshots and GIFs, and records file hashes, dimensions and duration in the manifest.
Fixed seeds, authored weapon arenas and fixed simulation steps keep the action reproducible.
Caption overlays advance per captured frame. Actual GIF demonstrations of the new AI, terrain,
factions and water are available in the [feature gallery](../docs/MEDIA.md#feature-animations).
