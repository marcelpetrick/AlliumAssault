import Phaser from 'phaser';
import { SimulationCore, type MatchConfig } from '@core/simulation/SimulationCore';
import type { Command } from '@core/simulation/Commands';
import { TerrainRenderer } from '../renderers/TerrainRenderer';
import { HUD } from '../hud/HUD';
import { AudioManager } from '../audio/AudioManager';
import { weaponRegistry } from '@core/weapons/WeaponRegistry';
import { CHARACTER_HEIGHT } from '@core/physics/CharacterPhysics';

interface CharacterSprite {
  sprite: Phaser.GameObjects.Image;
  aimLine?: Phaser.GameObjects.Graphics;
}

export class GameScene extends Phaser.Scene {
  private sim!: SimulationCore;
  private terrain!: TerrainRenderer;
  private hud!: HUD;
  private audio!: AudioManager;
  private charSprites = new Map<string, CharacterSprite>();
  private projSprites = new Map<string, Phaser.GameObjects.Image>();
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: {
    space: Phaser.Input.Keyboard.Key;
    backspace: Phaser.Input.Keyboard.Key;
    escape: Phaser.Input.Keyboard.Key;
    tab: Phaser.Input.Keyboard.Key;
    one: Phaser.Input.Keyboard.Key;
    two: Phaser.Input.Keyboard.Key;
    three: Phaser.Input.Keyboard.Key;
    four: Phaser.Input.Keyboard.Key;
    h: Phaser.Input.Keyboard.Key;
  };
  private matchConfig!: MatchConfig;
  private aiWorker?: Worker;
  private aiPending = false;
  private weaponPanelOpen = false;
  private gameOver = false;
  private powerBar?: Phaser.GameObjects.Graphics;
  private spaceWasDown = false;

  constructor() {
    super('GameScene');
  }

  init(data: { config: MatchConfig }): void {
    this.charSprites = new Map();
    this.projSprites = new Map();
    this.weaponPanelOpen = false;
    this.gameOver = false;
    this.aiPending = false;
    this.matchConfig = data.config;
    this.sim = SimulationCore.createMatch(data.config);
  }

  create(): void {
    const state = this.sim.getState();
    const worldW = state.terrain.getWidth();
    const worldH = state.terrain.getHeight();

    // Terrain renderer — includes sky gradient + decorations + water
    this.terrain = new TerrainRenderer(
      this,
      state.terrain,
      state.waterLevel,
      this.matchConfig.themeId ?? 'forest',
    );
    this.terrain.initialise();

    // Character sprites
    // Origin (0.5, 1.0) = bottom-centre so feet sit on the physics ground line.
    // Physics position y is the CHARACTER centre; feet are at y + CHARACTER_HEIGHT/2.
    for (const team of state.teams) {
      for (const char of team.characters) {
        const img = this.add.image(
          char.position.x,
          char.position.y + CHARACTER_HEIGHT / 2,
          'garlic_placeholder',
        );
        img.setOrigin(0.5, 1.0);
        img.setDisplaySize(96, 116);
        img.setTint(Phaser.Display.Color.IntegerToColor(team.color).lighten(60).color);
        img.setDepth(20);
        this.charSprites.set(char.id, { sprite: img });
      }
    }

    // Power bar
    this.powerBar = this.add.graphics().setScrollFactor(0).setDepth(101);

    // HUD
    this.hud = new HUD(this);

    // Audio
    this.audio = new AudioManager(this);

    // Camera
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setZoom(1);

    // Follow active character
    this.focusActiveCharacter();

    // Keyboard
    const kb = this.input.keyboard as Phaser.Input.Keyboard.KeyboardPlugin;
    this.cursors = kb.createCursorKeys();
    this.keys = {
      space: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      backspace: kb.addKey(Phaser.Input.Keyboard.KeyCodes.BACKSPACE),
      escape: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
      tab: kb.addKey(Phaser.Input.Keyboard.KeyCodes.TAB),
      one: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      two: kb.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      three: kb.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
      four: kb.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
      h: kb.addKey(Phaser.Input.Keyboard.KeyCodes.H),
    };

    // Prevent Tab from losing focus
    kb.on('keydown-TAB', (e: KeyboardEvent) => e.preventDefault());

    // H key → help overlay
    this.keys.h.on('down', () => this.hud.toggleHelp());

    // Subscribe to simulation events
    this.subscribeToEvents();

    // AI worker
    this.aiWorker = new Worker(new URL('../../workers/ai.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.aiWorker.addEventListener('message', (e: MessageEvent<Command[]>) => {
      this.handleAiCommands(e.data);
    });

    // Initialise audio on first pointer down
    this.input.once('pointerdown', () => this.audio.init());
  }

