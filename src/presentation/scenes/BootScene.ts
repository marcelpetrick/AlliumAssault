import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    // Generate placeholder garlic texture programmatically
    const g = this.make.graphics({});

    // Garlic body — white oval with green top
    g.fillStyle(0xf5f0e0);
    g.fillEllipse(16, 18, 22, 26);
    g.fillStyle(0x5a8f3c);
    g.fillEllipse(16, 7, 10, 10);

    // Eyes
    g.fillStyle(0x222222);
    g.fillCircle(12, 16, 2);
    g.fillCircle(20, 16, 2);

    // Mouth — smile arc approximated with rect
    g.fillStyle(0xdd5544);
    g.fillRect(13, 21, 6, 2);

    // Roots at bottom
    g.lineStyle(1, 0x8b6914);
    g.strokeRect(14, 29, 1, 3);
    g.strokeRect(17, 29, 1, 3);

    g.generateTexture('garlic_placeholder', 32, 32);
    g.destroy();

    // Generate explosion flash texture
    const ef = this.make.graphics({});
    ef.fillStyle(0xffaa00);
    ef.fillCircle(16, 16, 16);
    ef.fillStyle(0xffff00);
    ef.fillCircle(16, 16, 10);
    ef.generateTexture('explosion_flash', 32, 32);
    ef.destroy();

    // Generate projectile texture
    const pf = this.make.graphics({});
    pf.fillStyle(0x444444);
    pf.fillCircle(4, 4, 4);
    pf.fillStyle(0x888888);
    pf.fillCircle(3, 3, 2);
    pf.generateTexture('projectile', 8, 8);
    pf.destroy();

    this.scene.start('MainMenuScene');
  }
}
