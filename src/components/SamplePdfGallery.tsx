import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';

interface SamplePdf {
  id: string;
  title: string;
  description: string | null;
  brand: string | null;
  model: string | null;
  category: string | null;
  pdf_url: string;
  thumbnail_url: string | null;
}

interface SamplePdfGalleryProps {
  onSelect: (pdfUrl: string, title: string) => void;
  isProcessing: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  Leasing: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  Finanzierung: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  Kauf: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  Barkauf: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
};

export default function SamplePdfGallery({ onSelect, isProcessing }: SamplePdfGalleryProps) {
  const [pdfs, setPdfs] = useState<SamplePdf[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('sample_pdfs')
        .select('id, title, description, brand, model, category, pdf_url, thumbnail_url')
        .eq('active', true)
        .order('sort_order');
      setPdfs((data as SamplePdf[]) || []);
      setLoading(false);
    })();
  }, []);

  if (loading || pdfs.length === 0) return null;

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mx-auto"
      >
        <FileText className="w-4 h-4" />
        Oder: Aus geprüften Beispiel-PDFs wählen ({pdfs.length})
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {expanded && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          {pdfs.map(pdf => (
            <button
              key={pdf.id}
              onClick={() => onSelect(pdf.pdf_url, pdf.title)}
              disabled={isProcessing}
              className="bg-card rounded-xl border border-border p-3 text-left hover:border-accent/50 hover:shadow-md transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="aspect-[4/3] rounded-lg bg-muted mb-2 overflow-hidden flex items-center justify-center">
                {pdf.thumbnail_url ? (
                  <img src={pdf.thumbnail_url} alt={pdf.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                ) : (
                  <span className="text-3xl opacity-50">📄</span>
                )}
              </div>
              <h4 className="font-semibold text-foreground text-xs truncate group-hover:text-accent transition-colors">
                {pdf.title}
              </h4>
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {pdf.brand && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{pdf.brand}</Badge>
                )}
                {pdf.category && (
                  <Badge variant="outline" className={`text-[10px] h-4 px-1.5 ${CATEGORY_COLORS[pdf.category] || ''}`}>
                    {pdf.category}
                  </Badge>
                )}
              </div>
              {pdf.description && (
                <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{pdf.description}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
