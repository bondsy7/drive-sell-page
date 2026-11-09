import { describe, it, expect } from 'vitest';
import { moveStackImageToSection, getImageStack } from './landing-image-stack';

describe('moveStackImageToSection', () => {
  it('moves main image of section a to the end of section b with its frame', () => {
    const state = { images: { a: 'u1', b: 'u2' }, content: { sections: [], imageFrames: { a: { zoom: 2 } } } as any };
    const r = moveStackImageToSection(state, 'a', '@main', 'b', 'end', 'b::img-x');
    expect(r.images).toEqual({ b: 'u2', 'b::img-x': 'u1' });
    expect(getImageStack(r.content, 'b')).toEqual(['@main', 'b::img-x']);
    expect(r.content.imageStacks!.a).toEqual([]);
    expect((r.content.imageFrames as any)['b::img-x']).toEqual({ zoom: 2 });
  });
});