  private subscribeToEvents(): void {
    this.sim.on('TerrainModified', (e) => {
      if (e.type === 'TerrainModified') {
        this.terrain.markDirty(e.dirtyChunkIds);
        this.cameras.main.shake(60, 0.006);
      }
    });

    this.sim.on('ProjectileSpawned', (e) => {
      if (e.type === 'ProjectileSpawned') {
        const img = this.add.image(e.position.x, e.position.y, 'projectile').setDepth(25);
        this.projSprites.set(e.projectileId, img);
        this.audio.playWeaponFire(e.weaponId);
      }
    });

    this.sim.on('ProjectileDetonated', (e) => {
      if (e.type === 'ProjectileDetonated') {
        const img = this.projSprites.get(e.projectileId);
        if (img) {
          img.destroy();
          this.projSprites.delete(e.projectileId);
        }
        this.spawnExplosionEffect(e.position.x, e.position.y);
        this.audio.playExplosion('medium');
      }
    });

    this.sim.on('CharacterDamaged', (e) => {
      if (e.type === 'CharacterDamaged') {
        const cs = this.charSprites.get(e.characterId);
        if (cs) {
          this.tweens.add({
            targets: cs.sprite,
            tint: { from: 0xff0000, to: 0xffffff },
            duration: 200,
            onComplete: () => {
              cs.sprite.clearTint();
            },
          });
        }
        this.audio.playHurt();
      }
    });

    this.sim.on('CharacterKilled', (e) => {
      if (e.type === 'CharacterKilled') {
        const cs = this.charSprites.get(e.characterId);
        if (cs) {
          this.tweens.add({
            targets: cs.sprite,
            alpha: 0,
            scaleX: 2,
            scaleY: 2,
            duration: 400,
            onComplete: () => {
              cs.sprite.destroy();
              this.charSprites.delete(e.characterId);
            },
          });
        }
        this.audio.playDeath();
      }
    });

    this.sim.on('TeamEliminated', (e) => {
      if (e.type === 'TeamEliminated') {
        const team = this.sim.getState().teams.find((t) => t.id === e.teamId);
        this.hud.showMessage(`${team?.name ?? 'A team'} eliminated!`, 2500);
      }
    });

    this.sim.on('TurnStarted', (e) => {
      if (e.type === 'TurnStarted') {
        this.hud.updateWind(e.windX, e.windY);
        this.audio.playTurnStart();
        this.focusActiveCharacter();
        // Hide aim line
        for (const cs of this.charSprites.values()) cs.aimLine?.setVisible(false);
      }
    });

    this.sim.on('WindChanged', (e) => {
      if (e.type === 'WindChanged') this.hud.updateWind(e.x, e.y);
    });

    this.sim.on('RetreatStarted', () => {
      this.hud.showMessage('Retreat!', 1000);
    });

    this.sim.on('MatchEnded', (e) => {
      if (e.type === 'MatchEnded') {
        this.gameOver = true;
        const winner = this.sim.getState().teams.find((t) => t.id === e.winnerTeamId);
        const msg = winner ? `${winner.name} wins! 🧄` : "It's a draw!";
        this.hud.showMessage(msg, 99999);
        this.audio.playVictory();

        this.time.delayedCall(4000, () => {
          this.scene.start('MainMenuScene');
        });
      }
    });
  }

