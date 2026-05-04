import { useMemo, useState } from 'react';
import { useParams, Link, Navigate, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Car, FileText, Image as ImageIcon, Layout, LayoutGrid, Video, RotateCw,
  MessageSquare, FolderOpen, Trash2, Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useVehicle, useDeleteVehicle } from '@/hooks/useVehicles';
import { useAuth } from '@/hooks/useAuth';
import {
  useDeleteProject, useDeleteLead, useDeleteVideo, useDeleteBanner, useDeleteSpin360,
} from '@/hooks/useDashboardData';
import { downloadHTML } from '@/lib/templates/download';
import { embedCO2LabelsInHTML } from '@/lib/templates/shared';
import { compressToWebP } from '@/lib/storage-utils';
import ProjectsTab from '@/components/dashboard/ProjectsTab';
import LandingsTab from '@/components/dashboard/LandingsTab';
import GalleryTab, { getImageSortKey } from '@/components/dashboard/GalleryTab';
import BannersTab from '@/components/dashboard/BannersTab';
import VideosTab from '@/components/dashboard/VideosTab';
import Spin360Tab from '@/components/dashboard/Spin360Tab';
import LeadsTab from '@/components/dashboard/LeadsTab';
import OriginalsTab from '@/components/vehicle/OriginalsTab';
import ExportChoiceDialog, { type ExportMode } from '@/components/ExportChoiceDialog';
import GalleryLightbox from '@/components/GalleryLightbox';
import VideoPlayerModal from '@/components/dashboard/VideoPlayerModal';
import SpinViewerModal from '@/components/dashboard/SpinViewerModal';
import EditVehicleDialog from '@/components/vehicle/EditVehicleDialog';
import CoverPickerDialog from '@/components/vehicle/CoverPickerDialog';
import { getImageSrc } from '@/components/dashboard/types';
import type { Project, ProjectImage, Lead, Spin360Job, BannerFile, VideoFile } from '@/components/dashboard/types';

type TabKey = 'originals' | 'gallery' | 'landings' | 'projects' | 'banners' | 'videos' | 'spin360' | 'leads';

