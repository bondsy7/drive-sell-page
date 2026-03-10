import React, { useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { urlToBase64, urlsToBase64, compressToWebP, compressAllToWebP } from '@/lib/storage-utils';
import { Download, RotateCcw, Car, Fuel, Gauge, Calendar, Palette, Cog, Zap, MapPin, Phone, Mail, Globe, Plus, Trash2, ChevronLeft, ChevronRight, Eye, Pencil, Calculator, Loader2, Search } from 'lucide-react';
import AutohausEditor from '@/components/template-editors/AutohausEditor';
import ModernEditor from '@/components/template-editors/ModernEditor';
import KlassischEditor from '@/components/template-editors/KlassischEditor';
import MinimalistEditor from '@/components/template-editors/MinimalistEditor';
import type { VehicleData, ConsumptionData, DealerData } from '@/types/vehicle';
import { isPluginHybrid } from '@/lib/co2-utils';
import type { TemplateId } from '@/types/template';
import { generateHTML, downloadHTML, type GenerateHTMLOptions } from '@/lib/templates';
import { embedCO2LabelsInHTML, calculateLeasingFactor } from '@/lib/templates/shared';
import ExportChoiceDialog, { type ExportMode } from '@/components/ExportChoiceDialog';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import EditableField from '@/components/EditableField';
import CO2LabelSelector from '@/components/CO2LabelSelector';
import FuelTypeDropdown from '@/components/FuelTypeDropdown';
import CategoryDropdown from '@/components/CategoryDropdown';
import { getFinanceSectionTitle } from '@/lib/templates/shared';
import { parsePrice, parseDuration, parseInterestRate, formatPrice, calculateFinancingRate, calculateLeasingRate } from '@/lib/finance-utils';
import { calculateAllCosts } from '@/lib/cost-utils';
import { useVinLookup } from '@/hooks/useVinLookup';
import VinDataDialog from '@/components/VinDataDialog';

interface LandingPagePreviewProps {
  vehicleData: VehicleData;
  imageBase64: string | null;
  galleryImages?: string[];
  onReset: () => void;
  onDataChange: (data: VehicleData) => void;
  selectedTemplate: TemplateId;
  projectId?: string | null;
}

const SpecItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (val: string) => void;
}> = ({ icon, label, value, onChange }) => (
  <div className="flex items-start gap-2.5 py-2">
    <span className="text-muted-foreground mt-0.5">{icon}</span>
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <EditableField value={value} onChange={onChange} className="text-sm font-semibold text-foreground" />
    </div>
  </div>
);

const ConsumptionRow: React.FC<{ label: string; value: string; onChange: (v: string) => void; suffix?: string }> = ({ label, value, onChange, suffix }) => (
  <div className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-0">
    <span className="text-xs text-muted-foreground">{label}</span>
    <EditableField value={value} onChange={onChange} className="text-xs font-semibold text-foreground" suffix={suffix} />
  </div>
);