  override update(_time: number, delta: number): void {
    if (this.gameOver) return;

    const dt = delta / 1000;
    this.audio.tickWalkCooldown(dt);

    const commands = this.buildCommands();
    this.sim.step(dt, commands);

    const state = this.sim.getState();

    // Sync character sprite positions
    for (const team of state.teams) {
      for (const char of team.characters) {
        const cs = this.charSprites.get(char.id);
        if (cs) {
          cs.sprite.setPosition(char.position.x, char.position.y + CHARACTER_HEIGHT / 2);
          cs.sprite.setFlipX(char.facing === 'left');
        }
      }
    }

    // Sync projectile positions
    for (const proj of state.projectiles) {
      const img = this.projSprites.get(proj.id);
      if (img && proj.active) {
        img.setPosition(proj.position.x, proj.position.y);
        const angle = Math.atan2(proj.velocity.y, proj.velocity.x);
        img.setRotation(angle);
      }
    }

    // Update terrain dirty chunks + water shimmer
    this.terrain.update(_time);

    // Update HUD
    const activeTeam = state.teams[state.activeTeamIndex];
    if (activeTeam) {
      const activeChar = activeTeam.characters.filter((c) => c.alive)[
        state.activeTeamIndex % Math.max(1, activeTeam.characters.filter((c) => c.alive).length)
      ];
      if (activeChar) {
        this.hud.updateTurnInfo(activeTeam.name, activeChar.name, state.turnTimeRemaining);
      }
    }
    this.hud.updateRetreatTimer(state.retreatTimeRemaining);

    // Update health bars for all living chars
    const livingChars = state.teams.flatMap((t) =>
      t.characters
        .filter((c) => c.alive)
        .map((c) => ({
          id: c.id,
          name: c.name,
          health: c.health,
          maxHealth: c.maxHealth,
          position: c.position,
        })),
    );
    this.hud.updateHealthBars(livingChars);

    // Weapon info + contextual hint
    if (state.selectedWeaponId && activeTeam) {
      const def = weaponRegistry.get(state.selectedWeaponId);
      const stock = activeTeam.inventory.weapons.get(state.selectedWeaponId);
      if (def && stock) {
        this.hud.updateWeapon(def.displayName, stock.unlimited ? 'unlimited' : stock.count);
        if (state.turnState === 'AIMING') {
          const hint =
            def.executionType === 'melee'
              ? 'SPACE = punch  |  ↑↓ aim  |  1-4 weapon  |  H help'
              : 'Hold SPACE to charge  →  release to fire  |  ↑↓ aim  |  H help';
          this.hud.showControlHint(hint);
        }
      }
      this.updateAimLine(state);
    } else {
      this.hud.clearControlHint();
    }

    // Power bar
    this.updatePowerBar(state);

    // Camera follow
    this.updateCamera(dt);

    // AI controller
    this.maybeDispatchAI();

    // Walk sound
    const activeCharNow = activeTeam?.characters.filter((c) => c.alive)[0];
    if (activeCharNow && Math.abs(activeCharNow.velocity.x) > 10) {
      this.audio.playWalk();
    }
  }

