import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";

interface Props {
  imageUrl?: string;
  onUpload: (url: string) => void;
  onClear: () => void;
  label?: string;
  accept?: string;
}

const ImageUpload: React.FC<Props> = ({
  imageUrl,
  onUpload,
  onClear,
  label = "Hintergrundbild hochladen",
  accept = "image/jpeg,image/png,image/webp",
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onUpload(reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {imageUrl ? (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
          <img src={imageUrl} alt="Vorschau" className="w-14 h-14 object-cover rounded" />
          <div className="flex-1">
            <div className="text-sm font-medium text-foreground">Bild geladen</div>
            <div className="text-xs text-muted-foreground">Tippe „Ersetzen" um es zu wechseln.</div>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>Ersetzen</Button>
            <Button size="icon" variant="ghost" onClick={onClear}><X className="w-4 h-4" /></Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full p-6 rounded-lg border-2 border-dashed border-border hover:border-accent/60 transition-colors flex flex-col items-center gap-2 text-muted-foreground"
        >
          <Upload className="w-6 h-6" />
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs">JPEG, PNG oder WebP</span>
        </button>
      )}
    </div>
  );
};

export default ImageUpload;
