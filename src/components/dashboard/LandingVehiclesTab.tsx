import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Car, ChevronLeft, ChevronRight, FileText, Layout, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useVehicles } from '@/hooks/useVehicles';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { dashboardPageCounts, dashboardPageVehicleLink, type DashboardPageKind, type DashboardProjectRef } from '@/lib/dashboard-landing-vehicles';

const PAGE_SIZE = 24;

export default function LandingVehiclesTab() {
  const { user } = useAuth();
  const [kind, setKind] = useState<DashboardPageKind>('landing');
  const [page, setPage] = useState(1);
  const vehicleQuery = useVehicles();
  const projectQuery = useQuery({
    queryKey: ['dashboard-page-vehicles', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const rows: DashboardProjectRef[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from('projects')
          .select('id, vehicle_id, template_id')
          .eq('user_id', user.id).not('vehicle_id', 'is', null)
          .order('id').range(offset, offset + 499);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < 500) return rows;
      }
    },
  });
  const counts = useMemo(() => dashboardPageCounts(projectQuery.data || [], kind), [projectQuery.data, kind]);
  const vehicles = vehicleQuery.data.filter(vehicle => counts.has(vehicle.id));
  const loading = projectQuery.isLoading || vehicleQuery.isLoading || vehicleQuery.hasNextPage;
  const failed = projectQuery.isError || vehicleQuery.isError;
  const pageCount = Math.max(1, Math.ceil(vehicles.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const items = vehicles.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const label = kind === 'landing' ? 'Landingpages' : 'PDF-Angebotsseiten';

  return <div className="space-y-5">
    <Tabs value={kind} onValueChange={value => { setKind(value === 'pdf' ? 'pdf' : 'landing'); setPage(1); }}>
      <TabsList className="grid w-full max-w-md grid-cols-2" aria-label="Seitenart">
        <TabsTrigger value="landing" className="gap-2"><Layout className="h-4 w-4 shrink-0" />Landingpages</TabsTrigger>
        <TabsTrigger value="pdf" className="gap-2"><FileText className="h-4 w-4 shrink-0" />PDF-Angebotsseiten</TabsTrigger>
      </TabsList>
    </Tabs>
    {failed ? <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
      <p>Die Fahrzeuge konnten nicht geladen werden.</p>
      <Button variant="outline" onClick={() => { void projectQuery.refetch(); void vehicleQuery.refetch(); }}><RefreshCw className="mr-2 h-4 w-4" />Erneut laden</Button>
    </div> : loading ? <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Fahrzeuge werden geladen…</div>
      : vehicles.length === 0 ? <div className="py-16 text-center text-muted-foreground"><Layout className="mx-auto mb-3 h-10 w-10" /><p>Keine Fahrzeuge mit {label} vorhanden.</p></div>
        : <>
          <p className="text-xs text-muted-foreground">{vehicles.length} Fahrzeuge mit {label}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(vehicle => {
              const title = vehicle.title || [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || 'Fahrzeug';
              const count = counts.get(vehicle.id) || 0;
              return <Link key={vehicle.id} to={dashboardPageVehicleLink(vehicle.id, kind)} className="group block" aria-label={`${title}: ${label} öffnen`}>
                <Card className="overflow-hidden transition-shadow hover:shadow-lg">
                  <div className="relative aspect-video bg-muted">
                    {vehicle.cover_image_url ? <img src={vehicle.cover_image_url} alt={title} className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full items-center justify-center"><Car className="h-10 w-10 text-muted-foreground" /></div>}
                    <Badge variant="secondary" className="absolute right-2 top-2">{count} {kind === 'landing' ? count === 1 ? 'Landingpage' : 'Landingpages' : count === 1 ? 'PDF-Angebotsseite' : 'PDF-Angebotsseiten'}</Badge>
                  </div>
                  <div className="space-y-2 p-4">
                    <h3 className="line-clamp-2 font-semibold text-foreground group-hover:text-accent">{title}</h3>
                    <span className="inline-flex items-center gap-2 text-sm text-accent">{label} öffnen <ChevronRight className="h-4 w-4" /></span>
                  </div>
                </Card>
              </Link>;
            })}
          </div>
          {pageCount > 1 && <div className="flex items-center justify-center gap-3 pt-2">
            <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Zurück</Button>
            <span className="text-sm text-muted-foreground">{currentPage} / {pageCount}</span>
            <Button variant="outline" size="sm" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Weiter<ChevronRight className="ml-1 h-4 w-4" /></Button>
          </div>}
        </>}
  </div>;
}