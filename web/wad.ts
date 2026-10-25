// SPDX-License-Identifier: GPL-2.0-or-later
export const MAX_WAD = 64 * 1024 * 1024;
export function validateWad(buffer: ArrayBuffer) {
  if (buffer.byteLength < 12 || buffer.byteLength > MAX_WAD) throw new Error('IWAD deve ter entre 12 bytes e 64 MiB.');
  const bytes = new Uint8Array(buffer), view = new DataView(buffer);
  const text = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length)).replace(/\0.*$/, '');
  if (text(0, 4) !== 'IWAD') throw new Error('Selecione um IWAD; PWADs não são aceitos neste MVP.');
  const count = view.getInt32(4, true), offset = view.getInt32(8, true);
  if (count < 1 || count > 100000 || offset < 12 || offset + count * 16 > bytes.length) throw new Error('Diretório WAD inválido.');
  const names = new Set<string>();
  for (let n = 0; n < count; n++) {
    const at = offset + n * 16, pos = view.getInt32(at, true), len = view.getInt32(at + 4, true);
    if (pos < 0 || len < 0 || pos + len > bytes.length) throw new Error(`Lump ${n} fora do arquivo.`);
    names.add(text(at + 8, 8).toUpperCase());
  }
  if (!names.has('E1M1') || !names.has('PLAYPAL') || !names.has('PNAMES') || !names.has('TEXTURE1')) throw new Error('Este MVP requer IWAD de DOOM 1 / Freedoom Phase 1 com E1M1.');
  return { lumps: count, bytes: bytes.length, freedoom: names.has('FREEDOOM') };
}
export async function wadHash(data: ArrayBuffer) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(x => x.toString(16).padStart(2, '0')).join('');
}
