import React, { useState } from 'react';
import { RotateCw, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useModuleAccess, type ModuleKey } from '@/hooks/useModuleAccess';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { FileText, Image, Video, MessageSquare, Layout, LayoutGrid } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import { toast } from 'sonner';
import { downloadHTML } from '@/lib/templates/download';
import { embedCO2LabelsInHTML } from '@/lib/templates/shared';
import { compressToWebP } from '@/lib/storage-utils';
import ExportChoiceDialog, { type ExportMode } from '@/components/ExportChoiceDialog';
import GalleryLightbox from '@/components/GalleryLightbox';
import { useSearchParams } from 'react-router-dom';

import type { Project, VideoFile } from '@/components/dashboard/types';
import { getImageSrc } from '@/components/dashboard/types';
import { getImageSortKey } from '@/components/dashboard/GalleryTab';
import ProjectsTab from '@/components/dashboard/ProjectsTab';
import LandingsTab from '@/components/dashboard/LandingsTab';
import GalleryTab from '@/components/dashboard/GalleryTab';
import VideosTab from '@/components/dashboard/VideosTab';
import BannersTab from '@/components/dashboard/BannersTab';
import Spin360Tab from '@/components/dashboard/Spin360Tab';
import LeadsTab from '@/components/dashboard/LeadsTab';
import VideoPlayerModal from '@/components/dashboard/VideoPlayerModal';
import SpinViewerModal from '@/components/dashboard/SpinViewerModal';
import {
  useProjects, useGallery, useLeads, useVideos, useBanners, useSpin360,
  useDashboardCounts, useDeleteProject, useDeleteLead, useDeleteVideo, useDeleteBanner, useDeleteSpin360,
  PAGE_SIZE,
} from '@/hooks/useDashboardData';

type TabKey = 'projects' | 'landings' | 'gallery' | 'banners' | 'videos' | 'leads' | 'spin360';

