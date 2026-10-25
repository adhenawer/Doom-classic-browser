// SPDX-License-Identifier: GPL-2.0-or-later
let database: Promise<IDBDatabase> | undefined;
function db() {
  return database ??= new Promise((resolve, reject) => {
    const r = indexedDB.open('doom-ipad-v1', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('data');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => { database = undefined; reject(r.error); };
    r.onblocked = () => reject(new Error('Feche outras abas do jogo para liberar o armazenamento.'));
  });
}
export async function read<T>(key: string): Promise<T | undefined> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = d.transaction('data').objectStore('data').get(key);
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
}
export async function write(key: string, value: unknown) {
  const d = await db();
  return new Promise<void>((resolve, reject) => {
    const t = d.transaction('data', 'readwrite'); t.objectStore('data').put(value, key);
    t.oncomplete = () => resolve(); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error);
  });
}
