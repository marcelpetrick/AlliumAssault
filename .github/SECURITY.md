# Security policy

Allium Assault is a static browser game with no game server, accounts or application telemetry.
Match settings, entered team/buddy/faction names, language, graphics, text size and mute preferences
are saved locally in the browser. Match settings are not uploaded to a game backend. The browser
requests the site files and, when available, the optional Google Fonts stylesheet/font.

## Supported versions

The latest release is the supported version. Fixes go into a new release rather than a patch branch.

## Reporting a vulnerability

Please report privately, not as a public issue:

- GitHub Security Advisories: <https://github.com/marcelpetrick/AlliumAssault/security/advisories/new>
- or email <mail@marcelpetrick.it>

Include what you found, how to reproduce it, and what an attacker could do with it. You will get an
acknowledgement within a week. Since the game has no backend, the realistic surface is the published
static site, the build and its dependencies, so reports about supply chain issues — a compromised
dependency, a tampered release artefact — are just as welcome as ones about the game itself.

## What is already in place

- Every direct dependency is pinned to an exact version and updated deliberately. The 2026-11-03
  audit reports zero findings for both the complete development tree and production dependencies.
  Earlier advisory counts remain dated in the changelog; rerun `npm audit` when reviewing updates.
- The build, the tests and the licence check run in CI on every push, and again for every release.
- Release artefacts are built by the release workflow and published with a SHA-256 checksum.
- The game asks for no permissions and loads nothing at runtime but its own bundle and a web font.
