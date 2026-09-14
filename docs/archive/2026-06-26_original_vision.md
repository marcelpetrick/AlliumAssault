ChatGPT

Okay, let's do some reconnaissance engineering. I want to create a game like Worms 2 or Worms Armageddon, I mean, where you have some 2D environment which is destructible, and you move your figures, I mean, of your team around. I mean, when figures are hit by a weapon or explosion or fire, then of course they lose health points. I mean, you have a lot of weapons like shotgun, bazooka, grenades, and so on, so that you also have some physics and some wind influence so that you can steer those things. It should be really cute graphics. I mean, we also use our own theme. I mean, it will not be worms, it'll be more like garlic buddies, I mean, like garlic cloves, which are walking and jumping around. Also, a really funny thing, but we can also use placeholders first. So I said, graphics should be really cute, and we also want to randomly create some kind of environments. So the thing is like this, I mean, do some research on what kind of technology should be used so that when I want to run it in a browser, I mean, modern browser in 2026, like Firefox, I mean, what kind of technologies should I use? I mean, it should also run really locally so that you don't have to have some kind of server backend. Or if you need some server backend, I mean, then it can be easily started maybe with FastAPI or Django or Flask or whatever. Okay, maybe if you need some server backend, so that you also have some kind of database. And I said it should be really platform-independent. And so do some preliminary plan and also give me the 10 most urgent questions where I forgot to add something. Also do your research how those Worms games worked. For instance, I have an arsenal of weapons or inventory. I mean, when you use one specific weapon, then it also decreases by one and you have none left. And of course, you can only use those weapons which you already have. I mean, I said it's a turn-based game with teams, and each team has one turn, and then the next team, and so on and so forth, until none of the teams exists anymore. I mean, when one worm dies because it has zero health points, it should be removed from the team and also explode, because it also creates some kind of small environmental damage. But yeah, else, everything should be similar. And I said, I mean, we will also generate all the graphics on our own. I don't want to do something exists if some kind of agent can have some kind of image generation skill, it also should do this, so that it can generate its textures or assets or so on. Or also, we want to have some nice and cute sounds, like when the worms are moving, when you're firing a weapon, when something explodes, there should be different sounds which are also played inside the browser. So please think first about the architecture, write down the requirements, and then you will see.

I’ll structure this as a browser-first technical reconnaissance: mechanics model, stack comparison, recommended architecture, phased implementation plan, and the ten highest-impact open questions.

The key architectural finding is already clear: the terrain must be its own authoritative pixel/bit mask, not a conventional physics-engine mesh. Rendering and physics should consume that mask, while explosions modify it directly.
Reconnaissance result
Recommended direction

Build the first version as a browser-native, offline-capable 2D game with:

    TypeScript

    Phaser 4.2, pinned to an exact version

    Vite for development and static builds

    WebGL 2 as the required renderer

    A custom destructible-terrain and ballistic-physics layer

    IndexedDB for local saves, teams, settings, maps, and replays

    A service worker/PWA for offline play

    No application backend for the MVP

Phaser 4 is a particularly good fit because it supplies scenes, cameras, rendering, input, animation, audio, loading, particles, and UI-oriented infrastructure. Version 4 launched in April 2026, and 4.2.0 was released on June 19, 2026. Because it is still a comparatively new major version, pin it and hide Phaser-specific calls behind small rendering and audio adapters.

The crucial design decision is this:

    Do not make a general-purpose physics engine responsible for the terrain.

The terrain should be an authoritative occupancy mask owned by your simulation. Phaser, Box2D, Planck, or another physics library may later handle ropes, movable objects, vehicles, or decorative debris, but should not define the destructible landscape. Planck’s own documentation specifically states that arbitrarily destructible Worms-style terrain is outside its scope, and it also does not guarantee identical floating-point simulation across platforms.
What the original Worms design tells us

The Worms Armageddon manual documents several mechanics that are easy to overlook when creating a simplified clone:

    Teams have timed turns.

    A separate total round time can trigger sudden death.

    A turn does not finish immediately after firing; the game waits until worms, mines, projectiles, and other moving objects have settled.

    Wind has a visible strength and direction.

    Weapons have quantities displayed in the arsenal.

    One use normally consumes one unit, even where that use fires several shots.

    A weapon disappears from the selection menu when its stock reaches zero.

    Weapons and utilities can be obtained from crates.

    Landscapes, mines, and character placements can be randomly generated.

    Characters die through health depletion or drowning.

    Stockpiling and anti-stockpiling rules alter whether unused weapons carry across rounds.

A developer describing the original 2D implementation said its terrain collision used a one-bit mask. Terrain destruction essentially negated bits in that collision mask using fast sprite-like operations. That basic design remains appropriate today, although we can maintain richer visual and material layers alongside the binary collision data.

This suggests that the characteristic Worms feeling comes from a combination of:

    Discrete, timed turns.

    Free movement before attacking.

    Skill-based aiming, power, fuse, bounce, gravity, and wind.

    Terrain that permanently records every mistake.

    A settling phase where secondary consequences can continue.

    Knockback and drowning being as important as direct damage.

    Limited resources and asymmetric weapon availability.

    Comedic animation, sound, pauses, and reactions.

