import { describe, expect, it } from 'vitest';
import { allGeneratorModulesDisabled } from '@/lib/generator-access';
import { MODULE_KEYS } from '@/hooks/useModuleAccess';

describe('Generator access during maintenance', () => {
  it('blocks every generator entry when all modules are disabled', () => {
    expect(allGeneratorModulesDisabled(MODULE_KEYS, new Set(MODULE_KEYS))).toBe(true);
  });
  it('does not block accounts with any enabled module', () => {
    const disabled = new Set<string>(MODULE_KEYS);
    disabled.delete('photos');
    expect(allGeneratorModulesDisabled(MODULE_KEYS, disabled)).toBe(false);
  });
  it('does not treat an empty permissions list as a complete restriction', () => {
    expect(allGeneratorModulesDisabled([], new Set())).toBe(false);
  });
});