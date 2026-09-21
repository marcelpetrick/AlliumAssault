// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import type { Game, GameEvent, Phase } from '../core/game';
import { query, queryAs } from './dom';
import { hotkeyLabel, WEAPON_ORDER, WEAPONS, type WeaponDef, type WeaponId } from '../core/weapons';
import type { World } from '../render/world';

interface Floater {
  el: HTMLElement;
  x: number;
  y: number;
  age: number;
}

/** Current text size scale from the root style (1 when unset). */
const uiScale = () => Number(document.documentElement.style.getPropertyValue('--ui-scale')) || 1;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const RING = 2 * Math.PI * 26;

/** HTML overlay: turn info, timer, wind, weapon bar, team health, name tags and floating damage. */
export class Hud {
  private readonly el: HTMLElement;
  private readonly labelsEl: HTMLElement;
  private readonly bannerEl: HTMLElement;
  private readonly labels = new Map<number, { el: HTMLElement; hpEl: HTMLElement; shown: number }>();
  private readonly fuses = new Map<number, HTMLElement>();
  private floaters: Floater[] = [];
  private game: Game | null = null;
  private world: World | null = null;
  private bannerTime = 0;
  private lastPhase: Phase | null = null;

  constructor(
    uiRoot: HTMLElement,
    private readonly onWeapon: (id: WeaponId) => void,
    private readonly onMenu: (screen: 'pause' | 'help') => void,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <div class="labels"></div>
      <div class="hud-top">
        <div class="turn-card glass-card"><span class="turn-stripe"></span><div><div class="turn-team"></div><div class="turn-buddy"></div></div></div>
        <div class="timer glass-card">
          <svg viewBox="0 0 60 60"><circle class="track" cx="30" cy="30" r="26"/><circle class="progress" cx="30" cy="30" r="26" stroke-dasharray="${RING}"/></svg>
          <span class="timer-value"></span><span class="timer-caption"></span>
        </div>
        <div class="hud-right">
          <div class="wind glass-card"><div class="wind-label">Wind</div><div class="wind-bar"><span class="wind-mid"></span><div class="wind-fill"></div></div></div>
          <div class="approach glass-card" hidden><div class="wind-label">Approach</div><div class="approach-arrow"></div></div>
          <div class="hud-menu glass-card">
            <button class="hud-button" data-menu="help" title="How to Play" aria-label="Help">❔ Help</button>
            <button class="hud-button" data-menu="pause" title="Pause the match (Esc)" aria-label="Pause">⏸ Pause</button>
          </div>
        </div>
      </div>
      <div class="banner"><div class="banner-title"></div><div class="banner-sub"></div></div>
      <div class="hud-bottom">
        <div class="team-bars glass-card"></div>
        <div class="weapons glass-card">
          <div class="weapon-caption"><b class="weapon-name"></b><span class="weapon-blurb"></span></div>
          <div class="slots">
            ${WEAPON_ORDER.map((id, k) => `<button class="slot" data-weapon="${id}" title="${WEAPONS[id].name} (${hotkeyLabel(k)})" aria-label="${WEAPONS[id].name}"><span class="slot-key">${hotkeyLabel(k)}</span><span class="slot-icon">${WEAPONS[id].icon}</span><span class="slot-ammo"></span></button>`).join('')}
          </div>
        </div>
        <div class="hint glass-card"></div>
      </div>`;
    uiRoot.appendChild(this.el);
    this.labelsEl = query(this.el, '.labels');
    this.bannerEl = query(this.el, '.banner');
    query(this.el, '.weapons').addEventListener('click', (e) => {
      const slot = (e.target as HTMLElement).closest<HTMLElement>('.slot');
      if (slot?.dataset.weapon) this.onWeapon(slot.dataset.weapon as WeaponId);
    });
    query(this.el, '.hud-menu').addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest<HTMLElement>('.hud-button');
      if (button?.dataset.menu) this.onMenu(button.dataset.menu as 'pause' | 'help');
    });
  }

  attach(game: Game, world: World): void {
    this.game = game;
    this.world = world;
    this.labelsEl.innerHTML = '';
    this.labels.clear();
    this.fuses.clear();
    this.floaters = [];
    this.lastPhase = null;
    for (const b of game.buddies) {
      const color = game.teams[b.team].config.color;
      const el = document.createElement('div');
      el.className = 'tag';
      el.style.setProperty('--team', color);
      el.innerHTML = `<span class="tag-name">${esc(b.name)}</span><span class="tag-hp">${b.hp}</span>`;
      this.labelsEl.appendChild(el);
      this.labels.set(b.id, { el, hpEl: query(el, '.tag-hp'), shown: b.hp });
    }
    query(this.el, '.team-bars').innerHTML = game.teams
      .map(
        (t) =>
          `<div class="team-bar" style="--team:${t.config.color}"><span class="team-bar-name">${esc(t.config.name)}</span><div class="team-bar-track"><div class="team-bar-fill"></div></div></div>`,
      )
      .join('');
    // Show the new match's state straight away instead of the previous match's until the next frame.
    this.update(0);
  }

  setVisible(visible: boolean): void {
    this.el.classList.toggle('hidden', !visible);
  }

  handleEvents(events: GameEvent[]): void {
    const g = this.game;
    if (!g) return;
    for (const e of events) {
      const buddy = 'buddy' in e ? g.buddies.find((b) => b.id === e.buddy) : undefined;
      switch (e.type) {
        case 'turnStart': {
          const team = g.teams[e.team].config;
          this.banner(team.name, `${buddy?.name ?? ''} is up${team.controller === 'ai' ? ' · 🤖' : ''}`, team.color);
          break;
        }
        case 'suddenDeath':
          this.banner('Sudden Death!', '1 HP each — the water is rising!', '#ff5a3c');
          break;
        case 'damage':
          if (buddy) this.float(`−${e.amount}`, buddy.body.x, buddy.body.y + 1.6, g.teams[buddy.team].config.color);
          break;
        case 'cratePickup': {
          const text = e.kind === 'health' || !e.weapon ? `+${e.amount} HP` : `+${e.amount} ${WEAPONS[e.weapon].icon} ${WEAPONS[e.weapon].name}`;
          const colour = e.kind === 'health' ? '#5ee27a' : '#ffd166';
          // Where it was picked up, so a sheep scooping up a crate across the map is visible too.
          this.float(text, e.x, e.y + 1.2, colour);
          // And over the buddy that was rewarded, when that is somewhere else entirely.
          if (buddy && Math.hypot(buddy.body.x - e.x, buddy.body.y - e.y) > 2) this.float(text, buddy.body.x, buddy.body.y + 1.6, colour);
          break;
        }
        case 'mineTriggered':
          this.float('⚠', e.x, e.y + 1, '#ff5a5a');
          break;
        case 'drown':
          if (buddy) this.banner('Splash!', `${buddy.name} went for a swim`, '#4fc3f7');
          break;
        case 'death':
          if (buddy) this.banner('Peeled!', `${buddy.name} is out`, g.teams[buddy.team].config.color);
          break;
      }
    }
  }

  update(dt: number): void {
    const g = this.game;
    const w = this.world;
    if (!g || !w) return;
    const active = g.activeBuddy;
    const team = g.activeTeamData;

    if (g.phase !== this.lastPhase) {
      if (g.phase === 'retreat') this.banner('Retreat!', '', '#ffd166');
      this.lastPhase = g.phase;
    }

    // Top: turn card, timer, wind.
    if (team && active) {
      this.text('.turn-team', team.config.name);
      this.text('.turn-buddy', `${active.name} · ${Math.ceil(active.hp)} HP`);
      query(this.el, '.turn-card').style.setProperty('--team', team.config.color);
    }
    const retreat = g.phase === 'retreat';
    const seconds = retreat ? g.retreatLeft : g.countingDown || g.phase === 'turnStart' ? g.turnTimeLeft : 0;
    const total = retreat ? g.config.retreatTime : g.config.turnTime;
    this.text('.timer-value', g.phase === 'settling' || g.phase === 'deaths' ? '…' : String(Math.max(0, Math.ceil(seconds))));
    this.text('.timer-caption', retreat ? 'retreat' : 'turn');
    const progress = queryAs(this.el, '.progress', SVGCircleElement);
    progress.style.strokeDashoffset = String(RING * (1 - Math.max(0, seconds) / total));
    query(this.el, '.timer').classList.toggle('urgent', g.countingDown && seconds <= 5);
    query(this.el, '.timer').classList.toggle('retreat', retreat);
    const fill = query(this.el, '.wind-fill');
    fill.style.width = `${Math.abs(g.wind) * 50}%`;
    fill.style.left = g.wind < 0 ? `${50 - Math.abs(g.wind) * 50}%` : '50%';
    fill.classList.toggle('left', g.wind < 0);

    // Bottom: weapons, team bars, hints.
    const human = g.isHumanTurn;
    this.el.querySelectorAll<HTMLElement>('.slot').forEach((slot) => {
      const id = slot.dataset.weapon as WeaponId;
      const ammo = team?.ammo[id] ?? 0;
      slot.classList.toggle('on', g.weapon === id);
      slot.classList.toggle('empty', ammo <= 0);
      query(slot, '.slot-ammo').textContent = ammo === Infinity ? '∞' : `×${ammo}`;
    });
    this.el.querySelectorAll<HTMLElement>('.team-bar').forEach((bar, k) => {
      const t = g.teams[k];
      const hp = t.buddies.reduce((sum, b) => sum + (b.alive ? b.hp : 0), 0);
      query(bar, '.team-bar-fill').style.width = `${Math.min(100, (hp / (t.buddies.length * 100)) * 100)}%`;
      bar.classList.toggle('active', k === g.activeTeam);
      bar.classList.toggle('out', hp <= 0);
    });
    // Which side the strike plane comes in from, shown while the player is still picking a target.
    const approach = this.el.querySelector<HTMLElement>('.approach');
    if (approach) {
      approach.hidden = !g.choosingApproach;
      query(approach, '.approach-arrow').textContent = g.strikeDir > 0 ? '✈️ ⟶ from the left' : 'from the right ⟵ ✈️';
    }

    const def = WEAPONS[g.weapon];
    const ammo = team?.ammo[g.weapon] ?? 0;
    this.text('.weapon-name', `${def.icon} ${def.name}${ammo === Infinity ? '' : ` ×${ammo}`}`);
    this.text('.weapon-blurb', def.blurb);
    this.text('.hint', this.hint(g, def, team?.config.name, human, retreat));

    // Name tags follow buddies; HP counts down Worms-style.
    for (const b of g.buddies) {
      const label = this.labels.get(b.id);
      if (!label) continue;
      if (!b.alive) {
        label.el.style.display = 'none';
        continue;
      }
      const p = w.project(b.body.x, b.body.y + 1.75);
      if (!p) {
        label.el.style.display = 'none';
        continue;
      }
      label.el.style.display = '';
      label.el.style.transform = `translate(${p.x}px, ${p.y}px) scale(${uiScale()}) translate(-50%, -100%)`;
      label.el.classList.toggle('active', b === active && (g.phase === 'aiming' || g.phase === 'turnStart'));
      if (label.shown > b.hp) label.shown = Math.max(b.hp, label.shown - dt * 40);
      else label.shown = b.hp;
      label.hpEl.textContent = String(Math.ceil(label.shown));
    }

    // Grenade and sheep fuse countdown.
    const live = new Set<number>();
    const fused = g.projectiles.filter((p) => WEAPONS[p.weapon].fuse > 0 || p.armed).map((p) => ({ id: p.id, x: p.x, y: p.y, fuse: p.fuse }));
    for (const m of g.mines) if (m.state === 'triggered') fused.push({ id: m.id, x: m.body.x, y: m.body.y, fuse: m.fuse });
    if (g.flyer) fused.push({ id: g.flyer.id, x: g.flyer.x, y: g.flyer.y, fuse: Math.min(WEAPONS.flysheep.fuse - g.flyer.age, g.turnTimeLeft) });
    if (g.sheep) fused.push({ id: g.sheep.id, x: g.sheep.body.x, y: g.sheep.body.y, fuse: Math.min(WEAPONS.sheep.fuse - g.sheep.age, g.turnTimeLeft) });
    for (const p of fused) {
      live.add(p.id);
      let el = this.fuses.get(p.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'fuse';
        this.labelsEl.appendChild(el);
        this.fuses.set(p.id, el);
      }
      const pos = w.project(p.x, p.y + 0.7);
      el.textContent = String(Math.max(0, Math.ceil(p.fuse)));
      if (pos) el.style.transform = `translate(${pos.x}px, ${pos.y}px) scale(${uiScale()}) translate(-50%, -100%)`;
    }
    for (const [id, el] of this.fuses) {
      if (!live.has(id)) {
        el.remove();
        this.fuses.delete(id);
      }
    }

    this.floaters = this.floaters.filter((f) => {
      f.age += dt;
      const pos = w.project(f.x, f.y + f.age * 1.4);
      if (pos) f.el.style.transform = `translate(${pos.x}px, ${pos.y}px) scale(${(1 + Math.max(0, 0.3 - f.age)) * uiScale()}) translate(-50%, -100%)`;
      f.el.style.opacity = String(Math.max(0, 1 - Math.max(0, f.age - 0.9) / 0.6));
      if (f.age > 1.5) f.el.remove();
      return f.age <= 1.5;
    });

    this.bannerTime -= dt;
    this.bannerEl.classList.toggle('show', this.bannerTime > 0);
  }

  /** One line of help for whatever the player can do right now. */
  private hint(g: Game, def: WeaponDef, teamName: string | undefined, human: boolean, retreat: boolean): string {
    if (g.phase === 'gameOver') return 'Match over';
    if (!human) return `🤖 ${teamName ?? 'AI'} is plotting…`;
    if (def.kind === 'strike' && g.phase === 'aiming') {
      const side = g.choosingApproach ? ` · ← → plane comes in from the ${g.strikeDir > 0 ? 'left' : 'right'}` : '';
      return `Click on the map to drop the ${def.name.toLowerCase()}${side} · Esc menu`;
    }
    if (def.kind === 'platform' && g.phase === 'aiming') return 'Move the mouse to place the board · wheel tilts it · left-click sets it · Esc menu';
    if (g.phase === 'firing') return 'Rat-a-tat-tat! 🔩';
    if (g.phase === 'drilling') return 'Drilling down… ⛏️';
    if (g.phase === 'torching') return 'Burning through the rock… 🔥';
    if (g.phase === 'roping') return g.rope ? '↑↓ reel · ←→ swing · Space to let go 🪝' : 'Space to shoot the hook again 🪝';
    if (g.phase === 'guiding') {
      return g.flyer ? 'Arrow keys steer the flying sheep · Space to blow it up! 🦸' : 'Space to blow up the sheep! 🐑';
    }
    if (retreat) return 'Run! ← → walk · Enter jump · Backspace back-flip';
    const use = def.charge
      ? 'Hold Space to charge, release to fire'
      : def.kind === 'walker'
        ? 'Space to release the sheep'
        : def.kind === 'torch'
          ? 'Space to light the blowtorch'
          : def.kind === 'drill'
            ? 'Space to start drilling'
            : def.kind === 'rope'
              ? 'Space to shoot the hook'
              : def.kind === 'mine'
                ? 'Space to drop the mine, then run'
                : 'Space to strike';
    return `${use} · ↑↓ aim · Enter jump · 1–0, ⇧1–⇧${WEAPON_ORDER.length - 10} weapons · Esc menu`;
  }

  private banner(title: string, sub: string, color: string): void {
    this.bannerEl.style.setProperty('--team', color);
    query(this.bannerEl, '.banner-title').textContent = title;
    query(this.bannerEl, '.banner-sub').textContent = sub;
    this.bannerTime = 1.8;
  }

  private float(text: string, x: number, y: number, color: string): void {
    const el = document.createElement('div');
    el.className = 'floater';
    el.textContent = text;
    el.style.setProperty('--team', color);
    this.labelsEl.appendChild(el);
    this.floaters.push({ el, x, y, age: 0 });
  }

  private text(selector: string, value: string): void {
    const node = this.el.querySelector(selector);
    if (node && node.textContent !== value) node.textContent = value;
  }
}
