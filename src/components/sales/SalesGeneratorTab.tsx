import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Send, Copy, RotateCcw, Save, MessageSquare, Phone, Mail, FileText, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useSalesAssistant } from '@/hooks/useSalesAssistant';
import { useCredits } from '@/hooks/useCredits';
import CreditConfirmDialog from '@/components/CreditConfirmDialog';
import {
  JOURNEY_STAGE_LABELS, SOURCE_CHANNEL_LABELS, MESSAGE_TYPE_LABELS,
  TONE_OPTIONS, TASK_TYPE_LABELS, PRIORITY_LABELS,
  type JourneyStage, type SourceChannel, type MessageType, type GenerateRequest,
} from '@/types/sales-assistant';

export default function SalesGeneratorTab() {
  const sa = useSalesAssistant();
  const { balance, getCost } = useCredits();

  // Form state
  const [projectId, setProjectId] = useState<string>('');
  const [leadId, setLeadId] = useState<string>('');
  const [journeyStage, setJourneyStage] = useState<JourneyStage>('new_lead');
  const [sourceChannel, setSourceChannel] = useState<SourceChannel>('email');
  const [customerMessage, setCustomerMessage] = useState('');
  const [desiredOutputType, setDesiredOutputType] = useState<MessageType>('reply');
  const [tone, setTone] = useState('freundlich');
  const [pushFinancing, setPushFinancing] = useState(true);
  const [pushTestDrive, setPushTestDrive] = useState(true);
  const [pushTradeIn, setPushTradeIn] = useState(false);
  const [offerCallback, setOfferCallback] = useState(false);
  const [prioritizeAvailable, setPrioritizeAvailable] = useState(false);
  const [mentionPromotion, setMentionPromotion] = useState(false);
  const [knowledgeMode, setKnowledgeMode] = useState<'auto' | 'manual'>('auto');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  // Data
  const [projects, setProjects] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [outputText, setOutputText] = useState('');
  const [creditDialog, setCreditDialog] = useState(false);

  useEffect(() => {
    sa.loadProjects().then(setProjects);
    sa.loadLeads().then(setLeads);
  }, []);

  // Apply profile defaults
  useEffect(() => {
    if (sa.profile) {
      setTone(sa.profile.default_tone || 'freundlich');
      setPushFinancing(sa.profile.should_push_financing);
      setPushTestDrive(sa.profile.should_push_test_drive);
      setPushTradeIn(sa.profile.should_push_trade_in);
      setOfferCallback(sa.profile.should_offer_callback);
    }
  }, [sa.profile]);

  const handleGenerate = useCallback(async () => {
    if (!customerMessage.trim()) {
      toast.error('Bitte gib eine Kundenanfrage oder Situation ein.');
      return;
    }
    const request: GenerateRequest = {
      projectId: projectId || undefined,
      leadId: leadId || undefined,
      journeyStage,
      sourceChannel,
      customerMessage,
      desiredOutputType,
      tone,
      extraFlags: { pushFinancing, pushTestDrive, pushTradeIn, offerCallback, prioritizeAvailable, mentionPromotion },
      selectedKnowledgeDocumentIds: knowledgeMode === 'manual' ? selectedDocIds : undefined,
    };
    try {
      const response = await sa.generateResponse(request);
      if (response) {
        setOutputText(response.generatedText);
        toast.success('Antwort generiert!');
        sa.loadConversations();
        sa.loadTasks();
      }
    } catch (e: any) {
      if (e.message?.includes('insufficient_credits')) {
        toast.error('Nicht genügend Credits.');
      } else {
        toast.error(e.message || 'Fehler bei der Generierung.');
      }
    }
  }, [customerMessage, projectId, leadId, journeyStage, sourceChannel, desiredOutputType, tone, pushFinancing, pushTestDrive, pushTradeIn, offerCallback, prioritizeAvailable, mentionPromotion, knowledgeMode, selectedDocIds, sa]);

  const handleCopy = () => {
    navigator.clipboard.writeText(outputText);
    toast.success('In Zwischenablage kopiert!');
  };

  const handleRegenerate = (modifier?: string) => {
    const modifiedMessage = modifier
      ? `${customerMessage}\n\n[Zusätzliche Anweisung: ${modifier}]`
      : customerMessage;
    setCustomerMessage(modifiedMessage);
    handleGenerate();
  };

  const cost = 1; // 1 credit per generation

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* LEFT: Input & Context */}
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <h3 className="font-semibold text-foreground text-sm">Kontext & Eingabe</h3>

          {/* Project */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Fahrzeug / Projekt (optional)</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="Kein Projekt ausgewählt" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Kein Projekt</SelectItem>
                {projects.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lead */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Lead / Kunde (optional)</label>
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger><SelectValue placeholder="Kein Lead ausgewählt" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Kein Lead</SelectItem>
                {leads.map((l: any) => (
                  <SelectItem key={l.id} value={l.id}>{l.name} – {l.vehicle_title || l.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Journey Stage & Channel */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Journey Phase</label>
              <Select value={journeyStage} onValueChange={(v) => setJourneyStage(v as JourneyStage)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(JOURNEY_STAGE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Kanal</label>
              <Select value={sourceChannel} onValueChange={(v) => setSourceChannel(v as SourceChannel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SOURCE_CHANNEL_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Customer Message */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Kundenanfrage / Situation</label>
            <Textarea
              value={customerMessage}
              onChange={(e) => setCustomerMessage(e.target.value)}
              placeholder="Beschreibe die Kundenanfrage, die Situation oder füge die Nachricht des Kunden ein..."
              className="min-h-[120px]"
            />
          </div>

          {/* Output Type & Tone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Ausgabeformat</label>
              <Select value={desiredOutputType} onValueChange={(v) => setDesiredOutputType(v as MessageType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MESSAGE_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tonalität</label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Extra Flags */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Zusatzoptionen</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Finanzierung anbieten', value: pushFinancing, set: setPushFinancing },
                { label: 'Probefahrt anbieten', value: pushTestDrive, set: setPushTestDrive },
                { label: 'Inzahlungnahme ansprechen', value: pushTradeIn, set: setPushTradeIn },
                { label: 'Rückruf anbieten', value: offerCallback, set: setOfferCallback },
                { label: 'Verfügbarkeit betonen', value: prioritizeAvailable, set: setPrioritizeAvailable },
                { label: 'Aktion erwähnen', value: mentionPromotion, set: setMentionPromotion },
              ].map((flag) => (
                <label key={flag.label} className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                  <Switch checked={flag.value} onCheckedChange={flag.set} className="scale-75" />
                  {flag.label}
                </label>
              ))}
            </div>
          </div>

          {/* Knowledge Mode */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Wissensquellen</label>
            <Select value={knowledgeMode} onValueChange={(v) => setKnowledgeMode(v as 'auto' | 'manual')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automatisch (alle aktiven)</SelectItem>
                <SelectItem value="manual">Manuell auswählen</SelectItem>
              </SelectContent>
            </Select>
            {knowledgeMode === 'manual' && sa.documents.length > 0 && (
              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                {sa.documents.filter(d => d.is_active).map((doc) => (
                  <label key={doc.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedDocIds.includes(doc.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedDocIds(prev => [...prev, doc.id]);
                        else setSelectedDocIds(prev => prev.filter(id => id !== doc.id));
                      }}
                      className="rounded"
                    />
                    {doc.title}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={sa.generating || !customerMessage.trim()}
            className="w-full"
          >
            {sa.generating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generiere...</>
            ) : (
              <><Send className="w-4 h-4 mr-2" /> Antwort generieren (1 Credit)</>
            )}
          </Button>
        </div>
      </div>

      {/* RIGHT: Output */}
      <div className="space-y-4">
        {/* Generated Text */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="font-semibold text-foreground text-sm">Generierte Antwort</h3>
          {outputText ? (
            <>
              <Textarea
                value={outputText}
                onChange={(e) => setOutputText(e.target.value)}
                className="min-h-[250px] text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={handleCopy}>
                  <Copy className="w-3.5 h-3.5 mr-1" /> Kopieren
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleGenerate()}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> Neu generieren
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleRegenerate('Kürzer fassen')}>
                  Kürzer
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleRegenerate('Verbindlicher formulieren')}>
                  Verbindlicher
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleRegenerate('Mehr Abschlussfokus')}>
                  Mehr Abschluss
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleRegenerate('Für WhatsApp umschreiben, kurz und direkt')}>
                  <MessageSquare className="w-3.5 h-3.5 mr-1" /> WhatsApp
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleRegenerate('Als professionelle E-Mail umschreiben')}>
                  <Mail className="w-3.5 h-3.5 mr-1" /> E-Mail
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Hier erscheint die generierte Antwort.</p>
              <p className="text-xs mt-1">Fülle links die Felder aus und klicke auf „Antwort generieren".</p>
            </div>
          )}
        </div>

        {/* Used Context */}
        {sa.lastResponse?.usedContext && sa.lastResponse.usedContext.length > 0 && (
          <Accordion type="single" collapsible>
            <AccordionItem value="context" className="rounded-xl border border-border bg-card px-4">
              <AccordionTrigger className="text-sm font-semibold">
                Verwendeter Kontext ({sa.lastResponse.usedContext.length} Quellen)
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {sa.lastResponse.usedContext.map((ctx, i) => (
                    <div key={i} className="text-xs p-2 rounded bg-muted/50">
                      <div className="font-medium text-foreground">{ctx.title}</div>
                      <div className="text-muted-foreground">{ctx.snippet}</div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {/* Confidence Notes */}
        {sa.lastResponse?.confidenceNotes && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Hinweise</h4>
            <p className="text-xs text-muted-foreground">{sa.lastResponse.confidenceNotes}</p>
          </div>
        )}

        {/* Recommended Next Steps */}
        {sa.lastResponse?.recommendedNextSteps && sa.lastResponse.recommendedNextSteps.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <h3 className="font-semibold text-foreground text-sm">Empfohlene nächste Schritte</h3>
            {sa.lastResponse.recommendedNextSteps.map((step, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded bg-muted/30">
                <div className="w-5 h-5 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">{step.title}</div>
                  <div className="text-xs text-muted-foreground">{step.description}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
