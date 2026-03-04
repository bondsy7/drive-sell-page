import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Car, Plus, Image, FileText, Download, ExternalLink, Trash2, LogOut, User, MessageSquare, Mail, Phone, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { downloadHTML } from '@/lib/templates/download';

interface Project {
  id: string;
  title: string;
  template_id: string;
  vehicle_data: any;
  main_image_base64: string | null;
  html_content: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectImage {
  id: string;
  project_id: string;
  image_base64: string;
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

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [allImages, setAllImages] = useState<ProjectImage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tab, setTab] = useState<'projects' | 'gallery' | 'leads'>('projects');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (tab === 'gallery' && allImages.length === 0 && !galleryLoaded) {
      loadGallery();
    }
    if (tab === 'leads' && leads.length === 0 && !leadsLoaded) {
      loadLeads();
    }
  }, [tab]);

  const [galleryLoaded, setGalleryLoaded] = useState(false);
  const [leadsLoaded, setLeadsLoaded] = useState(false);

  const loadProjects = async () => {
    setLoading(true);
    const { data: p } = await supabase
      .from('projects')
      .select('id, title, template_id, vehicle_data, main_image_base64, created_at, updated_at')
      .order('updated_at', { ascending: false });
    setProjects((p as Project[]) || []);
    setLoading(false);
  };

  const loadGallery = async () => {
    setLoading(true);
    const { data: img } = await supabase
      .from('project_images')
      .select('id, project_id, image_base64, perspective, created_at')
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

  const downloadImage = (base64: string, name: string) => {
    const a = document.createElement('a');
    a.href = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
    a.download = name;
    a.click();
  };

  const handleExportHTML = (project: Project) => {
    if (!project.html_content) { toast.error('Keine HTML-Daten vorhanden'); return; }
    const vd = project.vehicle_data as any;
    const filename = `${vd?.vehicle?.brand || 'fahrzeug'}-${vd?.vehicle?.model || 'page'}.html`;
    downloadHTML(project.html_content, filename);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center">
              <Car className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="font-display font-bold text-foreground text-sm">AutoPage</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button size="sm" className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Neues Projekt</Button>
            </Link>
            <Link to="/leasing-rechner">
              <Button variant="outline" size="sm" className="gap-1.5"><Calculator className="w-3.5 h-3.5" /> Leasing-Rechner</Button>
            </Link>
            <Link to="/profile">
              <Button variant="ghost" size="icon"><User className="w-4 h-4" /></Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="w-4 h-4" /></Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex gap-2 mb-6">
          <Button variant={tab === 'projects' ? 'default' : 'outline'} size="sm" onClick={() => setTab('projects')}>
            <FileText className="w-4 h-4 mr-1.5" /> Projekte ({projects.length})
          </Button>
          <Button variant={tab === 'gallery' ? 'default' : 'outline'} size="sm" onClick={() => setTab('gallery')}>
            <Image className="w-4 h-4 mr-1.5" /> Bildergalerie ({allImages.length})
          </Button>
          <Button variant={tab === 'leads' ? 'default' : 'outline'} size="sm" onClick={() => setTab('leads')}>
            <MessageSquare className="w-4 h-4 mr-1.5" /> Anfragen ({leads.length})
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
                    {p.main_image_base64 && (
                      <div className="aspect-video bg-muted overflow-hidden">
                        <img src={p.main_image_base64.startsWith('data:') ? p.main_image_base64 : `data:image/png;base64,${p.main_image_base64}`} alt={p.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-4 space-y-2">
                      <h3 className="font-display font-semibold text-foreground text-sm truncate">{vd?.vehicle?.brand} {vd?.vehicle?.model}</h3>
                      <p className="text-xs text-muted-foreground">{vd?.vehicle?.variant}</p>
                      <p className="text-xs text-muted-foreground">{new Date(p.updated_at).toLocaleDateString('de-DE')}</p>
                      <div className="flex gap-1.5 pt-1">
                        <Link to={`/project/${p.id}`}><Button variant="outline" size="sm"><ExternalLink className="w-3.5 h-3.5" /></Button></Link>
                        <Button variant="outline" size="sm" onClick={() => handleExportHTML(p)}><Download className="w-3.5 h-3.5" /></Button>
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
              {allImages.map(img => (
                <div key={img.id} className="bg-card rounded-lg border border-border overflow-hidden group relative">
                  <div className="aspect-video bg-muted">
                    <img src={img.image_base64.startsWith('data:') ? img.image_base64 : `data:image/png;base64,${img.image_base64}`} alt={img.perspective || 'Fahrzeugbild'} className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Button size="sm" variant="secondary" onClick={() => downloadImage(img.image_base64, `${img.perspective || 'bild'}.png`)}>
                      <Download className="w-3.5 h-3.5 mr-1" /> Download
                    </Button>
                  </div>
                  {img.perspective && <p className="text-xs text-muted-foreground p-2">{img.perspective}</p>}
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
    </div>
  );
};

export default Dashboard;
