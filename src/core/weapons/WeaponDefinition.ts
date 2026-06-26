import type { ExecutionType, AmmoPolicy } from '../types';

export interface WeaponDefinition {
  id: string;
  displayName: string;
  executionType: ExecutionType;
  ammoPolicy: AmmoPolicy;
  consumesAmmo: number;
  maximumDamage: number;
  explosionRadius: number;
  terrainRadius: number;
  impulseStrength: number;
  gravityScale: number;
  windInfluence: number;
  restitution: number;
  usesPowerMeter: boolean;
  minimumLaunchSpeed: number;
  maximumLaunchSpeed: number;
  fuseSeconds: number | null;
  explodeOnImpact: boolean;
  endsTurn: boolean;
  retreatSeconds: number;
}
