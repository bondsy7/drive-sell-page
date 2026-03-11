import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Upload, Trash2, FileText, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSalesAssistant } from '@/hooks/useSalesAssistant';
import { DOCUMENT_TYPE_LABELS, type DocumentType } from '@/types/sales-assistant';

export default function SalesKnowledgeTab() {
  const { documents, documentsLoading, uploadDocument, toggleDocumentActive, deleteDocument } = useSalesAssistant();
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<DocumentType>('other');
  const [versionLabel, setVersionLabel] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error('Bitte wähle eine Datei.'); return; }
    if (!title.trim()) { toast.error('Bitte gib einen Titel ein.'); return; }
    setUploading(true);
    try {
      await uploadDocument(file, title, docType, versionLabel || undefined);
      setTitle('');
      setVersionLabel('');
      if (fileRef.current) fileRef.current.value = '';
      toast.success('Dokument hochgeladen! Verarbeitung läuft im Hintergrund.');
    } catch (e: any) {
      toast.error(e.message || 'Upload fehlgeschlagen.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: any) => {
    if (!confirm(`"${doc.title}" wirklich löschen?`)) return;
    await deleteDocument(doc.id, doc.storage_path);
    toast.success('Dokument gelöscht.');
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-600',
    processing: 'bg-blue-500/10 text-blue-600',
    ready: 'bg-green-500/10 text-green-600',
    failed: 'bg-red-500/10 text-red-600',
  };

  if (documentsLoading) return <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="font-semibold text-foreground text-sm">Wissensdokument hochladen</h3>
        <p className="text-xs text-muted-foreground">Lade Verkaufsleitfäden, FAQs, Einwandbehandlungen oder andere Dokumente hoch, die der Assistent nutzen soll.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Titel</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Verkaufsleitfaden 2024" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Dokumenttyp</label>
            <Select value={docType} onValueChange={(v) => setDocType(v as DocumentType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(DOCUMENT_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Version (optional)</label>
            <Input value={versionLabel} onChange={(e) => setVersionLabel(e.target.value)} placeholder="v1.0" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Datei</label>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md,.json" className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-muted file:text-foreground" />
          </div>
        </div>
        <Button size="sm" onClick={handleUpload} disabled={uploading}>
          {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
          Hochladen
        </Button>
      </div>

      {/* Documents List */}
      <div>
        <h3 className="font-semibold text-foreground text-sm mb-3">
          Wissensdokumente ({documents.length})
        </h3>
        {documents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Noch keine Dokumente hochgeladen.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="rounded-lg border border-border bg-card p-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-foreground truncate">{doc.title}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground shrink-0">
                      {DOCUMENT_TYPE_LABELS[doc.document_type as DocumentType] || doc.document_type}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${statusColors[doc.embedding_status] || 'bg-muted text-muted-foreground'}`}>
                      {doc.embedding_status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {doc.version_label && <span className="mr-3">Version: {doc.version_label}</span>}
                    {doc.chunk_count > 0 && <span className="mr-3">{doc.chunk_count} Chunks</span>}
                    <span>{new Date(doc.created_at).toLocaleDateString('de-DE')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => toggleDocumentActive(doc.id, !doc.is_active)}
                    title={doc.is_active ? 'Deaktivieren' : 'Aktivieren'}
                  >
                    {doc.is_active ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(doc)} className="text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