export default function VehicleView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: vehicle, isLoading } = useVehicle(id);
  const deleteVehicle = useDeleteVehicle();
  const deleteProject = useDeleteProject();
  const deleteLead = useDeleteLead();
  const deleteVideo = useDeleteVideo();
  const deleteBanner = useDeleteBanner();
  const deleteSpin360 = useDeleteSpin360();

  const [tab, setTab] = useState<TabKey>('originals');

  // Modals
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [lightboxFolder, setLightboxFolder] = useState<string | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportProject, setExportProject] = useState<Project | null>(null);
  const [playerVideo, setPlayerVideo] = useState<VideoFile | null>(null);
  const [viewerJobId, setViewerJobId] = useState<string | null>(null);
  const [viewerFrames, setViewerFrames] = useState<string[]>([]);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);

  // Per-vehicle data queries
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

  // ─── Handlers ─────────────────────────────────────────────

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['vehicle-projects', id] });
    qc.invalidateQueries({ queryKey: ['vehicle-images', id] });
    qc.invalidateQueries({ queryKey: ['vehicle-spin', id] });
    qc.invalidateQueries({ queryKey: ['vehicle-leads', id] });
    qc.invalidateQueries({ queryKey: ['vehicle-banners', id, user?.id] });
    qc.invalidateQueries({ queryKey: ['vehicle-videos', id, user?.id] });
  };

  const handleDeleteVehicle = async () => {
    if (!vehicle) return;
    const label = vehicle.title || vehicle.vin;
    if (!confirm(`"${label}" und ALLE zugehörigen Bilder, Landing Pages, Banner, Videos und Anfragen unwiderruflich löschen?`)) return;
    await deleteVehicle.mutateAsync(vehicle.id);
    navigate('/dashboard');
  };

  const downloadFile = async (url: string, name: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = name;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
    } catch {
      window.open(url, '_blank');
    }
  };

  const openExportDialog = (project: Project) => {
    if (!project.html_content) { toast.error('Keine HTML-Daten vorhanden'); return; }
    setExportProject(project);
    setExportDialogOpen(true);
  };

  const handleExportHTML = async (mode: ExportMode) => {
    if (!exportProject?.html_content) return;
    setExportLoading(true);
    try {
      const vd = exportProject.vehicle_data;
      const brand = (vd as Record<string, Record<string, string>>)?.vehicle?.brand || 'fahrzeug';
      const model = (vd as Record<string, Record<string, string>>)?.vehicle?.model || 'page';
      const filename = `${brand}-${model}.html`;
      let html = exportProject.html_content;
      if (mode === 'offline') {
        const imgRegex = /<img\s+[^>]*src="(https?:\/\/[^"]+)"[^>]*>/g;
        const matches = [...html.matchAll(imgRegex)];
        const uniqueUrls = [...new Set(matches.map(m => m[1]))];
        const urlMap = new Map<string, string>();
        await Promise.all(uniqueUrls.map(async (url) => { urlMap.set(url, await compressToWebP(url)); }));
        for (const [url, webp] of urlMap) html = html.split(`src="${url}"`).join(`src="${webp}"`);
      }
      html = await embedCO2LabelsInHTML(html);
      downloadHTML(html, filename);
    } finally {
      setExportLoading(false); setExportDialogOpen(false); setExportProject(null);
    }
  };

  const openSpinViewer = async (jobId: string) => {
    setViewerJobId(jobId); setViewerLoading(true); setViewerFrames([]);
    const { data } = await supabase
      .from('spin360_generated_frames')
      .select('image_url, frame_index')
      .eq('job_id', jobId)
      .eq('validation_status', 'passed')
      .order('frame_index', { ascending: true });
    const uniqueFrames = new Map<number, string>();
    for (const f of (data || [])) {
      if (!uniqueFrames.has(f.frame_index)) uniqueFrames.set(f.frame_index, f.image_url);
    }
    setViewerFrames(Array.from(uniqueFrames.entries()).sort((a, b) => a[0] - b[0]).map(e => e[1]));
    setViewerLoading(false);
  };

  // Wrap delete-mutations to refresh per-vehicle queries afterwards
  const onDeleteProject = (pid: string) => deleteProject.mutate(pid, { onSuccess: invalidateAll });
  const onDeleteLead = (lid: string) => deleteLead.mutate(lid, { onSuccess: invalidateAll });
  const onDeleteVideo = (name: string) => deleteVideo.mutate(name, { onSuccess: invalidateAll });
  const onDeleteBanner = (fp: string) => deleteBanner.mutate(fp, { onSuccess: invalidateAll });
  const onDeleteSpin = (sid: string) => deleteSpin360.mutate(sid, { onSuccess: invalidateAll });

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
        return (
          <GalleryTab
            images={images}
            onLightbox={(folder, idx) => { setLightboxFolder(folder); setLightboxIndex(idx); }}
            highlightFolder={null}
          />
        );
      case 'landings':
        return <LandingsTab projects={landingProjects} onExport={openExportDialog} onDelete={onDeleteProject} />;
      case 'projects':
        return <ProjectsTab projects={regularProjects} onExport={openExportDialog} onDelete={onDeleteProject} />;
      case 'banners':
        return <BannersTab banners={banners} onDownload={(b) => downloadFile(b.url, b.name)} onDelete={(fp) => onDeleteBanner(fp)} />;
      case 'videos':
        return <VideosTab videos={videos} onPlay={setPlayerVideo} onDownload={(v) => downloadFile(v.url, v.name)} onDelete={onDeleteVideo} />;
      case 'spin360':
        return <Spin360Tab jobs={spinJobs} onOpen={openSpinViewer} onDelete={onDeleteSpin} />;
      case 'leads':
        return <LeadsTab leads={leads} onDelete={onDeleteLead} />;
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
            <button
              type="button"
              onClick={() => setCoverOpen(true)}
              className="w-12 h-12 rounded-md bg-muted overflow-hidden flex items-center justify-center shrink-0 hover:ring-2 hover:ring-accent transition-all"
              aria-label="Cover-Bild ändern"
              title="Cover-Bild ändern"
            >
              {vehicle.cover_image_url
                ? <img src={vehicle.cover_image_url} alt="" className="w-full h-full object-cover" />
                : <Car className="w-5 h-5 text-muted-foreground" />}
            </button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">{title}</h1>
              <p className="text-xs text-muted-foreground font-mono truncate">{vehicle.vin}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setEditOpen(true)}
            aria-label="Fahrzeug bearbeiten"
          >
            <Pencil className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDeleteVehicle}
            disabled={deleteVehicle.isPending}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            aria-label="Fahrzeug löschen"
          >
            <Trash2 className="w-5 h-5" />
          </Button>
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

      <ExportChoiceDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onChoose={handleExportHTML}
        loading={exportLoading}
        projectId={exportProject?.id}
      />

      <GalleryLightbox
        images={
          (lightboxFolder
            ? images.filter(img => (img.gallery_folder || 'Ohne Ordner') === lightboxFolder)
            : [...images]
          )
            .sort((a, b) => getImageSortKey(a.perspective) - getImageSortKey(b.perspective))
            .map(img => ({ id: img.id, src: getImageSrc(img), perspective: img.perspective, project_id: img.project_id }))
        }
        initialIndex={lightboxIndex}
        open={lightboxIndex >= 0}
        onClose={() => { setLightboxIndex(-1); setLightboxFolder(null); }}
        onAssigned={invalidateAll}
        onRegenerated={invalidateAll}
        onDeleted={invalidateAll}
      />

      {playerVideo && (
        <VideoPlayerModal
          video={playerVideo}
          onClose={() => setPlayerVideo(null)}
          onDownload={(v) => downloadFile(v.url, v.name)}
        />
      )}
      {viewerJobId && (
        <SpinViewerModal
          loading={viewerLoading}
          frames={viewerFrames}
          onClose={() => { setViewerJobId(null); setViewerFrames([]); }}
        />
      )}
    </div>
  );
}
