import React, { useEffect, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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

import type { Project, ProjectImage, Lead, VideoFile, BannerFile, Spin360Job } from '@/components/dashboard/types';
import { getImageSrc } from '@/components/dashboard/types';
import ProjectsTab from '@/components/dashboard/ProjectsTab';
import LandingsTab from '@/components/dashboard/LandingsTab';
import GalleryTab from '@/components/dashboard/GalleryTab';
import VideosTab from '@/components/dashboard/VideosTab';
import BannersTab from '@/components/dashboard/BannersTab';
import Spin360Tab from '@/components/dashboard/Spin360Tab';
import LeadsTab from '@/components/dashboard/LeadsTab';
import VideoPlayerModal from '@/components/dashboard/VideoPlayerModal';
import SpinViewerModal from '@/components/dashboard/SpinViewerModal';

type TabKey = 'projects' | 'landings' | 'gallery' | 'banners' | 'videos' | 'leads' | 'spin360';

const Dashboard = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [allImages, setAllImages] = useState<ProjectImage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [banners, setBanners] = useState<BannerFile[]>([]);
  const initialTab = (searchParams.get('tab') as TabKey) || 'projects';
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [galleryLoaded, setGalleryLoaded] = useState(false);
  const [leadsLoaded, setLeadsLoaded] = useState(false);
  const [videosLoaded, setVideosLoaded] = useState(false);
  const [bannersLoaded, setBannersLoaded] = useState(false);
  const [spin360Jobs, setSpin360Jobs] = useState<Spin360Job[]>([]);
  const [spin360Loaded, setSpin360Loaded] = useState(false);
  const [viewerJobId, setViewerJobId] = useState<string | null>(null);
  const [viewerFrames, setViewerFrames] = useState<string[]>([]);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [counts, setCounts] = useState({ gallery: 0, videos: 0, leads: 0, banners: 0, spin360: 0 });
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportProject, setExportProject] = useState<Project | null>(null);
  const [playerVideo, setPlayerVideo] = useState<VideoFile | null>(null);

  const regularProjects = projects.filter(p => p.template_id !== 'landing-page');
  const landingProjects = projects.filter(p => p.template_id === 'landing-page');

  useEffect(() => { loadProjects(); loadCounts(); }, []);

  useEffect(() => {
    if (tab === 'gallery' && !galleryLoaded) loadGallery();
    if (tab === 'leads' && !leadsLoaded) loadLeads();
    if (tab === 'videos' && !videosLoaded) loadVideos();
    if (tab === 'banners' && !bannersLoaded) loadBanners();
    if (tab === 'spin360' && !spin360Loaded) loadSpin360();
  }, [tab]);

  // ─── Data Loading ───────────────────────────────────────────

  const loadCounts = async () => {
    const userId = user?.id;
    const [imgRes, leadsRes, videosRes, bannersRes] = await Promise.all([
      supabase.from('project_images').select('id', { count: 'exact', head: true }),
      supabase.from('leads').select('id', { count: 'exact', head: true }),
      userId ? supabase.storage.from('vehicle-images').list(`${userId}/videos`, { limit: 200 }) : Promise.resolve({ data: null }),
      userId ? supabase.storage.from('banners').list(userId, { limit: 200 }) : Promise.resolve({ data: null }),
    ]);
    const spinRes = await supabase.from('spin360_jobs').select('id', { count: 'exact', head: true });
    setCounts({
      gallery: imgRes.count ?? 0,
      leads: leadsRes.count ?? 0,
      videos: videosRes.data?.filter(f => f.name.endsWith('.mp4')).length ?? 0,
      banners: bannersRes.data?.filter(f => f.name.endsWith('.png')).length ?? 0,
      spin360: spinRes.count ?? 0,
    });
  };

  const loadProjects = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('projects')
      .select('id, title, template_id, vehicle_data, main_image_base64, main_image_url, html_content, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    setProjects((data as Project[]) || []);
    setLoading(false);
  };

  const loadGallery = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('project_images')
      .select('id, project_id, image_base64, image_url, perspective, gallery_folder, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200);
    setAllImages((data as ProjectImage[]) || []);
    setGalleryLoaded(true);
    setLoading(false);
  };

  const loadLeads = async () => {
    setLoading(true);
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(100);
    setLeads((data as Lead[]) || []);
    setLeadsLoaded(true);
    setLoading(false);
  };

  const loadVideos = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: files, error } = await supabase.storage
        .from('vehicle-images')
        .list(`${user.id}/videos`, { limit: 50, sortBy: { column: 'created_at', order: 'desc' } });
      if (error || !files) { setVideos([]); }
      else {
        setVideos(files.filter(f => f.name.endsWith('.mp4')).map(f => {
          const { data: urlData } = supabase.storage.from('vehicle-images').getPublicUrl(`${user.id}/videos/${f.name}`);
          return { name: f.name, url: urlData.publicUrl, created_at: f.created_at };
        }));
      }
    } catch { setVideos([]); }
    setVideosLoaded(true);
    setLoading(false);
  };

  const loadBanners = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: files, error } = await supabase.storage.from('banners').list(user.id, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
      if (error || !files) { setBanners([]); }
      else {
        setBanners(files.filter(f => f.name.endsWith('.png')).map(f => {
          const { data: urlData } = supabase.storage.from('banners').getPublicUrl(`${user.id}/${f.name}`);
          return { name: f.name, url: urlData.publicUrl, created_at: f.created_at, fullPath: `${user.id}/${f.name}` };
        }));
      }
    } catch { setBanners([]); }
    setBannersLoaded(true);
    setLoading(false);
  };

  const loadSpin360 = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('spin360_jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const now = Date.now();
    const staleMs = 5 * 60 * 1000;
    const jobs: Spin360Job[] = (data || []).map((job) => {
      const updatedAt = job.updated_at ? new Date(job.updated_at).getTime() : 0;
      const isStale = job.status !== 'completed' && job.status !== 'failed' && updatedAt > 0 && now - updatedAt > staleMs;
      return {
        id: job.id,
        status: job.status,
        created_at: job.created_at,
        updated_at: job.updated_at,
        error_message: job.error_message,
        manifest: job.manifest as Spin360Job['manifest'],
        displayStatus: isStale ? 'failed' : job.status,
        displayError: isStale ? (job.error_message || 'Pipeline wurde abgebrochen, weil sie nicht weitergelaufen ist.') : job.error_message,
      };
    });
    setSpin360Jobs(jobs);
    setSpin360Loaded(true);
  };

  // ─── Mutations ──────────────────────────────────────────────

  const runMutations = async (ops: Array<PromiseLike<{ error: { message: string } | null }>>) => {
    const results = await Promise.all(ops);
    const failed = results.find(r => r.error);
    if (failed?.error) throw failed.error;
  };

  const loadConversationIds = async (leadIds: string[], projectId?: string) => {
    const ids = new Set<string>();
    if (projectId) {
      const { data, error } = await supabase.from('sales_assistant_conversations').select('id').eq('project_id', projectId);
      if (error) throw error;
      data?.forEach(row => ids.add(row.id));
    }
    if (leadIds.length > 0) {
      const { data, error } = await supabase.from('sales_assistant_conversations').select('id').in('lead_id', leadIds);
      if (error) throw error;
      data?.forEach(row => ids.add(row.id));
    }
    return Array.from(ids);
  };

  const deleteConversationRelations = async (convIds: string[]) => {
    if (convIds.length === 0) return;
    await runMutations([
      supabase.from('sales_assistant_messages').delete().in('conversation_id', convIds),
      supabase.from('sales_assistant_tasks').delete().in('conversation_id', convIds),
      supabase.from('conversation_stage_log').delete().in('conversation_id', convIds),
      supabase.from('sales_email_outbox').delete().in('conversation_id', convIds),
      supabase.from('crm_manual_notes').delete().in('conversation_id', convIds),
      supabase.from('sales_notifications').delete().in('related_conversation_id', convIds),
      supabase.from('sales_quotes').delete().in('conversation_id', convIds),
      supabase.from('test_drive_bookings').delete().in('conversation_id', convIds),
      supabase.from('trade_in_valuations').delete().in('conversation_id', convIds),
    ]);
    await runMutations([supabase.from('sales_assistant_conversations').delete().in('id', convIds)]);
  };

  const deleteLeadRelations = async (leadIds: string[]) => {
    if (leadIds.length === 0) return;
    await runMutations([
      supabase.from('sales_email_outbox').delete().in('lead_id', leadIds),
      supabase.from('crm_manual_notes').delete().in('lead_id', leadIds),
      supabase.from('sales_notifications').delete().in('related_lead_id', leadIds),
      supabase.from('sales_quotes').delete().in('lead_id', leadIds),
      supabase.from('test_drive_bookings').delete().in('lead_id', leadIds),
      supabase.from('trade_in_valuations').delete().in('lead_id', leadIds),
    ]);
  };

  const deleteStorageFolder = async (bucket: 'vehicle-images' | 'banners', prefix: string) => {
    const files: string[] = [];
    const walk = async (path: string) => {
      const { data, error } = await supabase.storage.from(bucket).list(path, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
      if (error) throw error;
      for (const item of data || []) {
        const fullPath = path ? `${path}/${item.name}` : item.name;
        if ((item as { id?: string | null }).id) files.push(fullPath);
        else await walk(fullPath);
      }
    };
    await walk(prefix);
    for (let i = 0; i < files.length; i += 100) {
      const { error } = await supabase.storage.from(bucket).remove(files.slice(i, i + 100));
      if (error) throw error;
    }
  };

  const deleteProject = async (id: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: leadRows, error: leadError } = await supabase.from('leads').select('id').eq('project_id', id);
      if (leadError) throw leadError;
      const leadIds = leadRows?.map(r => r.id) || [];
      const convIds = await loadConversationIds(leadIds, id);
      await deleteConversationRelations(convIds);
      await deleteLeadRelations(leadIds);
      if (leadIds.length > 0) await runMutations([supabase.from('leads').delete().in('id', leadIds)]);
      await runMutations([
        supabase.from('image_generation_jobs').delete().eq('project_id', id),
        supabase.from('project_images').delete().eq('project_id', id),
        supabase.from('sales_quotes').delete().eq('project_id', id),
        supabase.from('test_drive_bookings').delete().eq('project_id', id),
        supabase.from('projects').delete().eq('id', id),
      ]);
      await deleteStorageFolder('vehicle-images', `${user.id}/${id}`);
      setProjects(prev => prev.filter(p => p.id !== id));
      setAllImages(prev => prev.filter(img => img.project_id !== id));
      await loadCounts();
      toast.success('Projekt vollständig gelöscht');
    } catch (error) {
      console.error('Delete project error:', error);
      toast.error('Projekt konnte nicht vollständig gelöscht werden');
    } finally { setLoading(false); }
  };

  const deleteLead = async (id: string) => {
    setLoading(true);
    try {
      const convIds = await loadConversationIds([id]);
      await deleteConversationRelations(convIds);
      await deleteLeadRelations([id]);
      await runMutations([supabase.from('leads').delete().eq('id', id)]);
      setLeads(prev => prev.filter(l => l.id !== id));
      await loadCounts();
      toast.success('Anfrage vollständig gelöscht');
    } catch (error) {
      console.error('Delete lead error:', error);
      toast.error('Anfrage konnte nicht vollständig gelöscht werden');
    } finally { setLoading(false); }
  };

  const deleteVideo = async (name: string) => {
    if (!user) return;
    const { error } = await supabase.storage.from('vehicle-images').remove([`${user.id}/videos/${name}`]);
    if (error) { toast.error('Fehler beim Löschen'); return; }
    toast.success('Video gelöscht');
    setVideos(prev => prev.filter(v => v.name !== name));
    await loadCounts();
  };

  const deleteBanner = async (fullPath: string, name: string) => {
    const { error } = await supabase.storage.from('banners').remove([fullPath]);
    if (error) { toast.error('Fehler beim Löschen'); return; }
    toast.success('Banner gelöscht');
    setBanners(prev => prev.filter(b => b.name !== name));
    await loadCounts();
  };

  // ─── Helpers ────────────────────────────────────────────────

  const downloadFile = (url: string, name: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.target = '_blank';
    a.click();
  };

  const downloadVideo = (video: VideoFile) => downloadFile(video.url, video.name);
  const downloadBanner = (banner: BannerFile) => downloadFile(banner.url, banner.name);

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
      setExportLoading(false);
      setExportDialogOpen(false);
      setExportProject(null);
    }
  };

  const openSpinViewer = async (jobId: string) => {
    setViewerJobId(jobId);
    setViewerLoading(true);
    setViewerFrames([]);
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

  // ─── Tab Config ─────────────────────────────────────────────

  const tabs: { key: TabKey; icon: React.ElementType; label: string; count: number }[] = [
    { key: 'projects', icon: FileText, label: 'Projekte', count: regularProjects.length },
    { key: 'landings', icon: Layout, label: 'Landing Pages', count: landingProjects.length },
    { key: 'gallery', icon: Image, label: 'Galerie', count: galleryLoaded ? allImages.length : counts.gallery },
    { key: 'videos', icon: Video, label: 'Videos', count: videosLoaded ? videos.length : counts.videos },
    { key: 'banners', icon: LayoutGrid, label: 'Banner', count: bannersLoaded ? banners.length : counts.banners },
    { key: 'spin360', icon: RotateCw, label: '360° Spin', count: spin360Loaded ? spin360Jobs.length : counts.spin360 },
    { key: 'leads', icon: MessageSquare, label: 'Anfragen', count: leadsLoaded ? leads.length : counts.leads },
  ];

  // ─── Render ─────────────────────────────────────────────────

  const renderTabContent = () => {
    if (loading) {
      return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" /></div>;
    }
    switch (tab) {
      case 'projects': return <ProjectsTab projects={regularProjects} onExport={openExportDialog} onDelete={deleteProject} />;
      case 'landings': return <LandingsTab projects={landingProjects} onExport={openExportDialog} onDelete={deleteProject} />;
      case 'gallery': return <GalleryTab images={allImages} onLightbox={setLightboxIndex} />;
      case 'videos': return <VideosTab videos={videos} onPlay={setPlayerVideo} onDownload={downloadVideo} onDelete={deleteVideo} />;
      case 'banners': return <BannersTab banners={banners} onDownload={downloadBanner} onDelete={deleteBanner} />;
      case 'spin360': return <Spin360Tab jobs={spin360Jobs} onOpen={openSpinViewer} />;
      case 'leads': return <LeadsTab leads={leads} onDelete={deleteLead} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {tabs.map(t => (
            <Button key={t.key} variant={tab === t.key ? 'default' : 'outline'} size="sm" onClick={() => setTab(t.key)} className="whitespace-nowrap">
              <t.icon className="w-4 h-4 mr-1.5" /> {t.label} ({t.count})
            </Button>
          ))}
        </div>
        {renderTabContent()}
      </main>

      <ExportChoiceDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen} onChoose={handleExportHTML} loading={exportLoading} projectId={exportProject?.id} />

      <GalleryLightbox
        images={allImages.map(img => ({ id: img.id, src: getImageSrc(img), perspective: img.perspective, project_id: img.project_id }))}
        initialIndex={lightboxIndex}
        open={lightboxIndex >= 0}
        onClose={() => setLightboxIndex(-1)}
        onAssigned={() => loadGallery()}
        onRegenerated={() => loadGallery()}
      />

      {playerVideo && <VideoPlayerModal video={playerVideo} onClose={() => setPlayerVideo(null)} onDownload={downloadVideo} />}
      {viewerJobId && <SpinViewerModal loading={viewerLoading} frames={viewerFrames} onClose={() => { setViewerJobId(null); setViewerFrames([]); }} />}
    </div>
  );
};

export default Dashboard;
