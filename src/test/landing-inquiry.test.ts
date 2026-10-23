import { describe, expect, it } from 'vitest';
import { inquiryPhoneHref } from '@/components/landing/LandingInquiryFields';

describe('landing inquiry phone target', () => {
  it('uses the dealer telephone number without formatting characters', () => {
    expect(inquiryPhoneHref('+49 (241) 123-456')).toBe('tel:+49241123456');
  });
  it('does not invent a call target when the dealer has no phone number', () => {
    expect(inquiryPhoneHref()).toBeUndefined();
    expect(inquiryPhoneHref('javascript:alert(1)')).toBeUndefined();
  });
});