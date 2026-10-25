// SPDX-License-Identifier: GPL-2.0-or-later
import { defaults, validateBindings } from './input';

export type TurnSettings = {
  initial: number; acceleration: number; maximum: number;
  sensitivity: number; deceleration: number;
};
export type GameplaySettings = TurnSettings & {
  bindings: Record<string, string[]>;
  alwaysRun: boolean;
  sfxVolume: number;
  musicVolume: number;
};

/** Presets select a digital turn response, not new physics or a new camera. */
export const turnPresets = {
  classic: {
    label: 'Clássico', description: 'Rampa original do port, parada imediata.',
    initial: 60, acceleration: 360, maximum: 180, sensitivity: 1, deceleration: 0
  },
  precision: {
    label: 'Precisão', description: 'Giro inicial mais lento para alinhar disparos.',
    initial: 35, acceleration: 240, maximum: 150, sensitivity: 1, deceleration: 0
  },
  responsive: {
    label: 'Ágil', description: 'Giro mais rápido para mudar de direção.',
    initial: 95, acceleration: 540, maximum: 240, sensitivity: 1, deceleration: 0
  }
} as const;
export type TurnPreset = keyof typeof turnPresets;

export const baseSettings: GameplaySettings = {
  initial: 60, acceleration: 360, maximum: 180, sensitivity: 1, deceleration: 0,
  bindings: structuredClone(defaults), alwaysRun: false, sfxVolume: 8, musicVolume: 6
};

export function sanitizeSettings(raw: unknown): GameplaySettings {
  if (!raw || typeof raw !== 'object') return structuredClone(baseSettings);
  const s = raw as Record<string, unknown>;
  const number = (v: unknown, low: number, high: number, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(low, Math.min(high, v)) : fallback;
  const initial = number(s.initial, 1, 360, baseSettings.initial);
  return {
    initial, acceleration: number(s.acceleration, 0, 2000, baseSettings.acceleration),
    maximum: number(s.maximum, initial, 720, Math.max(initial, baseSettings.maximum)),
    sensitivity: number(s.sensitivity, .1, 3, baseSettings.sensitivity),
    deceleration: number(s.deceleration, 0, 4000, baseSettings.deceleration),
    bindings: validateBindings(s.bindings), alwaysRun: s.alwaysRun === true,
    sfxVolume: Math.round(number(s.sfxVolume, 0, 15, baseSettings.sfxVolume)),
    musicVolume: Math.round(number(s.musicVolume, 0, 15, baseSettings.musicVolume))
  };
}

/** Keep bindings, audio and any caller-owned display preferences when selecting. */
export function applyTurnPreset<T extends GameplaySettings>(settings: T, preset: TurnPreset): T {
  const p = turnPresets[preset];
  return {
    ...settings, initial: p.initial, acceleration: p.acceleration,
    maximum: p.maximum, sensitivity: p.sensitivity, deceleration: p.deceleration
  };
}

export function selectedTurnPreset(settings: TurnSettings): TurnPreset | 'custom' {
  return (Object.keys(turnPresets) as TurnPreset[]).find(name => {
    const p = turnPresets[name];
    return p.initial === settings.initial && p.acceleration === settings.acceleration &&
      p.maximum === settings.maximum && p.sensitivity === settings.sensitivity &&
      p.deceleration === settings.deceleration;
  }) ?? 'custom';
}

/** Both profiles produce vanilla ticcmds and share the existing save format. */
export function gameplayProfile(settings: Pick<GameplaySettings, 'alwaysRun'>): 'classic-v1' | 'comfort-v1' {
  return settings.alwaysRun ? 'comfort-v1' : 'classic-v1';
}
