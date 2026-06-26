export type Command =
  | { type: 'MoveLeft' }
  | { type: 'MoveRight' }
  | { type: 'StopMove' }
  | { type: 'Jump' }
  | { type: 'SelectWeapon'; weaponId: string }
  | { type: 'AdjustAim'; angleDelta: number }
  | { type: 'StartCharge' }
  | { type: 'ReleaseCharge' }
  | { type: 'SetFuse'; seconds: number }
  | { type: 'EndTurn' }
  | { type: 'ActivateMelee' }
  | { type: 'CancelAim' };
