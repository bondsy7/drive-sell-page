export type DashboardPageKind = 'landing' | 'pdf';

export interface DashboardProjectRef {
  id: string;
  vehicle_id: string | null;
  template_id: string | null;
}

/** Match the existing vehicle's Landing Pages/PDF tabs; group only by vehicle ID. */
export function dashboardPageCounts(projects: DashboardProjectRef[], kind: DashboardPageKind): Map<string, number> {
  const counts = new Map<string, number>();
  for (const project of projects) {
    if (!project.vehicle_id) continue;
    const landing = project.template_id === 'landing-page';
    if (landing !== (kind === 'landing')) continue;
    counts.set(project.vehicle_id, (counts.get(project.vehicle_id) || 0) + 1);
  }
  return counts;
}

export function dashboardPageVehicleLink(vehicleId: string, kind: DashboardPageKind): string {
  return `/vehicle/${vehicleId}?tab=${kind === 'landing' ? 'landings' : 'projects'}`;
}