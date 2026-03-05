import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Car, ArrowLeft, Layout } from 'lucide-react';
import { toast } from 'sonner';
import LandingPagePreview from '@/components/LandingPagePreview';
import TemplateSidebar from '@/components/TemplateSidebar';

import type { VehicleData } from '@/types/vehicle';
import type { TemplateId } from '@/types/template';

const ProjectView = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<any>(null);
  const [images, setImages] = useState<string[]>([]);
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('modern');
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
        setSelectedTemplate((p.template_id || 'modern') as TemplateId);
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

  const mainImage = (project as any).main_image_url || project.main_image_base64 || images[0] || null;
  const galleryImages = images.length > 1 ? images.slice(1) : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link to="/dashboard"><Button variant="ghost" size="icon" className="shrink-0"><ArrowLeft className="w-4 h-4" /></Button></Link>
            {/* Mobile sidebar toggle */}
            <Button variant="ghost" size="icon" className="lg:hidden shrink-0" onClick={() => setSidebarOpen(true)}>
              <Layout className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center shrink-0">
                <Car className="w-4 h-4 text-accent-foreground" />
              </div>
              <span className="font-display font-bold text-foreground text-sm truncate">{vehicleData.vehicle.brand} {vehicleData.vehicle.model}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-56px)]">
        <TemplateSidebar
          selectedTemplate={selectedTemplate}
          onSelectTemplate={handleTemplateChange}
          vehicleData={vehicleData}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex-1 overflow-y-auto px-3 sm:px-4 py-6 sm:py-10">
          <div className="max-w-5xl mx-auto">
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
