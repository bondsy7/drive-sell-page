import { describe, expect, it } from 'vitest';
import { getPipelineJobsForVehicleClass, PIPELINE_JOBS } from '@/lib/pipeline-jobs';

function promptFor(key: string): string {
  const job = PIPELINE_JOBS.find((candidate) => candidate.key === key);
  if (!job) throw new Error(`Missing pipeline job: ${key}`);
  return job.prompt;
}

describe('PKW side pipeline prompt contract', () => {
  it('renders the physical left flank with the vehicle front pointing left', () => {
    const prompt = promptFor('EXT_SIDE_LEFT');
    expect(prompt).toContain('LEFT flank');
    expect(prompt).toContain('FRONT (hood/headlights) MUST point to the LEFT side of the image');
    expect(prompt).toContain('REAR (trunk/taillights) MUST point to the RIGHT side of the image');
    expect(prompt).toContain('Use ONLY the PROVIDED SHOWROOM for this run');
    expect(prompt).toContain('complete uncropped vehicle is more important than any logo');
  });

  it('renders the physical right flank with the vehicle front pointing right', () => {
    const prompt = promptFor('EXT_SIDE_RIGHT');
    expect(prompt).toContain('RIGHT flank');
    expect(prompt).toContain('FRONT (hood/headlights) MUST point to the RIGHT side of the image');
    expect(prompt).toContain('REAR (trunk/taillights) MUST point to the LEFT side of the image');
    expect(prompt).toContain('If no dedicated right-side photo exists');
    expect(prompt).not.toContain('Use the exact RIGHT-side reference as primary authority');
    expect(prompt).toContain('Use ONLY the PROVIDED SHOWROOM for this run');
    expect(prompt).toContain('complete uncropped vehicle is more important than any logo');
  });

  it('keeps non-car pipeline jobs isolated from the PKW job list', () => {
    expect(getPipelineJobsForVehicleClass('motorcycle').some((job) => job.key.startsWith('MOTO_'))).toBe(true);
    expect(getPipelineJobsForVehicleClass('motorhome').some((job) => job.key.startsWith('WOMO_'))).toBe(true);
    expect(getPipelineJobsForVehicleClass('van').some((job) => job.key.startsWith('VAN_'))).toBe(true);
    expect(getPipelineJobsForVehicleClass('machinery').some((job) => job.key.startsWith('MACH_'))).toBe(true);
  });
});