import { supabase } from '@/integrations/supabase/client';

/** Offline aufgenommene Originalfotos, die bei Verbindung in den privaten originals-Bucket hochgeladen werden. */
export interface QueuedUpload {
  id: string;
  path: string;
  blob: Blob;
  contentType: string;
  createdAt: number;
}

const DB_NAME = 'autohaus-offline';
const STORE = 'pending-originals';
const EVENT = 'offline-queue-changed';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const notify = () => window.dispatchEvent(new Event(EVENT));

export async function enqueueUpload(item: Omit<QueuedUpload, 'id' | 'createdAt'>) {
  await tx('readwrite', s => s.put({ ...item, id: crypto.randomUUID(), createdAt: Date.now() }));
  notify();
}

export const listQueued = () => tx<QueuedUpload[]>('readonly', s => s.getAll());
const removeQueued = (id: string) => tx('readwrite', s => s.delete(id));

export function onQueueChange(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

/** Lädt alle Einträge der Reihe nach hoch; erfolgreiche bzw. bereits vorhandene werden entfernt. */
export async function processQueue(
  items: QueuedUpload[],
  upload: (item: QueuedUpload) => Promise<{ ok: boolean; duplicate?: boolean }>,
  remove: (id: string) => Promise<unknown>,
): Promise<{ uploaded: number; remaining: number }> {
  let uploaded = 0;
  let remaining = 0;
  for (const item of items) {
    const r = await upload(item).catch(() => ({ ok: false }));
    if (r.ok || (r as { duplicate?: boolean }).duplicate) {
      await remove(item.id);
      if (r.ok) uploaded++;
    } else remaining++;
  }
  return { uploaded, remaining };
}

let flushing = false;
export async function flushUploadQueue() {
  if (flushing || !navigator.onLine) return { uploaded: 0, remaining: 0 };
  flushing = true;
  try {
    const items = await listQueued();
    const res = await processQueue(items, async item => {
      const { error } = await supabase.storage.from('originals')
        .upload(item.path, item.blob, { upsert: false, contentType: item.contentType });
      if (!error) return { ok: true };
      return { ok: false, duplicate: /exists|duplicate/i.test(error.message) };
    }, removeQueued);
    notify();
    return res;
  } finally {
    flushing = false;
  }
}
