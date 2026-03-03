import React from 'react';
import { TEMPLATES, TemplateId, TemplateInfo } from '@/types/template';
import { Layout } from 'lucide-react';

interface TemplateSidebarProps {
  selectedTemplate: TemplateId;
  onSelectTemplate: (id: TemplateId) => void;
}

const TemplateCard: React.FC<{ template: TemplateInfo; isSelected: boolean; onClick: () => void }> = ({ template, isSelected, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full text-left rounded-xl p-3 transition-all border-2 ${
      isSelected
        ? 'border-accent bg-accent/10 shadow-sm'
        : 'border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/50'
    }`}
  >
    {/* Mini preview swatch */}
    <div
      className="w-full h-20 rounded-lg mb-2 flex items-center justify-center relative overflow-hidden"
      style={{
        background: template.previewStyle === 'dark' ? '#141414' : '#f4f5f7',
      }}
    >
      {/* Simulated layout blocks */}
      <div className="flex gap-1.5 w-full px-3">
        <div
          className="h-12 rounded-md flex-1"
          style={{ background: template.previewStyle === 'dark' ? '#222' : '#ddd' }}
        />
        <div className="flex flex-col gap-1 flex-1">
          <div
            className="h-2 rounded-full w-3/4"
            style={{ background: template.accent }}
          />
          <div
            className="h-1.5 rounded-full w-full"
            style={{ background: template.previewStyle === 'dark' ? '#333' : '#ccc' }}
          />
          <div
            className="h-1.5 rounded-full w-2/3"
            style={{ background: template.previewStyle === 'dark' ? '#333' : '#ccc' }}
          />
          <div
            className="h-3 rounded mt-1 w-1/2"
            style={{ background: template.accent }}
          />
        </div>
      </div>
    </div>
    <div className="font-semibold text-xs text-foreground">{template.name}</div>
    <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{template.description}</div>
  </button>
);

const TemplateSidebar: React.FC<TemplateSidebarProps> = ({ selectedTemplate, onSelectTemplate }) => {
  return (
    <div className="w-56 shrink-0 bg-card border-r border-border p-4 overflow-y-auto h-full">
      <div className="flex items-center gap-2 mb-4">
        <Layout className="w-4 h-4 text-accent" />
        <span className="font-display font-semibold text-sm text-foreground">Templates</span>
      </div>
      <div className="space-y-3">
        {TEMPLATES.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            isSelected={selectedTemplate === t.id}
            onClick={() => onSelectTemplate(t.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default TemplateSidebar;