The last point is important: the simulation is only part of the game. Timing, reaction animations, voices, camera movement, anticipation, and delayed explosions create much of the personality.
Technology assessment
Option	Assessment
Phaser 4 + TypeScript	Best overall choice. Provides the surrounding game systems while permitting a custom terrain implementation.
PixiJS 8 + custom engine code	Excellent renderer and maximum control, including optional WebGPU, but you must build more camera, scene, audio, input, lifecycle, and game-framework functionality yourself. PixiJS describes itself primarily as a rendering engine rather than a complete game engine.
Godot 4 web export	Viable, especially for teams wanting a visual editor, but less attractive for a browser-first project. Web builds require WebAssembly and WebGL 2, C# projects currently cannot export to the web, and browser-tab background suspension needs consideration.
Pure Canvas 2D	Suitable for an early terrain experiment, but not my preferred production renderer once particles, shaders, animated backgrounds, lighting, and large maps are added.
Rust/WebAssembly custom engine	Potentially powerful, but premature. It adds build, debugging, interoperation, and asset-pipeline complexity before the gameplay is validated.
Unity WebGL	Not the preferred browser-first route for this particular lightweight 2D project. It provides many unnecessary systems while the most difficult feature—pixel-destructible terrain—still needs custom engineering.
WebGL versus WebGPU

Use WebGL 2 as the compatibility baseline. WebGPU is attractive, but its Firefox availability has remained platform-dependent during the 2025–2026 rollout. It should be treated as a future optimization, not a launch requirement.

Phaser 4’s current renderer is WebGL-based, which is appropriate for the target.
Proposed architecture

Application shell
├── Menus and match setup
├── Settings, controls and accessibility
├── Save/load and map browser
└── PWA installation and offline handling

Game presentation
├── Phaser scenes and cameras
├── Garlic character sprites and animation
├── Terrain renderer
├── Particles and visual effects
├── HUD and arsenal
└── Audio mixer

Deterministic game core
├── Match state machine
├── Teams, characters and inventories
├── Weapon definitions
├── Projectile simulation
├── Damage, impulses and deaths
├── Wind and environmental effects
├── Seeded random-number generator
└── Replay/command log

Terrain subsystem
├── Collision occupancy mask
├── Optional material mask
├── Dirty-chunk tracking
├── Explosion and digging brushes
├── Surface and spawn analysis
└── Visual texture generation

Optional infrastructure
├── AI controller
├── Online authoritative server
├── Accounts and cloud saves
└── Mod/content packaging

1. Simulation core

The game core should not know about Phaser sprites, cameras, sound objects, or DOM elements. It receives commands such as:

    Move left or right.

    Start jump.

    Select weapon.

    Change aim.

    Set power.

    Set fuse or bounce mode.

    Fire.

    End turn.

It produces events such as:

    Projectile spawned.

    Terrain removed.

    Character damaged.

    Character launched.

    Character drowned.

    Character killed.

    Team eliminated.

    Turn advanced.

    Match ended.

This separation enables tests, replays, AI simulation, eventual networking, and replacement of the renderer without rewriting the rules.

Use a fixed simulation step, for example 60 steps per second. Rendering can interpolate independently.
2. Match state machine

Do not represent the match as a few loose booleans. Use explicit states:

MATCH_SETUP
→ TURN_START
→ CHARACTER_SELECTION
→ MOVEMENT_AND_AIMING
→ WEAPON_ACTIVE
→ RETREAT
→ WORLD_SETTLING
→ DAMAGE_RESOLUTION
→ DEATH_SEQUENCE
→ TEAM_ELIMINATION
→ TURN_END
→ VICTORY_CHECK

WORLD_SETTLING is essential. The turn should continue while any significant projectile, garlic character, mine, fire particle, or delayed explosive remains active.

Damage can be accumulated during an attack and presented after motion settles, depending on the desired style.
3. Destructible terrain

Maintain at least two representations:
Logical collision mask

A compact grid that answers:

Is pixel (x, y) solid?

A one-bit-per-pixel bitset is memory-efficient, although a one-byte-per-pixel Uint8Array is easier during initial development.

For a 3072 × 1536 level:

    One byte per pixel: approximately 4.5 MB.

    One bit per pixel: approximately 0.56 MB.

Start with bytes for simplicity. Convert to bit packing only after profiling.
Visual terrain

The rendered terrain may contain:

    Base soil texture.

    Cut-edge texture.

    Grass or crust surface.

    Embedded stones.

    Lighting and shadows.

    Decorative non-colliding elements.

An explosion performs an operation like:

    Clear a circle or irregular brush from the logical mask.

    Mark affected terrain chunks dirty.

    Clear or modify the corresponding visual texture.

    Add a darker or lighter exposed edge.

    Check unsupported characters and objects.

    Emit dust and fragments.

Use chunks of approximately 64×64 or 128×128 pixels, so only affected regions are regenerated and uploaded.
Character collision

Garlic characters should use a small capsule, circle, or custom foot profile rather than full sprite-pixel collision.

Useful queries include:

    Foot support samples.

    Head clearance.

    Side obstruction.

    Maximum step height.

    Surface normal.

    Fall distance.

    Whether the character is embedded after terrain deformation.

Projectiles should use swept segment tests between their previous and new positions, not only test their destination point. Otherwise fast bazookas and bullets will pass through thin terrain.
4. Projectile and explosion physics

A custom ballistic integrator is sufficient:

velocity += gravity × dt
velocity.x += wind × weaponWindFactor × dt
position += velocity × dt

Each weapon defines its own parameters:

launch mode
initial speed range
gravity scale
wind influence
fuse duration
bounce factor
friction
number of projectiles
explosion radius
maximum damage
knockback force
terrain brush
fire or poison effect
whether firing ends the turn

Explosion processing should be ordered consistently:

    Find affected characters and objects.

    Calculate radial damage.

    Calculate line-of-sight or terrain shielding, if enabled.

    Apply impulse.

    Carve terrain.

    Spawn particles and sound.

    Activate nearby mines or explosives.

    Enter settling state.

