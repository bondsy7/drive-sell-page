import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import AiDisclosureBadge from '@/components/AiDisclosureBadge';
import {
  AI_DISCLOSURE_OVERLAY_CLASS,
  buildAiDisclosureBadgeHTML,
  buildAiDisclosureImageOverlayHTML,
} from '@/lib/ai-disclosure';

// Vorgabe: Das KI-Label wird generell mit 40 % Deckkraft gezeigt – nie voll.
describe('KI-Label Deckkraft', () => {
  it('Overlay-Klasse im Interface nutzt 40 % und nie volle Deckkraft', () => {
    expect(AI_DISCLOSURE_OVERLAY_CLASS).toContain('opacity-40');
    expect(AI_DISCLOSURE_OVERLAY_CLASS).not.toMatch(/opacity-(50|60|70|80|90|95|100)/);
  });

  it('Badges in exportiertem HTML und PDF laufen mit 0.4 Deckkraft', () => {
    expect(buildAiDisclosureImageOverlayHTML('landing')).toContain('opacity:.4');
    expect(buildAiDisclosureBadgeHTML('banner')).toContain('opacity:.4');
  });

  it('Badge-Komponente (Galerie, Viewer, Banner) rendert mit 40 % Deckkraft', () => {
    const { container } = render(<AiDisclosureBadge context="banner" />);
    const img = container.querySelector('img');
    expect(img?.getAttribute('class')).toContain('opacity-40');
  });
});