  private buildCommands(): Command[] {
    const state = this.sim.getState();
    const activeTeam = state.teams[state.activeTeamIndex];
    if (activeTeam?.controllerType === 'ai') return []; // AI handles its own commands

    const cmds: Command[] = [];
    const turnState = state.turnState;

    const spaceDown = this.keys.space.isDown;
    const spaceJustPressed = spaceDown && !this.spaceWasDown;
    const spaceJustReleased = !spaceDown && this.spaceWasDown;
    this.spaceWasDown = spaceDown;

    if (turnState === 'MOVEMENT') {
      if (this.cursors.left.isDown) cmds.push({ type: 'MoveLeft' });
      else if (this.cursors.right.isDown) cmds.push({ type: 'MoveRight' });
      else cmds.push({ type: 'StopMove' });

      // Space = jump; Up arrow also jumps
      if (spaceJustPressed || Phaser.Input.Keyboard.JustDown(this.cursors.up))
        cmds.push({ type: 'Jump' });
      if (Phaser.Input.Keyboard.JustDown(this.keys.backspace)) cmds.push({ type: 'EndTurn' });

      // 1-4: select weapon (enters AIMING directly)
      if (Phaser.Input.Keyboard.JustDown(this.keys.one))
        cmds.push({ type: 'SelectWeapon', weaponId: 'bazooka' });
      if (Phaser.Input.Keyboard.JustDown(this.keys.two))
        cmds.push({ type: 'SelectWeapon', weaponId: 'impact_clove' });
      if (Phaser.Input.Keyboard.JustDown(this.keys.three))
        cmds.push({ type: 'SelectWeapon', weaponId: 'garlic_uppercut' });
      if (Phaser.Input.Keyboard.JustDown(this.keys.four))
        cmds.push({ type: 'SelectWeapon', weaponId: 'classic_grenade' });

      // Enter/down arrow in movement — also selects bazooka if nothing selected
      if (!state.selectedWeaponId && Phaser.Input.Keyboard.JustDown(this.cursors.down))
        cmds.push({ type: 'SelectWeapon', weaponId: 'bazooka' });

      // Tab to open weapon panel
      if (Phaser.Input.Keyboard.JustDown(this.keys.tab)) {
        this.weaponPanelOpen = !this.weaponPanelOpen;
        if (this.weaponPanelOpen && activeTeam) {
          const weapons = [...activeTeam.inventory.weapons.entries()].map(([id, stock]) => {
            const def = weaponRegistry.get(id);
            return {
              id,
              name: def?.displayName ?? id,
              ammo: stock.unlimited ? ('unlimited' as const) : stock.count,
            };
          });
          this.hud.showWeaponPanel(weapons);
        } else {
          this.hud.hideWeaponPanel();
        }
      }
    }

    if (turnState === 'AIMING') {
      // Walk left/right while aiming (character can reposition before firing)
      if (this.cursors.left.isDown) cmds.push({ type: 'MoveLeft' });
      else if (this.cursors.right.isDown) cmds.push({ type: 'MoveRight' });
      else cmds.push({ type: 'StopMove' });

      // Up arrow: jump (JustDown) + aim higher (isDown)
      if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) cmds.push({ type: 'Jump' });
      if (this.cursors.up.isDown) cmds.push({ type: 'AdjustAim', angleDelta: -0.03 });
      if (this.cursors.down.isDown) cmds.push({ type: 'AdjustAim', angleDelta: 0.03 });

      const def = state.selectedWeaponId ? weaponRegistry.get(state.selectedWeaponId) : undefined;
      if (def?.executionType === 'melee') {
        if (spaceJustPressed) cmds.push({ type: 'ActivateMelee' });
      } else {
        // SPACE: hold to charge power, release to fire
        if (spaceJustPressed) cmds.push({ type: 'StartCharge' });
        if (spaceJustReleased) cmds.push({ type: 'ReleaseCharge' });
      }

      // 1-4: switch weapon while aiming
      if (Phaser.Input.Keyboard.JustDown(this.keys.one))
        cmds.push({ type: 'SelectWeapon', weaponId: 'bazooka' });
      if (Phaser.Input.Keyboard.JustDown(this.keys.two))
        cmds.push({ type: 'SelectWeapon', weaponId: 'impact_clove' });
      if (Phaser.Input.Keyboard.JustDown(this.keys.three))
        cmds.push({ type: 'SelectWeapon', weaponId: 'garlic_uppercut' });
      if (Phaser.Input.Keyboard.JustDown(this.keys.four))
        cmds.push({ type: 'SelectWeapon', weaponId: 'classic_grenade' });

      if (Phaser.Input.Keyboard.JustDown(this.keys.backspace)) cmds.push({ type: 'EndTurn' });
      if (Phaser.Input.Keyboard.JustDown(this.keys.escape)) cmds.push({ type: 'EndTurn' });
    }

    if (turnState === 'RETREAT') {
      if (this.cursors.left.isDown) cmds.push({ type: 'MoveLeft' });
      else if (this.cursors.right.isDown) cmds.push({ type: 'MoveRight' });
      if (spaceJustPressed || Phaser.Input.Keyboard.JustDown(this.cursors.up))
        cmds.push({ type: 'Jump' });
    }

