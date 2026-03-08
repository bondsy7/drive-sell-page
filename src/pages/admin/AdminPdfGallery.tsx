import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Plus, Trash2, Eye, EyeOff, Upload, GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface SamplePdf {
  id: string;
  title: string;
  description: string | null;
  brand: string | null;
  model: string | null;
  category: string | null;
  pdf_url: string;
  thumbnail_url: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
}

const CATEGORIES = ['Leasing', 'Finanzierung', 'Kauf', 'Barkauf'];

export default function AdminPdfGallery() {
  const [pdfs, setPdfs] = useState<SamplePdf[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => { loadPdfs(); }, []);

  const loadPdfs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('sample_pdfs' as any)
      .select('*')
      .order('sort_order', { ascending: true });
    setPdfs((data as any[]) || []);
    setLoading(false);
  };

  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.endsWith('.pdf')) {
      toast.error('Bitte eine PDF-Datei auswählen');
      return;
    }

    setUploading(true);
    const fileName = `${Date.now()}_${file.name.replace(/\s/g, '_')}`;

    const { error: uploadError } = await supabase.storage
      .from('sample-pdfs')
      .upload(`pdfs/${fileName}`, file);

    if (uploadError) {
      toast.error('Upload fehlgeschlagen: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('sample-pdfs')
      .getPublicUrl(`pdfs/${fileName}`);

    const title = file.name.replace('.pdf', '').replace(/[-_]/g, ' ');

    const { error } = await supabase.from('sample_pdfs' as any).insert({
      title,
      pdf_url: urlData.publicUrl,
      sort_order: pdfs.length,
    } as any);

    if (error) {
      toast.error('Fehler: ' + error.message);
    } else {
      toast.success('PDF hochgeladen');
      loadPdfs();
    }
    setUploading(false);
    e.target.value = '';
  };

  const handleUploadThumbnail = async (pdfId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = `${pdfId}_thumb.${file.name.split('.').pop()}`;
    const { error: uploadError } = await supabase.storage
      .from('sample-pdfs')
      .upload(`thumbnails/${fileName}`, file, { upsert: true });

    if (uploadError) {
      toast.error('Thumbnail-Upload fehlgeschlagen');
      return;
    }

    const { data: urlData } = supabase.storage
      .from('sample-pdfs')
      .getPublicUrl(`thumbnails/${fileName}`);

    await supabase.from('sample_pdfs' as any)
      .update({ thumbnail_url: urlData.publicUrl, updated_at: new Date().toISOString() } as any)
      .eq('id', pdfId);

    toast.success('Vorschaubild aktualisiert');
    loadPdfs();
  };

  const updateField = async (id: string, field: string, value: any) => {
    const { error } = await supabase
      .from('sample_pdfs' as any)
      .update({ [field]: value, updated_at: new Date().toISOString() } as any)
      .eq('id', id);
    if (error) toast.error('Fehler: ' + error.message);
    else loadPdfs();
  };

  const deletePdf = async (pdf: SamplePdf) => {
    if (!confirm(`"${pdf.title}" wirklich löschen?`)) return;
    
    // Delete files from storage
    const pdfPath = pdf.pdf_url.split('/sample-pdfs/')[1];
    if (pdfPath) await supabase.storage.from('sample-pdfs').remove([pdfPath]);
    if (pdf.thumbnail_url) {
      const thumbPath = pdf.thumbnail_url.split('/sample-pdfs/')[1];
      if (thumbPath) await supabase.storage.from('sample-pdfs').remove([thumbPath]);
    }

    await supabase.from('sample_pdfs' as any).delete().eq('id', pdf.id);
    toast.success('PDF gelöscht');
    loadPdfs();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">PDF-Galerie</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Geprüfte Beispiel-PDFs für Nutzer. {pdfs.filter(p => p.active).length} von {pdfs.length} aktiv.
          </p>
        </div>
        <label className="cursor-pointer">
          <input type="file" accept=".pdf" onChange={handleUploadPdf} className="hidden" />
          <Button asChild disabled={uploading}>
            <span className="gap-1.5">
              <Plus className="w-4 h-4" /> {uploading ? 'Lädt hoch…' : 'PDF hinzufügen'}
            </span>
          </Button>
        </label>
      </div>

      {pdfs.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground text-sm">Noch keine PDFs. Klicke auf "PDF hinzufügen" um zu starten.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pdfs.map(pdf => (
            <div key={pdf.id} className={`bg-card rounded-xl border ${pdf.active ? 'border-border' : 'border-border/50 opacity-60'} p-4`}>
              <div className="flex gap-4">
                {/* Thumbnail */}
                <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden relative group">
                  {pdf.thumbnail_url ? (
                    <img src={pdf.thumbnail_url} alt={pdf.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">📄</span>
                  )}
                  <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                    <input type="file" accept="image/*" onChange={(e) => handleUploadThumbnail(pdf.id, e)} className="hidden" />
                    <Upload className="w-4 h-4 text-white" />
                  </label>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      {editingId === pdf.id ? (
                        <Input
                          defaultValue={pdf.title}
                          onBlur={(e) => { updateField(pdf.id, 'title', e.target.value); setEditingId(null); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { updateField(pdf.id, 'title', (e.target as HTMLInputElement).value); setEditingId(null); } }}
                          autoFocus
                          className="h-8 text-sm font-semibold"
                        />
                      ) : (
                        <h3
                          className="font-semibold text-foreground text-sm cursor-pointer hover:text-accent transition-colors"
                          onClick={() => setEditingId(pdf.id)}
                        >
                          {pdf.title}
                        </h3>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <Input
                          placeholder="Marke"
                          defaultValue={pdf.brand || ''}
                          onBlur={(e) => updateField(pdf.id, 'brand', e.target.value || null)}
                          className="h-7 w-24 text-xs"
                        />
                        <Input
                          placeholder="Modell"
                          defaultValue={pdf.model || ''}
                          onBlur={(e) => updateField(pdf.id, 'model', e.target.value || null)}
                          className="h-7 w-32 text-xs"
                        />
                        <Select
                          defaultValue={pdf.category || 'Leasing'}
                          onValueChange={(val) => updateField(pdf.id, 'category', val)}
                        >
                          <SelectTrigger className="h-7 w-32 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map(c => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input
                        placeholder="Kurzbeschreibung (optional)"
                        defaultValue={pdf.description || ''}
                        onBlur={(e) => updateField(pdf.id, 'description', e.target.value || null)}
                        className="h-7 text-xs mt-1.5 max-w-md"
                      />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1.5">
                        {pdf.active ? <Eye className="w-3.5 h-3.5 text-emerald-500" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
                        <Switch
                          checked={pdf.active}
                          onCheckedChange={(checked) => updateField(pdf.id, 'active', checked)}
                        />
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deletePdf(pdf)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                <span>Erstellt: {new Date(pdf.created_at).toLocaleDateString('de-DE')}</span>
                {pdf.brand && <Badge variant="secondary" className="text-[10px] h-4">{pdf.brand}</Badge>}
                {pdf.category && <Badge variant="outline" className="text-[10px] h-4">{pdf.category}</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
