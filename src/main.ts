import Phaser from 'phaser';
import { BootScene } from './presentation/scenes/BootScene';
import { MainMenuScene } from './presentation/scenes/MainMenuScene';
import { MatchSetupScene } from './presentation/scenes/MatchSetupScene';
import { GameScene } from './presentation/scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  parent: 'game-container',
  backgroundColor: '#1a0a2e',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MainMenuScene, MatchSetupScene, GameScene],
};

new Phaser.Game(config);
