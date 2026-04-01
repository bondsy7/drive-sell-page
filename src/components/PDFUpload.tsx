import React, { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';

interface PDFUploadProps {
  onFileSelected: (file: File) => void;
  isProcessing: boolean;
}

const PDFUpload: React.FC<PDFUploadProps> = ({ onFileSelected, isProcessing }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    if (file.type !== 'application/pdf') { setError('Bitte lade eine PDF-Datei hoch.'); return; }
    if (file.size > 20 * 1024 * 1024) { setError('Die Datei ist zu groß (max. 20 MB).'); return; }
    setError(null);
    onFileSelected(file);
  }, [onFileSelected]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

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
            type="file" accept=".pdf"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); }}
            disabled={isProcessing}
          />
          <div className={`p-3 rounded-xl mb-3 transition-colors ${isDragging ? 'bg-accent/10' : 'bg-muted'}`}>
            {isDragging ? <FileText className="w-7 h-7 text-accent" /> : <Upload className="w-7 h-7 text-muted-foreground" />}
          </div>
          <p className="text-sm font-medium text-foreground">
            {isDragging ? 'Datei hier ablegen' : 'PDF hier ablegen oder klicken'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Leasing-, Kauf- oder Finanzierungsangebot
          </p>
        </label>
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