import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    // Chonky Knoblauch (garlic bulb) character — 40×48 px
    const g = this.make.graphics({});
    const W = 40;
    const H = 48;

    // ── Outer papery skin (cream/ivory) ──────────────────────────────────────
    // Main bulb: wide ellipse, slightly flat on top
    g.fillStyle(0xf5efd8); // warm ivory
    g.fillEllipse(W / 2, 30, 36, 34);

    // Side clove bumps — give that characteristic segmented knoblauch shape
    g.fillStyle(0xeee6c8);
    g.fillEllipse(7, 28, 13, 18);  // left bulge
    g.fillEllipse(33, 28, 13, 18); // right bulge

    // Top clove nubs peeking out
    g.fillStyle(0xe8dfc0);
    g.fillEllipse(13, 18, 10, 12); // upper-left clove
    g.fillEllipse(27, 18, 10, 12); // upper-right clove
    g.fillEllipse(20, 15, 12, 14); // center top clove

    // Subtle crease lines between cloves (thin dark stripes)
    g.lineStyle(1, 0xc8b888, 0.7);
    g.lineBetween(20, 12, 20, 32); // center vertical crease
    g.lineBetween(13, 16, 11, 32); // left crease
    g.lineBetween(27, 16, 29, 32); // right crease

    // Lavender tinge on cloves (papery skin touch)
    g.fillStyle(0xd8c8e8, 0.25);
    g.fillEllipse(20, 22, 28, 22);

    // ── Highlight / sheen ────────────────────────────────────────────────────
    g.fillStyle(0xfff8ee, 0.6);
    g.fillEllipse(15, 20, 10, 8); // main highlight blob

    // ── Pointed green sprout on top ──────────────────────────────────────────
    // Base of sprout (pale green)
    g.fillStyle(0x88b848);
    g.fillEllipse(20, 10, 8, 10);
    // Sprout tip
    g.fillStyle(0x5a9e2c);
    g.fillTriangle(20, 1, 16, 10, 24, 10);
    g.fillStyle(0x78b840);
    g.fillTriangle(20, 3, 17, 10, 23, 10);

    // ── Face ────────────────────────────────────────────────────────────────
    // Eyes: round black with white specular dot — cute!
    g.fillStyle(0x1a1008);
    g.fillCircle(15, 26, 3);
    g.fillCircle(25, 26, 3);
    g.fillStyle(0xffffff);
    g.fillCircle(16, 25, 1);
    g.fillCircle(26, 25, 1);

    // Rosy cheeks
    g.fillStyle(0xf08070, 0.35);
    g.fillCircle(11, 29, 4);
    g.fillCircle(29, 29, 4);

    // Smile — a nice wide grin
    g.fillStyle(0x2a1008);
    g.fillRect(15, 31, 10, 2);
    g.fillRect(14, 30, 2, 2); // left corner
    g.fillRect(25, 30, 2, 2); // right corner
    // Tiny teeth
    g.fillStyle(0xffffff, 0.9);
    g.fillRect(16, 31, 3, 1);
    g.fillRect(21, 31, 3, 1);

    // ── Roots at bottom ──────────────────────────────────────────────────────
    g.lineStyle(1, 0xb09040, 0.85);
    g.lineBetween(16, 46, 14, 48);
    g.lineBetween(18, 46, 17, 48);
    g.lineBetween(20, 46, 20, 48);
    g.lineBetween(22, 46, 23, 48);
    g.lineBetween(24, 46, 26, 48);
    // Root plate
    g.fillStyle(0xc8a850, 0.6);
    g.fillEllipse(20, 46, 16, 4);

    // ── Dark outline ─────────────────────────────────────────────────────────
    g.lineStyle(1.5, 0x3a2808, 0.75);
    g.strokeEllipse(W / 2, 30, 36, 34);

    g.generateTexture('garlic_placeholder', W, H);
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
