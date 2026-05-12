import React from "react";
import ImageUpload from "./ImageUpload";

interface Props {
  logoUrl?: string;
  onChange: (url?: string) => void;
}

const LogoPanel: React.FC<Props> = ({ logoUrl, onChange }) => (
  <div className="space-y-3">
    <ImageUpload
      imageUrl={logoUrl}
      onUpload={(url) => onChange(url)}
      onClear={() => onChange(undefined)}
      label="Logo hochladen (PNG empfohlen)"
      accept="image/png,image/jpeg,image/webp,image/svg+xml"
    />
    <p className="text-xs text-muted-foreground">
      Tipp: PNG mit transparentem Hintergrund verwenden. Position und Größe lassen sich danach in der Vorschau anpassen.
    </p>
  </div>
);

export default LogoPanel;
