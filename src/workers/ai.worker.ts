// AI Web Worker — trajectory-search opponent controller.
// Receives a WorldSnapshot message, posts back Command[].
// Runs off the main thread so trajectory sampling doesn't stall rendering.

import type { AiDifficulty } from '../core/types';
import type { Command } from '../core/simulation/Commands';

export interface WorldSnapshot {
  activeCharId: string;
  activeTeamId: string;
  activeCharPos: { x: number; y: number };
  activeCharFacing: 'left' | 'right';
  enemies: Array<{
    id: string;
    teamId: string;
    x: number;
    y: number;
    health: number;
    alive: boolean;
  }>;
  windX: number;
  windY: number;
  waterLevel: number;
  worldWidth: number;
  worldHeight: number;
  availableWeapons: string[];
  difficulty: AiDifficulty;
  turnTimeRemaining: number;
}

interface TrajectoryResult {
  angle: number;
  power: number; // 0-1
  score: number;
  targetId: string;
}

const GRAVITY = 980;

// Simplified parabolic simulation without terrain — good enough for scoring
function simulateTrajectory(
  startX: number,
  startY: number,
  vx: number,
  vy: number,
  windX: number,
  windInfluence: number,
  waterLevel: number,
  worldWidth: number,
): { finalX: number; finalY: number } {
  let x = startX;
  let y = startY;
  let dvx = vx;
  let dvy = vy;
  const dt = 1 / 60;

  for (let i = 0; i < 300; i++) {
    dvy += GRAVITY * dt;
    dvx += windX * windInfluence * dt;
    x += dvx * dt;
    y += dvy * dt;
    if (y >= waterLevel || x < 0 || x > worldWidth) break;
  }

  return { finalX: x, finalY: y };
}

function difficultyConfig(diff: AiDifficulty): {
  angles: number;
  powers: number;
  aimError: number;
} {
  switch (diff) {
    case 'easy':
      return { angles: 6, powers: 3, aimError: 0.26 }; // ~15°
    case 'normal':
      return { angles: 12, powers: 4, aimError: 0.14 }; // ~8°
    case 'hard':
      return { angles: 24, powers: 5, aimError: 0.07 }; // ~4°
    case 'expert':
      return { angles: 40, powers: 6, aimError: 0.017 }; // ~1°
  }
}

function searchBazooka(snap: WorldSnapshot): TrajectoryResult | null {
  const cfg = difficultyConfig(snap.difficulty);
  let best: TrajectoryResult | null = null;

  for (const enemy of snap.enemies) {
    if (!enemy.alive) continue;

    for (let ai = 0; ai < cfg.angles; ai++) {
      const baseAngle = (ai / cfg.angles) * Math.PI - Math.PI / 2;

      for (let pi = 0; pi < cfg.powers; pi++) {
        const power = 0.2 + (pi / (cfg.powers - 1)) * 0.8;
        const speed = 200 + power * 600; // min 200, max 800
        const facing = snap.activeCharFacing === 'right' ? 1 : -1;
        const vx = Math.cos(baseAngle) * speed * facing;
        const vy = Math.sin(baseAngle) * speed;

        const { finalX, finalY } = simulateTrajectory(
          snap.activeCharPos.x,
          snap.activeCharPos.y,
          vx,
          vy,
          snap.windX,
          0.9, // bazooka wind influence
          snap.waterLevel,
          snap.worldWidth,
        );

        const distToEnemy = Math.sqrt((finalX - enemy.x) ** 2 + (finalY - enemy.y) ** 2);
        const score = Math.max(0, 100 - distToEnemy * 0.5);

        if (!best || score > best.score) {
          best = { angle: baseAngle, power, score, targetId: enemy.id };
        }
      }
    }
  }

  return best;
}

function buildCommands(snap: WorldSnapshot, shot: TrajectoryResult | null): Command[] {
  const cmds: Command[] = [];

  if (!shot || shot.score < 5) {
    // No good shot — end turn
    cmds.push({ type: 'EndTurn' });
    return cmds;
  }

  // Pick weapon — prefer bazooka
  const weapon = snap.availableWeapons.includes('bazooka') ? 'bazooka' : snap.availableWeapons[0];
  if (!weapon) {
    cmds.push({ type: 'EndTurn' });
    return cmds;
  }

  // Select weapon
  cmds.push({ type: 'SelectWeapon', weaponId: weapon });

  // Add aim error based on difficulty
  const cfg = difficultyConfig(snap.difficulty);
  const errorAmount = (Math.random() * 2 - 1) * cfg.aimError;
  const targetAngle = shot.angle + errorAmount;

  cmds.push({ type: 'AdjustAim', angleDelta: targetAngle });
  cmds.push({ type: 'StartCharge' });

  // The worker will need multiple ticks to charge — this is handled by the game loop
  // For now we emit a synthetic "charged to target power" command
  // In practice the game loop drives charge over multiple steps
  cmds.push({ type: 'ReleaseCharge' });

  return cmds;
}

// Worker message handler
self.addEventListener('message', (e: MessageEvent<WorldSnapshot>) => {
  const snap = e.data;
  const shot = searchBazooka(snap);
  const commands = buildCommands(snap, shot);
  self.postMessage(commands);
});
