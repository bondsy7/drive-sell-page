import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Image, FileText, Download, ExternalLink, Trash2, MessageSquare, Mail, Phone, Video, Play, X, LayoutGrid, Layout } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import { toast } from 'sonner';
import { downloadHTML } from '@/lib/templates/download';
import { embedCO2LabelsInHTML } from '@/lib/templates/shared';
import { compressToWebP } from '@/lib/storage-utils';
import ExportChoiceDialog, { type ExportMode } from '@/components/ExportChoiceDialog';
import GalleryLightbox from '@/components/GalleryLightbox';
import { useSearchParams } from 'react-router-dom';

interface Project {
  id: string;
  title: string;
  template_id: string;
  vehicle_data: any;
  main_image_base64: string | null;
  main_image_url: string | null;
  html_content: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectImage {
  id: string;
  project_id: string;
  image_base64: string;
  image_url: string | null;
  perspective: string | null;
  created_at: string;
}

interface Lead {
  id: string;
  project_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  vehicle_title: string | null;
  created_at: string;
}

interface VideoFile {
  name: string;
  url: string;
  created_at: string;
}

interface BannerFile {
  name: string;
  url: string;
  created_at: string;
  fullPath: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [allImages, setAllImages] = useState<ProjectImage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [banners, setBanners] = useState<BannerFile[]>([]);
  const initialTab = (searchParams.get('tab') as any) || 'projects';
  const [tab, setTab] = useState<'projects' | 'gallery' | 'banners' | 'videos' | 'leads'>(initialTab);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState(-1);

  const [galleryLoaded, setGalleryLoaded] = useState(false);
  const [leadsLoaded, setLeadsLoaded] = useState(false);
  const [videosLoaded, setVideosLoaded] = useState(false);
  const [bannersLoaded, setBannersLoaded] = useState(false);
  const [counts, setCounts] = useState({ gallery: 0, videos: 0, leads: 0, banners: 0 });

  useEffect(() => {
    loadProjects();
    loadCounts();
  }, []);

  useEffect(() => {
    if (tab === 'gallery' && !galleryLoaded) loadGallery();
    if (tab === 'leads' && !leadsLoaded) loadLeads();
    if (tab === 'videos' && !videosLoaded) loadVideos();
    if (tab === 'banners' && !bannersLoaded) loadBanners();
  }, [tab]);

  const loadCounts = async () => {
    const userId = user?.id;
    const [imgRes, leadsRes, videosRes, bannersRes] = await Promise.all([
      supabase.from('project_images').select('id', { count: 'exact', head: true }),
      supabase.from('leads').select('id', { count: 'exact', head: true }),
      supabase.storage.from('vehicle-images').list('videos', { limit: 200 }),
      userId ? supabase.storage.from('banners').list(userId, { limit: 200 }) : Promise.resolve({ data: null }),
    ]);
    setCounts({
      gallery: imgRes.count ?? 0,
      leads: leadsRes.count ?? 0,
      videos: videosRes.data?.filter(f => f.name.endsWith('.mp4')).length ?? 0,
      banners: bannersRes.data?.filter(f => f.name.endsWith('.png')).length ?? 0,
    });
  };

  const loadProjects = async () => {
    setLoading(true);
    const { data: p } = await supabase
      .from('projects')
      .select('id, title, template_id, vehicle_data, main_image_base64, main_image_url, html_content, created_at, updated_at')
      .order('updated_at', { ascending: false });
    setProjects((p as Project[]) || []);
    setLoading(false);
  };

