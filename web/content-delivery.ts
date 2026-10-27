// SPDX-License-Identifier: GPL-2.0-or-later
/** Only explicitly requested assets are downloaded. No map prediction or prefetch. */
export type ContentPart = { file: string; bytes: number; sha256: string; offset: number };
export type Asset = { bytes: number; sha256: string; parts: ContentPart[] };
export type DeliveryProgress = { completedBytes: number; totalBytes: number; completedParts: number; totalParts: number };
type Options = { signal?: AbortSignal; onProgress?: (progress: DeliveryProgress) => void };
const inflight = new Map<string, { promise: Promise<void>; controller: AbortController; users: number; bytes: number }>();
let active = 0;
const queue: Array<() => void> = [];
const aborted = () => new DOMException('Preparação cancelada.', 'AbortError');
function check(signal?: AbortSignal) { if (signal?.aborted) throw aborted(); }
function scope() { return new URL('./', location.href); }
function cacheName() { return 'doom-content-v1-' + encodeURIComponent(scope().pathname); }
function key(part: ContentPart) { return new URL(`__content/${part.sha256}`, scope()).href; }
function hashValid(hash: string) { return /^[a-f0-9]{64}$/.test(hash); }
function validate(assets: readonly Asset[]) {
  const unique = new Map<string, ContentPart>();
  for (const asset of assets) {
    if (!Number.isSafeInteger(asset.bytes) || asset.bytes <= 0 || !hashValid(asset.sha256)) throw new Error('Inventário de conteúdo inválido.');
    let offset = 0;
    for (const part of asset.parts) {
      const url = new URL(part.file, scope());
      if (url.origin !== scope().origin || !url.pathname.startsWith(scope().pathname) || url.search || url.hash || url.username || url.password ||
          !Number.isSafeInteger(part.bytes) || part.bytes <= 0 || !hashValid(part.sha256) || part.offset !== offset)
        throw new Error('Parte de conteúdo inválida.');
      offset += part.bytes;
      if (!Number.isSafeInteger(offset) || offset > asset.bytes) throw new Error('Tamanho de conteúdo inválido.');
      const previous = unique.get(part.sha256);
      if (previous && previous.bytes !== part.bytes) throw new Error('Hash com tamanhos inconsistentes.');
      unique.set(part.sha256, part);
    }
    if (offset !== asset.bytes) throw new Error('Inventário de conteúdo incompleto.');
  }
  return [...unique.values()];
}
async function digest(bytes: Uint8Array<ArrayBuffer>) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
}
async function verified(response: Response, part: {bytes: number; sha256: string}, signal?: AbortSignal) {
  if (!response.ok) throw new Error('Conteúdo indisponível. Confira a conexão e tente novamente.');
  check(signal);
  const result = new Uint8Array(part.bytes);
  const reader = response.body?.getReader();
  const cancel = () => { void reader?.cancel().catch(() => {}); };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    let offset = 0;
    if (reader) {
      while (true) {
        check(signal);
        const { done, value } = await reader.read();
        check(signal);
        if (done) break;
        if (offset + value.length > result.length) throw new Error('Conteúdo maior que o esperado.');
        result.set(value, offset); offset += value.length;
      }
    } else {
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length !== result.length) throw new Error('Conteúdo incompleto.');
      result.set(bytes); offset = bytes.length;
    }
    check(signal);
    if (offset !== result.length || await digest(result) !== part.sha256) throw new Error('Conteúdo corrompido: tamanho ou SHA-256 divergente.');
    check(signal);
    return result;
  } catch (error) { await reader?.cancel().catch(() => {}); throw error; }
  finally { signal?.removeEventListener('abort', cancel); reader?.releaseLock(); }
}
async function cached(cache: Cache, part: ContentPart, signal?: AbortSignal) {
  const response = await cache.match(key(part));
  if (!response) return undefined;
  try { return await verified(response, part, signal); }
  catch (error) {
    check(signal); // Cancellation does not imply that the cached object is corrupt.
    await cache.delete(key(part));
    return undefined;
  }
}
async function slot(signal: AbortSignal) {
  check(signal);
  if (active < 3) { active++; return; }
  await new Promise<void>((resolve, reject) => {
    const run = () => { signal.removeEventListener('abort', cancel); active++; resolve(); };
    const cancel = () => { const i = queue.indexOf(run); if (i >= 0) queue.splice(i, 1); reject(aborted()); };
    queue.push(run); signal.addEventListener('abort', cancel, { once: true });
  });
}
function releaseSlot() { active--; queue.shift()?.(); }
async function transfer(part: ContentPart, signal: AbortSignal) {
  const perform = async () => {
    check(signal);
    const cache = await caches.open(cacheName());
    if (await cached(cache, part, signal)) return;
    await slot(signal);
    try {
      check(signal);
      const response = await fetch(new URL(part.file, scope()), { cache: 'no-store', signal });
      const bytes = await verified(response, part, signal);
      await cache.put(key(part), new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } }));
    } finally { releaseSlot(); }
  };
  // A second tab rechecks the cache after acquiring the same object lock.
  if (navigator.locks) await navigator.locks.request(`${cacheName()}:${part.sha256}`, { signal }, perform);
  else await perform();
}
async function ensure(part: ContentPart, signal: AbortSignal) {
  check(signal);
  const id = `${cacheName()}:${part.sha256}`;
  let task = inflight.get(id);
  if (task && task.bytes !== part.bytes) throw new Error('Hash com tamanhos inconsistentes.');
  if (!task || task.controller.signal.aborted) {
    const controller = new AbortController();
    task = { controller, users: 0, bytes: part.bytes, promise: Promise.resolve() };
    const own = task;
    task.promise = transfer(part, controller.signal).finally(() => { if (inflight.get(id) === own) inflight.delete(id); });
    inflight.set(id, task);
  }
  task.users++;
  const shared = task;
  let cancel: (() => void) | undefined;
  try {
    await Promise.race([shared.promise, new Promise<never>((_, reject) => {
      cancel = () => reject(aborted()); signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel();
    })]);
  } finally {
    if (cancel) signal.removeEventListener('abort', cancel);
    if (--shared.users === 0) shared.controller.abort();
  }
}
export async function prepareAssets(assets: readonly Asset[], options: Options = {}): Promise<void> {
  const parts = validate(assets);
  check(options.signal);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  options.signal?.addEventListener('abort', cancel, { once: true });
  const progress = { completedBytes: 0, totalBytes: parts.reduce((sum, p) => sum + p.bytes, 0), completedParts: 0, totalParts: parts.length };
  let next = 0;
  try {
    options.onProgress?.({ ...progress });
    await Promise.all(Array.from({ length: Math.min(3, parts.length) }, async () => {
      while (next < parts.length) {
        check(controller.signal);
        const part = parts[next++];
        await ensure(part, controller.signal);
        check(controller.signal);
        progress.completedBytes += part.bytes; progress.completedParts++;
        options.onProgress?.({ ...progress });
      }
    }));
  } finally { controller.abort(); options.signal?.removeEventListener('abort', cancel); }
}
/** Offline inspection never issues a request. Corrupt cache entries are removed. */
export async function hasAssets(assets: readonly Asset[]): Promise<boolean> {
  const parts = validate(assets);
  try {
    const cache = await caches.open(cacheName());
    for (const part of parts) if (!await cached(cache, part)) return false;
    return true;
  } catch { return false; }
}
/** Assembly is cache-only; downloads must be explicitly requested via prepareAssets. */
export async function readAsset(asset: Asset): Promise<Uint8Array<ArrayBuffer>> {
  validate([asset]);
  const cache = await caches.open(cacheName());
  const result = new Uint8Array(asset.bytes);
  for (const part of asset.parts) {
    const bytes = await cached(cache, part);
    if (!bytes) throw new Error('Conteúdo não preparado neste aparelho.');
    result.set(bytes, part.offset);
  }
  if (await digest(result) !== asset.sha256) throw new Error('Conteúdo montado corrompido: SHA-256 divergente.');
  return result;
}
