import { describe, it, expect } from 'vitest';
import { ALL_PIPELINE_JOBS } from '@/lib/pipeline-jobs';
import type { RemasterConfig } from '@/lib/remaster-prompt';
import {
  NB21_SECTION_ORDER, NB21_PIPELINE_SPECS, NB21_SERVER_SLOTS, NB21_VERSION_MARKER,
  buildNb21PipelinePrompt, buildNb21RemasterPrompt, getNb21PipelineSpec, isNb21Tier,
  nb21SectionHeader, resolveRegenerationPromptVersion,
} from '@/prompts/nb21';

const config = {
  scene: 'showroom-1', licensePlate: 'remove', changeColor: false,
  showManufacturerLogo: false, showDealerLogo: false, cleanupItems: ['trailer', 'stickers'],
} as RemasterConfig;

const refs = {
  primaryRole: '34front',
  supportingRoles: ['side', 'rear', 'interior-front'],
  hasWheelReference: true,
  hasEnvironmentReference: true,
};

function expectNineSections(prompt: string) {
  const positions = NB21_SECTION_ORDER.map((name) => {
    const header = nb21SectionHeader(name);
    expect(prompt.split(header).length - 1, `${name} genau einmal`).toBe(1);
    return prompt.indexOf(header);
  });
  for (let i = 1; i < positions.length; i++) expect(positions[i]).toBeGreaterThan(positions[i - 1]);
  expect(prompt.match(/### SECTION \d\/9:/g)).toHaveLength(9);
}

function sectionBody(prompt: string, name: (typeof NB21_SECTION_ORDER)[number]): string {
  const start = prompt.indexOf(nb21SectionHeader(name));
  const next = prompt.indexOf('### SECTION', start + 5);
  return prompt.slice(start, next === -1 ? undefined : next);
}

const classFor = (key: string) =>
  key.startsWith('MOTO_') ? 'motorcycle' : key.startsWith('WOMO_') ? 'motorhome'
    : key.startsWith('VAN_') ? 'van' : key.startsWith('MACH_') ? 'machinery' : 'car';

describe('NB21: Abdeckung und Struktur', () => {
  it('jeder bestehende Pipeline-Job hat einen 2.1-Prompt', () => {
    for (const job of ALL_PIPELINE_JOBS) expect(NB21_PIPELINE_SPECS[job.key], job.key).toBeDefined();
    expect(() => getNb21PipelineSpec('UNBEKANNT')).toThrow(/keine Rückfalllösung/);
  });

  it('jede 2.1-Pipeline-Ausgabe hat die 9 Abschnitte genau einmal in Reihenfolge', () => {
    for (const job of ALL_PIPELINE_JOBS) {
      const p = buildNb21PipelinePrompt({ job, config, classContext: { vehicleClass: classFor(job.key) } as never, references: refs });
      expectNineSections(p);
      expect(p).toContain(NB21_VERSION_MARKER);
      for (const slot of Object.values(NB21_SERVER_SLOTS)) expect(p.split(slot).length - 1).toBe(1);
    }
  });

  it('jeder Remaster-Slot (Pkw und Klassen) ergibt 9 Abschnitte', () => {
    const slots: Array<[string, string]> = [
      ['car', '34front'], ['car', 'side'], ['car', 'rear'], ['car', 'interior-front'], ['car', 'interior-rear'],
      ['van', 'side-right'], ['van', 'cargo'], ['motorhome', 'living'], ['motorcycle', 'side'], ['machinery', 'controls'],
      ['truck', 'truck_cab_side_left'],
    ];
    for (const [vehicleClass, slotKey] of slots) {
      const p = buildNb21RemasterPrompt({ config, slotKey, classContext: { vehicleClass, truckConfiguration: 'solo', subjectScope: 'tractor_only' } as never, references: { primaryRole: slotKey } });
      expectNineSections(p);
    }
  });
});

describe('NB21: Seitenrichtung', () => {
  it('linke Seitenansicht: Front zeigt nach links im Bild', () => {
    const p = buildNb21PipelinePrompt({ job: { key: 'EXT_SIDE_LEFT', label: '', labelDe: '' }, config, references: refs });
    const persp = sectionBody(p, 'PERSPECTIVE LOCK');
    expect(persp).toContain('physical LEFT flank');
    expect(persp).toContain('front/hood/headlights point to IMAGE LEFT');
    expect(persp).toContain('NB21_PHYSICAL_SIDE: LEFT');
  });
  it('rechte Seitenansicht: Front zeigt nach rechts im Bild', () => {
    const p = buildNb21PipelinePrompt({ job: { key: 'EXT_SIDE_RIGHT', label: '', labelDe: '' }, config, references: refs });
    const persp = sectionBody(p, 'PERSPECTIVE LOCK');
    expect(persp).toContain('physical RIGHT flank');
    expect(persp).toContain('front/hood/headlights point to IMAGE RIGHT');
  });
  it('abgeleitete Klassen-Seitenansichten übernehmen die physische Seite', () => {
    expect(NB21_PIPELINE_SPECS.VAN_EXT_SIDE_RIGHT.physicalSide).toBe('RIGHT');
    expect(NB21_PIPELINE_SPECS.MOTO_EXT_SIDE_LEFT.physicalSide).toBe('LEFT');
    const moto = buildNb21RemasterPrompt({ config, slotKey: 'side', classContext: { vehicleClass: 'motorcycle' } as never, references: { primaryRole: 'side' } });
    expect(moto).toContain('IMAGE LEFT');
  });
});

describe('NB21: Innenraum-Referenzen', () => {
  it('Innenraumjobs erklären keine Außen-/Felgenreferenz als Innenraumquelle', () => {
    for (const job of ALL_PIPELINE_JOBS.filter(j => j.category === 'interior')) {
      const p = buildNb21PipelinePrompt({ job, config, references: { ...refs, primaryRole: 'interior-front' } });
      const roles = sectionBody(p, 'REFERENCE ROLES');
      expect(roles, job.key).not.toContain('WHEEL REFERENCE');
      expect(roles).toContain('NEVER an authoritative source for interior surfaces');
      expect(roles).not.toMatch(/SIDE EVIDENCE[^\n]*authoritative for the side/);
      expect(sectionBody(p, 'VEHICLE IDENTITY LOCK')).toContain('INTERIOR_CONSOLE_LOCK');
    }
  });
});

describe('NB21: Klassentrennung', () => {
  it('Pkw-2.1 enthält keine Lkw-/Anhängerregeln', () => {
    const p = buildNb21RemasterPrompt({ config, slotKey: '34front', classContext: { vehicleClass: 'car' } as never, references: refs });
    expect(p).not.toContain('TRACTOR_TRAILER_SEPARATION');
    expect(p).not.toMatch(/Trailer: remove/);
    expect(p).not.toContain('TRUCKS / LORRIES');
  });
  it('Lkw-2.1 behält die Anhänger-Entfernung', () => {
    const p = buildNb21RemasterPrompt({ config, slotKey: 'truck_cab_side_left', classContext: { vehicleClass: 'truck', truckConfiguration: 'solo', subjectScope: 'tractor_only' } as never, references: refs });
    expect(p).toMatch(/Trailer: remove the complete detachable trailer/);
  });
});

describe('NB21: Routing nur für Tier nb21', () => {
  it('nur nb21 aktiviert den 2.1-Pfad', () => {
    expect(isNb21Tier('nb21')).toBe(true);
    for (const t of ['qualitaet', 'standard', 'schnell', 'premium', 'turbo', 'ultra', 'neu', 'flare', 'sunburst', undefined, null]) {
      expect(isNb21Tier(t as never)).toBe(false);
    }
  });
  it('Neu-Generierung: nur 2.1-Läufe nutzen wieder 2.1', () => {
    expect(resolveRegenerationPromptVersion({ promptVersion: 'nb21-v1', modelTier: 'nb21' })).toBe('nb21-v1');
    expect(resolveRegenerationPromptVersion({ modelTier: 'nb21' })).toBe('nb21-v1');
    expect(resolveRegenerationPromptVersion({ modelTier: 'qualitaet' })).toBeUndefined();
    expect(resolveRegenerationPromptVersion(null)).toBeUndefined();
  });
});
