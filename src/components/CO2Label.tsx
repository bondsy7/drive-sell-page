import React from 'react';
import type { ConsumptionData } from '@/types/vehicle';
import { getCO2LabelPath } from '@/lib/co2-utils';

interface CO2LabelProps {
  consumption: ConsumptionData;
}

const CO2Label: React.FC<CO2LabelProps> = ({ consumption }) => {
  const src = getCO2LabelPath(consumption);

  return (
    <div className="w-full max-w-[280px]">
      <div className="text-xs font-semibold text-foreground mb-1">
        CO₂-Effizienz
      </div>
      <img src={src} alt="CO₂-Klasse" className="w-full h-auto" />
    </div>
  );
};

export default CO2Label;
