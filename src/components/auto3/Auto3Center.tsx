import { ArrowLeft, CheckCircle2, Settings2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Auto3InventoryPanel from '@/components/profile/Auto3InventoryPanel';
import VehicleProcessingProfileCard from '@/components/profile/VehicleProcessingProfileCard';
import { useAuto3Config } from '@/hooks/useAuto3Config';
import { useProcessingProfile } from '@/hooks/useProcessingProfile';

const MODE_LABEL = { off: 'Automatik aus', prepare: 'Vorbereiten', full: 'Vollautomatisch' } as const;

export default function Auto3Center({ onBack }: { onBack: () => void }) {
  const { config } = useAuto3Config();
  const { data } = useProcessingProfile();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Zurück zum Generator"><ArrowLeft className="size-4" /></Button>
          <div>
            <p className="text-xs font-bold uppercase text-primary">Verbundener Fahrzeugbestand</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-foreground sm:text-3xl">Auto3 Fahrzeugbestand</h1>
            <p className="mt-1 text-sm text-muted-foreground">Fahrzeuge übernehmen, Originale sichern und die Aufbereitung steuern.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1.5"><CheckCircle2 className="size-3.5 text-primary" />Verbunden · {config?.vehicleCount ?? 0} Fahrzeuge</Badge>
          <Badge variant="secondary">{MODE_LABEL[data?.mode || 'off']}</Badge>
          <Badge variant={data?.approved ? 'default' : 'outline'} className="gap-1.5"><ShieldCheck className="size-3.5" />{data?.approved ? 'Profil freigegeben' : 'Freigabe fehlt'}</Badge>
        </div>
      </div>

      <Accordion type="single" collapsible className="rounded-lg border border-border bg-card px-4">
        <AccordionItem value="rules" className="border-0">
          <AccordionTrigger className="py-3 hover:no-underline">
            <span className="flex items-center gap-2 text-sm font-semibold"><Settings2 className="size-4 text-primary" />Automatik & globale Aufbereitungsregeln</span>
          </AccordionTrigger>
          <AccordionContent><VehicleProcessingProfileCard embedded /></AccordionContent>
        </AccordionItem>
      </Accordion>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">Fahrzeuge</h2>
          <p className="text-xs text-muted-foreground">Auto3 bleibt Datenquelle. Eine Website-Veröffentlichung erfolgt weiterhin nur manuell.</p>
        </div>
        <Auto3InventoryPanel />
      </section>
    </div>
  );
}