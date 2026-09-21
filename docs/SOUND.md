# Sound design

Every sound in Allium Assault is synthesized in the browser with the Web Audio API — there is not a
single audio file in the repository. `src/audio.ts` owns the synthesizer; the rules core never names
a sound, it only says what happened, and the weapon table says what a weapon sounds like through
plain keys (`look.fireSound`, `look.flight`, `look.shotSound`, `look.hitSound`). Presentation
therefore never switches on a weapon id, and a new weapon gets a voice by filling in its table row.

## Principles

1. **One action, one voice.** If two things sound the same, a player learns nothing from hearing
   them. Borrowed sounds were the main finding of the audit in 1.52.0 (T86).
2. **The sound says how the thing works.** A rocket is launched under power and roars; a grenade is
   thrown by an arm and whooshes; a board is hammered into place and knocks twice.
3. **Loudness follows consequence.** A pistol-sized blast is quieter than a holy grenade; the
   Sudden Death siren is longer and deeper than a self-destruct countdown because it changes the
   whole match, not one turn.
4. **Nothing is silent that a player must notice.** Every state change that costs health, ammo or a
   turn makes a sound, including ones that happen off screen (crates, mines, the rising water).
5. **Short and dry.** Tails are tens to a few hundred milliseconds, so a fast exchange of fire does
   not turn into mush.

## What was changed in the audit (1.52.0)

| Action                                      | Was                                   | Is now       | Why                                                                                                                                               |
| ------------------------------------------- | ------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grenade, cluster, holy grenade, banana bomb | `fire` (the bazooka's roar)           | `throw`      | They are thrown by hand; nothing is launched under power, and hearing a rocket motor on a lobbed grenade was the complaint that started the audit |
| Blowtorch start                             | `fire`                                | `torchLight` | It lights a gas flame; a click and a soft rush, which the running torch loop then takes over                                                      |
| Platform placed                             | `clunk` (the mine's)                  | `build`      | Carpentry, not a metal disc: two wooden knocks and a short ring                                                                                   |
| Teleport                                    | `teleport` (the crate shimmer)        | `warp`       | A buddy folding away and unfolding elsewhere is not a crate arriving                                                                              |
| Small explosions (< 1.2 radius)             | `shot` (the shotgun)                  | `pop`        | A little charge going off is the big explosion in miniature, not a shotgun                                                                        |
| Sudden Death                                | `alarm` (the self-destruct countdown) | `siren`      | One ends a turn, the other changes the match; the siren is deeper, slower and longer                                                              |

## The full table

Sounds marked _loop_ follow the simulation every frame instead of being one-shots.

| What happens               | Sound                                   | Made of                                                  |
| -------------------------- | --------------------------------------- | -------------------------------------------------------- |
| Bazooka fired              | `fire`                                  | Band-passed noise rush plus a sawtooth motor note        |
| Grenade family thrown      | `throw`                                 | Short airy whoosh, soft grunt under it                   |
| Shotgun                    | `shot`                                  | Bright noise crack plus a square-wave body               |
| Minigun spinning up        | `spinup`                                | Sawtooth sweeping up from 80 to 420 Hz                   |
| Each minigun bullet        | `bullet`                                | Very short high noise tick                               |
| Garlic punch connects      | `punch`                                 | Low noise thump plus a sine body                         |
| Baseball bat connects      | `bat`                                   | Click, hollow wooden knock and a swish                   |
| Blowtorch lit / running    | `torchLight` / torch _loop_             | Ignition click and rush, then the burning loop           |
| Drill running              | drill _loop_                            | Filtered noise with a grinding oscillator                |
| Sheep released             | `baa`                                   | Bleat: vibrato square through a formant filter           |
| Sheep hop                  | `hop`                                   | Short rising blip                                        |
| Concrete mule called       | `bray`                                  | Hee-haw: alternating nasal tones                         |
| Plane flying in            | `plane`                                 | Doppler-swept propeller drone                            |
| Napalm catching            | `ignite`                                | Low thump and a rushing burst of air                     |
| Burning napalm             | fire _loop_                             | Crackling filtered noise, louder with more patches       |
| Buddy scorched             | `yelp`                                  | Squeaky rising hop                                       |
| Holy grenade arming        | `hallelujah`                            | Four-voice choir chord                                   |
| Self-destruct              | `alarm`                                 | Three rising beeps over a falling drone                  |
| Sudden Death               | `siren`                                 | Slow deep two-tone warning, three times                  |
| Mine dropped / arming      | `clunk` / `armed` / `beep`              | Metal disc, two rising clicks, then the countdown        |
| Platform placed            | `build`                                 | Two wooden knocks and a short ring                       |
| Teleport                   | `warp`                                  | Swoop down, pop, swoop back up with a sparkle tail       |
| Crate teleporting in       | `teleport`                              | Bright shimmering sweep                                  |
| Crate collected            | `pickup` / `heal`                       | Rising arpeggio, or a warm major third                   |
| Rope shot / bites / reels  | `hookShot` / `hookBite` / `reel` _loop_ | Air shot, metal bite, ratcheting loop                    |
| Projectile in flight       | flight _loop_                           | `rocket` whistles and hisses, `lob` only whooshes softly |
| Explosion                  | `explosion`                             | Big filtered noise body plus a low sine boom             |
| Small explosion            | `pop`                                   | The same, smaller and shorter                            |
| Bounce                     | `bounce`                                | Thud plus a metallic tick, scaled by impact              |
| Walk / jump / land         | `step` / `jump` / `land`                | Papery patter, a "hup", a soft thud                      |
| Drowning                   | `splash`                                | Band-passed noise wash                                   |
| Tombstone landing          | `thud`                                  | Stone plonk with a sad trombone slide                    |
| Damage / death             | `hurt` / `death`                        | Falling square blip, longer falling sawtooth             |
| Turn start / last seconds  | `turn` / `tick`                         | Two-note chime, dry tick                                 |
| Weapon selected / UI click | `select` / `click`                      | Tiny two-tone blip, single click                         |
| Victory                    | `victory`                               | Four-note major arpeggio                                 |

## Keeping it honest

`tests/game.test.ts` holds the expected voice of every selectable weapon, so a new weapon cannot be
added without deciding what it sounds like, and it asserts that only the bazooka uses the launch
roar and that every `throw` weapon is a lobbed one. The browser suite checks that a thrown grenade
plays `throw` and never `fire`, and that the weapons with their own voices — platform, teleport,
rope, mine, sheep — really produce them in Chrome.