const LandingPagePreview: React.FC<LandingPagePreviewProps> = ({ vehicleData, imageBase64, galleryImages = [], onReset, onDataChange, selectedTemplate, projectId }) => {
  const data = vehicleData;
  const { user } = useAuth();
  const [selectedImage, setSelectedImage] = useState(0);
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview');
  const [costCalculating, setCostCalculating] = useState(false);
  const [costMissingFields, setCostMissingFields] = useState<string[]>([]);
  const vinLookup = useVinLookup();

  const vehicleTitle = `${data.vehicle.brand} ${data.vehicle.model} ${data.vehicle.variant || ''}`.trim();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const htmlOptions: GenerateHTMLOptions | undefined = user ? {
    contactForm: {
      dealerUserId: user.id,
      projectId: projectId || undefined,
      supabaseUrl,
      vehicleTitle,
    }
  } : undefined;

  const liveHTML = useMemo(
    () => generateHTML(selectedTemplate, data, imageBase64, galleryImages, htmlOptions),
    [selectedTemplate, data, imageBase64, galleryImages, user?.id, projectId]
  );

  // Ensure consumption exists with defaults
  const consumption: ConsumptionData = data.consumption || {
    origin: '', mileage: '', displacement: '', power: '', driveType: '',
    fuelType: '', consumptionCombined: '', co2Emissions: '', co2Class: '',
    consumptionCity: '', consumptionSuburban: '', consumptionRural: '',
    consumptionHighway: '', energyCostPerYear: '', fuelPrice: '',
    co2CostMedium: '', co2CostLow: '', co2CostHigh: '', vehicleTax: '',
    isPluginHybrid: false, co2EmissionsDischarged: '', co2ClassDischarged: '',
    consumptionCombinedDischarged: '', electricRange: '', consumptionElectric: '',
  };

  const cat = (data.category || '').toLowerCase();
  const isBuyCategory = cat.includes('barkauf') || cat.includes('neuwagen') || cat.includes('gebrauchtwagen') || cat.includes('tageszulassung');
  const allImages = [imageBase64, ...galleryImages].filter(Boolean) as string[];

  const updateVehicle = (key: keyof VehicleData['vehicle'], val: string) => {
    onDataChange({ ...data, vehicle: { ...data.vehicle, [key]: val } });
  };
  const updateFinance = (key: keyof VehicleData['finance'], val: string) => {
    onDataChange({ ...data, finance: { ...data.finance, [key]: val } });
  };
  const updateDealer = (key: keyof DealerData, val: string) => {
    onDataChange({ ...data, dealer: { ...data.dealer, [key]: val } });
  };
  const updateConsumption = (key: keyof ConsumptionData, val: string) => {
    onDataChange({ ...data, consumption: { ...consumption, [key]: val } });
  };
  const updatePower = (val: string) => {
    onDataChange({
      ...data,
      vehicle: { ...data.vehicle, power: val },
      consumption: { ...consumption, power: val },
    });
  };
  const updateFuelType = (val: string) => {
    const isPhev = val.toLowerCase().includes('plug-in');
    onDataChange({
      ...data,
      vehicle: { ...data.vehicle, fuelType: val },
      consumption: {
        ...consumption,
        fuelType: val,
        isPluginHybrid: isPhev,
      },
    });
  };

  const recalculateRate = useCallback(() => {
    const price = parsePrice(data.finance.totalPrice);
    const months = parseDuration(data.finance.duration);
    const rate = parseInterestRate(data.finance.interestRate || '');
    let monthly = 0;
    if (cat.includes('leasing')) {
      const sp = parsePrice(data.finance.specialPayment);
      const rv = parsePrice(data.finance.residualValue);
      monthly = calculateLeasingRate(price, sp, rv, rate, months);
    } else {
      const dp = parsePrice(data.finance.downPayment);
      const fp = parsePrice(data.finance.residualValue); // Schlussrate for balloon financing
      monthly = calculateFinancingRate(price, dp, rate, months, fp);
    }
    if (monthly > 0) {
      updateFinance('monthlyRate', formatPrice(monthly));
    }
  }, [data.finance, cat]);

  const calculateCosts = useCallback(async () => {
    // Check required fields
    const missing: string[] = [];
    const fuelType = consumption.fuelType || data.vehicle.fuelType || '';
    const isElectric = fuelType.toLowerCase().match(/elektro|electric|strom|^ev$|^bev$/);
    
    if (!consumption.consumptionCombined) missing.push('Verbrauch (komb.)');
    if (!fuelType) missing.push('Kraftstoffart');
    if (!consumption.displacement && !isElectric) missing.push('Hubraum');
    if (!consumption.co2Emissions && !isElectric) missing.push('CO₂-Emissionen');
    
    if (missing.length > 0) {
      setCostMissingFields(missing);
      return;
    }
    
    setCostMissingFields([]);
    setCostCalculating(true);
    try {
      const annualMileage = data.finance.annualMileage || '15.000 km';
      const costs = await calculateAllCosts(
        consumption.consumptionCombined,
        annualMileage,
        fuelType,
        consumption.displacement,
        consumption.co2Emissions,
        data.vehicle.year || 2024,
        consumption.fuelPrice
      );
      
      const updatedConsumption = { ...consumption };
      if (costs.fuelPrice) updatedConsumption.fuelPrice = costs.fuelPrice;
      if (costs.energyCostPerYear) updatedConsumption.energyCostPerYear = costs.energyCostPerYear;
      if (costs.co2CostLow) updatedConsumption.co2CostLow = costs.co2CostLow;
      if (costs.co2CostMedium) updatedConsumption.co2CostMedium = costs.co2CostMedium;
      if (costs.co2CostHigh) updatedConsumption.co2CostHigh = costs.co2CostHigh;
      if (costs.vehicleTax) updatedConsumption.vehicleTax = costs.vehicleTax;
      
      onDataChange({ ...data, consumption: updatedConsumption });
    } catch (e) {
      console.error('Kostenberechnung fehlgeschlagen:', e);
    } finally {
      setCostCalculating(false);
    }
  }, [data, consumption]);

  const addFeature = () => {
    const features = [...(data.vehicle.features || []), 'Neue Ausstattung'];
    onDataChange({ ...data, vehicle: { ...data.vehicle, features } });
  };
  const updateFeature = (index: number, val: string) => {
    const features = [...(data.vehicle.features || [])];
    features[index] = val;
    onDataChange({ ...data, vehicle: { ...data.vehicle, features } });
  };
  const removeFeature = (index: number) => {
    const features = (data.vehicle.features || []).filter((_, i) => i !== index);
    onDataChange({ ...data, vehicle: { ...data.vehicle, features } });
  };

  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const handleExportClick = () => setExportDialogOpen(true);

  const handleExport = async (mode: ExportMode) => {
    setExportLoading(true);
    try {
      const filename = `${data.vehicle.brand}_${data.vehicle.model}_Angebot.html`.replace(/\s+/g, '_');
      let html: string;

      if (mode === 'lightweight') {
        html = generateHTML(selectedTemplate, data, imageBase64, galleryImages, htmlOptions);
        html = await embedCO2LabelsInHTML(html);
        downloadHTML(html, filename);
      } else {
        const [mainWebP, galleryWebP] = await Promise.all([
          imageBase64 ? compressToWebP(imageBase64) : Promise.resolve(null),
          compressAllToWebP(galleryImages),
        ]);
        html = generateHTML(selectedTemplate, data, mainWebP, galleryWebP, htmlOptions);
        html = await embedCO2LabelsInHTML(html);
        downloadHTML(html, filename);
      }

      // Persist HTML to project so it's re-downloadable from dashboard
      if (projectId) {
        await supabase.from('projects').update({
          html_content: html,
          updated_at: new Date().toISOString(),
        }).eq('id', projectId);
      }
    } finally {
      setExportLoading(false);
      setExportDialogOpen(false);
    }
  };

  return (
    <div className="w-full mx-auto space-y-6">
      {/* Action bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={onReset} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Neues PDF</span>
            <span className="sm:hidden">Neu</span>
          </Button>
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'preview' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Vorschau</span>
            </button>
            <button
              onClick={() => setViewMode('edit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'edit' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Pencil className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Bearbeiten</span>
            </button>
          </div>
        </div>
        <Button onClick={handleExportClick} size="sm" className="gap-2 gradient-accent text-accent-foreground font-semibold shadow-glow hover:opacity-90 transition-opacity w-full sm:w-auto">
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Als HTML herunterladen</span>
          <span className="sm:hidden">Export</span>
        </Button>
      </div>

      {viewMode === 'preview' ? (
        <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
          <iframe
            srcDoc={liveHTML}
            className="w-full border-0 rounded-2xl"
            style={{ minHeight: '80vh' }}
            title="Template-Vorschau"
          />
        </div>
      ) : (() => {
        const editorProps = {
          data, consumption, imageBase64, galleryImages, allImages,
          isBuyCategory, category: cat,
          updateVehicle, updateFinance, updateDealer, updateConsumption,
          updatePower, updateFuelType, onDataChange,
          recalculateRate, calculateCosts, costCalculating, costMissingFields,
          addFeature, updateFeature, removeFeature, vinLookup,
        };
        switch (selectedTemplate) {
          case 'autohaus': return <AutohausEditor {...editorProps} />;
          case 'modern': return <ModernEditor {...editorProps} />;
          case 'klassisch': return <KlassischEditor {...editorProps} />;
          case 'minimalist': return <MinimalistEditor {...editorProps} />;
          default: return <AutohausEditor {...editorProps} />;
        }
      })()}
      <ExportChoiceDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen} onChoose={handleExport} loading={exportLoading} projectId={projectId} />
      <VinDataDialog
        open={vinLookup.dialogOpen}
        onClose={() => vinLookup.setDialogOpen(false)}
        diffs={vinLookup.diffs}
        vin={data.vehicle.vin || ''}
        onApply={(fields) => {
          const updated = vinLookup.applyFields(fields, data);
          onDataChange(updated);
        }}
      />
    </div>
  );
};

export default LandingPagePreview;
