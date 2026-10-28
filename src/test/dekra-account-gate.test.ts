import { describe, it, expect } from 'vitest';
import {
  isDekraAccount,
  canUseExplainerVideo,
  DEKRA_SCENE_EMAILS,
  EXPLAINER_VIDEO_EMAILS,
  getSceneOptionsForUser,
} from '@/lib/remaster-prompt';

// Erklärvideo: DEKRA-Accounts + d.bonds / p.erhard / erik.wakolbinger.
// DEKRA-Showroom: weiterhin ausschließlich die drei DEKRA-Accounts.
describe('explainer video access', () => {
  it('allows DEKRA accounts and the two admin accounts', () => {
    for (const email of DEKRA_SCENE_EMAILS) {
      expect(canUseExplainerVideo(email)).toBe(true);
    }
    expect(canUseExplainerVideo('d.bonds@autoactiva.de')).toBe(true);
    expect(canUseExplainerVideo('p.erhard@autoactiva.de')).toBe(true);
    expect(canUseExplainerVideo('erik.wakolbinger@dekra.com')).toBe(true);
  });

  it('rejects other accounts and missing emails', () => {
    expect(canUseExplainerVideo('paul@example.com')).toBe(false);
    expect(canUseExplainerVideo('')).toBe(false);
    expect(canUseExplainerVideo(null)).toBe(false);
    expect(canUseExplainerVideo(undefined)).toBe(false);
  });

  it('is case- and whitespace-insensitive', () => {
    expect(canUseExplainerVideo(' D.BONDS@autoactiva.de ')).toBe(true);
    expect(canUseExplainerVideo('P.Erh ard@autoactiva.de'.replace(' ', ''))).toBe(true);
  });

  it('does not grant the DEKRA scene to the admin accounts', () => {
    expect(EXPLAINER_VIDEO_EMAILS.length).toBe(DEKRA_SCENE_EMAILS.length + 3);
    expect(isDekraAccount('d.bonds@autoactiva.de')).toBe(false);
    expect(isDekraAccount('p.erhard@autoactiva.de')).toBe(false);
    expect(getSceneOptionsForUser('p.erhard@autoactiva.de').some(o => o.value === 'dealer-lot-dekra')).toBe(false);
    expect(getSceneOptionsForUser('dekra@autohaus.ai').some(o => o.value === 'dealer-lot-dekra')).toBe(true);
  });
});
