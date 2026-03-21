import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn (class merger)', () => {
  it('merges classes', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });

  it('resolves tailwind conflicts', () => {
    const result = cn('px-2', 'px-4');
    expect(result).toBe('px-4');
  });

  it('handles undefined and false', () => {
    expect(cn('px-2', undefined, false && 'py-1')).toBe('px-2');
  });
});
