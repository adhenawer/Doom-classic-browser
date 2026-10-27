// SPDX-License-Identifier: GPL-2.0-or-later
import { prepareAssets, readAsset, hasAssets, type Asset, type DeliveryProgress } from './content-delivery';

export type ContentRange = { offset: number; asset: Asset };
export type MapEntry = { ranges: ContentRange[]; hdAssets: string[] };
export type IwadEntry = { bytes: number; sha256: string; bootstrap: ContentRange[]; maps: Record<string, MapEntry> };
export type HDAsset = Asset & { path: string; width: number; height: number; channels: number };
export type ContentIndex = { version: number; iwads: Record<string, IwadEntry>; hd: { assets: Record<string, HDAsset> } };
export type ContentFS = {
  mkdirTree(path: string): void;
  writeFile(path: string, data: Uint8Array, options?: { canOwn?: boolean }): void;
  open(path: string, flags: string): unknown;
  write(stream: unknown, data: Uint8Array, offset: number, length: number, position: number): number;
  close(stream: unknown): void;
};

let indexPromise: Promise<ContentIndex> | undefined;
export function loadContentIndex(): Promise<ContentIndex> {
  // Pin the catalog for the whole document, including all subsequent maps.
  return indexPromise ??= fetch('./content-index.json').then(async response => {
    if (!response.ok) throw new Error('Catálogo de mapas indisponível. Reabra com conexão.');
    const index = await response.json() as ContentIndex;
    if (index.version !== 1 || !index.iwads || !index.hd?.assets) throw new Error('Catálogo de mapas incompatível.');
    return index;
  }).catch(error => { indexPromise = undefined; throw error; });
}

/** The sparse IWAD retains the original directory, offsets and logical identity.
 * Missing map ranges are never consumed: native map entry must await prepareMap.
 * All PNG bytes are original; empty enumeration nodes are metadata-only until
 * their map is prepared, and are never rendered as substitutes.
 */
export class MapContent {
  private fs?: ContentFS;
  private loadedMaps = new Set<string>();
  private loadedImages = new Set<string>();
  constructor(readonly index: ContentIndex, readonly hash: string, readonly hd: boolean) {
    const wad = this.wad;
    if (!wad || !Number.isSafeInteger(wad.bytes) || wad.bytes < 12 || wad.bytes > 64 * 1024 * 1024)
      throw new Error('Conteúdo-base inválido no catálogo.');
    for (const range of [...wad.bootstrap, ...Object.values(wad.maps).flatMap(map => map.ranges)]) {
      if (!Number.isSafeInteger(range.offset) || range.offset < 0 || range.offset + range.asset.bytes > wad.bytes)
        throw new Error('Intervalo de mapa inválido.');
    }
  }
  get wad() { return this.index.iwads[this.hash]; }
  get lazyImages() {
    return this.hd ? Object.fromEntries(Object.values(this.index.hd.assets).map(asset => {
      if (!/^hires\/[A-Za-z0-9_\-\[\]\\^]+\.png$/.test(asset.path) ||
          ![1,2,3,4].includes(asset.channels) || asset.width <= 0 || asset.height <= 0)
        throw new Error('Metadados de imagem inválidos.');
      return [asset.path, { width: asset.width, height: asset.height, channels: asset.channels, bytes: asset.bytes }];
    })) : {};
  }
  private async writeRanges(ranges: ContentRange[]) {
    const fs = this.fs!;
    const stream = fs.open('/game.wad', 'r+');
    try {
      for (const range of ranges) {
        const bytes = await readAsset(range.asset);
        if (fs.write(stream, bytes, 0, bytes.length, range.offset) !== bytes.length)
          throw new Error('Não foi possível montar os dados do mapa.');
      }
    } finally { fs.close(stream); }
  }
  async initialize(fs: ContentFS, onProgress?: (progress: DeliveryProgress) => void) {
    this.fs = fs;
    await prepareAssets(this.wad.bootstrap.map(range => range.asset), { onProgress });
    fs.writeFile('/game.wad', new Uint8Array(this.wad.bytes), { canOwn: true });
    await this.writeRanges(this.wad.bootstrap);
    if (this.hd) {
      fs.mkdirTree('/lazy-hd/hires');
      for (const path of Object.keys(this.lazyImages)) fs.writeFile('/lazy-hd/' + path, new Uint8Array());
    }
  }
  private assets(mapName: string) {
    const map = this.wad.maps[mapName];
    if (!map) throw new Error(`Mapa ${mapName} não está no catálogo desta versão.`);
    const images = this.hd ? map.hdAssets.map(id => {
      const asset = this.index.hd.assets[id];
      if (!asset) throw new Error(`Material HD ausente do catálogo: ${id}`);
      return { id, asset };
    }) : [];
    return { map, images, assets: [...map.ranges.map(range => range.asset), ...images.map(image => image.asset)] };
  }
  async prepareMap(mapName: string, onProgress?: (progress: DeliveryProgress) => void) {
    if (this.loadedMaps.has(mapName)) return;
    if (!this.fs) throw new Error('Conteúdo ainda não inicializado.');
    const { map, images, assets } = this.assets(mapName);
    await prepareAssets(assets, { onProgress });
    await this.writeRanges(map.ranges);
    for (const { id, asset } of images) {
      if (this.loadedImages.has(id)) continue;
      this.fs.writeFile('/lazy-hd/' + asset.path, await readAsset(asset), { canOwn: true });
      this.loadedImages.add(id);
    }
    this.loadedMaps.add(mapName);
  }
  async availableOffline(mapName: string) {
    return hasAssets([...this.wad.bootstrap.map(range => range.asset), ...this.assets(mapName).assets]);
  }
}
