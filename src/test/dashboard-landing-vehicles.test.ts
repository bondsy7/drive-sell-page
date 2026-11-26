import { describe, expect, it } from 'vitest';
import { dashboardPageCounts, dashboardPageVehicleLink } from '@/lib/dashboard-landing-vehicles';

const projects = [
  { id: 'lp-1', vehicle_id: 'kia-a', template_id: 'landing-page' },
  { id: 'lp-2', vehicle_id: 'kia-a', template_id: 'landing-page' },
  { id: 'pdf-1', vehicle_id: 'kia-a', template_id: 'modern' },
  { id: 'pdf-2', vehicle_id: 'kia-b', template_id: 'classic' },
  { id: 'unlinked', vehicle_id: null, template_id: 'landing-page' },
];

describe('Dashboard Landingpages category', () => {
  it('shows only vehicles with landingpages and counts multiple pages once per vehicle', () => {
    expect([...dashboardPageCounts(projects, 'landing')]).toEqual([['kia-a', 2]]);
  });
  it('separates PDF offers and keeps distinct vehicles separate', () => {
    expect([...dashboardPageCounts(projects, 'pdf')]).toEqual([['kia-a', 1], ['kia-b', 1]]);
  });
  it('opens the matching page section on the selected vehicle', () => {
    expect(dashboardPageVehicleLink('kia-a', 'landing')).toBe('/vehicle/kia-a?tab=landings');
    expect(dashboardPageVehicleLink('kia-b', 'pdf')).toBe('/vehicle/kia-b?tab=projects');
  });
});