For death explosions, queue them rather than resolving every death recursively in the middle of another explosion. This prevents unstable state transitions and makes chain reactions reproducible.
5. Weapon inventory

Inventory belongs to the team, unless you deliberately choose per-character inventories.

A weapon entry needs more than a count:

weaponId
availableFromTurn
ammoCount
unlimited
crateWeight
specialWeapon
enabledForScheme

When fired:

    Validate availability.

    Consume one unit at the defined commit point.

    Hide or disable it at zero.

    Record the consumption in the command log.

    Decide whether interrupted or cancelled weapons refund ammunition.

The inventory system should support predefined schemes, because the weapon economy strongly influences match length and strategy.
6. Random terrain generation

Use a seeded generator, so a map can be reconstructed from:

seed + generator version + theme + options

Suggested pipeline:

    Generate a broad land silhouette from layered noise or splines.

    Add overhangs, islands, arches, or cavern ceilings.

    Carve large blobs and tunnels.

    Smooth isolated single-pixel features.

    Remove tiny disconnected terrain fragments.

    Determine surface contours and candidate spawn points.

    Reject unsafe or unfair spawn layouts.

    Add theme decoration independently from collision.

    Place garlics, mines, crates, and environmental hazards.

    Run a validation simulation before accepting the map.

Map validation should check:

    Every character begins on solid ground.

    Characters do not overlap.

    Initial positions are not immediately fatal.

    Teams are reasonably distributed.

    There is enough usable terrain above water.

    No spawn is trapped inside a closed cavity unless the mode permits it.

    Important parts of the map are visible and navigable.

7. Rendering and cute art

For the garlic characters, a layered puppet is likely better than generating hundreds of complete animation frames:

body/clove
face
eyes and eyelids
mouth
left/right arm
left/right foot
hat or accessory
held weapon
team marking

This allows squash-and-stretch animation, procedural blinking, aim poses, recoil, fear reactions, and different team colors without requiring a unique sprite sheet for every combination.

Image generation can be used effectively for:

    Character concept sheets.

    Theme exploration.

    Background skies.

    Terrain texture ingredients.

    Props and crate concepts.

    Weapon icons.

    Menu illustrations.

    Placeholder assets.

Generated sprite sheets should still receive cleanup because maintaining exact proportions, alignment, transparent edges, and animation continuity across frames is harder than producing isolated concept art.

Keep the gameplay silhouette original. Do not reuse Worms character shapes, names, sound effects, interface layouts, or weapon artwork.
8. Audio

Use Phaser’s Web Audio support with separate buses for:

    Music.

    Interface.

    Character voices.

    Weapons.

    Explosions.

    Ambience.

The Web Audio API supports mixing, panning, effects, and other graph-based processing. Browsers generally require a user action before an audio context starts, so the title screen should include an explicit “Start” interaction that also initializes audio.

Important sound categories:

    Walking and jumping.

    Landing and fall impact.

    Aim movement.

    Charge/power meter.

    Weapon launch.

    Projectile travel.

    Bounce and collision.

    Explosion variants by size.

    Terrain debris.

    Fire.

    Damage reaction.

    Death countdown and death explosion.

    Drowning.

    Turn start/end.

    Crate collection.

    Victory and defeat.

Use pitch and volume variation so repeated footsteps and impacts do not sound identical.
Preliminary requirements
MVP functional requirements

    Two or more teams can participate in a local hot-seat match.

    Each team owns multiple garlic characters.

    Each character has health, position, velocity, alive/dead status, and team membership.

    Only one team acts at a time.

    Turn duration, retreat duration, and settling rules are configurable.

    Players can walk, jump, aim, select weapons, and fire.

    Terrain can be destroyed at arbitrary pixel positions.

    Characters fall when terrain beneath them is removed.

    Projectiles respond to gravity and weapon-specific wind influence.

    Explosions cause radial damage and knockback.

    Falling and drowning can cause death.

    Dead characters are removed after a death sequence and create a small final explosion.

    Teams are removed when they have no living members.

    The match ends when one team or alliance remains.

    Team inventories contain finite, infinite, locked, and unavailable weapons.

    Weapon usage decrements ammunition.

    Maps can be procedurally generated from a seed.

    The camera follows active characters and important projectiles.

    Basic sound and visual feedback is present.

    Settings and locally created teams persist in the browser.

Initial weapon set

A good engineering set is not necessarily the largest or funniest set. Begin with weapons that exercise different systems:
Weapon	System exercised
Bazooka	Power, aim, wind, direct explosion
Grenade	Fuse, bouncing, throwing
Shotgun	Hitscan or fast projectile, two-stage usage
Dynamite	Placement, delayed explosion, retreat
Baseball bat equivalent	Melee, knockback
Blowtorch equivalent	Continuous terrain removal
Fire bottle	Impact plus persistent fire particles
Teleport	Target selection and relocation
Mine	Proximity trigger and chain reactions

The first playable prototype only needs bazooka, grenade, and shotgun. Add the others after the turn-settling and damage sequence are reliable.
Non-functional requirements

    Current desktop Firefox, Chromium, and Safari support.

    WebGL 2 required; Canvas fallback not required.

    Keyboard and mouse first, with gamepad considered.

    Stable 60 Hz simulation on a normal contemporary laptop.

    Offline play after installation or initial caching.

    No mandatory account or internet connection.

    Seeded maps and replayable command logs.

    Remappable controls.

    Independent music, voice, and effects volume.

    Reduced camera shake and reduced flashing options.

    Automated simulation tests independent of rendering.

