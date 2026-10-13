import { describe, expect, it } from 'vitest';
import { ASYMMETRIC_EQUIPMENT_LOCK, buildMasterPrompt, type RemasterConfig } from '@/lib/remaster-prompt';
import { PIPELINE_JOBS } from '@/lib/pipeline-jobs';

const config: RemasterConfig = {
  scene: 'showroom-1', licensePlate: 'keep', changeColor: false,
  showManufacturerLogo: false, showDealerLogo: false,
};

function jobPrompt(key: string): string {
  const job = PIPELINE_JOBS.find((entry) => entry.key === key);
  if (!job) throw new Error(`Missing pipeline job: ${key}`);
  return job.prompt;
}

describe('asymmetric equipment lock (side-specific equipment is never mirrored)', () => {
  it('instructs to determine the mounting side from references and forbids mirroring', () => {
    expect(ASYMMETRIC_EQUIPMENT_LOCK).toContain('Determine from the reference photos');
    expect(ASYMMETRIC_EQUIPMENT_LOCK).toContain('Never move them to the opposite flank, never mirror them and never render them on both sides');
    expect(ASYMMETRIC_EQUIPMENT_LOCK).toContain('A left-side view must not show equipment the references place on the right flank');
  });

  it('applies to exterior remastering but not to interior slots', () => {
    expect(buildMasterPrompt(config, undefined, 'side')).toContain(ASYMMETRIC_EQUIPMENT_LOCK);
    expect(buildMasterPrompt(config, undefined, 'interior-front')).not.toContain(ASYMMETRIC_EQUIPMENT_LOCK);
  });

  it('sharpens the side profiles with their physical flank', () => {
    expect(jobPrompt('EXT_SIDE_LEFT')).toContain("This view shows the vehicle's LEFT flank");
    expect(jobPrompt('EXT_SIDE_LEFT')).toContain('never show equipment the references place on the RIGHT flank');
    expect(jobPrompt('EXT_SIDE_RIGHT')).toContain("This view shows the vehicle's RIGHT flank");
    expect(jobPrompt('EXT_SIDE_RIGHT')).toContain('never show equipment the references place on the LEFT flank');
  });

  it.each(['EXT_34_FRONT_RIGHT', 'EXT_34_REAR_LEFT', 'EXT_34_REAR_RIGHT'])('keeps 3/4 view %s flank-faithful', (key) => {
    expect(jobPrompt(key)).toContain('Follow ASYMMETRIC_EQUIPMENT_LOCK');
  });

  it('does not claim a fixed side for asymmetric equipment like awnings', () => {
    expect(ASYMMETRIC_EQUIPMENT_LOCK).not.toMatch(/awning[^.]*always/i);
    expect(ASYMMETRIC_EQUIPMENT_LOCK).toContain('its exact position, size and state (extended/retracted/closed) as photographed');
  });
});
