import React, { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PDFUploadProps {
  onFilesSelected: (files: File[]) => void;
  isProcessing: boolean;
}

const PDFUpload: React.FC<PDFUploadProps> = ({ onFilesSelected, isProcessing }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);

  const addFiles = useCallback((incoming: File[]) => {
    const valid: File[] = [];
    for (const file of incoming) {
      if (file.type !== 'application/pdf') { setError('Bitte nur PDF-Dateien hochladen.'); continue; }
      if (file.size > 20 * 1024 * 1024) { setError('Eine Datei ist zu groß (max. 20 MB).'); continue; }
      valid.push(file);
    }
    if (valid.length > 0) {
      setError(null);
      setFiles(prev => {
        const names = new Set(prev.map(f => f.name));
        const unique = valid.filter(f => !names.has(f.name));
        return [...prev, ...unique];
      });
    }
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length > 0) addFiles(dropped);
  }, [addFiles]);

  const handleSubmit = useCallback(() => {
    if (files.length === 0) return;
    onFilesSelected(files);
  }, [files, onFilesSelected]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="bg-card rounded-2xl border border-border shadow-card p-6">
        <label
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          className={`
            relative flex flex-col items-center justify-center
            w-full h-48 rounded-xl border-2 border-dashed
            cursor-pointer transition-all duration-200
            ${isDragging
              ? 'border-accent bg-accent/5 scale-[1.01]'
              : 'border-border hover:border-accent/40 hover:bg-muted/30'
            }
            ${isProcessing ? 'pointer-events-none opacity-60' : ''}
          `}
        >
          <input
            type="file" accept=".pdf" multiple
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={(e) => {
              const selected = Array.from(e.target.files || []);
              if (selected.length > 0) addFiles(selected);
              e.target.value = '';
            }}
            disabled={isProcessing}
          />
          <div className={`p-3 rounded-xl mb-3 transition-colors ${isDragging ? 'bg-accent/10' : 'bg-muted'}`}>
            {isDragging ? <FileText className="w-7 h-7 text-accent" /> : <Upload className="w-7 h-7 text-muted-foreground" />}
          </div>
          <p className="text-sm font-medium text-foreground">
            {isDragging ? 'Dateien hier ablegen' : 'PDFs hier ablegen oder klicken'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Leasing-, Kauf-, Finanzierungs- oder Ausstattungsdokumente
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Mehrere PDFs möglich – Daten werden zusammengeführt
          </p>
        </label>

        {/* File List */}
        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{files.length} {files.length === 1 ? 'Datei' : 'Dateien'} ausgewählt</p>
            {files.map((file, i) => (
              <div key={`${file.name}-${i}`} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <FileText className="w-4 h-4 text-accent shrink-0" />
                <span className="text-sm text-foreground truncate flex-1">{file.name}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{formatSize(file.size)}</span>
                <button
                  onClick={(e) => { e.preventDefault(); removeFile(i); }}
                  className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <Button
              onClick={handleSubmit}
              disabled={isProcessing}
              className="w-full mt-3"
              size="sm"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {files.length === 1 ? 'PDF analysieren' : `${files.length} PDFs analysieren & zusammenführen`}
            </Button>
          </div>
        )}
      </div>
      {error && (
        <div className="flex items-center gap-2 mt-3 text-destructive text-sm">
          <AlertCircle className="w-4 h-4" />{error}
        </div>
      )}
    </div>
  );
};

export default PDFUpload;