  const loadGallery = async () => {
    setLoading(true);
    const { data: img } = await supabase
      .from('project_images')
      .select('id, project_id, image_base64, image_url, perspective, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    setAllImages((img as ProjectImage[]) || []);
    setGalleryLoaded(true);
    setLoading(false);
  };

  const loadLeads = async () => {
    setLoading(true);
    const { data: l } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setLeads((l as Lead[]) || []);
    setLeadsLoaded(true);
    setLoading(false);
  };

  const loadVideos = async () => {
    setLoading(true);
    try {
      const { data: files, error } = await supabase.storage
        .from('vehicle-images')
        .list('videos', { limit: 50, sortBy: { column: 'created_at', order: 'desc' } });

      if (error || !files) {
        setVideos([]);
      } else {
        const videoFiles: VideoFile[] = files
          .filter(f => f.name.endsWith('.mp4'))
          .map(f => {
            const { data: urlData } = supabase.storage.from('vehicle-images').getPublicUrl(`videos/${f.name}`);
            return {
              name: f.name,
              url: urlData.publicUrl,
              created_at: f.created_at,
            };
          });
        setVideos(videoFiles);
      }
    } catch {
      setVideos([]);
    }
    setVideosLoaded(true);
    setLoading(false);
  };

  const loadBanners = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: files, error } = await supabase.storage
        .from('banners')
        .list(user.id, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
      if (error || !files) {
        setBanners([]);
      } else {
        const bannerFiles: BannerFile[] = files
          .filter(f => f.name.endsWith('.png'))
          .map(f => {
            const { data: urlData } = supabase.storage.from('banners').getPublicUrl(`${user.id}/${f.name}`);
            return { name: f.name, url: urlData.publicUrl, created_at: f.created_at, fullPath: `${user.id}/${f.name}` };
          });
        setBanners(bannerFiles);
      }
    } catch {
      setBanners([]);
    }
    setBannersLoaded(true);
    setLoading(false);
  };

  const loadData = async () => {
    await loadProjects();
    if (tab === 'gallery') await loadGallery();
  };

