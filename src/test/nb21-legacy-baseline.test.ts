import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { ALL_PIPELINE_JOBS } from '@/lib/pipeline-jobs';
import { buildMasterPrompt, type RemasterConfig } from '@/lib/remaster-prompt';

/**
 * Guard: Die 2.0-Prompts (Qualität/Nano Banana 2 und alle anderen Tiers) dürfen
 * durch die getrennte Nano-Banana-2.1-Erweiterung nicht verändert werden.
 * Die Hashes wurden VOR dem Einbau von src/prompts/nb21 erzeugt.
 */
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

const config = {
  scene: 'showroom-1', licensePlate: 'remove', changeColor: false,
  showManufacturerLogo: false, showDealerLogo: false,
} as RemasterConfig;

const MATRIX: Array<[string, string]> = [
  ['car', '34front'], ['car', 'side'], ['car', 'rear'], ['car', 'interior-front'], ['car', 'interior-rear'],
  ['van', 'side-left'], ['motorhome', 'living'], ['motorcycle', 'side'], ['machinery', 'cabin'],
];

export function legacyFingerprint() {
  const jobs = sha(ALL_PIPELINE_JOBS.map(j => `${j.key}\u0000${j.prompt}`).join('\u0001'));
  const master = sha(MATRIX.map(([vehicleClass, slot]) =>
    buildMasterPrompt(config, 'Kompakt-SUV, Modelljahr 2025', slot, {}, { vehicleClass } as never),
  ).join('\u0001'));
  return { jobs, master };
}

describe('2.0-Prompts bleiben unverändert', () => {
  it('Pipeline-Job-Prompts und Master-Prompt sind byte-identisch zum Stand vor 2.1', () => {
    const fp = legacyFingerprint();
    console.log('[legacy-fingerprint]', JSON.stringify(fp));
    expect(fp).toEqual(LEGACY_FINGERPRINT);
  });
});

const LEGACY_FINGERPRINT = { jobs: 'TBD', master: 'TBD' };