IndexedDB is appropriate for substantial local structured data, including blobs, and works without network availability. Service workers can cache the application and assets for offline use.
Local operation and backend strategy
Browser-only local game

No application server or database server is needed for:

    Local hot-seat play.

    AI opponents.

    Local saves.

    Procedural maps.

    Replays.

    Team creation.

    Custom schemes.

    Offline installation.

However, modern JavaScript modules should not normally be launched by double-clicking index.html. Browsers apply origin and CORS restrictions to file:// pages, so development and local operation should use a small HTTP server. Service workers require HTTPS in production, while localhost is treated as a secure development origin.

Practical options:

    Development: Vite local server.

    Local release: a one-command static server.

    Hosted release: any HTTPS static file host.

    One-click desktop distribution: a lightweight Tauri wrapper around the same web build.

    Offline browser installation: PWA after the first load.

This HTTP process is only a file server, not a game backend.
When a real backend becomes necessary

A backend is justified for:

    Internet multiplayer.

    Matchmaking and lobbies.

    Accounts.

    Cloud saves.

    Rankings.

    Moderation.

    Shared user-created maps.

    Analytics or crash reporting.

For online multiplayer, I would use a TypeScript monorepo:

packages/
├── game-core
├── shared-protocol
├── browser-client
└── game-server

The server should import the same game-core package as the client. This avoids rewriting projectile, inventory, and turn rules in Python.

Because this is turn-based, the server does not need to transmit every rendered frame. It can transmit commands, state hashes, important events, and occasional snapshots.
Python framework assessment

    FastAPI: Good for accounts, REST endpoints, administration APIs, map metadata, and WebSocket lobbies.

    Django: Appropriate when the product has extensive accounts, moderation, content management, and administration.

    Flask: Usable, but offers little advantage here over FastAPI for a new service.

    Node/TypeScript: Best choice for the authoritative match server because it can directly reuse the simulation core.

For a small deployment:

    SQLite for local development or a single private instance.

    PostgreSQL once concurrent users, rankings, uploaded maps, or multiple server processes appear.

Do not add any of this to the first vertical slice.
Implementation sequence
Phase 1: Terrain and physics spike

Build an intentionally ugly testbed containing:

    One generated terrain mask.

    Two capsule placeholders.

    Walking and jumping.

    Bazooka aiming and firing.

    Wind.

    Circular terrain destruction.

    Knockback and fall damage.

    Camera following.

Success means repeated explosions, movement, and collision remain stable in Firefox.
Phase 2: Match vertical slice

Add:

    Two teams.

    Multiple garlics.

    Turn timer.

    Character selection.

    World-settling detection.

    Health and death.

    Death explosion.

    Team elimination.

    Victory screen.

    Grenade and shotgun.

    Team inventory.

At this point the core game should already be enjoyable with placeholder graphics.
Phase 3: Data-driven content

Move weapon behavior into definitions and reusable components:

    Projectile weapons.

    Thrown weapons.

    Hitscan weapons.

    Melee weapons.

    Placed explosives.

    Terrain tools.

    Movement utilities.

    Targeted strikes.

    Persistent area effects.

Add game schemes so ammunition, damage, wind, turn duration, water, and sudden death can be configured.
Phase 4: Procedural generation and AI

Add:

    Multiple terrain themes.

    Validated spawn placement.

    Crates and mines.

    Seed sharing.

    Basic AI using sampled trajectories and heuristic scoring.

    Replay logs and deterministic regression tests.

Phase 5: Garlic presentation

Replace placeholders with:

    Layered garlic characters.

    Team accessories and colors.

    Facial reactions.

    Squash-and-stretch animation.

    Weapon poses.

    Particle effects.

    Camera shake.

    Character voice sets.

    Music and ambient sound.

Phase 6: Distribution

Add:

    PWA manifest.

    Offline cache.

    Local save migration.

    Browser compatibility tests.

    Production static build.

    Optional Tauri packaging.

Only after this should online multiplayer be considered.
Ten urgent questions

    Which modes are actually required for the first release?
    Local hot-seat, human versus AI, online private matches, public matchmaking, campaign, challenges, or some combination?

    What devices and control methods must be supported?
    Desktop keyboard/mouse only, gamepad, touchscreen tablets, phones, Steam Deck, and high-DPI displays lead to substantially different interface decisions.

    How closely should the rules imitate Worms Armageddon?
    Is this intended as a mechanically faithful spiritual successor, or can movement, aiming, inventory, turn order, and damage behave differently?

    What are the maximum match dimensions?
    Number of teams, garlics per team, map resolution, simultaneous projectiles, fire particles, mines, and match duration determine memory and performance requirements.

    What is the exact turn model?
    Can players choose any surviving garlic each turn? Does firing always end the turn? Is there retreat time? Can utilities and weapons be combined in one turn?

    Which weapons are mandatory for the first genuinely playable build?
    A concise list is needed, including ammunition counts, wind response, fuse settings, damage, radius, knockback, and whether each weapon modifies terrain.

    How sophisticated must the terrain be?
    Is it simply solid versus empty, or are there materials such as indestructible rock, ice, mud, metal, flammable ground, or terrain that collapses?

    Is deterministic replay or online multiplayer a firm future requirement?
    This determines whether fixed-point or tightly controlled arithmetic must be introduced early rather than relying on ordinary cross-platform floating-point simulation.

    What is the intended art-production model?
    Fully frame-animated sprites, layered puppet animation, vector-like rendering, generated raster assets, or a hybrid? A target internal resolution and art-direction sheet are needed before asset production.

    What persistence and user-generated content are required?
    Local settings only, saved matches, custom teams, custom weapon schemes, map editor, imported maps, downloadable maps, progression, unlocks, achievements, or cloud synchronization?