    return cmds;
  }

  private updateAimLine(state: ReturnType<typeof this.sim.getState>): void {
    const activeTeam = state.teams[state.activeTeamIndex];
    if (!activeTeam) return;
    const activeChar = activeTeam.characters.find((c) => c.alive);
    if (!activeChar) return;
    const def = state.selectedWeaponId ? weaponRegistry.get(state.selectedWeaponId) : undefined;

    const cs = this.charSprites.get(activeChar.id);
    if (!cs) return;

    if (!cs.aimLine) {
      cs.aimLine = this.add.graphics().setDepth(30);
    }
    const g = cs.aimLine;
    g.clear().setVisible(true);

    const facing = activeChar.facing === 'right' ? 1 : -1;
    const aimAngle = state.aimAngle;
    // Match fireWeapon's angle convention exactly
    const launchAngle = aimAngle * facing;

    const muzzleX = activeChar.position.x + facing * 14;
    const muzzleY = activeChar.position.y - 14;

    if (!def || def.executionType === 'melee') {
      // Melee: simple punch arc indicator
      const arcR = 36;
      g.lineStyle(3, 0xff8800, 0.85);
      g.beginPath();
      const startA = facing > 0 ? -0.6 : Math.PI + 0.6;
      const endA   = facing > 0 ?  0.6 : Math.PI - 0.6;
      g.arc(activeChar.position.x, muzzleY, arcR, startA, endA, false);
      g.strokePath();
      // Arrow tip
      g.fillStyle(0xff8800, 0.9);
      const tipX = activeChar.position.x + Math.cos(endA) * arcR;
      const tipY = muzzleY + Math.sin(endA) * arcR;
      g.fillTriangle(
        tipX, tipY,
        tipX - facing * 6, tipY - 5,
        tipX - facing * 6, tipY + 5,
      );
      return;
    }

    // Projectile: simulate physics trajectory
    const power = def.usesPowerMeter
      ? (state.chargePower > 0.01 ? state.chargePower : 0.5)
      : 1.0;
    const speed =
      def.minimumLaunchSpeed + (def.maximumLaunchSpeed - def.minimumLaunchSpeed) * power;

    let vx = Math.cos(launchAngle) * speed * facing;
    let vy = Math.sin(launchAngle) * speed;
    let px = muzzleX;
    let py = muzzleY;

    const terrain = state.terrain;
    const worldW = terrain.getWidth();
    const worldH = terrain.getHeight();
    const DT = 1 / 30;
    const GRAVITY_SIM = 980;
    const MAX_STEPS = 120;

    const points: Array<{ x: number; y: number }> = [{ x: px, y: py }];
    let hitX = -1;
    let hitY = -1;

    for (let i = 0; i < MAX_STEPS; i++) {
      vy += GRAVITY_SIM * def.gravityScale * DT;
      vx += state.wind.x * def.windInfluence * DT;
      const nx = px + vx * DT;
      const ny = py + vy * DT;

      if (
        nx < 0 || nx > worldW ||
        ny > worldH ||
        terrain.isSolid(Math.round(nx), Math.round(ny))
      ) {
        hitX = nx;
        hitY = ny;
        break;
      }
      px = nx;
      py = ny;
      points.push({ x: px, y: py });
    }

    // Draw arc as colour-ramped dashes
    const total = points.length;
    const DASH = 10; // px between dots

    let distAcc = 0;
    let dotOn = true;

    for (let i = 1; i < total; i++) {
      const prev = points[i - 1]!;
      const curr = points[i]!;
      const t = i / total; // 0 = launch, 1 = end

      // Green → yellow → orange → red
      const r = Math.min(255, Math.round(t < 0.5 ? t * 2 * 255 : 255));
      const gv = Math.min(255, Math.round(t < 0.5 ? 255 : (1 - t) * 2 * 255));
      const color = (r << 16) | (gv << 8);

      const segLen = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      distAcc += segLen;

      if (distAcc >= DASH) {
        distAcc = 0;
        dotOn = !dotOn;
      }

      if (dotOn) {
        g.lineStyle(3, color, 0.9 - t * 0.3);
        g.lineBetween(prev.x, prev.y, curr.x, curr.y);
      }
    }

    // Arrowhead at last point
    if (total >= 2) {
      const last = points[total - 1]!;
      const prev = points[total - 2]!;
      const dx = last.x - prev.x;
      const dy = last.y - prev.y;
      const len = Math.hypot(dx, dy);
      if (len > 0.1) {
        const nx2 = dx / len;
        const ny2 = dy / len;
        g.fillStyle(0xff2200, 0.9);
        g.fillTriangle(
          last.x + nx2 * 10, last.y + ny2 * 10,
          last.x - ny2 * 7,  last.y + nx2 * 7,
          last.x + ny2 * 7,  last.y - nx2 * 7,
        );
      }
    }

    // Target crosshair where arc hits terrain
    if (hitX >= 0) {
      const cx = hitX;
      const cy = hitY;
      const cr = 10;
      g.lineStyle(2, 0xff2200, 0.85);
      g.strokeCircle(cx, cy, cr);
      g.lineBetween(cx - cr - 4, cy, cx + cr + 4, cy);
      g.lineBetween(cx, cy - cr - 4, cx, cy + cr + 4);
    }

    // Power ring at muzzle — bright circle scaled by power
    if (def.usesPowerMeter) {
      const ringR = 6 + power * 14;
      const pr = Math.round(power * 255);
      const pg = Math.round((1 - power) * 255);
      const ringColor = (pr << 16) | (pg << 8);
      g.lineStyle(2, ringColor, 0.8);
      g.strokeCircle(muzzleX, muzzleY, ringR);
    }
  }

  private updatePowerBar(state: ReturnType<typeof this.sim.getState>): void {
    if (!this.powerBar) return;
    this.powerBar.clear();
    if (state.turnState !== 'AIMING') return;

    const def = state.selectedWeaponId ? weaponRegistry.get(state.selectedWeaponId) : undefined;
    if (!def?.usesPowerMeter) return;

    const { width, height } = this.scale;
    const barW = 200;
    const barH = 18;
    const x = (width - barW) / 2;
    const y = height - 64;

    // Background
    this.powerBar.fillStyle(0x000000, 0.7);
    this.powerBar.fillRect(x - 2, y - 2, barW + 4, barH + 4);
    // Empty bar (dark)
    this.powerBar.fillStyle(0x333333, 0.9);
    this.powerBar.fillRect(x, y, barW, barH);
    // Filled portion
    if (state.chargePower > 0) {
      const color =
        state.chargePower < 0.5 ? 0x44ff44 : state.chargePower < 0.8 ? 0xffaa00 : 0xff3333;
      this.powerBar.fillStyle(color);
      this.powerBar.fillRect(x, y, Math.round(barW * state.chargePower), barH);
    }
    // Border
    this.powerBar.lineStyle(1, 0xffffff, 0.6);
    this.powerBar.strokeRect(x, y, barW, barH);
    // Hint text via label — always visible in AIMING
    this.powerBar.fillStyle(0xffffff, 0.5);
    this.powerBar.fillRect(x, y + barH + 4, barW, 1); // underline hint area
  }

  private updateCamera(_dt: number): void {
    const state = this.sim.getState();
    const activeTeam = state.teams[state.activeTeamIndex];
    if (!activeTeam) return;
    const activeChar = activeTeam.characters.find((c) => c.alive);
    if (!activeChar) return;

    // Smooth follow
    const cam = this.cameras.main;
    const targetX = activeChar.position.x;
    const targetY = activeChar.position.y;
    const cx = cam.scrollX + cam.width / 2;
    const cy = cam.scrollY + cam.height / 2;
    const lerpSpeed = 0.08;
    cam.scrollX += (targetX - cx) * lerpSpeed;
    cam.scrollY += (targetY - cy) * lerpSpeed;

    // Also follow active projectile
    for (const proj of state.projectiles) {
      if (proj.active) {
        cam.scrollX += (proj.position.x - cx) * 0.04;
        cam.scrollY += (proj.position.y - cy) * 0.04;
        break;
      }
    }
  }

  private focusActiveCharacter(): void {
    const state = this.sim.getState();
    const activeTeam = state.teams[state.activeTeamIndex];
    if (!activeTeam) return;
    const char = activeTeam.characters.find((c) => c.alive);
    if (char) {
      this.cameras.main.centerOn(char.position.x, char.position.y);
    }
  }

  private spawnExplosionEffect(x: number, y: number): void {
    // Outer fireball
    const g = this.add.graphics().setDepth(50);
    g.fillStyle(0xff6600, 0.92);
    g.fillCircle(x, y, 32);
    this.tweens.add({
      targets: g,
      scaleX: 4.5,
      scaleY: 4.5,
      alpha: 0,
      duration: 500,
      ease: 'Power2',
      onComplete: () => g.destroy(),
    });

    // Mid ring (darker orange)
    const mid = this.add.graphics().setDepth(51);
    mid.fillStyle(0xffaa00, 0.8);
    mid.fillCircle(x, y, 22);
    this.tweens.add({
      targets: mid,
      scaleX: 3,
      scaleY: 3,
      alpha: 0,
      duration: 380,
      ease: 'Power3',
      onComplete: () => mid.destroy(),
    });

    // White core flash
    const flash = this.add.graphics().setDepth(52);
    flash.fillStyle(0xffffff, 1);
    flash.fillCircle(x, y, 16);
    this.tweens.add({
      targets: flash,
      scaleX: 1.6,
      scaleY: 1.6,
      alpha: 0,
      duration: 150,
      onComplete: () => flash.destroy(),
    });

    // Smoke ring (lingers)
    const smoke = this.add.graphics().setDepth(49);
    smoke.lineStyle(4, 0x555555, 0.6);
    smoke.strokeCircle(x, y, 18);
    this.tweens.add({
      targets: smoke,
      scaleX: 5,
      scaleY: 5,
      alpha: 0,
      duration: 700,
      ease: 'Sine.easeOut',
      onComplete: () => smoke.destroy(),
    });

    this.cameras.main.shake(220, 0.012);
  }

  private maybeDispatchAI(): void {
    if (this.aiPending) return;
    const state = this.sim.getState();
    const activeTeam = state.teams[state.activeTeamIndex];
    if (!activeTeam || activeTeam.controllerType !== 'ai') return;
    if (state.turnState !== 'MOVEMENT' && state.turnState !== 'AIMING') return;
    if (!this.aiWorker) return;

    this.aiPending = true;
    const activeChar = activeTeam.characters.find((c) => c.alive);
    if (!activeChar) return;

    const enemies = state.teams
      .filter((t) => t.id !== activeTeam.id)
      .flatMap((t) =>
        t.characters.map((c) => ({
          id: c.id,
          teamId: t.id,
          x: c.position.x,
          y: c.position.y,
          health: c.health,
          alive: c.alive,
        })),
      );

    const availableWeapons = [...activeTeam.inventory.weapons.entries()]
      .filter(([, s]) => s.unlimited || s.count > 0)
      .map(([id]) => id);

    this.aiWorker.postMessage({
      activeCharId: activeChar.id,
      activeTeamId: activeTeam.id,
      activeCharPos: activeChar.position,
      activeCharFacing: activeChar.facing,
      enemies,
      windX: state.wind.x,
      windY: state.wind.y,
      waterLevel: state.waterLevel,
      worldWidth: state.terrain.getWidth(),
      worldHeight: state.terrain.getHeight(),
      availableWeapons,
      difficulty: activeTeam.aiDifficulty,
      turnTimeRemaining: state.turnTimeRemaining,
    });
  }

  private handleAiCommands(commands: Command[]): void {
    this.aiPending = false;
    // Feed AI commands on the next few steps
    const state = this.sim.getState();
    if (state.turnState !== 'MOVEMENT' && state.turnState !== 'AIMING') return;

    // Execute commands with small delays to look natural
    let delay = 0;
    for (const cmd of commands) {
      const captured = cmd;
      this.time.delayedCall(delay, () => {
        this.sim.step(1 / 60, [captured]);
      });
      delay += 120 + Math.random() * 200; // human-like delay
    }
  }

  shutdown(): void {
    this.aiWorker?.terminate();
    this.hud?.destroy();
    this.audio?.destroy();
    this.terrain?.destroy();
    this.charSprites.clear();
    this.projSprites.clear();
  }
}
