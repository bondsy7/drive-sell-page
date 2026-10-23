import { describe, it, expect } from 'vitest';
import {
  landingImageCost,
  creditLabel,
  planBulkImageRun,
  readInsufficientCredits,
} from './landing-credit-costs';

const COSTS = {
  image_generate: { schnell: 1, ultra: 2 },
  image_remaster: { schnell: 1, neu: 2 },
};

describe('landing page credit costs', () => {
  it('prices one generated image at the configured 1 credit', () => {
    expect(landingImageCost(COSTS, 'image_generate')).toBe(1);
  });

  it('prices a remaster at the configured 1 credit for the schnell tier', () => {
    expect(landingImageCost(COSTS, 'image_remaster')).toBe(1);
  });

  it('uses the server default while the cost table has not loaded', () => {
    expect(landingImageCost({}, 'image_generate')).toBe(1);
    expect(landingImageCost({}, 'image_remaster')).toBe(2);
  });

  it('charges every image of a bulk run and names the missing credits', () => {
    const plan = planBulkImageRun(5, 1, 3);
    expect(plan.totalCost).toBe(5);
    expect(plan.missing).toBe(2);
    expect(plan.canRun).toBe(false);
  });

  it('allows the run when the balance covers all images', () => {
    const plan = planBulkImageRun(5, 1, 5);
    expect(plan.missing).toBe(0);
    expect(plan.canRun).toBe(true);
    expect(creditLabel(1)).toBe('1 Credit');
    expect(creditLabel(7)).toBe('7 Credits');
  });

  it('unlocks the server-side shortfall message from a failed call', async () => {
    const error = { context: { json: async () => ({ error: 'insufficient_credits', balance: 0, cost: 5 }) } };
    expect(await readInsufficientCredits(error)).toEqual({ balance: 0, cost: 5 });
    expect(await readInsufficientCredits({ context: { json: async () => ({ error: 'timeout' }) } })).toBeNull();
    expect(await readInsufficientCredits(new Error('network'))).toBeNull();
  });
});
