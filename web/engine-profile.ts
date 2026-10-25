// SPDX-License-Identifier: GPL-2.0-or-later
/** Internal rendering profiles. Resolution changes select another engine at boot. */
export type Resolution = 'classic' | 'high' | 'modern';
export const modernSizes = { '1280': [1280,960], '1920': [1920,1440], '2560': [2560,1920], '3840': [3840,2880] } as const;
export type ModernSize = keyof typeof modernSizes;
export function sanitizeModernSize(raw: unknown): ModernSize { return typeof raw === 'string' && Object.hasOwn(modernSizes,raw) ? raw as ModernSize : '1920'; }
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
  },
  modern: {
    id: 'edge-modern-v1', commit: '9e2b61677f215861e40b631429bf322935e8f87c',
    factory: 'createDoomModern', loader: 'doom-modern.js', wasm: 'edge.wasm',
    width: 1920, height: 1440
  }
} as const;
export const backupProfiles = {
  classic: { id: engineProfiles.classic.id, commit: engineProfiles.classic.commit },
  high: { id: engineProfiles.high.id, commit: engineProfiles.high.commit }
} as const;

export const modernBackupProfiles = { ...backupProfiles, modern: { id: engineProfiles.modern.id, commit: engineProfiles.modern.commit } } as const;

export const modernContent = { file: 'modern-hd.epk', iwad: '7323bcc168c5a45ff10749b339960e98314740a734c30d4b9f3337001f9e703d', bytes: 398681345, sha256: 'f9a2cc0ea9f290af2b04a9b0227aef1fdad7596649e52101842ae6bbf8dc0562', images: 1115 } as const;

export const modernParts = [
  {
    "file": "modern-hd.000.bin",
    "bytes": 33554432,
    "offset": 0,
    "sha256": "6f7b22662d4471172a779ab3d534f71e4b13add369ca45aef99d57d14b389e95"
  },
  {
    "file": "modern-hd.001.bin",
    "bytes": 33554432,
    "offset": 33554432,
    "sha256": "fd1643e5aa9e65c252826c6b80e80e6b7aec77034d3abdba59d2eb693f428590"
  },
  {
    "file": "modern-hd.002.bin",
    "bytes": 33554432,
    "offset": 67108864,
    "sha256": "9994ffac732cfa27478e43b643a0b11fcbc9df093dfc357d0d45f184a4a7364b"
  },
  {
    "file": "modern-hd.003.bin",
    "bytes": 33554432,
    "offset": 100663296,
    "sha256": "046942454ec63a0fd86b0de299159c80b3c291a38dbf25d9560d13ec15b7c311"
  },
  {
    "file": "modern-hd.004.bin",
    "bytes": 33554432,
    "offset": 134217728,
    "sha256": "e3dcb4dfd1508c80098f7434eee2898ba3c4b901816b6f2d0f59925a779f2e8b"
  },
  {
    "file": "modern-hd.005.bin",
    "bytes": 33554432,
    "offset": 167772160,
    "sha256": "6e2784472bb44ad22ef7da2c95f3a0986a360864dd9cd9ae0997c221e8d794f3"
  },
  {
    "file": "modern-hd.006.bin",
    "bytes": 33554432,
    "offset": 201326592,
    "sha256": "1cbd6599cece4b6184deaa9eac20e9b56c6972d5ca284223b663e95c361e0666"
  },
  {
    "file": "modern-hd.007.bin",
    "bytes": 33554432,
    "offset": 234881024,
    "sha256": "1858b3fb137b91c32945b9bb7b742c10d50ae99cde83c7436053d7bba4d12f1e"
  },
  {
    "file": "modern-hd.008.bin",
    "bytes": 33554432,
    "offset": 268435456,
    "sha256": "97b867e4bb5efd004b696b1de55faab039135a0ac2a3e359e0960099d7c8b9ba"
  },
  {
    "file": "modern-hd.009.bin",
    "bytes": 33554432,
    "offset": 301989888,
    "sha256": "c5242bd526be812fb787bf2b4ce87d82971ea48e61d20ec942fa81688d23ba38"
  },
  {
    "file": "modern-hd.010.bin",
    "bytes": 33554432,
    "offset": 335544320,
    "sha256": "4e4a271a6952e3eadd4f8a3150d2ceffb6f980d56883841be2289f91a2cdf984"
  },
  {
    "file": "modern-hd.011.bin",
    "bytes": 29582593,
    "offset": 369098752,
    "sha256": "88d1952cc46c261dc6d15efd9e8488e4dd9e170ca7cc773b047d2f34965e96a1"
  }
] as const;

/** Missing/unknown preferences never migrate an existing user to another engine. */
export function sanitizeResolution(raw: unknown): Resolution {
  return raw === 'modern' ? 'modern' : raw === 'high' ? 'high' : 'classic';
}

export function saveDirectory(resolution: Resolution, hash: string): string {
  if (resolution !== 'classic' && resolution !== 'high' && resolution !== 'modern') throw new Error('Perfil de resolução inválido.');
  if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('SHA-256 do IWAD inválido.');
  return `/persist/${resolution === 'modern' ? 'saves-modern' : resolution === 'high' ? 'saves-hires' : 'saves'}/${hash}`;
}

/** Both backup versions keep six slots; v1 can never introduce a high-res save. */
export function validateSavePath(path: unknown, backupVersion: unknown): path is string {
  if (typeof path !== 'string') return false;
  if (backupVersion === 1) return /^\/persist\/saves\/[a-f0-9]{64}\/doomsav[0-5]\.dsg$/.test(path);
  if (backupVersion === 3 && /^\/persist\/saves-modern\/[a-f0-9]{64}\/savegame\/slot00[0-7]\/(?:(?:head|e[1-4]m[1-9])\.esg|head\.(?:jpg|png))$/.test(path)) return true;
  if (backupVersion === 2 || backupVersion === 3) return /^\/persist\/(?:saves|saves-hires)\/[a-f0-9]{64}\/doomsav[0-5]\.dsg$/.test(path);
  return false;
}

/** Exact known pins, not an assertion that arbitrary save bytes are trustworthy. */
export function validateBackupProfiles(raw: unknown, version: number = 2): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const records = raw as Record<string, unknown>;
  const expected = version === 3 ? modernBackupProfiles : version === 2 ? backupProfiles : undefined;
  if (!expected || Object.keys(records).length !== Object.keys(expected).length) return false;
  return Object.entries(expected).every(([profile,pin]) => {
    if (!Object.hasOwn(records, profile)) return false;
    const record = records[profile];
    if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
    const value = record as Record<string, unknown>;
    return Object.keys(value).length === 2 && Object.hasOwn(value, 'id') && Object.hasOwn(value, 'commit') &&
      value.id === pin.id && value.commit === pin.commit;
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
