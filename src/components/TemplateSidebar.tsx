import React from 'react';
import { TEMPLATES, TemplateId, TemplateInfo } from '@/types/template';
import { Layout } from 'lucide-react';
import LeasingCalculatorPanel from '@/components/LeasingCalculatorPanel';
import type { VehicleData } from '@/types/vehicle';

interface TemplateSidebarProps {
  selectedTemplate: TemplateId;
  onSelectTemplate: (id: TemplateId) => void;
  vehicleData?: VehicleData | null;
}

const TemplateCard: React.FC<{ template: TemplateInfo; isSelected: boolean; onClick: () => void }> = ({ template, isSelected, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full text-left rounded-xl p-3 transition-all border ${
      isSelected
        ? 'border-sidebar-primary bg-sidebar-accent shadow-sm ring-1 ring-sidebar-primary/30'
        : 'border-sidebar-border bg-sidebar-accent/30 hover:border-sidebar-primary/40 hover:bg-sidebar-accent/60'
    }`}
  >
    <div
      className="w-full h-16 rounded-lg mb-2 flex items-center justify-center relative overflow-hidden"
      style={{ background: template.previewStyle === 'dark' ? '#0f1629' : '#f0f4f8' }}
    >
      <div className="flex gap-1.5 w-full px-3">
        <div className="h-10 rounded-md flex-1" style={{ background: template.previewStyle === 'dark' ? '#1a2540' : '#dde3ed' }} />
        <div className="flex flex-col gap-1 flex-1">
          <div className="h-2 rounded-full w-3/4" style={{ background: template.accent }} />
          <div className="h-1.5 rounded-full w-full" style={{ background: template.previewStyle === 'dark' ? '#2a3550' : '#c8d0dc' }} />
          <div className="h-1.5 rounded-full w-2/3" style={{ background: template.previewStyle === 'dark' ? '#2a3550' : '#c8d0dc' }} />
        </div>
      </div>
    </div>
    <div className="font-semibold text-xs text-sidebar-foreground">{template.name}</div>
    <div className="text-[10px] text-sidebar-foreground/50 leading-tight mt-0.5">{template.description}</div>
  </button>
);

const TemplateSidebar: React.FC<TemplateSidebarProps> = ({ selectedTemplate, onSelectTemplate, vehicleData }) => {
  return (
    <div className="w-56 shrink-0 bg-sidebar border-r border-sidebar-border p-4 overflow-y-auto h-full">
      <div className="flex items-center gap-2 mb-4">
        <Layout className="w-4 h-4 text-sidebar-primary" />
        <span className="font-display font-semibold text-sm text-sidebar-foreground">Templates</span>
      </div>
      <div className="space-y-3">
        {TEMPLATES.map((t) => (
          <TemplateCard key={t.id} template={t} isSelected={selectedTemplate === t.id} onClick={() => onSelectTemplate(t.id)} />
        ))}
      </div>
      {vehicleData && <LeasingCalculatorPanel vehicleData={vehicleData} />}
    </div>
  );
};

export default TemplateSidebar;