The highest-risk engineering item is not the weapon count or graphics. It is achieving reliable character collision and projectile interaction against terrain that can change at any pixel at any time. The first prototype should therefore test terrain carving, walking, falling, high-speed projectile collision, explosion impulses, and world-settling before any serious art production begins.

Okay, to answer those questions, I mean, for the first one, it should be local hotseat and human versus AI. So we have to implement some kind of local AI. The rest like private matches, public matchmaking and so on is not noted. So hotseat and human versus AI, also against several teams. I mean, one human or several humans in one play. It should be desktop, mouse, and keyboard. This is okay. Everything else is not matchmaking. The rules should imitate the Worms Armageddon rules. I mean, for instance, just Google, I mean, how it was working, and derive all the things which are maybe needed about and how it behaves from this. Up to four teams can play, up to four garlic bodies per team. Map resolution, yeah, should be, I mean, as big as the window is. I mean, the map should be that you have maybe several, I mean, two 24-inch monitor sizes. So like 5,000 pixels wide, 2,000 pixels high. Firing and turn, I mean, activating weapon or the rope or whatever. And then there's five seconds of retreat time, yes. And yes, you can combine some utilities, like you can first use the rope and then a weapon. Yeah, but else, I mean, the activation of that item is ending the turn. Except when it's maybe the jetpack, but let's leave the jetpack out. Let's focus on the simple things first, that you can move, that you can jump with space, and that you can also with space activate your weapon. Weapons, I mean, use bazooka, which is having some trajectory, grenades, which are exploding on contact, and then also something like a fist punch. The terrain should be randomly generated out of rocks and stones so that you have maybe some forest background. Please check some screenshots on the web, I mean, how it was looking, and then create some description of how this should be generated. Of course, our graphics engine has to generate them out of a seed. So we will use a seed-based generator. You give a seed, which is maybe some hash value of whatever algorithm, and then out of that to generate the terrain. And of course, the terrain must make sense. I mean, so they have at the bottom the ground, and then some obstacles, and then of course the placement of the worms, so that they're not in one place in the beginning. Fully frame-animated sprites, I don't know, puppet animation. Use something which is useful and still cute, but runs in the browser. Something like sprites, I guess, would be best. Well, at first, sprites itself, don't have to move. And it should be local settings only, and maybe it also stores in some kind of background, I mean, a database, I mean, who has won and how the teams look like and so on. Is this enough?

Yes—this is enough to lock a credible MVP specification. I’m checking the original Worms Armageddon turn, retreat, weapon, and landscape behavior now, then I’ll convert your answers into a concrete build contract and identify only the remaining implementation decisions.
Yes—this is enough to begin implementation

Your answers are sufficient to freeze the scope for the first playable version. The project is now a local, browser-based, Worms Armageddon-inspired game with:

    Local hot-seat matches.

    Human-versus-AI matches.

    Any mixture of human and AI teams.

    Two to four teams.

    One to four garlic buddies per team.

    Desktop keyboard and mouse controls.

    A world approximately 5,000 × 2,000 logical pixels.

    A camera showing only the current browser viewport.

    Procedurally generated, seeded terrain.

    Destructible pixel terrain.

    Team-owned weapon inventories.

    Bazooka, grenade-type weapon, and punch as the initial weapons.

    Five seconds of retreat after an attack.

    Local settings, team definitions, and statistics.

    No backend and no network functionality in the initial version.

The world must not be resized to match the browser window. The viewport matches the browser; the world remains approximately 5,000 × 2,000 pixels and is explored with a scrolling camera.
One important rules discrepancy

A standard Worms Armageddon grenade does not explode on contact. It has:

    A selectable one-to-five-second fuse.

    High- and low-bounce settings.

    Aim and variable throwing power.

    A maximum nominal damage of 50 in the original rules.

The bazooka is the basic contact-explosion projectile influenced by wind. The Fire Punch inflicts 30 damage, launches the target upward, and cuts through some terrain.

For the first version, I recommend implementing four weapon definitions:
Weapon	Behaviour
Bazooka	Variable power, ballistic trajectory, affected strongly by wind, explodes on terrain or character contact.
Impact Clove	Your requested contact grenade: thrown in an arc and explodes on first meaningful impact.
Classic Grenade	Fuse-based and bouncing, matching the Worms Armageddon behaviour. It can initially remain hidden from the normal weapon scheme.
Garlic Uppercut	Close-range punch that damages, launches the target, and removes a small vertical section of terrain.

This preserves your requested weapon while keeping the architecture compatible with the game you are using as the mechanical reference.
Frozen MVP specification
Match composition

A match supports:

Teams:                2–4
Garlics per team:     1–4
Maximum characters:   16
Controller per team:  Human or AI
Alliances:             Not in MVP
Online multiplayer:    Not in scope

A single player can therefore play against one, two, or three AI teams. Local hot-seat can contain several human-controlled teams and optional AI-controlled teams.

Each team owns:

id
name
controller type
AI difficulty, when applicable
team color
emblem
garlic names
cosmetic configuration
weapon inventory
current living garlics
persistent statistics

Turn order

Teams act in a fixed rotating order:

Team A → Team B → Team C → Team D → Team A

Within a team, living garlics rotate in their own fixed order. This prevents a player from repeatedly using the same optimally positioned character.

Example:

Team A turn 1: Garlic A1
Team A turn 2: Garlic A2
Team A turn 3: Garlic A3
Team A turn 4: Garlic A4
Team A turn 5: Garlic A1

Dead garlics are skipped.

Worms Armageddon supports timed team turns, manual character selection under some configurations, and switching only before the player has committed to movement or weapon selection. The initial implementation should use automatic character cycling because it is simpler, strategically sound, and avoids needing a separate “select garlic” utility.
Turn state machine

TURN_INTRO
    ↓
MOVEMENT
    ↓
WEAPON_SELECTION
    ↓
AIMING
    ↓
WEAPON_EXECUTION
    ↓
RETREAT — 5 seconds
    ↓
WORLD_SETTLING
    ↓
DAMAGE_PRESENTATION
    ↓
DEATH_SEQUENCES
    ↓
VICTORY_CHECK
    ↓
NEXT_TEAM

The world-settling phase is mandatory. Worms Armageddon waits until worms, mines, and other active objects have stopped moving before completing a turn.

A turn can also terminate because:

    The turn timer expires.

    The active garlic suffers fall damage.

    The active garlic drowns.

    The active garlic dies.

    A weapon or utility explicitly ends the turn.

    The player skips the turn.

Retreat rules

After weapon commitment:

    The weapon is launched, placed, or activated.

    A five-second retreat timer begins.

    The garlic can walk and jump.

    Weapon selection and further attacks are disabled.

    The retreat timer can finish while a projectile remains active.

    The game then waits for all consequential movement and explosions to settle.

For melee attacks, five-second retreat remains enabled initially for consistency, although it may later be made scheme-configurable.
Controls

There is a conflict in using Space both for jumping and firing. It is technically possible, but only if the game has explicit movement and aiming modes.
Proposed control scheme
Movement mode

Left / Right arrows    Walk
Space                  Jump forward
Shift + Space          Backward jump
Mouse at screen edge   Pan camera
Mouse wheel            Zoom, within limits
Right mouse button     Open weapon panel

Aiming mode

Selecting a weapon places the garlic in aiming mode:

Up / Down arrows       Adjust aim
Left / Right arrows    Change facing direction
Hold Space             Build firing power
Release Space          Fire
Escape                  Return to movement mode before committing

Immediate weapons

Punch and similar weapons do not have a power meter:

Space                  Activate immediately

Rope later

The original game uses Space to launch and detach the rope, arrow keys to control swing and rope length, and a separate input to drop a weapon while attached.

The rope should not be in the first physics milestone. It requires:

    Anchor raycasting.

    Rope constraints.

    Pendulum behaviour.

    Rope shortening and lengthening.

    Mid-air detach and reattachment.

    Collision-safe character motion.

    Weapon release while attached.

It should be added after walking, jumping, explosions, and terrain collision are stable.
Initial weapon scheme

Inventories belong to the team, not the individual garlic.

Bazooka          Unlimited
Impact Clove     5
Garlic Uppercut  Unlimited

The hidden Classic Grenade may be enabled for development testing.

Every weapon instance defines:

interface WeaponDefinition {
  id: string;
  displayName: string;
  executionType: "projectile" | "throwable" | "melee";
  ammoPolicy: "finite" | "unlimited";
  consumesAmmo: number;

  maximumDamage: number;
  explosionRadius: number;
  terrainRadius: number;
  impulseStrength: number;

  gravityScale: number;
  windInfluence: number;
  restitution: number;

  usesPowerMeter: boolean;
  minimumLaunchSpeed: number;
  maximumLaunchSpeed: number;

  fuseSeconds?: number;
  explodeOnImpact: boolean;
  endsTurn: boolean;
  retreatSeconds: number;
}

Ammo is consumed at the commit point, meaning when the projectile is actually launched or the attack animation begins. Cancelling during aiming does not consume ammunition.
World and camera
Logical dimensions

Nominal world:  5000 × 2000 pixels
Minimum world:  3500 × 1600 pixels
Viewport:       Browser content area
Water line:     Near the bottom of the world
Camera:         Scrollable and target-following

The renderer should use terrain chunks rather than one enormous texture:

Chunk size:       256 × 256 or 512 × 512 pixels
Collision format: Uint8Array during MVP
Rendering:        Dirty chunks updated after destruction

At 5,000 × 2,000 pixels, a one-byte-per-pixel collision mask uses approximately 10 MB. That is acceptable for a desktop browser. The rendered terrain should still be chunked so explosions update only the affected regions.

The camera follows:

    The active garlic during movement.

    The projectile after firing.

    The central point of an explosion.

    Launched or falling characters.

    The active garlic during retreat, where practical.

The player should be permitted to override the camera manually except during short cinematic explosion sequences.
Seeded terrain generation
Visual analysis of the reference screenshots

The screenshots reveal a consistent visual structure:

    A large, contiguous terrain mass.

    Water occupying the bottom hazard zone.

    Bright, readable surface edging.

    Repeated interior material textures.

    Concave valleys, narrow towers, arches, tunnels, and exposed ledges.

    Decorative objects that do not necessarily participate in collision.

    A comparatively simple background with strong separation from the playable terrain.

    Characters placed on clear exposed surfaces rather than buried in highly noisy geometry.

The terrain is deliberately exaggerated rather than geologically realistic. Traversability and tactical possibilities are more important than physical plausibility.
Proposed original forest theme

The first theme can be called Moonlit Garlic Grove.
Background layers

