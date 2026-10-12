// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import type { Point } from './math';
import type { ProjectileBody } from './physics';

/** Direct pursuit, without curvature or obstacle avoidance. Collision remains the swept solver's job. */
export function steerHoming(p: ProjectileBody, target: Point | undefined, speed: number): void {
  if (!target) return;
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1e-5) return;
  p.vx = (dx / distance) * speed;
  p.vy = (dy / distance) * speed;
}
