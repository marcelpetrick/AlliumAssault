import Phaser from 'phaser';
import type { MatchConfig, TeamConfig } from '@core/simulation/SimulationCore';

interface TeamSlot {
  name: string;
  controllerType: 'human' | 'ai';
  aiDifficulty: 'easy' | 'normal' | 'hard' | 'expert';
  color: number;
  characterNames: string[];
}

const TEAM_COLORS = [0xff4400, 0x4488ff, 0x44cc44, 0xcc44cc];
const DEFAULT_NAMES = [
  ['Minty', 'Bud', 'Sprout', 'Nub'],
  ['Shallot', 'Leek', 'Chive', 'Reed'],
  ['Pungent', 'Odour', 'Stinky', 'Reek'],
  ['Clover', 'Bulb', 'Stem', 'Root'],
];
const DEFAULT_TEAM_NAMES = ['Garlic Gang', 'Onion Crew', 'Shallot Squad', 'Bulb Brigade'];

export class MatchSetupScene extends Phaser.Scene {
  private numTeams = 2;
  private teamSlots: TeamSlot[] = [];
  private seed = '';
  private labelTexts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('MatchSetupScene');
  }

  create(): void {
    this.seed = this.randomSeed();
    this.teamSlots = this.buildDefaultSlots(4);
    this.buildUI();
  }

  private randomSeed(): string {
    return Math.floor(Math.random() * 0xffffffff)
      .toString(16)
      .padStart(8, '0');
  }

  private buildDefaultSlots(n: number): TeamSlot[] {
    return Array.from({ length: n }, (_, i) => ({
      name: DEFAULT_TEAM_NAMES[i] ?? `Team ${i + 1}`,
      controllerType: i === 0 ? 'human' : 'ai',
      aiDifficulty: 'normal',
      color: TEAM_COLORS[i] ?? 0xffffff,
      characterNames: DEFAULT_NAMES[i] ?? ['Garlic 1', 'Garlic 2'],
    }));
  }

  private buildUI(): void {
    this.children.removeAll(true);
    this.labelTexts = [];
    const { width, height } = this.scale;

    // BG
    const bg = this.add.graphics();
    bg.fillStyle(0x1a0a2e);
    bg.fillRect(0, 0, width, height);

    // Title
    this.add
      .text(width / 2, 30, 'Match Setup', {
        fontFamily: 'monospace',
        fontSize: '36px',
        color: '#e8d84a',
      })
      .setOrigin(0.5);

    // Number of teams
    this.add.text(40, 90, 'Teams:', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#ccbbee',
    });
    this.makeCounter(
      130,
      82,
      () => this.numTeams,
      2,
      4,
      (v) => {
        this.numTeams = v;
        this.buildUI();
      },
    );

    // Team slots
    for (let i = 0; i < this.numTeams; i++) {
      this.buildTeamRow(i, 140 + i * 80);
    }

    // Seed
    this.add.text(40, 140 + this.numTeams * 80, 'Map seed:', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#ccbbee',
    });
    const seedText = this.add.text(160, 140 + this.numTeams * 80, this.seed, {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#88ffcc',
    });
    this.makeButton(width - 160, 140 + this.numTeams * 80, 120, 30, 'Random', () => {
      this.seed = this.randomSeed();
      seedText.setText(this.seed);
    });

    // Start / Back
    const bottomY = 180 + this.numTeams * 80;
    this.makeButton(
      width / 2 - 130,
      bottomY,
      200,
      48,
      'Start Match',
      () => this.startMatch(),
      '#44ee44',
    );
    this.makeButton(
      width / 2 + 50,
      bottomY,
      120,
      48,
      'Back',
      () => this.scene.start('MainMenuScene'),
      '#ee4444',
    );
  }

  private buildTeamRow(i: number, y: number): void {
    const slot = this.teamSlots[i];
    if (!slot) return;
    const { width } = this.scale;

    // Color swatch
    const swatch = this.add.graphics();
    swatch.fillStyle(slot.color);
    swatch.fillRect(40, y + 4, 20, 20);

    // Team name
    this.add.text(70, y, slot.name, {
      fontFamily: 'monospace',
      fontSize: '17px',
      color: '#f0e0c0',
    });

    // Human / AI toggle
    this.makeButton(
      width * 0.5,
      y,
      90,
      26,
      slot.controllerType === 'human' ? 'Human' : 'AI',
      () => {
        slot.controllerType = slot.controllerType === 'human' ? 'ai' : 'human';
        this.buildUI();
      },
    );

    // Difficulty (shown for AI only)
    if (slot.controllerType === 'ai') {
      const diffs: Array<'easy' | 'normal' | 'hard' | 'expert'> = [
        'easy',
        'normal',
        'hard',
        'expert',
      ];
      const curIdx = diffs.indexOf(slot.aiDifficulty);
      this.makeButton(width * 0.65, y, 90, 26, slot.aiDifficulty, () => {
        slot.aiDifficulty = diffs[(curIdx + 1) % diffs.length] ?? 'normal';
        this.buildUI();
      });
    }
  }

  private makeCounter(
    x: number,
    y: number,
    getValue: () => number,
    min: number,
    max: number,
    onChange: (v: number) => void,
  ): void {
    this.makeButton(x, y, 28, 28, '−', () => {
      if (getValue() > min) onChange(getValue() - 1);
    });
    this.add.text(x + 36, y + 5, String(getValue()), {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#ffee88',
    });
    this.makeButton(x + 60, y, 28, 28, '+', () => {
      if (getValue() < max) onChange(getValue() + 1);
    });
  }

  private makeButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onClick: () => void,
    color = '#e0d8ff',
  ): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x3a2060, 0.9);
    bg.fillRoundedRect(x, y, w, h, 6);
    bg.lineStyle(1, 0x7755aa);
    bg.strokeRoundedRect(x, y, w, h, 6);

    const txt = this.add
      .text(x + w / 2, y + h / 2, label, { fontFamily: 'monospace', fontSize: '14px', color })
      .setOrigin(0.5);

    const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x5535a0, 0.9);
      bg.fillRoundedRect(0, 0, w, h, 6);
      bg.setPosition(x, y);
    });
    zone.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x3a2060, 0.9);
      bg.fillRoundedRect(0, 0, w, h, 6);
      bg.setPosition(x, y);
    });
    zone.on('pointerup', onClick);

    void txt; // used for display
  }

  private startMatch(): void {
    const teams: TeamConfig[] = this.teamSlots.slice(0, this.numTeams).map((slot, i) => ({
      id: `team_${i}`,
      name: slot.name,
      color: slot.color,
      controllerType: slot.controllerType,
      aiDifficulty: slot.aiDifficulty,
      characterNames: slot.characterNames,
    }));

    const config: MatchConfig = {
      seed: this.seed,
      teams,
      worldWidth: 5000,
      worldHeight: 2000,
      turnDuration: 45,
      retreatDuration: 5,
      friendlyFire: true,
    };

    this.scene.start('GameScene', { config });
  }
}
