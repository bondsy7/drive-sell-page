import React from 'react';
import { Plus } from 'lucide-react';

/** Plus-Button auf dem Hauptbild einer PDF-Angebotsseite (nur Bearbeitungsmodus). */
const AddImageFab: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
  if (!onClick) return null;
  return (
    <button type="button" onClick={onClick} aria-label="Weitere Bilder hinzufügen" title="Weitere Bilder hinzufügen"
      className="absolute bottom-3 right-3 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform">
      <Plus className="h-6 w-6" />
    </button>
  );
};

export default AddImageFab;