These are non-colliding and rendered with parallax:

    Sky layer
    Dark blue-to-purple vertical gradient, moon glow, sparse stars, and soft clouds.

    Distant forest layer
    Large desaturated silhouettes of conifers and rounded deciduous trees.

    Near forest layer
    Dark trunks, branches, oversized leaves, mushrooms, and occasional glowing fireflies.

    Atmospheric layer
    Slowly drifting leaves, pollen, mist, and subtle wind-responsive particles.

    Water layer
    Animated water surface with simple horizontal waves and a darker underwater gradient.

Playable terrain

    Warm brown and muted terracotta stone.

    Embedded rounded rocks of several sizes.

    A bright moss or grass lip along upward-facing surfaces.

    Pale roots, tiny mushrooms, and garlic shoots as decoration.

    Darker exposed material around explosion craters.

    Sparse non-colliding shrubs and stones.

    Occasional indestructible-looking decorative boulders only after material types are implemented.

This produces a similar degree of readability without copying Worms artwork.
Terrain generation pipeline

Every generation request uses:

seed
generatorVersion
width
height
themeId
terrainDensity
caveDensity
islandDensity
roughness
waterLevel

The seed is passed through a deterministic hash and then expanded into separate pseudorandom streams:

shape RNG
cave RNG
decoration RNG
spawn RNG
crate RNG
wind RNG

Separate streams are important. Adding a decorative flower later must not silently change every spawn position for the same seed.
Step 1: Base ground envelope

Generate a low-frequency one-dimensional height curve across the map.

Top of ground varies approximately between y = 650 and y = 1300.
Everything below a deep foundation level begins as solid.

Use several noise octaves, but keep the lowest frequency dominant. The result should have broad hills and valleys rather than constant tiny spikes.
Step 2: Two-dimensional rock field

Apply two-dimensional simplex or gradient noise to the region around the base envelope.

The density test can conceptually be:

solid =
    verticalGroundBias
  + broadShapeNoise
  + mediumRockNoise
  + localFeatureNoise
  > threshold

A practical Worms-like generator should produce mostly open air above, mostly solid terrain below, plus caves, overhangs, curved surfaces, and occasional floating structures. Traversability requires avoiding excessive spikes and tiny hooks.
Step 3: Feature stamps

Add or subtract deterministic shape brushes:

    Large rock columns.

    Rounded outcrops.

    Natural arches.

    Broad bowls.

    Caverns.

    Tunnels.

    Small floating islands.

    Flat shelves.

    Deep valleys.

Feature stamps provide more controllable gameplay than relying exclusively on noise.
Step 4: Morphological cleanup

Run several mask-processing passes:

    Remove isolated one-pixel noise.

    Fill tiny holes.

    Remove thin unsupported needles.

    Round dangerous hooks.

    Enforce a minimum platform thickness.

    Remove disconnected fragments smaller than a configured area.

    Smooth surfaces without eliminating useful ledges.

Step 5: Guarantee a foundation

The lower portion of the level must remain a sufficiently thick connected mass. Terrain may have caves, but generation must not produce a world consisting entirely of floating fragments.

A water margin remains below the terrain:

Water surface: approximately y = 1870
Safe terrain should generally end above y = 1820

Step 6: Analyse surfaces

Extract walkable surface intervals by looking for solid pixels with open pixels immediately above them.

Each candidate position records:

x and y
surface normal
clearance above
platform width
distance from water
slope
nearby walls
nearby characters
escape directions

Step 7: Place teams fairly

For up to 16 characters:

    Reject narrow ledges.

    Require enough vertical clearance.

    Require a minimum distance from water.

    Require a minimum distance between characters.

    Divide the map horizontally into broad sectors.

    Place teams in alternating sectors rather than clustering one team together.

    Avoid giving one team all of the highest ground.

    Avoid immediate punch range.

    Avoid enclosed pockets without exits.

    Run a final overlap and support check.

Initial placement should be interleaved, for example:

A1   C1   B1   D1   A2   C2   B2   D2

The exact order is shuffled by the seed while preserving spatial separation.
Step 8: Paint the terrain

The collision mask remains binary, but the visible surface is generated from it:

    Interior rock texture based on world coordinates.

    Surface moss selected from surface normals.

    Dark soil immediately below the moss.

    Ambient shadow inside overhangs and caves.

    Cracks and embedded stones generated from a decoration stream.

    Crater edges redrawn after terrain destruction.

Decorations must never alter collision unless explicitly designated as gameplay objects.
Step 9: Validate the generated level

Reject and regenerate a map when:

    Too little terrain exists.

    Too much terrain exists.

    Fewer than 16 valid spawn sites exist when 16 are requested.

    One team receives a severe height advantage.

    Characters cannot stand at their assigned positions.

    Important terrain components are inaccessible.

    Too much of the surface lies immediately above water.

    Narrow spikes dominate the map.

    The primary terrain mass is too fragmented.

Use a deterministic retry strategy:

attemptSeed = hash(originalSeed, attemptNumber)

Thus the same input always produces the same accepted result.
Character representation

Static placeholder sprites are adequate for the first milestone.
Recommended evolution
Prototype

    One left-facing sprite.

    One right-facing sprite.

    Team-colored outline, scarf, leaf, or headband.

    Aiming line and weapon icon drawn separately.

First art pass

Small sprite sheets:

Idle:       4–6 frames
Walk:       6–8 frames
Jump:       2–4 frames
Aim:        body plus separate arm/weapon
Punch:      5–7 frames
Hurt:       3–5 frames
Fall:       2–3 frames
Death:      6–10 frames
Victory:    6–10 frames

Cosmetics

Keep cosmetics as separate layers:

body sprite
face sprite
team accessory
hat
held weapon
status icon

This is technically a small hybrid between sprite animation and puppet composition. It avoids generating a full animation set for every hat and team color while retaining a hand-animated appearance.
Local AI design

