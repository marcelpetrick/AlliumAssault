# Post copy

Three drafts, one per clip. Every number in them is checkable in the repository — see `notes.md`.

LinkedIn shows about three lines before "…see more", so each draft front-loads the hook and keeps
the link out of the body (links in the post body get less reach; put it in the first comment).

## Draft A — for clip A, the tour

> Five days ago it had four weapons. It now has seventeen, and you can play it in your browser.
>
> Allium Assault is a turn-based 3D artillery game — Worms Armageddon, but the soldiers are garlic
> buddies. Destructible islands, wind, sudden death, and an AI that will absolutely drop a concrete
> mule on you.
>
> It runs as a static site. No install, no account, no launcher: open the link and it is running.
>
> 🧄 17 weapons, from the bazooka to a steerable flying sheep
> 🎨 Real 3D in Babylon.js — every sound is synthesized in the Web Audio API, every model is
> generated in code, there is not a single asset file in the repository
> 🧪 84 unit tests and an end-to-end test per weapon, in real Chrome
> 📖 Open source, GPL-3.0
>
> Free, in the browser, link in the comments.

## Draft B — for clip B, the ship log

> Day one: four weapons. Day five: seventeen.
>
> I have been building Allium Assault — a turn-based 3D artillery game with garlic buddies, in the
> spirit of Worms Armageddon. 99 commits in five days took it from a bazooka, a grenade, a shotgun
> and a fist to a holy hand grenade that sings before it detonates, a concrete mule that keeps
> crashing through its own craters, and a sheep you steer.
>
> What I actually enjoyed was that speed did not mean skipping the boring parts:
>
> ⚡ Every commit ships with its own version and changelog entry
> 🧪 84 unit tests, plus an end-to-end test per weapon driven through a test hook, because headless
> Chrome renders at two frames a second
> 🤖 The AI picks up new weapons from the weapon table — adding a weapon does not touch the AI
> 📖 GPL-3.0, REUSE-compliant, CI gates the deploy
> ⚙️ A profiling pass cut the cost of a frame by ~40 % by deleting multisampling that a later pass
> already did
>
> Playable in your browser, free, link in the comments.

## Draft C — for clip C, it is just a link

> No install. No account. No launcher. One tab.
>
> Allium Assault is a turn-based 3D artillery game — Worms Armageddon, with garlic buddies — and it
> runs entirely in your browser as a static site. Open the link and you are playing against the AI
> about four seconds later, on a desktop or on your phone.
>
> Destructible islands, wind, 17 weapons, a sheep you set off yourself, and an AI that will drop a
> concrete mule on your head.
>
> The whole thing is open source, GPL-3.0, and every sound and model is generated in code — there
> is not one asset file in the repository.
>
> Link in the comments. It costs you one click to find out whether I am exaggerating.

## First comment (all drafts)

> Play it here: <https://marcelpetrick.github.io/AlliumAssault/>
> Source: <https://github.com/marcelpetrick/AlliumAssault>

## Hashtags

Keep it to three to five; LinkedIn does not reward a wall of them.

`#gamedev #typescript #babylonjs #webgl #opensource`

## Optional lines

Use only if you want to tell that part of the story — pick one, do not stack them:

- "Built almost entirely with a coding agent, which is why the changelog is the most disciplined
  part of the project."
- "Everything you see and hear is generated in code — no textures, no audio files, no asset
  pipeline."
- "The whole thing is a static site. The 'backend' is a GitHub Pages bucket."

## Posting notes

- Upload the MP4 directly to LinkedIn; do not link a YouTube or Vimeo page, since a native upload
  autoplays in the feed and an external link does not.
- Add the poster frame as the thumbnail if LinkedIn offers the choice.
- The clip has no speech, but add a caption in the post itself — autoplay is muted and most people
  will never turn the sound on.
- Best window for a developer audience is a weekday morning in your own timezone; the first hour of
  engagement decides how far it travels.
