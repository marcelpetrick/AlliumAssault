# Security policy

Allium Assault is a static browser game: no server, no accounts, no user data. It stores exactly one
thing, in the browser's own `localStorage`: your match settings and whether sound is muted. Nothing
is sent anywhere.

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

- Every dependency is pinned to an exact version and updated deliberately; `npm audit` is clean.
- The build, the tests and the licence check run in CI on every push, and again for every release.
- Release artefacts are built by the release workflow and published with a SHA-256 checksum.
- The game asks for no permissions and loads nothing at runtime but its own bundle and a web font.
