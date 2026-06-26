import { AlliumDB, type SettingsRecord } from './db';

export const DEFAULT_SETTINGS: Omit<SettingsRecord, 'id'> = {
  audioMusic: 0.7,
  audioSfx: 1.0,
  audioVoice: 1.0,
  controlBindings: {
    MoveLeft: 'ArrowLeft',
    MoveRight: 'ArrowRight',
    Jump: 'Space',
    EndTurn: 'Backspace',
    WeaponPanel: 'Tab',
    AimUp: 'ArrowUp',
    AimDown: 'ArrowDown',
    Charge: 'Space',
    Fire: 'Space',
  },
  screenShake: true,
  reducedFlash: false,
};

export class SettingsRepo {
  private readonly db: AlliumDB;

  constructor(db: AlliumDB) {
    this.db = db;
  }

  async get(): Promise<SettingsRecord> {
    const stored = await this.db.settings.get(1);
    if (!stored) return { id: 1, ...DEFAULT_SETTINGS };
    return stored;
  }

  async save(partial: Partial<Omit<SettingsRecord, 'id'>>): Promise<void> {
    const current = await this.get();
    await this.db.settings.put({ ...current, ...partial, id: 1 });
  }

  async getControlBindings(): Promise<Record<string, string>> {
    const s = await this.get();
    return s.controlBindings;
  }

  async saveControlBindings(bindings: Record<string, string>): Promise<void> {
    await this.save({ controlBindings: bindings });
  }
}
