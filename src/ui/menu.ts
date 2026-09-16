import type { AiLevel, Controller, MatchConfig } from '../core/game';
import { WEAPON_ORDER, WEAPONS } from '../core/weapons';
import { THEME_IDS, THEMES } from '../render/themes';
import { CRATE_OPTIONS, makeTeam, quickMatch, randomSeed, setBuddyCount, TEAM_COLORS, TURN_OPTIONS, WIND_OPTIONS } from './presets';

export type Screen = 'title' | 'setup' | 'help' | 'pause' | 'victory';

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

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const CONTROLS_HTML = `
  <table class="keys">
    <tr><td><kbd>←</kbd><kbd>→</kbd></td><td>Walk</td></tr>
    <tr><td><kbd>Enter</kbd></td><td>Jump forward</td></tr>
    <tr><td><kbd>Backspace</kbd></td><td>Back-flip (high jump)</td></tr>
    <tr><td><kbd>↑</kbd><kbd>↓</kbd></td><td>Aim</td></tr>
    <tr><td><kbd>Space</kbd></td><td>Hold to charge, release to fire</td></tr>
    <tr><td><kbd>1</kbd>–<kbd>${WEAPON_ORDER.length}</kbd> <kbd>Tab</kbd></td><td>Choose weapon</td></tr>
    <tr><td>Wheel · Drag</td><td>Zoom · Pan camera</td></tr>
    <tr><td>Click</td><td>Call the air strike</td></tr>
    <tr><td><kbd>M</kbd> <kbd>Esc</kbd></td><td>Mute · Pause</td></tr>
  </table>`;

export class Menu {
  screen: Screen | null = null;
  private readonly el: HTMLElement;
  private draft: MatchConfig = quickMatch();
  private helpReturn: Screen = 'title';

  constructor(
    uiRoot: HTMLElement,
    private readonly version: string,
    private readonly actions: MenuActions,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'menu';
    uiRoot.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.onClick(e));
    this.el.addEventListener('input', (e) => this.onInput(e));
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
        </div>
        <footer class="version">v${this.version} · sound ${this.actions.isMuted() ? 'off' : 'on'} (M)</footer>
      </div>`;
  }

  showSetup(): void {
    this.screen = 'setup';
    const d = this.draft;
    const seg = (items: { label: string; value: string | number; on: boolean }[], action: string, team?: number) =>
      `<div class="seg">${items
        .map((i) => `<button class="${i.on ? 'on' : ''}" data-action="${action}" data-value="${i.value}" ${team !== undefined ? `data-team="${team}"` : ''}>${i.label}</button>`)
        .join('')}</div>`;
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
                ${seg(CONTROLLERS.map((c) => ({ label: c.label, value: c.id, on: c.id === ctrl })), 'controller', i)}
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
            <div><label class="field-label">Turn time</label>${seg(TURN_OPTIONS.map((s) => ({ label: `${s}s`, value: s, on: s === d.turnTime })), 'turn')}</div>
            <div><label class="field-label">Wind</label>${seg(WIND_OPTIONS.map((w) => ({ label: w.label, value: w.value, on: w.value === d.windMax })), 'wind')}</div>
            <div><label class="field-label">Crates</label>${seg(CRATE_OPTIONS.map((c) => ({ label: c.label, value: c.value, on: c.value === (d.crates ?? 0) })), 'crates')}</div>
            <div><label class="field-label">Map seed</label>
              <div class="seed"><input data-field="seed" value="${esc(d.seed)}" maxlength="24" spellcheck="false" /><button data-action="dice" title="Random seed">🎲</button></div>
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
          <footer class="panel-foot"><button class="primary big" data-action="start">Start Battle ▶</button></footer>
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
          <div class="stack">
            <button class="primary" data-action="resume">Resume</button>
            <button class="glass" data-action="restart">Restart match</button>
            <button class="glass" data-action="help-pause">Controls</button>
            <button class="glass" data-action="mute">Sound: ${this.actions.isMuted() ? 'off' : 'on'}</button>
            <button class="ghost" data-action="quit">Quit to title</button>
          </div>
        </div>
      </div>`;
  }

  showVictory(winner: { name: string; color: string } | null, turns: number): void {
    this.screen = 'victory';
    this.el.innerHTML = `
      <div class="screen dim">
        <div class="panel narrow victory" style="--team:${winner?.color ?? '#999'}">
          <div class="trophy">${winner ? '🏆' : '🧄'}</div>
          <h2>${winner ? `${esc(winner.name)} wins!` : 'Draw!'}</h2>
          <p class="lead">${winner ? `Victory after ${turns} turns of pungent combat.` : 'Everybody got peeled.'}</p>
          <div class="stack">
            <button class="primary" data-action="rematch">Rematch on a new map</button>
            <button class="glass" data-action="setup">Change setup</button>
            <button class="ghost" data-action="quit">Title screen</button>
          </div>
        </div>
      </div>`;
  }

  back(): void {
    if (this.screen === 'help') this.returnFromHelp();
    else if (this.screen === 'setup') this.showTitle();
  }

  private returnFromHelp(): void {
    if (this.helpReturn === 'pause') this.showPause();
    else this.showTitle();
  }

  private onInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.dataset.field === 'seed') this.draft.seed = input.value.trim() || randomSeed();
    if (input.dataset.field === 'team-name') this.draft.teams[Number(input.dataset.team)].name = input.value || 'Team';
  }

  private onClick(e: Event): void {
    const button = (e.target as HTMLElement).closest('button');
    if (!button?.dataset.action) return;
    this.actions.click();
    const d = this.draft;
    const team = d.teams[Number(button.dataset.team)];
    const value = button.dataset.value ?? '';
    switch (button.dataset.action) {
      case 'quick':
        this.actions.start(quickMatch());
        return;
      case 'setup':
        return this.showSetup();
      case 'title':
        return this.showTitle();
      case 'help':
        return this.showHelp('title');
      case 'help-pause':
        return this.showHelp('pause');
      case 'help-back':
        return this.returnFromHelp();
      case 'start':
        this.actions.start(structuredClone(d));
        return;
      case 'resume':
        return this.actions.resume();
      case 'restart':
        return this.actions.restart();
      case 'rematch':
        return this.actions.rematch();
      case 'quit':
        return this.actions.quit();
      case 'mute':
        this.actions.toggleMute();
        return this.showPause();
      case 'add-team': {
        const used = d.teams.map((t) => t.color);
        const t = makeTeam(d.teams.length, 'ai', 'normal', 3, d.teams.flatMap((x) => x.buddyNames));
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
        const c = CONTROLLERS.find((x) => x.id === value)!;
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
      case 'dice':
        d.seed = randomSeed();
        break;
      case 'theme':
        d.theme = value;
        break;
    }
    this.showSetup();
  }

  /** Remember a finished match's config so "Change setup" starts from it. */
  setDraft(config: MatchConfig): void {
    this.draft = structuredClone(config);
  }
}
