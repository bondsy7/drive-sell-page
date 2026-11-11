import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { isHoneypotSubmission, leadSchema, ownsLeadContext } from './validation.ts';

const valid = { dealerUserId: '11111111-1111-4111-8111-111111111111', name: 'Test Anfrage', email: 'test@example.com' };
Deno.test('bot trap detects filled field but allows legacy forms', () => {
  assertEquals(isHoneypotSubmission({ ...valid, website: 'https://spam.example' }), true);
  assertEquals(isHoneypotSubmission(valid), false);
  assertEquals(isHoneypotSubmission({ website: ' ' }), false);
});
Deno.test('rejects invalid email and blank names', () => {
  assertEquals(leadSchema.safeParse({ ...valid, email: 'invalid' }).success, false);
  assertEquals(leadSchema.safeParse({ ...valid, name: '   ' }).success, false);
  assertEquals(leadSchema.safeParse(valid).success, true);
});
Deno.test('rejects oversized text, header injection and nonboolean flags', () => {
  assertEquals(leadSchema.safeParse({ ...valid, message: 'x'.repeat(3201) }).success, false);
  assertEquals(leadSchema.safeParse({ ...valid, email: 'test@example.com\r\nBcc:evil@example.com' }).success, false);
  assertEquals(leadSchema.safeParse({ ...valid, interestedPurchase: 'false' }).success, false);
});
Deno.test('preserves long enquiry text and consent appendix', () => {
  assertEquals(leadSchema.safeParse({ ...valid, message: 'x'.repeat(3000) + '\nDatenschutz: bestätigt.' }).success, true);
});
Deno.test('rejects foreign or missing projects and vehicles', () => {
  assertEquals(ownsLeadContext('a', { user_id: 'b', vehicle_id: null }, null, 'p'), false);
  assertEquals(ownsLeadContext('a', null, null, 'p'), false);
  assertEquals(ownsLeadContext('a', null, { user_id: 'b' }, null, 'v'), false);
  assertEquals(ownsLeadContext('a', { user_id: 'a', vehicle_id: 'v' }, { user_id: 'a' }, 'p', 'v'), true);
  assertEquals(ownsLeadContext('a', { user_id: 'a', vehicle_id: 'v' }, { user_id: 'a' }, 'p', 'other'), false);
});