The AI should be conventional deterministic game AI, not a language model or neural network. It runs entirely in the browser.
AI turn pipeline

1. Observe current world state.
2. Identify viable enemy targets.
3. Identify immediate hazards.
4. Generate movement destinations.
5. Generate weapon-action candidates.
6. Simulate candidate trajectories.
7. Score expected outcomes.
8. Select an action with difficulty-dependent error.
9. Execute the action through normal player commands.

Movement planning

Construct a temporary navigation graph from terrain surfaces.

Nodes represent safe standing positions. Edges represent:

    Walking along a continuous surface.

    A valid forward jump.

    A valid backward jump.

    A controlled drop.

    Later: rope traversal.

The graph is rebuilt only in terrain chunks changed by explosions.

For the first version, AI movement can be limited to:

    Walking.

    Short jumps.

    Turning around.

    Stopping at safe firing positions.

Bazooka AI

For each candidate enemy:

    Sample several aim angles.

    Sample several launch powers.

    Simulate the projectile using current wind.

    Stop on terrain or character collision.

    Calculate expected explosion damage and displacement.

    Penalize self-damage and friendly fire.

    Select the highest-scoring feasible shot.

Impact Clove AI

Use the same process, but account for:

    Higher gravity.

    Reduced wind influence.

    First-impact explosion.

    Terrain interception near the thrower.

Punch AI

Search for enemies reachable during the turn. Score punches based on:

    Direct damage.

    Likelihood of launching the enemy into water.

    Fall-damage potential.

    Terrain cleared.

    Whether the acting garlic will remain safe.

Candidate score

A first scoring function could be:

score =
    enemyDamage × 1.0
  + enemyKillBonus
  + drowningProbability × drowningValue
  + predictedFallDamage
  + strategicDisplacement
  - friendlyDamage × 1.8
  - selfDamage × 2.2
  - selfDrowningRisk
  - ammunitionCost
  - movementRisk

Difficulty settings
Difficulty	Behaviour
Easy	Few trajectory samples, substantial aim error, weak movement planning.
Normal	Moderate sampling, occasional tactical errors, basic self-protection.
Hard	More samples, better movement positions, considers knockback and drowning.
Expert	Broad trajectory search, small aim error, better ammunition conservation.

The AI computation should execute in a Web Worker so trajectory searches do not freeze rendering or sound.
Persistence

No server database is required. Use IndexedDB with a small repository layer.
Stored data

settings
control bindings
audio volumes
created teams
team cosmetics
team garlic names
team statistics
completed match summaries
recent map seeds
generator version

Suggested records

interface TeamStatistics {
  teamId: string;
  matchesPlayed: number;
  matchesWon: number;
  roundsPlayed: number;
  roundsWon: number;
  enemiesDefeated: number;
  garlicsLost: number;
  damageDealt: number;
  damageReceived: number;
}

interface MatchSummary {
  id: string;
  startedAt: string;
  completedAt: string;
  seed: string;
  generatorVersion: number;
  teamIds: string[];
  winnerTeamId: string;
  durationSeconds: number;
  turnsPlayed: number;
}

Data should be versioned and migrated when schemas change. An export/import JSON function can be added later without introducing a backend.
Implementation milestones
Milestone 1: Terrain laboratory

    Generate a 5,000 × 2,000 seeded mask.

    Display it through a scrolling camera.

    Place one static garlic.

    Perform pixel-perfect circular terrain destruction.

    Verify dirty-chunk updates.

    Save and reload seeds.

Milestone 2: Character physics

    Walking.

    Facing.

    Jumping.

    Falling.

    Terrain support checks.

    Fall damage.

    Water death.

    Sixteen-character stress test.

Milestone 3: Bazooka combat

    Aim mode.

    Power bar.

    Gravity.

    Wind.

    Swept projectile collision.

    Explosion damage.

    Knockback.

    Terrain deformation.

    World-settling detection.

Milestone 4: Complete match

    Two to four teams.

    Human and AI controllers.

    Character rotation.

    Turn timer.

    Five-second retreat.

    Health and death.

    Death explosion.

    Team elimination.

    Victory detection.

    Match history.

Milestone 5: Additional weapons and AI

    Impact Clove.

    Classic Grenade.

    Garlic Uppercut.

    Weapon inventories.

    Trajectory-search AI.

    Difficulty levels.

Milestone 6: Presentation

    Forest theme.

    Garlic sprites.

    Animation.

    Particles.

    Sound effects.

    Music.

    HUD and weapon panel.

    Camera effects.

Remaining decisions

These no longer block the terrain and physics prototype, but they must be set before the complete match milestone:

    Turn duration: provisional recommendation is 45 seconds.

    Starting health: provisional recommendation is 100.

    Fall-damage formula: it needs calibration against character scale and gravity.

    Sudden death: omit from MVP, but reserve a match-state hook for rising water.

    Friendly fire: enable it, including self-damage, because explosion positioning depends on it.

    Team statistics: count a kill for the attacker only when damage or displacement from that attacker directly causes the death.

    Weapon selection during movement: selecting a weapon enters aiming mode, but Escape can cancel before firing.

    Impact Clove inventory: provisional count of five per team.

    Wind: choose a new deterministic wind value at the beginning of each team turn.

    Round structure: the MVP consists of one round; best-of-three matches can be added afterward.

None of these requires further research before engineering begins. The appropriate next step is the terrain laboratory, because that will validate the collision mask, chunk renderer, procedural generation, camera, and browser performance—the highest-risk parts of the entire project.


