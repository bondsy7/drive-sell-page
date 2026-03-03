import React from 'react';
import { CO2_LABEL_IMAGES } from '@/lib/co2-utils';

interface CO2LabelProps {
  co2Class: string;
}

const CO2Label: React.FC<CO2LabelProps> = ({ co2Class }) => {
  const cls = co2Class?.toUpperCase() || 'A';
  const src = CO2_LABEL_IMAGES[cls] || CO2_LABEL_IMAGES['A'];

  return (
    <div className="w-full max-w-[280px]">
      <div className="text-xs font-semibold text-foreground mb-1">
        CO₂-Effizienz
      </div>
      <img src={src} alt={`CO₂-Klasse ${cls}`} className="w-full h-auto" />
    </div>
  );
};

export default CO2Label;
