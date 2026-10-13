import { describe, expect, it } from 'vitest';
import { buildMasterPrompt, INTERIOR_CONSOLE_LOCK, type RemasterConfig } from '@/lib/remaster-prompt';
import { PIPELINE_JOBS } from '@/lib/pipeline-jobs';

const config: RemasterConfig = {
  scene: 'showroom-1', licensePlate: 'keep', changeColor: false,
  showManufacturerLogo: false, showDealerLogo: false,
};

describe('reference-conditioned interior console protection', () => {
  it('prioritizes a dashboard rocker/switch without replacing it with a console lever', () => {
    const prompt = buildMasterPrompt(config, undefined, 'interior-front');
    expect(prompt).toContain('SHIFT_BY_WIRE_PRIORITY: If the interior reference shows a rocker or switch on the dashboard');
    expect(prompt).toContain('do not replace the dashboard control with a console-mounted selector');
  });

  it('forbids automatic as well as manual additions when the original console has no selector', () => {
    const prompt = buildMasterPrompt(config, undefined, 'interior-front');
    expect(prompt).toContain('If no gear selector protrudes from the center console in the reference image');
    expect(prompt).toContain('ANY lever, stick, pin, stalk, knob, shift boot or bulge');
    expect(prompt).toContain('whether manual or automatic/DSG');
    expect(prompt).toContain('Flat/open console surfaces MUST remain completely flat/open');
  });

  it('preserves real selectors and controls for vehicles that have them', () => {
    expect(INTERIOR_CONSOLE_LOCK).toContain('If a real console-mounted selector is visible in the reference, retain its exact type, shape, size and position');
    expect(INTERIOR_CONSOLE_LOCK).toContain('this rule never flattens genuine reference geometry');
  });

  it.each(['interior-front', 'interior-rear'])('inherits protection once in follow-up slot %s, even with admin interior overrides', (slot) => {
    const prompt = buildMasterPrompt(config, undefined, slot, { remaster_interior_rules: 'Existing custom interior rule' });
    expect(prompt.split(INTERIOR_CONSOLE_LOCK)).toHaveLength(2);
  });

  it.each(['INT_DASHBOARD', 'GRID_INTERIOR_4'])('removes the automatic/DSG lever suggestion from %s', (key) => {
    const job = PIPELINE_JOBS.find((entry) => entry.key === key);
    expect(job).toBeDefined();
    expect(job?.prompt).toContain('Follow INTERIOR_CONSOLE_LOCK');
    expect(job?.prompt).not.toContain('automatic/DSG lever');
  });

  it('does not add console protection to exterior remastering', () => {
    expect(buildMasterPrompt(config, undefined, 'side')).not.toContain(INTERIOR_CONSOLE_LOCK);
  });
});