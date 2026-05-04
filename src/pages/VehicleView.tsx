import { useMemo, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Car, FileText, Image as ImageIcon, Layout, LayoutGrid, Video, RotateCw, MessageSquare, FolderOpen } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useVehicle } from '@/hooks/useVehicles';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import ProjectsTab from '@/components/dashboard/ProjectsTab';
import LandingsTab from '@/components/dashboard/LandingsTab';
import GalleryTab from '@/components/dashboard/GalleryTab';
import BannersTab from '@/components/dashboard/BannersTab';
import VideosTab from '@/components/dashboard/VideosTab';
import Spin360Tab from '@/components/dashboard/Spin360Tab';
import LeadsTab from '@/components/dashboard/LeadsTab';
import OriginalsTab from '@/components/vehicle/OriginalsTab';
import type { Project, ProjectImage, Lead, Spin360Job, BannerFile, VideoFile } from '@/components/dashboard/types';

type TabKey = 'originals' | 'gallery' | 'landings' | 'projects' | 'banners' | 'videos' | 'spin360' | 'leads';

export default function VehicleView() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: vehicle, isLoading } = useVehicle(id);
  const [tab, setTab] = useState<TabKey>('originals');

  // Per-vehicle data queries (only fire when vehicle exists)
  const { data: projects = [] } = useQuery({
    queryKey: ['vehicle-projects', id],
    enabled: !!id && !!vehicle,
    queryFn: async (): Promise<Project[]> => {
      const { data } = await supabase.from('projects')
        .select('id, title, template_id, vehicle_data, main_image_base64, main_image_url, html_content, created_at, updated_at')
        .eq('vehicle_id', id!)
        .order('updated_at', { ascending: false });
      return (data as Project[]) || [];
    },
  });

  const { data: images = [] } = useQuery({
    queryKey: ['vehicle-images', id],
    enabled: !!id && !!vehicle,
    queryFn: async (): Promise<ProjectImage[]> => {
      const { data } = await supabase.from('project_images')
        .select('id, project_id, image_base64, image_url, perspective, gallery_folder, created_at')
        .eq('vehicle_id', id!)
        .order('created_at', { ascending: false });
      return (data as ProjectImage[]) || [];
    },
  });

  const { data: spinJobs = [] } = useQuery({
    queryKey: ['vehicle-spin', id],
    enabled: !!id && !!vehicle,
    queryFn: async (): Promise<Spin360Job[]> => {
      const { data } = await supabase.from('spin360_jobs')
        .select('id, status, created_at, updated_at, error_message, manifest')
        .eq('vehicle_id', id!)
        .order('created_at', { ascending: false });
      return (data || []).map((j: { id: string; status: string; created_at: string; updated_at: string; error_message: string | null; manifest: { frameCount?: number } | null }) => ({
        ...j,
        displayStatus: j.status,
        displayError: j.error_message,
      }));
    },
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['vehicle-leads', id],
    enabled: !!id && !!vehicle,
    queryFn: async (): Promise<Lead[]> => {
      const { data } = await supabase.from('leads')
        .select('*')
        .eq('vehicle_id', id!)
        .order('created_at', { ascending: false });
      return (data as Lead[]) || [];
    },
  });

  // Banners + videos via storage path convention
  const { data: banners = [] } = useQuery({
    queryKey: ['vehicle-banners', id, user?.id],
    enabled: !!id && !!vehicle && !!user,
    queryFn: async (): Promise<BannerFile[]> => {
      const prefix = `${user!.id}/${id}`;
      const { data } = await supabase.storage.from('banners').list(prefix, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
      return (data || []).filter(f => f.name && !f.name.startsWith('.')).map(f => {
        const fullPath = `${prefix}/${f.name}`;
        return {
          name: f.name,
          fullPath,
          url: supabase.storage.from('banners').getPublicUrl(fullPath).data.publicUrl,
          created_at: f.created_at || '',
        };
      });
    },
  });

  const { data: videos = [] } = useQuery({
    queryKey: ['vehicle-videos', id, user?.id],
    enabled: !!id && !!vehicle && !!user,
    queryFn: async (): Promise<VideoFile[]> => {
      const prefix = `${user!.id}/${id}`;
      const { data } = await supabase.storage.from('vehicle-images').list(`${prefix}/videos`, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
      return (data || []).filter(f => f.name && !f.name.startsWith('.')).map(f => ({
        name: f.name,
        url: supabase.storage.from('vehicle-images').getPublicUrl(`${prefix}/videos/${f.name}`).data.publicUrl,
        created_at: f.created_at || '',
      }));
    },
  });

  const regularProjects = useMemo(() => projects.filter(p => p.template_id !== 'landing-page'), [projects]);
  const landingProjects = useMemo(() => projects.filter(p => p.template_id === 'landing-page'), [projects]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (!vehicle) return <Navigate to="/dashboard" replace />;

  const title =
    vehicle.title ||
    [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' ') ||
    vehicle.vin;

  const tabs: { key: TabKey; label: string; icon: React.ElementType; count: number }[] = [
    { key: 'originals', label: 'Originale', icon: FolderOpen, count: 0 },
    { key: 'gallery', label: 'Galerie', icon: ImageIcon, count: images.length },
    { key: 'landings', label: 'Landing Pages', icon: Layout, count: landingProjects.length },
    { key: 'projects', label: 'Projekte', icon: FileText, count: regularProjects.length },
    { key: 'banners', label: 'Banner', icon: LayoutGrid, count: banners.length },
    { key: 'videos', label: 'Videos', icon: Video, count: videos.length },
    { key: 'spin360', label: '360°', icon: RotateCw, count: spinJobs.length },
    { key: 'leads', label: 'Anfragen', icon: MessageSquare, count: leads.length },
  ];

  const renderTab = () => {
    switch (tab) {
      case 'originals':
        return <OriginalsTab vehicleId={vehicle.id} />;
      case 'gallery':
        return <GalleryTab images={images} onLightbox={() => {}} highlightFolder={null} />;
      case 'landings':
        return <LandingsTab projects={landingProjects} onExport={() => {}} onDelete={() => {}} />;
      case 'projects':
        return <ProjectsTab projects={regularProjects} onExport={() => {}} onDelete={() => {}} />;
      case 'banners':
        return <BannersTab banners={banners} onDownload={() => {}} onDelete={() => {}} />;
      case 'videos':
        return <VideosTab videos={videos} onPlay={() => {}} onDownload={() => {}} onDelete={() => {}} />;
      case 'spin360':
        return <Spin360Tab jobs={spinJobs} onOpen={() => {}} onDelete={() => {}} />;
      case 'leads':
        return <LeadsTab leads={leads} onDelete={() => {}} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <Button asChild variant="ghost" size="icon">
            <Link to="/dashboard" aria-label="Zurück"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-md bg-muted overflow-hidden flex items-center justify-center shrink-0">
              {vehicle.cover_image_url
                ? <img src={vehicle.cover_image_url} alt="" className="w-full h-full object-cover" />
                : <Car className="w-5 h-5 text-muted-foreground" />}
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">{title}</h1>
              <p className="text-xs text-muted-foreground font-mono truncate">{vehicle.vin}</p>
            </div>
          </div>
        </div>

        {/* Tag chips */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          {vehicle.brand && <Badge variant="secondary">{vehicle.brand}</Badge>}
          {vehicle.model && <Badge variant="secondary">{vehicle.model}</Badge>}
          {vehicle.year && <Badge variant="secondary">{vehicle.year}</Badge>}
          {vehicle.color && <Badge variant="secondary">{vehicle.color}</Badge>}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {tabs.map(t => (
            <Button
              key={t.key}
              variant={tab === t.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab(t.key)}
              className="whitespace-nowrap"
            >
              <t.icon className="w-4 h-4 mr-1.5" />
              {t.label}
              {t.count > 0 && <span className="ml-1.5 opacity-75">({t.count})</span>}
            </Button>
          ))}
        </div>

        {renderTab()}
      </main>
    </div>
  );
}
