// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import pkg from '../../package.json';
import type { AiLevel, Arsenal, Controller, MatchConfig } from '../core/game';
import type { MatchSummary } from '../core/stats';
import { WEAPON_ORDER, WEAPONS } from '../core/weapons';
import { THEME_IDS, THEMES } from '../render/themes';
import { QUALITY_OPTIONS, type Quality } from '../render/quality';
import {
  ARSENAL_OPTIONS,
  CRATE_OPTIONS,
  GRAVITY_OPTIONS,
  makeTeam,
  quickMatch,
  randomSeed,
  setBuddyCount,
  SUDDEN_DEATH_OPTIONS,
  TEAM_COLORS,
  TURN_OPTIONS,
  WIND_OPTIONS,
} from './presets';
import { drawMapPreview } from './mapPreview';
import { applyTextSize, clearSettings, defaultSettings, loadSettings, saveSettings, TEXT_SIZES, type TextSize } from './settings';

export type Screen = 'title' | 'setup' | 'help' | 'about' | 'pause' | 'victory' | 'stats';

export interface MenuActions {
  start(config: MatchConfig): void;
  resume(): void;
  restart(): void;
  rematch(): void;
  quit(): void;
  toggleMute(): boolean;
  isMuted(): boolean;
  click(): void;
}

const CONTROLLERS: { id: string; label: string; controller: Controller; level: AiLevel }[] = [
  { id: 'human', label: 'Human', controller: 'human', level: 'normal' },
  { id: 'easy', label: 'AI Easy', controller: 'ai', level: 'easy' },
  { id: 'normal', label: 'AI Normal', controller: 'ai', level: 'normal' },
  { id: 'hard', label: 'AI Hard', controller: 'ai', level: 'hard' },
];

const PAGES_URL = 'https://marcelpetrick.github.io/AlliumAssault/';
const REPO_URL = 'https://github.com/marcelpetrick/AlliumAssault';
/** Exact dependency versions, straight from package.json. */
const DEPENDENCY_VERSIONS: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const segmented = (items: { label: string; value: string | number; on: boolean }[], action: string, team?: number) =>
  `<div class="seg">${items
    .map(
      (item) =>
        `<button class="${item.on ? 'on' : ''}" data-action="${action}" data-value="${item.value}" ${team !== undefined ? `data-team="${team}"` : ''}>${item.label}</button>`,
    )
    .join('')}</div>`;

export const CONTROLS_HTML = `
  <table class="keys">
    <tr><td><kbd>←</kbd><kbd>→</kbd></td><td>Walk</td></tr>
    <tr><td><kbd>Enter</kbd></td><td>Jump forward</td></tr>
    <tr><td><kbd>Backspace</kbd></td><td>Back-flip (high jump)</td></tr>
    <tr><td><kbd>↑</kbd><kbd>↓</kbd></td><td>Aim</td></tr>
    <tr><td><kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd></td><td>Steer the flying sheep</td></tr>
    <tr><td><kbd>Space</kbd></td><td>Hold to charge, release to fire</td></tr>
    <tr><td><kbd>1</kbd>–<kbd>0</kbd> <kbd>⇧1</kbd>–<kbd>⇧${WEAPON_ORDER.length - 10}</kbd> <kbd>Tab</kbd></td><td>Choose weapon</td></tr>
    <tr><td>Wheel · Drag</td><td>Zoom · Pan camera</td></tr>
    <tr><td><kbd>←</kbd><kbd>→</kbd> (air strike)</td><td>Choose which side the plane flies in from</td></tr>
    <tr><td><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> (on the rope)</td><td>Reel in and out, swing left and right</td></tr>
    <tr><td>Click</td><td>Call the air strike or concrete mule</td></tr>
    <tr><td><kbd>M</kbd> <kbd>Esc</kbd></td><td>Mute · Pause (also the HUD's Help and Pause buttons)</td></tr>
  </table>`;

export class Menu {
  screen: Screen | null = null;
  private readonly el: HTMLElement;
  private draft: MatchConfig;
  /** Last custom setup saved by the player; a temporary Quick Match must not replace it. */
  private savedMatch: MatchConfig;
  private textSize: TextSize;
  /** Renderer budget for the next match; a match already running keeps the one it started with. */
  private quality: Quality;
  private helpReturn: Screen = 'title';
  /** Pending repaint of the map preview while the seed is being typed. */
  private previewTimer = 0;

