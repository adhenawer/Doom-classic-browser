// SPDX-License-Identifier: GPL-2.0-or-later
/** Internal rendering profiles. Resolution changes select another engine at boot. */
export type Resolution = 'classic' | 'high';
export const engineProfiles = {
  classic: {
    id: 'chocolate-doom-classic-v1',
    commit: 'a2dfd51fcc00d272dc8a17a97ccd6683333ff4ea',
    factory: 'createDoom', loader: 'doom.js', wasm: 'chocolate-doom.wasm',
    width: 320, height: 200
  },
  high: {
    id: 'crispy-doom-hires-v1',
    commit: 'fdeabe4c23a833534b70aa84a22f1685aae7125d',
    factory: 'createDoomHigh', loader: 'doom-high.js', wasm: 'crispy-doom.wasm',
    width: 640, height: 400
  }
} as const;
export const backupProfiles = {
  classic: { id: engineProfiles.classic.id, commit: engineProfiles.classic.commit },
  high: { id: engineProfiles.high.id, commit: engineProfiles.high.commit }
} as const;

/** Missing/unknown preferences never migrate an existing user to another engine. */
export function sanitizeResolution(raw: unknown): Resolution {
  return raw === 'high' ? 'high' : 'classic';
}

export function saveDirectory(resolution: Resolution, hash: string): string {
  if (resolution !== 'classic' && resolution !== 'high') throw new Error('Perfil de resolução inválido.');
  if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('SHA-256 do IWAD inválido.');
  return `/persist/${resolution === 'high' ? 'saves-hires' : 'saves'}/${hash}`;
}

/** Both backup versions keep six slots; v1 can never introduce a high-res save. */
export function validateSavePath(path: unknown, backupVersion: unknown): path is string {
  if (typeof path !== 'string') return false;
  if (backupVersion === 1) return /^\/persist\/saves\/[a-f0-9]{64}\/doomsav[0-5]\.dsg$/.test(path);
  if (backupVersion === 2) return /^\/persist\/(?:saves|saves-hires)\/[a-f0-9]{64}\/doomsav[0-5]\.dsg$/.test(path);
  return false;
}

/** Exact known pins, not an assertion that arbitrary save bytes are trustworthy. */
export function validateBackupProfiles(raw: unknown): raw is typeof backupProfiles {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const records = raw as Record<string, unknown>;
  if (Object.keys(records).length !== 2) return false;
  return (['classic', 'high'] as const).every(profile => {
    if (!Object.hasOwn(records, profile)) return false;
    const record = records[profile];
    if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
    const value = record as Record<string, unknown>;
    return Object.keys(value).length === 2 && Object.hasOwn(value, 'id') && Object.hasOwn(value, 'commit') &&
      value.id === backupProfiles[profile].id && value.commit === backupProfiles[profile].commit;
  });
}

// Renderer-only Crispy configuration; unexposed gameplay extensions stay disabled.
const crispyConfig = {
  hires:1, widescreen:0, gamma:9, uncapped:0, vsync:0, fpslimit:35,
  automapoverlay:0, automaprotate:0, automapstats:0, bobfactor:0,
  btusetimer:0, brightmaps:0, centerweapon:0, coloredblood:0, coloredhud:0,
  crosshair:0, crosshairhealth:0, crosshairtarget:0, crosshairtype:0,
  defaultskill:0, demobar:0, demotimer:0, demotimerdir:0, extautomap:0,
  flipcorpses:0, freeaim:0, freelook:0, jump:0, leveltime:0, mouselook:0,
  neghealth:0, overunder:0, pitch:0, playercoords:0, secretmessage:0,
  smoothlight:0, smoothmap:0, smoothscaling:0, soundfix:0, soundfull:0,
  soundmono:0, statsformat:0, translucency:0
};
export const highConfig = Object.entries(crispyConfig).map(([key,value])=>`crispy_${key} ${value}\n`).join('');
