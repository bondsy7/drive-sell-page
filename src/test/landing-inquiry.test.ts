import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import LandingInquiryFields, {
  DEFAULT_INQUIRY_MESSAGE, inquiryMessage, inquiryPhoneHref,
} from '@/components/landing/LandingInquiryFields';
import { buildContactFormHTML } from '@/lib/templates/shared';

describe('landing inquiry phone target', () => {
  it('uses the dealer telephone number without formatting characters', () => {
    expect(inquiryPhoneHref('+49 (241) 123-456')).toBe('tel:+49241123456');
  });
  it('does not invent a call target when the dealer has no phone number', () => {
    expect(inquiryPhoneHref()).toBeUndefined();
    expect(inquiryPhoneHref('javascript:alert(1)')).toBeUndefined();
  });
});

describe('landing enquiry default message names the vehicle', () => {
  it('inserts make and model chosen while creating the page', () => {
    expect(inquiryMessage('KIA EV4')).toBe(
      'Hallo,\nich interessiere mich für das angebotene Fahrzeug KIA EV4 und bitte um weitere Informationen.\nMit freundlichen Grüßen',
    );
  });

  it('keeps the generic text when no vehicle is known', () => {
    expect(inquiryMessage()).toBe(DEFAULT_INQUIRY_MESSAGE);
    expect(inquiryMessage('   ')).toBe(DEFAULT_INQUIRY_MESSAGE);
  });

  it('renders the vehicle into the shared enquiry form', () => {
    const html = renderToStaticMarkup(createElement(LandingInquiryFields, { vehicleLabel: 'Skoda Octavia' }));
    expect(html).toContain('angebotene Fahrzeug Skoda Octavia und bitte um weitere Informationen');
  });

  it('carries make and model into the exported landingpage form', () => {
    const html = buildContactFormHTML({
      dealerUserId: 'dealer-1',
      projectId: 'project-1',
      supabaseUrl: 'https://example.supabase.co',
      vehicleTitle: 'KIA EV4',
      inventoryStyle: true,
    });
    expect(html).toContain('angebotene Fahrzeug KIA EV4 und bitte um weitere Informationen');
  });
});