  constructor(
    uiRoot: HTMLElement,
    private readonly version: string,
    private readonly actions: MenuActions,
  ) {
    const settings = loadSettings();
    this.draft = structuredClone(settings.match);
    this.savedMatch = structuredClone(settings.match);
    this.textSize = settings.textSize;
    this.quality = settings.quality;
    applyTextSize(this.textSize);
    this.el = document.createElement('div');
    this.el.className = 'menu';
    uiRoot.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      this.onClick(e);
    });
    this.el.addEventListener('input', (e) => {
      this.onInput(e);
    });
  }

  hide(): void {
    this.screen = null;
    this.el.innerHTML = '';
  }

  showTitle(): void {
    this.screen = 'title';
    this.el.innerHTML = `
      <div class="screen title-screen">
        <div class="logo">
          <div class="logo-garlic">🧄</div>
          <h1><span>Allium</span><span>Assault</span></h1>
          <p class="tagline">Turn-based garlic warfare on destructible islands</p>
        </div>
        <div class="title-buttons">
          <button class="primary big" data-action="quick">▶ Quick Match <small>You vs AI</small></button>
          <button class="glass big" data-action="setup">⚙ Custom Match</button>
          <button class="glass big" data-action="help">❔ How to Play</button>
          <button class="ghost" data-action="about">ℹ About</button>
        </div>
        <footer class="version">v${this.version} · sound ${this.actions.isMuted() ? 'off' : 'on'} (M)</footer>
      </div>`;
  }

  showSetup(): void {
    this.screen = 'setup';
    const d = this.draft;
    this.el.innerHTML = `
      <div class="screen setup-screen">
        <div class="panel wide">
          <header class="panel-head">
            <button class="ghost" data-action="title">← Back</button>
            <h2>Custom Match</h2>
            <span></span>
          </header>
          <section class="teams-grid">
            ${d.teams
              .map((t, i) => {
                const ctrl = t.controller === 'human' ? 'human' : t.aiLevel;
                return `
              <div class="team-card" style="--team:${t.color}">
                <div class="team-top">
                  <span class="team-dot"></span>
                  <input class="team-name" data-field="team-name" data-team="${i}" value="${esc(t.name)}" maxlength="18" spellcheck="false" />
                  ${d.teams.length > 2 ? `<button class="icon" data-action="remove-team" data-team="${i}" title="Remove team">✕</button>` : ''}
                </div>
                <div class="swatches">${TEAM_COLORS.map((c) => `<button class="swatch ${c === t.color ? 'on' : ''}" style="--c:${c}" data-action="color" data-team="${i}" data-value="${c}"></button>`).join('')}</div>
                <label class="field-label">Player</label>
                ${segmented(
                  CONTROLLERS.map((c) => ({ label: c.label, value: c.id, on: c.id === ctrl })),
                  'controller',
                  i,
                )}
                <label class="field-label">Buddies</label>
                <div class="buddies">
                  <div class="stepper">
                    <button data-action="buddies" data-team="${i}" data-value="-1">−</button>
                    <span>${t.buddyNames.length}</span>
                    <button data-action="buddies" data-team="${i}" data-value="1">+</button>
                  </div>
                  <div class="buddy-names">${t.buddyNames.map((n) => `<span>🧄 ${esc(n)}</span>`).join('')}</div>
                </div>
              </div>`;
              })
              .join('')}
            ${d.teams.length < 4 ? `<button class="team-card add" data-action="add-team">＋<span>Add team</span></button>` : ''}
          </section>
          <section class="options">
            <div><label class="field-label">Turn time</label>${segmented(
              TURN_OPTIONS.map((s) => ({ label: `${s}s`, value: s, on: s === d.turnTime })),
              'turn',
            )}</div>
            <div><label class="field-label">Wind</label>${segmented(
              WIND_OPTIONS.map((w) => ({ label: w.label, value: w.value, on: w.value === d.windMax })),
              'wind',
            )}</div>
            <div><label class="field-label">Crates</label>${segmented(
              CRATE_OPTIONS.map((c) => ({ label: c.label, value: c.value, on: c.value === (d.crates ?? 0) })),
              'crates',
            )}</div>
            <div><label class="field-label">Graphics</label>${segmented(
              QUALITY_OPTIONS.map((q) => ({ label: q.label, value: q.value, on: q.value === this.quality })),
              'quality',
            )}</div>
            <div><label class="field-label">Text size</label>${segmented(
              TEXT_SIZES.map((t) => ({ label: t.label, value: t.value, on: t.value === this.textSize })),
              'text-size',
            )}</div>
            <div><label class="field-label">Arsenal</label>${segmented(
              ARSENAL_OPTIONS.map((a) => ({ label: a.label, value: a.value, on: a.value === (d.arsenal ?? 'all') })),
              'arsenal',
            )}</div>
            <div><label class="field-label">Gravity</label>${segmented(
              GRAVITY_OPTIONS.map((g) => ({ label: g.label, value: g.value, on: g.value === (d.gravity ?? 1) })),
              'gravity',
            )}</div>
            <div><label class="field-label">Sudden Death</label>${segmented(
              SUDDEN_DEATH_OPTIONS.map((o) => ({ label: o.label, value: o.value, on: o.value === (d.suddenDeath ?? 0) })),
              'sudden-death',
            )}</div>
            <div class="map-field">
              <div class="seed-field"><label class="field-label">Map seed</label>
                <div class="seed"><input data-field="seed" value="${esc(d.seed)}" maxlength="24" spellcheck="false" /><button data-action="dice" title="Random seed">🎲</button></div>
              </div>
              <div class="preview-field"><label class="field-label">Map preview</label>
                <canvas class="map-preview" data-preview width="384" height="192" aria-label="Preview of the map this seed generates"></canvas>
              </div>
            </div>
          </section>
          <label class="field-label">Scenery</label>
          <section class="themes">
            ${THEME_IDS.map((id) => {
              const th = THEMES[id];
              return `<button class="theme-card ${id === d.theme ? 'on' : ''}" data-action="theme" data-value="${id}"
                style="--sky1:${th.skyTop.toHexString()};--sky2:${th.skyHorizon.toHexString()};--ground:${th.grass.toHexString()};--rock:${th.rock.toHexString()}">
                <span>${th.name}</span></button>`;
            }).join('')}
          </section>
          <footer class="panel-foot">
            <button class="ghost" data-action="reset" title="Restore all default settings">↺ Reset all</button>
            <button class="primary big" data-action="start">Start Battle ▶</button>
          </footer>
        </div>
      </div>`;
    this.paintPreview();
  }

  /** Draw the island the current seed and scenery produce, whenever the setup screen is on. */
  private paintPreview(): void {
    const canvas = this.el.querySelector('canvas[data-preview]');
    if (canvas instanceof HTMLCanvasElement) drawMapPreview(canvas, this.draft.seed, this.draft.theme);
  }

  showAbout(): void {
    this.screen = 'about';
    const dep = (name: string) => esc(DEPENDENCY_VERSIONS[name] ?? '');
    const row = (name: string, version: string, license: string, url: string) =>
      `<tr><td><a href="${url}" target="_blank" rel="noopener">${name}</a></td><td>${version}</td><td>${license}</td></tr>`;
    this.el.innerHTML = `
      <div class="screen">
        <div class="panel about">
          <header class="panel-head"><button class="ghost" data-action="title">← Back</button><h2>About</h2><span></span></header>
          <p class="lead"><b>Allium Assault</b> v${esc(this.version)} — turn-based garlic warfare, <b>free to play</b> in your browser.</p>
          <ul class="about-facts">
            <li><b>Author:</b> Marcel Petrick · <a href="mailto:mail@marcelpetrick.it">mail@marcelpetrick.it</a></li>
            <li><b>Play online:</b> hosted on GitHub Pages at <a href="${PAGES_URL}" target="_blank" rel="noopener">marcelpetrick.github.io/AlliumAssault</a></li>
            <li><b>Source code:</b> <a href="${REPO_URL}" target="_blank" rel="noopener">github.com/marcelpetrick/AlliumAssault</a> · licensed GPL-3.0-or-later</li>
          </ul>
          <h3>Tech stack and open-source licenses</h3>
          <table class="licenses">
            <tr><th>Component</th><th>Version</th><th>License</th></tr>
            ${row('Babylon.js (3D engine)', dep('@babylonjs/core'), 'Apache-2.0', 'https://www.babylonjs.com/')}
            ${row('simplex-noise (terrain)', dep('simplex-noise'), 'MIT', 'https://github.com/jwagner/simplex-noise.js')}
            ${row('Fredoka font', 'Google Fonts', 'OFL-1.1', 'https://fonts.google.com/specimen/Fredoka')}
            ${row('TypeScript', dep('typescript'), 'Apache-2.0', 'https://www.typescriptlang.org/')}
            ${row('Vite (build)', dep('vite'), 'MIT', 'https://vite.dev/')}
            ${row('Vitest (unit tests)', dep('vitest'), 'MIT', 'https://vitest.dev/')}
            ${row('Playwright (browser tests)', dep('@playwright/test'), 'Apache-2.0', 'https://playwright.dev/')}
            ${row('ESLint + typescript-eslint', dep('eslint'), 'MIT', 'https://eslint.org/')}
          </table>
          <p class="fine">Sound effects are synthesized live with the Web Audio API; graphics are generated in code. Game
          mechanics are inspired by Team17's Worms series; all design, art, sound and code are original.</p>
        </div>
      </div>`;
  }

  showHelp(from: Screen): void {
    this.helpReturn = from;
    this.screen = 'help';
    this.el.innerHTML = `
      <div class="screen">
        <div class="panel">
          <header class="panel-head"><button class="ghost" data-action="help-back">← Back</button><h2>How to Play</h2><span></span></header>
          <p class="lead">Teams take turns. Walk your garlic buddy into position, pick a weapon, aim, and blast the enemy — then
          retreat before the smoke clears. Water is deadly, falls hurt, and the last team standing wins.</p>
          <div class="help-grid">
            <div>${CONTROLS_HTML}</div>
            <div class="weapon-list">
              ${WEAPON_ORDER.map((id) => {
                const w = WEAPONS[id];
                return `<div class="weapon-row"><span class="weapon-icon">${w.icon}</span><div><b>${w.name}</b>
                  <small>${w.ammo === Infinity ? 'unlimited' : `${w.ammo} per team`} · ${w.damage} dmg</small><p>${w.blurb}</p></div></div>`;
              }).join('')}
            </div>
          </div>
        </div>
      </div>`;
  }

  showPause(): void {
    this.screen = 'pause';
    this.el.innerHTML = `
      <div class="screen dim">
        <div class="panel narrow">
          <h2>Paused</h2>
          <div class="pause-setting">
            <label class="field-label">Text size</label>
            ${segmented(
              TEXT_SIZES.map((size) => ({ label: size.label, value: size.value, on: size.value === this.textSize })),
              'text-size',
            )}
          </div>
          <div class="stack">
            <button class="primary" data-action="resume">Resume</button>
            <button class="glass" data-action="restart">Restart match</button>
            <button class="glass" data-action="help-pause">❔ How to Play</button>
            <button class="glass" data-action="mute">Sound: ${this.actions.isMuted() ? 'off' : 'on'}</button>
            <button class="ghost" data-action="quit">Quit to title</button>
          </div>
        </div>
      </div>`;
  }

  /** The result of the match that just ended, kept so the two screens can be flipped between. */
  private summary: MatchSummary | null = null;
  private result: { winner: { name: string; color: string } | null; turns: number } = { winner: null, turns: 0 };

  showVictory(winner: { name: string; color: string } | null, turns: number, summary?: MatchSummary | null): void {
    if (summary !== undefined) {
      this.summary = summary;
      this.result = { winner, turns };
    }
    ({ winner, turns } = this.result);
    this.screen = 'victory';
    this.el.innerHTML = `
      <div class="screen dim">
        <div class="panel narrow victory" style="--team:${winner?.color ?? '#999'}">
          <div class="trophy">${winner ? '🏆' : '🧄'}</div>
          <h2>${winner ? `${esc(winner.name)} wins!` : 'Draw!'}</h2>
          <p class="lead">${winner ? `Victory after ${turns} turns of pungent combat.` : 'Everybody got peeled.'}</p>
          <div class="stack">
            ${this.summary ? '<button class="glass" data-action="stats">\u{1f4ca} Match statistics</button>' : ''}
            <button class="primary" data-action="rematch">Rematch on a new map</button>
            <button class="glass" data-action="setup">Change setup</button>
            <button class="ghost" data-action="quit">Title screen</button>
          </div>
        </div>
      </div>`;
  }

  /**
   * The scoreboard: what each team and each buddy did, and the honours board. Built from the
   * summary the rules handed over, so nothing here recounts anything.
   */
  showStats(): void {
    const summary = this.summary;
    if (!summary) {
      this.showVictory(this.result.winner, this.result.turns);
      return;
    }
    this.screen = 'stats';
    const pct = (hits: number, shots: number) => (shots > 0 ? `${Math.round((hits / shots) * 100)}%` : '—');
    this.el.innerHTML = `
      <div class="screen">
        <div class="panel wide stats-panel">
          <header class="panel-head"><button class="ghost" data-action="victory">\u2190 Back</button><h2>Match statistics</h2><span></span></header>
          <table class="stats-table">
            <tr><th>Team</th><th>Damage dealt</th><th>Taken</th><th>Own goals</th><th>Shots</th><th>On target</th><th>Lost</th></tr>
            ${summary.teams
              .map(
                (t) =>
                  `<tr style="--team:${t.colour}"><td><span class="stats-dot"></span>${esc(t.name)}</td><td>${String(t.dealt)}</td><td>${String(t.taken)}</td><td>${String(t.friendly)}</td><td>${String(t.shots)}</td><td>${pct(t.hits, t.shots)}</td><td>${String(t.lost)}</td></tr>`,
              )
              .join('')}
          </table>
          <h3>Honours</h3>
          <div class="awards">
            ${summary.awards
              .map(
                (a) =>
                  `<div class="award"><span class="award-icon">${a.icon}</span><div><b>${esc(a.title)}</b><div class="award-who">${esc(a.who)}</div><small>${esc(a.detail)}</small></div></div>`,
              )
              .join('')}
          </div>
          <h3>Every buddy</h3>
          <table class="stats-table">
            <tr><th>Buddy</th><th>Dealt</th><th>Taken</th><th>Own goals</th><th>Shots</th><th>Crates</th><th>Best hit</th></tr>
            ${summary.buddies
              .map(
                (b) =>
                  `<tr class="${b.alive ? 'alive' : 'out'}"><td>${b.alive ? '\u{1f9c4}' : '\u{1faa6}'} ${esc(b.name)}</td><td>${String(b.dealt)}</td><td>${String(b.taken)}</td><td>${String(b.friendly)}</td><td>${String(b.shots)}</td><td>${String(b.crates)}</td><td>${String(b.best.amount)}</td></tr>`,
              )
              .join('')}
          </table>
        </div>
      </div>`;
  }

  back(): void {
    if (this.screen === 'help') this.returnFromHelp();
    else if (this.screen === 'about') this.showTitle();
    else if (this.screen === 'setup') this.showTitle();
  }

  private returnFromHelp(): void {
    if (this.helpReturn === 'pause') this.showPause();
    else this.showTitle();
  }

  private onInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.dataset.field === 'seed') {
      this.draft.seed = input.value.trim() || randomSeed();
      // Generating a map costs a few milliseconds, so wait for a pause in the typing.
      window.clearTimeout(this.previewTimer);
      this.previewTimer = window.setTimeout(() => {
        this.paintPreview();
      }, 250);
    }
    if (input.dataset.field === 'team-name') this.draft.teams[Number(input.dataset.team)].name = input.value || 'Team';
    this.persist();
  }

  private onClick(e: Event): void {
    const button = (e.target as HTMLElement).closest('button');
    if (!button?.dataset.action) return;
    this.actions.click();
    const d = this.draft;
    const screen = this.screen;
    const team = d.teams[Number(button.dataset.team)];
    const value = button.dataset.value ?? '';
    switch (button.dataset.action) {
      case 'quick':
        this.actions.start(quickMatch());
        return;
      case 'setup': {
        this.showSetup();
        return;
      }
      case 'title': {
        this.showTitle();
        return;
      }
      case 'help': {
        this.showHelp('title');
        return;
      }
      case 'about': {
        this.showAbout();
        return;
      }
      case 'help-pause': {
        this.showHelp('pause');
        return;
      }
      case 'help-back': {
        this.returnFromHelp();
        return;
      }
      case 'start':
        // Only the custom setup is remembered for next time; quick matches leave it alone.
        this.persist();
        this.actions.start(structuredClone(d));
        return;
      case 'stats': {
        this.showStats();
        return;
      }
      case 'victory': {
        this.showVictory(this.result.winner, this.result.turns);
        return;
      }
      case 'resume': {
        this.actions.resume();
        return;
      }
      case 'restart': {
        this.actions.restart();
        return;
      }
      case 'rematch': {
        this.actions.rematch();
        return;
      }
      case 'quit': {
        this.actions.quit();
        return;
      }
      case 'mute':
        this.actions.toggleMute();
        {
          this.showPause();
          return;
        }
      case 'add-team': {
        const used = d.teams.map((t) => t.color);
        const t = makeTeam(
          d.teams.length,
          'ai',
          'normal',
          3,
          d.teams.flatMap((x) => x.buddyNames),
        );
        t.color = TEAM_COLORS.find((c) => !used.includes(c)) ?? t.color;
        d.teams.push(t);
        break;
      }
      case 'remove-team':
        d.teams.splice(Number(button.dataset.team), 1);
        break;
      case 'color':
        team.color = value;
        break;
      case 'controller': {
        const c = CONTROLLERS.find((x) => x.id === value);
        if (!c) break;
        team.controller = c.controller;
        team.aiLevel = c.level;
        break;
      }
      case 'buddies':
        setBuddyCount(d, team, Math.min(4, Math.max(1, team.buddyNames.length + Number(value))));
        break;
      case 'turn':
        d.turnTime = Number(value);
        break;
      case 'wind':
        d.windMax = Number(value);
        break;
      case 'crates':
        d.crates = Number(value);
        break;
      case 'sudden-death':
        d.suddenDeath = Number(value);
        break;
      case 'gravity':
        d.gravity = Number(value);
        break;
      case 'quality':
        // Takes effect for the next match: the scene is built once, with the budget it was given.
        this.quality = value as Quality;
        break;
      case 'arsenal':
        d.arsenal = value as Arsenal;
        // Special weapons only come from crates, so make sure crates drop.
        if (d.arsenal === 'crates' && !d.crates) d.crates = CRATE_OPTIONS[1].value;
        break;
      case 'dice':
        d.seed = randomSeed();
        break;
      case 'theme':
        d.theme = value;
        break;
      case 'text-size':
        this.textSize = value as TextSize;
        applyTextSize(this.textSize);
        if (screen === 'pause') {
          this.persistPreferences();
          this.showPause();
          return;
        }
        break;
      case 'reset': {
        clearSettings();
        const defaults = defaultSettings();
        this.draft = structuredClone(defaults.match);
        this.savedMatch = structuredClone(defaults.match);
        this.textSize = defaults.textSize;
        this.quality = defaults.quality;
        applyTextSize(this.textSize);
        this.showSetup();
        return;
      }
    }
    this.persist();
    this.showSetup();
  }

  /** Remember a started match's config so "Change setup" starts from it (in this session only). */
  setDraft(config: MatchConfig): void {
    this.draft = structuredClone(config);
  }

  private persist(): void {
    this.savedMatch = structuredClone(this.draft);
    this.persistPreferences();
  }

  /** Save the preferences without touching the saved match — a paused game may be changing them. */
  private persistPreferences(): void {
    saveSettings({ match: this.savedMatch, textSize: this.textSize, quality: this.quality });
  }

  /** What the player chose; the app still lets `?quality=low` in the URL override it. */
  get renderQuality(): Quality {
    return this.quality;
  }
}
