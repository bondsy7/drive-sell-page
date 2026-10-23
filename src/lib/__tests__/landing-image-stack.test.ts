import { describe, it, expect } from 'vitest';
import { getImageStack, insertStackImage, removeStackImage, STACK_MAIN, sectionOfImageId } from '@/lib/landing-image-stack';

const base: any = { meta: {}, hero: {}, sections: [] };

describe('landing image stack', () => {
  it('inserts above and below the anchor', () => {
    let c = insertStackImage(base, 's1', STACK_MAIN, 'before', 's1::img-a');
    c = insertStackImage(c, 's1', STACK_MAIN, 'after', 's1::img-b');
    expect(getImageStack(c, 's1')).toEqual(['s1::img-a', STACK_MAIN, 's1::img-b']);
  });
  it('removing an inserted image restores the previous order', () => {
    const c = insertStackImage(base, 's1', STACK_MAIN, 'before', 's1::img-a');
    const s = removeStackImage({ content: c, images: { 's1::img-a': 'u', s1: 'm' } }, 's1::img-a');
    expect(getImageStack(s.content, 's1')).toEqual([STACK_MAIN]);
    expect(s.images).toEqual({ s1: 'm' });
    expect(sectionOfImageId('s1::img-a')).toBe('s1');
  });
});
