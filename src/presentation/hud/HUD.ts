import Phaser from 'phaser';
import type { Vec2 } from '@core/types';

interface HealthBar {
  bg: Phaser.GameObjects.Graphics;
  fill: Phaser.GameObjects.Graphics;
  name: Phaser.GameObjects.Text;
}

export class HUD {
  private readonly scene: Phaser.Scene;
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly container: Phaser.GameObjects.Container;
  private turnText: Phaser.GameObjects.Text;
  private timerText: Phaser.GameObjects.Text;
  private retreatText: Phaser.GameObjects.Text;
  private windText: Phaser.GameObjects.Text;
  private weaponText: Phaser.GameObjects.Text;
  private messageText: Phaser.GameObjects.Text;
  private messageTween?: Phaser.Tweens.Tween;
  private healthBars = new Map<string, HealthBar>();
  private weaponPanel: Phaser.GameObjects.Container | undefined;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.camera = scene.cameras.main;
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(100);

    const { width, height } = scene.scale;

    // Dark top bar
    const topBar = scene.add.graphics();
    topBar.fillStyle(0x000000, 0.5);
    topBar.fillRect(0, 0, width, 40);
    this.container.add(topBar);

    // Turn / character info — top left
    this.turnText = scene.add.text(10, 8, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#f0e8c0',
    });
    this.container.add(this.turnText);

    // Timer — top center
    this.timerText = scene.add
      .text(width / 2, 8, '', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0);
    this.container.add(this.timerText);

    // Wind — top right
    this.windText = scene.add
      .text(width - 10, 8, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#88ccff',
      })
      .setOrigin(1, 0);
    this.container.add(this.windText);

    // Weapon — bottom right
    this.weaponText = scene.add
      .text(width - 10, height - 10, '', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#ffe066',
      })
      .setOrigin(1, 1);
    this.container.add(this.weaponText);

    // Retreat timer — shown conditionally
    this.retreatText = scene.add
      .text(width / 2, 45, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ff8844',
      })
      .setOrigin(0.5, 0)
      .setVisible(false);
    this.container.add(this.retreatText);

    // Message banner
    this.messageText = scene.add
      .text(width / 2, height * 0.35, '', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#ffff88',
        stroke: '#222222',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(110);
    this.container.add(this.messageText);
  }

  updateTurnInfo(teamName: string, charName: string, timeRemaining: number): void {
    this.turnText.setText(`${teamName} · ${charName}`);
    const secs = Math.ceil(timeRemaining);
    const color = secs <= 10 ? '#ff4444' : '#ffffff';
    this.timerText.setText(String(secs)).setColor(color);
    this.retreatText.setVisible(false);
  }

  updateRetreatTimer(seconds: number): void {
    const secs = Math.ceil(seconds);
    this.retreatText.setText(`Retreat: ${secs}s`).setVisible(secs > 0);
  }

  updateWind(x: number, _y: number): void {
    const dir = x > 0.1 ? '→' : x < -0.1 ? '←' : '·';
    this.windText.setText(`Wind ${dir} ${Math.abs(x).toFixed(1)}`);
  }

  updateWeapon(weaponName: string, ammoCount: number | 'unlimited'): void {
    const ammo = ammoCount === 'unlimited' ? '∞' : String(ammoCount);
    this.weaponText.setText(`${weaponName}  [${ammo}]`);
  }

  updateHealthBars(
    characters: Array<{
      id: string;
      name: string;
      health: number;
      maxHealth: number;
      position: Vec2;
    }>,
  ): void {
    // Remove bars for dead characters
    const liveIds = new Set(characters.map((c) => c.id));
    for (const [id, bar] of this.healthBars) {
      if (!liveIds.has(id)) {
        bar.bg.destroy();
        bar.fill.destroy();
        bar.name.destroy();
        this.healthBars.delete(id);
      }
    }

    // Update / create bars
    const W = 32;
    const H = 5;
    const cam = this.camera;

    for (const char of characters) {
      const worldX = char.position.x;
      const worldY = char.position.y - 32;

      // Convert to screen space
      const sx = (worldX - cam.scrollX) * cam.zoom + cam.x + (cam.width / 2) * (1 - cam.zoom);
      const sy = (worldY - cam.scrollY) * cam.zoom + cam.y + (cam.height / 2) * (1 - cam.zoom);

      let bar = this.healthBars.get(char.id);
      if (!bar) {
        const bg = this.scene.add.graphics().setScrollFactor(0).setDepth(99);
        const fill = this.scene.add.graphics().setScrollFactor(0).setDepth(100);
        const name = this.scene.add
          .text(0, 0, char.name, {
            fontFamily: 'monospace',
            fontSize: '9px',
            color: '#ffffff',
          })
          .setScrollFactor(0)
          .setDepth(100)
          .setOrigin(0.5, 1);
        bar = { bg, fill, name };
        this.healthBars.set(char.id, bar);
      }

      const ratio = Math.max(0, char.health / char.maxHealth);
      const fillColor = ratio > 0.5 ? 0x44cc44 : ratio > 0.25 ? 0xffaa00 : 0xff3333;

      bar.bg
        .clear()
        .fillStyle(0x000000, 0.7)
        .fillRect(sx - W / 2, sy - H, W, H);
      bar.fill
        .clear()
        .fillStyle(fillColor)
        .fillRect(sx - W / 2, sy - H, W * ratio, H);
      bar.name.setPosition(sx, sy - H - 1);
    }
  }

  showMessage(text: string, durationMs: number): void {
    if (this.messageTween) this.messageTween.stop();
    this.messageText.setText(text).setAlpha(1);
    this.messageTween = this.scene.tweens.add({
      targets: this.messageText,
      alpha: 0,
      duration: 400,
      delay: durationMs - 400,
    });
  }

  showWeaponPanel(weapons: Array<{ id: string; name: string; ammo: number | 'unlimited' }>): void {
    this.hideWeaponPanel();
    const { width, height } = this.scene.scale;
    const panelW = 200;
    const rowH = 28;
    const totalH = weapons.length * rowH + 16;
    const panelX = width - panelW - 10;
    const panelY = height - totalH - 50;

    const panelBg = this.scene.add.graphics().setScrollFactor(0).setDepth(105);
    panelBg.fillStyle(0x1a0a2e, 0.92);
    panelBg.fillRoundedRect(panelX, panelY, panelW, totalH, 8);
    panelBg.lineStyle(1, 0x7755aa, 0.8);
    panelBg.strokeRoundedRect(panelX, panelY, panelW, totalH, 8);

    const items: Phaser.GameObjects.GameObject[] = [panelBg];
    weapons.forEach((w, i) => {
      const ammo = w.ammo === 'unlimited' ? '∞' : String(w.ammo);
      const txt = this.scene.add
        .text(panelX + 10, panelY + 8 + i * rowH, `${w.name}  [${ammo}]`, {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#e8d84a',
        })
        .setScrollFactor(0)
        .setDepth(106);
      items.push(txt);
    });

    this.weaponPanel = this.scene.add.container(0, 0, items).setScrollFactor(0).setDepth(105);
  }

  hideWeaponPanel(): void {
    const panel = this.weaponPanel;
    if (panel) {
      panel.destroy(true);
      this.weaponPanel = undefined;
    }
  }

  destroy(): void {
    this.container.destroy(true);
    for (const bar of this.healthBars.values()) {
      bar.bg.destroy();
      bar.fill.destroy();
      bar.name.destroy();
    }
    this.healthBars.clear();
    this.hideWeaponPanel();
  }
}