  const deleteProject = async (id: string) => {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) { toast.error('Fehler beim Löschen'); return; }
    toast.success('Projekt gelöscht');
    setProjects(prev => prev.filter(p => p.id !== id));
    setAllImages(prev => prev.filter(i => i.project_id !== id));
  };

  const deleteLead = async (id: string) => {
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) { toast.error('Fehler beim Löschen'); return; }
    toast.success('Anfrage gelöscht');
    setLeads(prev => prev.filter(l => l.id !== id));
  };

  const deleteVideo = async (name: string) => {
    const { error } = await supabase.storage.from('vehicle-images').remove([`videos/${name}`]);
    if (error) { toast.error('Fehler beim Löschen'); return; }
    toast.success('Video gelöscht');
    setVideos(prev => prev.filter(v => v.name !== name));
  };

  const deleteBanner = async (fullPath: string, name: string) => {
    const { error } = await supabase.storage.from('banners').remove([fullPath]);
    if (error) { toast.error('Fehler beim Löschen'); return; }
    toast.success('Banner gelöscht');
    setBanners(prev => prev.filter(b => b.name !== name));
  };

  const downloadBanner = (banner: BannerFile) => {
    const a = document.createElement('a');
    a.href = banner.url;
    a.download = banner.name;
    a.target = '_blank';
    a.click();
  };

  const downloadImage = (img: ProjectImage) => {
    const src = img.image_url || img.image_base64;
    const a = document.createElement('a');
    a.href = src.startsWith('data:') ? src : src.startsWith('http') ? src : `data:image/png;base64,${src}`;
    a.download = `${img.perspective || 'bild'}.png`;
    a.click();
  };

  const downloadVideo = (video: VideoFile) => {
    const a = document.createElement('a');
    a.href = video.url;
    a.download = video.name;
    a.target = '_blank';
    a.click();
  };

  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportProject, setExportProject] = useState<Project | null>(null);
  const [playerVideo, setPlayerVideo] = useState<VideoFile | null>(null);

  const openExportDialog = (project: Project) => {
    if (!project.html_content) { toast.error('Keine HTML-Daten vorhanden'); return; }
    setExportProject(project);
    setExportDialogOpen(true);
  };

  const handleExportHTML = async (mode: ExportMode) => {
    if (!exportProject?.html_content) return;
    setExportLoading(true);
    try {
      const vd = exportProject.vehicle_data as any;
      const filename = `${vd?.vehicle?.brand || 'fahrzeug'}-${vd?.vehicle?.model || 'page'}.html`;
      let html = exportProject.html_content;

      if (mode === 'offline') {
        const imgRegex = /<img\s+[^>]*src="(https?:\/\/[^"]+)"[^>]*>/g;
        const matches = [...html.matchAll(imgRegex)];
        const uniqueUrls = [...new Set(matches.map(m => m[1]))];
        const urlMap = new Map<string, string>();
        await Promise.all(uniqueUrls.map(async (url) => {
          const webp = await compressToWebP(url);
          urlMap.set(url, webp);
        }));
        for (const [url, webp] of urlMap) {
          html = html.split(`src="${url}"`).join(`src="${webp}"`);
        }
      }

      html = await embedCO2LabelsInHTML(html);
      downloadHTML(html, filename);
    } finally {
      setExportLoading(false);
      setExportDialogOpen(false);
      setExportProject(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          <Button variant={tab === 'projects' ? 'default' : 'outline'} size="sm" onClick={() => setTab('projects')} className="whitespace-nowrap">
            <FileText className="w-4 h-4 mr-1.5" /> Projekte ({projects.length})
          </Button>
          <Button variant={tab === 'gallery' ? 'default' : 'outline'} size="sm" onClick={() => setTab('gallery')} className="whitespace-nowrap">
            <Image className="w-4 h-4 mr-1.5" /> Galerie ({galleryLoaded ? allImages.length : counts.gallery})
          </Button>
          <Button variant={tab === 'videos' ? 'default' : 'outline'} size="sm" onClick={() => setTab('videos')} className="whitespace-nowrap">
            <Video className="w-4 h-4 mr-1.5" /> Videos ({videosLoaded ? videos.length : counts.videos})
          </Button>
          <Button variant={tab === 'banners' ? 'default' : 'outline'} size="sm" onClick={() => setTab('banners')} className="whitespace-nowrap">
            <LayoutGrid className="w-4 h-4 mr-1.5" /> Banner ({bannersLoaded ? banners.length : counts.banners})
          </Button>
          <Button variant={tab === 'leads' ? 'default' : 'outline'} size="sm" onClick={() => setTab('leads')} className="whitespace-nowrap">
            <MessageSquare className="w-4 h-4 mr-1.5" /> Anfragen ({leadsLoaded ? leads.length : counts.leads})
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" /></div>
        ) : tab === 'projects' ? (
          projects.length === 0 ? (
            <div className="text-center py-20 space-y-3">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">Noch keine Projekte erstellt.</p>
              <Link to="/"><Button>Erstes Projekt erstellen</Button></Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map(p => {
                const vd = p.vehicle_data as any;
                return (
                  <div key={p.id} className="bg-card rounded-xl border border-border overflow-hidden group">
                    {(p.main_image_url || p.main_image_base64) && (
                      <div className="aspect-video bg-muted overflow-hidden">
                        <img src={p.main_image_url || (p.main_image_base64!.startsWith('data:') ? p.main_image_base64! : `data:image/png;base64,${p.main_image_base64}`)} alt={p.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-semibold text-foreground text-sm truncate">{vd?.vehicle?.brand} {vd?.vehicle?.model}</h3>
                        {(() => {
                          const cat = (vd?.category || '').toLowerCase();
                          if (cat.includes('leasing')) return <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 whitespace-nowrap">Leasing</span>;
                          if (cat.includes('finanzierung') || cat.includes('kredit')) return <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 whitespace-nowrap">Finanzierung</span>;
                          if (cat.includes('barkauf') || cat.includes('kauf') || cat.includes('neuwagen') || cat.includes('gebrauchtwagen') || cat.includes('tageszulassung')) return <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 whitespace-nowrap">Kauf</span>;
                          return null;
                        })()}
                      </div>
                      <p className="text-xs text-muted-foreground">{vd?.vehicle?.variant}</p>
                      {vd?.finance?.monthlyRate && (
                        <p className="text-sm font-semibold text-foreground">{vd.finance.monthlyRate} <span className="text-xs font-normal text-muted-foreground">/ Monat</span></p>
                      )}
                      <p className="text-xs text-muted-foreground">{new Date(p.updated_at).toLocaleDateString('de-DE')}</p>
                      <div className="flex gap-1.5 pt-1">
                        <Link to={`/project/${p.id}`}><Button variant="outline" size="sm"><ExternalLink className="w-3.5 h-3.5" /></Button></Link>
                        <Button variant="outline" size="sm" onClick={() => openExportDialog(p)}><Download className="w-3.5 h-3.5" /></Button>
                        <Button variant="outline" size="sm" onClick={() => deleteProject(p.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : tab === 'gallery' ? (
          allImages.length === 0 ? (
            <div className="text-center py-20 space-y-3">
              <Image className="w-12 h-12 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">Noch keine Bilder generiert.</p>
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {allImages.map((img, idx) => {
                const imgSrc = img.image_url || (img.image_base64.startsWith('data:') ? img.image_base64 : `data:image/png;base64,${img.image_base64}`);
                return (
                <div key={img.id} className="bg-card rounded-lg border border-border overflow-hidden group relative cursor-pointer" onClick={() => setLightboxIndex(idx)}>
                  <div className="aspect-video bg-muted">
                    <img src={imgSrc} alt={img.perspective || 'Fahrzeugbild'} className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span className="text-sm font-medium text-background">Öffnen</span>
                  </div>
                  {img.perspective && <p className="text-xs text-muted-foreground p-2">{img.perspective}</p>}
                </div>
                );
              })}
            </div>
          )
        ) : tab === 'videos' ? (
          videos.length === 0 ? (
            <div className="text-center py-20 space-y-3">
              <Video className="w-12 h-12 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">Noch keine Videos generiert.</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">Generierte Videos aus dem Video-Generator erscheinen hier automatisch.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map(video => (
                <div key={video.name} className="bg-card rounded-xl border border-border overflow-hidden group">
                  <div className="aspect-video bg-muted relative cursor-pointer" onClick={() => setPlayerVideo(video)}>
                    <video
                      src={video.url}
                      className="w-full h-full object-cover"
                      muted
                      loop
                      playsInline
                      onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                      onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-foreground/20">
                      <div className="bg-background/80 backdrop-blur rounded-full p-3">
                        <Play className="w-6 h-6 text-foreground" />
                      </div>
                    </div>
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {video.created_at ? new Date(video.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Video'}
                    </p>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => downloadVideo(video)}>
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => deleteVideo(video.name)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : tab === 'banners' ? (
          banners.length === 0 ? (
            <div className="text-center py-20 space-y-3">
              <LayoutGrid className="w-12 h-12 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">Noch keine Banner generiert.</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">Generierte Banner aus dem Banner Generator werden hier automatisch gespeichert.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {banners.map(banner => (
                <div key={banner.name} className="bg-card rounded-xl border border-border overflow-hidden group">
                  <div className="aspect-video bg-muted overflow-hidden">
                    <img src={banner.url} alt={banner.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {banner.created_at ? new Date(banner.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Banner'}
                    </p>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => downloadBanner(banner)}>
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => deleteBanner(banner.fullPath, banner.name)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          leads.length === 0 ? (
            <div className="text-center py-20 space-y-3">
              <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">Noch keine Anfragen eingegangen.</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">Sobald ein Interessent das Kontaktformular auf einer Ihrer Angebotsseiten ausfüllt, erscheint die Anfrage hier.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {leads.map(lead => (
                <div key={lead.id} className="bg-card rounded-xl border border-border p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-display font-semibold text-foreground text-sm">{lead.name}</h3>
                        {lead.vehicle_title && (
                          <span className="text-[10px] font-medium bg-accent/10 text-accent px-2 py-0.5 rounded-full truncate max-w-[200px]">
                            {lead.vehicle_title}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-2">
                        <a href={`mailto:${lead.email}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
                          <Mail className="w-3 h-3" /> {lead.email}
                        </a>
                        {lead.phone && (
                          <a href={`tel:${lead.phone}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
                            <Phone className="w-3 h-3" /> {lead.phone}
                          </a>
                        )}
                        <span>{new Date(lead.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {lead.message && (
                        <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 mt-2">{lead.message}</p>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteLead(lead.id)} className="shrink-0">
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </main>
      <ExportChoiceDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen} onChoose={handleExportHTML} loading={exportLoading} projectId={exportProject?.id} />

      {/* Gallery Lightbox */}
      <GalleryLightbox
        images={allImages.map(img => ({
          id: img.id,
          src: img.image_url || (img.image_base64.startsWith('data:') ? img.image_base64 : `data:image/png;base64,${img.image_base64}`),
          perspective: img.perspective,
          project_id: img.project_id,
        }))}
        initialIndex={lightboxIndex}
        open={lightboxIndex >= 0}
        onClose={() => setLightboxIndex(-1)}
        onAssigned={() => loadGallery()}
      />

      {/* Video Player Modal */}
      {playerVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm" onClick={() => setPlayerVideo(null)}>
          <div className="relative w-full max-w-3xl mx-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPlayerVideo(null)}
              className="absolute -top-10 right-0 text-background hover:text-background/80 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <video
              src={playerVideo.url}
              controls
              autoPlay
              className="w-full rounded-xl shadow-2xl"
            />
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-background/70">
                {playerVideo.created_at ? new Date(playerVideo.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
              </p>
              <Button variant="secondary" size="sm" onClick={() => downloadVideo(playerVideo)} className="gap-1.5">
                <Download className="w-3.5 h-3.5" /> Herunterladen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
