import { describe, it, expect } from 'vitest';
import { isNetworkActionLabel } from '@/lib/offline-action-guard';
import { processQueue, type QueuedUpload } from '@/lib/offline-upload-queue';

const item = (id: string): QueuedUpload => ({ id, path: `u/v/${id}.jpg`, blob: new Blob(), contentType: 'image/jpeg', createdAt: 0 });

describe('offline mode', () => {
  it('blocks generate/remaster/save buttons offline', () => {
    expect(isNetworkActionLabel('Bilder generieren')).toBe(true);
    expect(isNetworkActionLabel('Remastering starten')).toBe(true);
    expect(isNetworkActionLabel('Speichern')).toBe(true);
    expect(isNetworkActionLabel('Zurück')).toBe(false);
  });
  it('keeps failed uploads queued and removes uploaded/duplicates', async () => {
    const removed: string[] = [];
    const res = await processQueue([item('a'), item('b'), item('c')],
      async i => i.id === 'a' ? { ok: true } : i.id === 'b' ? { ok: false, duplicate: true } : { ok: false },
      async id => { removed.push(id); });
    expect(res).toEqual({ uploaded: 1, remaining: 1 });
    expect(removed).toEqual(['a', 'b']);
  });
});
