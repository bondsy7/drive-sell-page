import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Layout } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import LandingPagePreview from '@/components/LandingPagePreview';
import LandingPageEditor from '@/components/LandingPageEditor';
import TemplateSidebar from '@/components/TemplateSidebar';

import type { VehicleData } from '@/types/vehicle';
import type { TemplateId } from '@/types/template';

const ProjectView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [images, setImages] = useState<string[]>([]);
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('autohaus');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('project_images').select('*').eq('project_id', id).order('sort_order'),
    ]).then(([{ data: p }, { data: imgs }]) => {
      if (p) {
        setProject(p);
        setVehicleData(p.vehicle_data as unknown as VehicleData);
        setSelectedTemplate((p.template_id || 'autohaus') as TemplateId);
      }
      if (imgs) setImages(imgs.map((i: any) => i.image_url || i.image_base64));
      setLoading(false);
    });
  }, [id]);

  const handleDataChange = async (data: VehicleData) => {
    setVehicleData(data);
    if (id) {
      await supabase.from('projects').update({
        vehicle_data: data as any,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
    }
  };

  const handleTemplateChange = async (t: TemplateId) => {
    setSelectedTemplate(t);
    if (id) {
      await supabase.from('projects').update({ template_id: t, updated_at: new Date().toISOString() }).eq('id', id);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" /></div>;
  if (!project || !vehicleData) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Projekt nicht gefunden</p></div>;

  // ─── Landing Page type → show dedicated editor ───
  const vd = project.vehicle_data as any;
  const isLandingPage = project.template_id === 'landing-page' && vd?.type === 'landing-page';

  if (isLandingPage) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          <LandingPageEditor
            projectId={id!}
            initialContent={vd.pageContent}
            initialImages={vd.imageMap || {}}
            dealer={vd.dealer || {}}
            brand={vd.brand || ''}
            model={vd.model || ''}
            brandLogoUrl={vd.brandLogoUrl}
            onBack={() => navigate('/dashboard?tab=landings')}
          />
        </main>
      </div>
    );
  }

  // ─── Regular project → template-based preview ───
  const mainImage = (project as any).main_image_url || project.main_image_base64 || images[0] || null;
  const galleryImages = images.length > 1 ? images.slice(1) : [];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader leftActions={
        <Button variant="ghost" size="icon" className="lg:hidden shrink-0" onClick={() => setSidebarOpen(true)}>
          <Layout className="w-4 h-4" />
        </Button>
      } />

      <div className="flex h-[calc(100vh-56px)]">
        <TemplateSidebar
          selectedTemplate={selectedTemplate}
          onSelectTemplate={handleTemplateChange}
          vehicleData={vehicleData}
          open={sidebarOpen}
          onOpen={() => setSidebarOpen(true)}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 sm:py-10">
          <div className="max-w-7xl mx-auto">
            <LandingPagePreview
              vehicleData={vehicleData}
              imageBase64={mainImage}
              galleryImages={galleryImages}
              onReset={() => {}}
              onDataChange={handleDataChange}
              selectedTemplate={selectedTemplate}
              projectId={id}
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default ProjectView;
