import Phaser from 'phaser';

interface MenuButton {
  bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
}

export class MainMenuScene extends Phaser.Scene {
  private buttons: MenuButton[] = [];

  constructor() {
    super('MainMenuScene');
  }

  create(): void {
    const { width, height } = this.scale;

    // Background gradient
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1a0a2e, 0x1a0a2e, 0x2d1854, 0x2d1854, 1);
    bg.fillRect(0, 0, width, height);

    // Stars
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height * 0.6;
      const alpha = 0.4 + Math.random() * 0.6;
      this.add.circle(x, y, 1, 0xffffff, alpha);
    }

    // Title
    this.add
      .text(width / 2, height * 0.18, 'ALLIUM ASSAULT', {
        fontFamily: 'monospace',
        fontSize: '52px',
        color: '#e8d84a',
        stroke: '#8b6914',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.29, 'Garlic goes to war', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#c9e88a',
      })
      .setOrigin(0.5)
      .setAlpha(0.85);

    // Decorative garlic sprites
    for (let i = 0; i < 4; i++) {
      const x = width * 0.05 + i * (width * 0.3);
      this.add
        .image(x + 40, height * 0.25, 'garlic_placeholder')
        .setScale(2)
        .setAlpha(0.5)
        .setAngle(Phaser.Math.Between(-20, 20));
    }

    // Buttons
    const buttonDefs = [
      { label: 'Play Match', scene: 'MatchSetupScene' },
      { label: 'Teams', scene: null },
      { label: 'Settings', scene: null },
      { label: 'How to Play', scene: null },
    ];

    const btnW = 240;
    const btnH = 52;
    const startY = height * 0.44;
    const gap = 68;

    buttonDefs.forEach((def, i) => {
      const x = width / 2 - btnW / 2;
      const y = startY + i * gap;
      const btn = this.makeButton(x, y, btnW, btnH, def.label, () => {
        if (def.scene) {
          this.scene.start(def.scene);
        } else {
          console.warn(`Scene "${def.label}" not yet implemented`);
        }
      });
      this.buttons.push(btn);
    });

    // Version tag
    this.add
      .text(width - 8, height - 8, 'v0.1.0-dev', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#665577',
      })
      .setOrigin(1, 1);
  }

  private makeButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onClick: () => void,
  ): MenuButton {
    const bg = this.add.graphics();
    this.drawButton(bg, 0, 0, w, h, false);
    bg.setPosition(x, y);

    const txt = this.add
      .text(x + w / 2, y + h / 2, label, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#f0e8c0',
      })
      .setOrigin(0.5);

    // Hit zone
    const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });

    zone.on('pointerover', () => {
      this.drawButton(bg, 0, 0, w, h, true);
      txt.setColor('#ffee88');
    });
    zone.on('pointerout', () => {
      this.drawButton(bg, 0, 0, w, h, false);
      txt.setColor('#f0e8c0');
    });
    zone.on('pointerdown', () => {
      this.drawButton(bg, 0, 0, w, h, true);
    });
    zone.on('pointerup', () => {
      onClick();
    });

    return { bg, label: txt };
  }

  private drawButton(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    hover: boolean,
  ): void {
    g.clear();
    g.fillStyle(hover ? 0x3d2268 : 0x261544, 0.9);
    g.fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(2, hover ? 0xe8d84a : 0x7755aa, 0.8);
    g.strokeRoundedRect(x, y, w, h, 10);
  }
}
