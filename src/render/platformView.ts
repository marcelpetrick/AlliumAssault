// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { Color3, MeshBuilder, StandardMaterial, type Mesh, type Scene } from '@babylonjs/core';
import type { Point } from '../core/math';
import { PLATFORM_LENGTH, PLATFORM_THICKNESS, type Platform, type Terrain } from '../core/terrain';

/** The wooden boards and the placement preview; the terrain owns their collision. */
export class PlatformView {
  private readonly placed: Mesh[] = [];
  private readonly preview: Mesh;
  private readonly wood: StandardMaterial;
  private readonly allowed: StandardMaterial;
  private readonly blocked: StandardMaterial;

  constructor(
    private readonly scene: Scene,
    private readonly terrain: Terrain,
    private readonly addCaster: (mesh: Mesh) => void,
  ) {
    this.wood = new StandardMaterial('platformWood', scene);
    this.wood.diffuseColor = Color3.FromHexString('#946037');
    this.wood.specularColor = Color3.FromHexString('#392719');
    this.allowed = this.previewMaterial('platformPreviewAllowed', '#58d88b');
    this.blocked = this.previewMaterial('platformPreviewBlocked', '#ff5b4d');
    this.preview = this.board('platformPreview');
    this.preview.setEnabled(false);
  }

  private previewMaterial(name: string, color: string): StandardMaterial {
    const material = new StandardMaterial(name, this.scene);
    material.diffuseColor = Color3.FromHexString(color);
    material.emissiveColor = material.diffuseColor.scale(0.35);
    material.alpha = 0.65;
    return material;
  }

  private board(name: string): Mesh {
    const mesh = MeshBuilder.CreateBox(name, { width: PLATFORM_LENGTH, height: PLATFORM_THICKNESS, depth: 1.25 }, this.scene);
    // Boards must never swallow the click that places the next one.
    mesh.isPickable = false;
    return mesh;
  }

  /** `candidate` is the board under the mouse while one is being placed, or null when none is. */
  update(candidate: Platform | null, occupied: readonly Point[]): void {
    while (this.placed.length < this.terrain.platforms.length) {
      const board = this.terrain.platforms[this.placed.length];
      const mesh = this.board(`platform-${this.placed.length}`);
      mesh.position.set(board.x, board.y, 0);
      mesh.rotation.z = board.angle;
      mesh.material = this.wood;
      mesh.receiveShadows = true;
      this.addCaster(mesh);
      this.placed.push(mesh);
    }
    this.preview.setEnabled(candidate !== null);
    if (!candidate) return;
    // Slightly in front of the boards, so a preview over one is still readable.
    this.preview.position.set(candidate.x, candidate.y, -0.1);
    this.preview.rotation.z = candidate.angle;
    this.preview.material = this.terrain.canPlacePlatform(candidate, occupied) ? this.allowed : this.blocked;
  }

  dispose(): void {
    for (const mesh of this.placed) mesh.dispose();
    this.preview.dispose();
    this.wood.dispose();
    this.allowed.dispose();
    this.blocked.dispose();
  }
}
