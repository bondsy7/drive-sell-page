import React, { useEffect, useRef, useCallback } from 'react';
import { TEMPLATES, TemplateId, TemplateInfo } from '@/types/template';
import { Layout, X } from 'lucide-react';
import LeasingCalculatorPanel from '@/components/LeasingCalculatorPanel';
import FinancingCalculatorPanel from '@/components/FinancingCalculatorPanel';
import KfzSteuerPanel from '@/components/KfzSteuerPanel';
import type { VehicleData } from '@/types/vehicle';

interface TemplateSidebarProps {
  selectedTemplate: TemplateId;
  onSelectTemplate: (id: TemplateId) => void;
  vehicleData?: VehicleData | null;
  open?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
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

const SidebarContent: React.FC<Omit<TemplateSidebarProps, 'open'>> = ({ selectedTemplate, onSelectTemplate, vehicleData, onClose }) => (
  <div className="p-4 overflow-y-auto h-full">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Layout className="w-4 h-4 text-sidebar-primary" />
        <span className="font-display font-semibold text-sm text-sidebar-foreground">Templates</span>
      </div>
      {onClose && (
        <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
    <div className="space-y-3">
      {TEMPLATES.map((t) => (
        <TemplateCard key={t.id} template={t} isSelected={selectedTemplate === t.id} onClick={() => { onSelectTemplate(t.id); onClose?.(); }} />
      ))}
    </div>
    {vehicleData && <LeasingCalculatorPanel vehicleData={vehicleData} />}
    {vehicleData && <FinancingCalculatorPanel vehicleData={vehicleData} />}
    {vehicleData && <KfzSteuerPanel vehicleData={vehicleData} />}
  </div>
);

const TemplateSidebar: React.FC<TemplateSidebarProps> = ({ selectedTemplate, onSelectTemplate, vehicleData, open, onOpen, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Swipe from left edge to open
  useEffect(() => {
    if (!onOpen) return;
    const handleTouchStart = (e: TouchEvent) => {
      const x = e.touches[0].clientX;
      if (x < 24 && !open) {
        touchStartX.current = x;
        touchStartY.current = e.touches[0].clientY;
      }
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = Math.abs(e.changedTouches[0].clientY - (touchStartY.current || 0));
      if (dx > 50 && dy < 100) onOpen();
      touchStartX.current = null;
      touchStartY.current = null;
    };
    // Only on mobile
    const mql = window.matchMedia('(max-width: 1023px)');
    if (!mql.matches) return;
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onOpen, open]);

  // Swipe left on panel to close
  useEffect(() => {
    if (!open || !onClose) return;
    const panel = panelRef.current;
    if (!panel) return;
    let sx: number | null = null;
    const onStart = (e: TouchEvent) => { sx = e.touches[0].clientX; };
    const onEnd = (e: TouchEvent) => {
      if (sx === null) return;
      const dx = e.changedTouches[0].clientX - sx;
      if (dx < -60) onClose();
      sx = null;
    };
    panel.addEventListener('touchstart', onStart, { passive: true });
    panel.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      panel.removeEventListener('touchstart', onStart);
      panel.removeEventListener('touchend', onEnd);
    };
  }, [open, onClose]);

  return (
    <>
      {/* Desktop sidebar - always visible */}
      <div className="hidden lg:block w-56 shrink-0 bg-sidebar border-r border-sidebar-border h-full">
        <SidebarContent selectedTemplate={selectedTemplate} onSelectTemplate={onSelectTemplate} vehicleData={vehicleData} />
      </div>

      {/* Mobile overlay sidebar */}
      {open && (
        <>
          <div className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 lg:hidden" onClick={onClose} />
          <div
            ref={panelRef}
            className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-sidebar border-r border-sidebar-border z-50 lg:hidden shadow-xl animate-in slide-in-from-left duration-200"
          >
            <SidebarContent selectedTemplate={selectedTemplate} onSelectTemplate={onSelectTemplate} vehicleData={vehicleData} onClose={onClose} />
          </div>
        </>
      )}
    </>
  );
};

export default TemplateSidebar;
