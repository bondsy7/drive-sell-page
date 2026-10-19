import { describe, it, expect, vi } from 'vitest';
import { resolveRemasterCost } from '../../supabase/functions/_shared/remaster-cost';
import { persistRemasterGallery, validateGalleryTarget, verifyGalleryOwnership } from '../../supabase/functions/_shared/remaster-gallery';
import { remasterPerspectives, unsavedRemasterInputs } from '@/lib/remaster-results';
import { getActiveProfiles } from '@/config/vehicle-classes';
import { CAR_CAPTURE_SLOTS } from '@/config/profiles/car-profile';

const target = {
  id: '11111111-1111-4111-8111-111111111111', vehicleId: '22222222-2222-4222-8222-222222222222',
  folder: 'TEST', slotKey: 'interior-front', perspective: 'Interieur Fahrersitz', sortOrder: 3,
};
function client() {
  const rows = new Map();
  const upload = vi.fn().mockResolvedValue({ error: null });
  const upsert = vi.fn(async (row: Record<string, unknown>): Promise<{ error: unknown }> => { rows.set(row.id, row); return { error: null }; });
  return { rows, upload, upsert, storage: { from: () => ({ upload, getPublicUrl: () => ({ data: { publicUrl: 'https://example.test/result.png' } }) }) }, from: () => ({ upsert }) };
}
describe('Remasterpreis: Anzeige und Server', () => {
  it('NB21 kostet bei fehlendem eigenen Eintrag 3, nicht den Schnellpreis 1', () => {
    expect(resolveRemasterCost({ image_remaster: { schnell: 1, qualitaet: 1 } }, 'nb21')).toBe(3);
  });
  it('eine konfigurierte Preisangabe bleibt unverändert', () => {
    expect(resolveRemasterCost({ image_remaster: { nb21: 6, qualitaet: 1 } }, 'nb21')).toBe(6);
    expect(resolveRemasterCost({ image_remaster: { qualitaet: 1 } }, 'standard')).toBe(1);
  });
});
describe('Slotbeschriftung und doppelfreie Ablage', () => {
  it('Innenraumbilder behalten ihre tatsächliche Rolle bei lückenhaften Uploads', () => {
    expect(remasterPerspectives(CAR_CAPTURE_SLOTS, ['34front', 'rear', 'interior-front', 'interior-rear'])).toEqual([
      '3/4 Front links', 'Heck', 'Interieur Fahrersitz', 'Interieur Rücksitz',
    ]);
  });
  it('alle statischen Fahrzeugklassen liefern ihre eigenen Slotlabels', () => {
    for (const profile of getActiveProfiles().filter(p => !p.hasWorkflowWizard)) {
      const slots = profile.captureSlots.filter(s => !s.isVin);
      expect(remasterPerspectives(slots, slots.map(s => s.key))).toEqual(slots.map(s => s.label));
    }
  });
  it('gesicherte Bilder werden nicht erneut als Pipeline-Eingaben gespeichert', () => {
    expect(unsavedRemasterInputs(['front', 'rear', 'inside'], ['saved-front', undefined, 'saved-inside'])).toEqual([{ item: 'rear', index: 1 }]);
  });
});
describe('Dauerhafte Ergebnislieferung', () => {
  it('speichert ein Ergebnis ohne Abschlussbutton, identisch bei Wiederholung', async () => {
    const c = client();
    await persistRemasterGallery(c, 'owner', target, 'data:image/png;base64,YQ==');
    await persistRemasterGallery(c, 'owner', target, 'data:image/png;base64,Yg==');
    expect(c.rows.size).toBe(1);
    expect(c.rows.get(target.id)).toMatchObject({ perspective: 'Interieur Fahrersitz', vehicle_id: target.vehicleId, sort_order: 3 });
    expect(c.upload.mock.calls[0][0]).toBe(c.upload.mock.calls[1][0]);
  });
  it('eine fehlgeschlagene Galerieablage ist kein erfolgreich geliefertes Bild', async () => {
    const c = client();
    c.upsert.mockResolvedValueOnce({ error: { message: 'failed' } });
    await expect(persistRemasterGallery(c, 'owner', target, 'data:image/png;base64,YQ==')).rejects.toThrow('Galerie');
  });
  it('fremde Fahrzeuge dürfen nicht als Speicherziel verwendet werden', async () => {
    const query = { eq: vi.fn().mockReturnThis(), maybeSingle: async () => ({ data: null, error: null }) };
    const c = { from: () => ({ select: () => query }) };
    await expect(verifyGalleryOwnership(c, 'owner', target)).rejects.toThrow('Fahrzeug');
    expect(query.eq).toHaveBeenCalledWith('user_id', 'owner');
  });
  it('ungültige Speicherziele werden vor Verarbeitung abgelehnt', () => {
    expect(() => validateGalleryTarget({ ...target, vehicleId: '../other' })).toThrow();
    expect(validateGalleryTarget(target)).toEqual(target);
  });
});