const Dashboard = () => {
  const { user } = useAuth();
  const { disabledModules } = useModuleAccess();
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabKey) || 'projects';
  const highlightFolder = searchParams.get('folder') || null;
  const [tab, setTab] = useState<TabKey>(initialTab);

  // Map module keys to dashboard tab keys
  const moduleToTabs: Record<ModuleKey, TabKey[]> = {
    'photos': ['gallery'],
    'pdf-landing': ['landings'],
    'manual-landing': ['landings'],
    'banner': ['banners'],
    'video': ['videos'],
    'sales-assistant': [],
  };

  const disabledTabs = new Set<TabKey>();
  for (const mod of disabledModules) {
    for (const t of moduleToTabs[mod] || []) disabledTabs.add(t);
  }
  // landings only disabled if BOTH pdf-landing and manual-landing are disabled
  if (disabledTabs.has('landings') && !(disabledModules.has('pdf-landing') && disabledModules.has('manual-landing'))) {
    disabledTabs.delete('landings');
  }

  // Pagination state
  const [galleryPage, setGalleryPage] = useState(0);
  const [leadsPage, setLeadsPage] = useState(0);

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

  // React Query hooks
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: galleryData, isLoading: galleryLoading } = useGallery(tab === 'gallery', galleryPage);
  const { data: leadsData, isLoading: leadsLoading } = useLeads(tab === 'leads', leadsPage);
  const { data: videos = [], isLoading: videosLoading } = useVideos(tab === 'videos');
  const { data: banners = [], isLoading: bannersLoading } = useBanners(tab === 'banners');
  const { data: spin360Jobs = [], isLoading: spin360Loading } = useSpin360(tab === 'spin360');
  const { data: counts } = useDashboardCounts();

  const deleteProject = useDeleteProject();
  const deleteLead = useDeleteLead();
  const deleteVideo = useDeleteVideo();
  const deleteBanner = useDeleteBanner();
  const deleteSpin360 = useDeleteSpin360();

  const allImages = galleryData?.items || [];
  const galleryTotal = galleryData?.total || 0;
  const leads = leadsData?.items || [];
  const leadsTotal = leadsData?.total || 0;

  const regularProjects = projects.filter(p => p.template_id !== 'landing-page');
  const landingProjects = projects.filter(p => p.template_id === 'landing-page');

  // ─── Helpers ────────────────────────────────────────────────

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
      // Fallback: open in new tab
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

  // ─── Pagination component ─────────────────────────────────

  const Pagination = ({ page, setPage, total }: { page: number; setPage: (p: number) => void; total: number }) => {
    const totalPages = Math.ceil(total / PAGE_SIZE);
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-2 mt-6">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Zurück</Button>
        <span className="text-sm text-muted-foreground">Seite {page + 1} von {totalPages}</span>
        <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Weiter</Button>
      </div>
    );
  };

  // ─── Tab Config ─────────────────────────────────────────────

  const isLoading = tab === 'projects' ? projectsLoading
    : tab === 'gallery' ? galleryLoading
    : tab === 'leads' ? leadsLoading
    : tab === 'videos' ? videosLoading
    : tab === 'banners' ? bannersLoading
    : tab === 'spin360' ? spin360Loading
    : false;

  const tabs: { key: TabKey; icon: React.ElementType; label: string; count: number }[] = [
    { key: 'projects', icon: FileText, label: 'Projekte', count: regularProjects.length },
    { key: 'landings', icon: Layout, label: 'Landing Pages', count: landingProjects.length },
    { key: 'gallery', icon: Image, label: 'Galerie', count: tab === 'gallery' ? galleryTotal : (counts?.gallery ?? 0) },
    { key: 'videos', icon: Video, label: 'Videos', count: tab === 'videos' ? videos.length : (counts?.videos ?? 0) },
    { key: 'banners', icon: LayoutGrid, label: 'Banner', count: tab === 'banners' ? banners.length : (counts?.banners ?? 0) },
    { key: 'spin360', icon: RotateCw, label: '360° Spin', count: tab === 'spin360' ? spin360Jobs.length : (counts?.spin360 ?? 0) },
    { key: 'leads', icon: MessageSquare, label: 'Anfragen', count: tab === 'leads' ? leadsTotal : (counts?.leads ?? 0) },
  ];

  // ─── Render ─────────────────────────────────────────────────

  const renderTabContent = () => {
    if (isLoading) {
      return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" /></div>;
    }
    switch (tab) {
      case 'projects': return <ProjectsTab projects={regularProjects} onExport={openExportDialog} onDelete={(id) => deleteProject.mutate(id)} />;
      case 'landings': return <LandingsTab projects={landingProjects} onExport={openExportDialog} onDelete={(id) => deleteProject.mutate(id)} />;
      case 'gallery': return (
        <>
          <GalleryTab images={allImages} onLightbox={(folder, idx) => { setLightboxFolder(folder); setLightboxIndex(idx); }} highlightFolder={highlightFolder} />
          <Pagination page={galleryPage} setPage={setGalleryPage} total={galleryTotal} />
        </>
      );
      case 'videos': return <VideosTab videos={videos} onPlay={setPlayerVideo} onDownload={(v) => downloadFile(v.url, v.name)} onDelete={(name) => deleteVideo.mutate(name)} />;
      case 'banners': return <BannersTab banners={banners} onDownload={(b) => downloadFile(b.url, b.name)} onDelete={(fp, _name) => deleteBanner.mutate(fp)} />;
      case 'spin360': return <Spin360Tab jobs={spin360Jobs} onOpen={openSpinViewer} onDelete={(id) => deleteSpin360.mutate(id)} />;
      case 'leads': return (
        <>
          <LeadsTab leads={leads} onDelete={(id) => deleteLead.mutate(id)} />
          <Pagination page={leadsPage} setPage={setLeadsPage} total={leadsTotal} />
        </>
      );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {tabs.map(t => {
            const isDisabled = disabledTabs.has(t.key);
            return (
              <Button
                key={t.key}
                variant={tab === t.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => !isDisabled && setTab(t.key)}
                disabled={isDisabled}
                className={`whitespace-nowrap ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <t.icon className="w-4 h-4 mr-1.5" />
                {t.label} ({t.count})
                {isDisabled && <Lock className="w-3 h-3 ml-1.5" />}
              </Button>
            );
          })}
        </div>
        {renderTabContent()}
      </main>

      <ExportChoiceDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen} onChoose={handleExportHTML} loading={exportLoading} projectId={exportProject?.id} />

      <GalleryLightbox
        images={
          (lightboxFolder
            ? allImages.filter(img => (img.gallery_folder || 'Ohne Ordner') === lightboxFolder)
            : [...allImages]
          )
            .sort((a, b) => getImageSortKey(a.perspective) - getImageSortKey(b.perspective))
            .map(img => ({ id: img.id, src: getImageSrc(img), perspective: img.perspective, project_id: img.project_id }))
        }
        initialIndex={lightboxIndex}
        open={lightboxIndex >= 0}
        onClose={() => { setLightboxIndex(-1); setLightboxFolder(null); }}
        onAssigned={() => {}}
        onRegenerated={() => {}}
        onDeleted={() => {}}
      />

      {playerVideo && <VideoPlayerModal video={playerVideo} onClose={() => setPlayerVideo(null)} onDownload={(v) => downloadFile(v.url, v.name)} />}
      {viewerJobId && <SpinViewerModal loading={viewerLoading} frames={viewerFrames} onClose={() => { setViewerJobId(null); setViewerFrames([]); }} />}
    </div>
  );
};

export default Dashboard;
