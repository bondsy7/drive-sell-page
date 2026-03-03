import React from 'react';

interface CO2LabelProps {
  co2Class: string;
}

const classes = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const colors = [
  'hsl(145, 63%, 32%)',
  'hsl(130, 55%, 40%)',
  'hsl(100, 60%, 45%)',
  'hsl(65, 70%, 48%)',
  'hsl(45, 90%, 50%)',
  'hsl(25, 90%, 50%)',
  'hsl(0, 70%, 45%)',
];

const CO2Label: React.FC<CO2LabelProps> = ({ co2Class }) => {
  const activeIndex = classes.indexOf(co2Class.toUpperCase());

  return (
    <div className="flex flex-col gap-1 w-full max-w-[280px]">
      <div className="text-xs font-semibold text-foreground mb-1">
        CO₂-Effizienz
      </div>
      {classes.map((cls, i) => {
        const widthPercent = 40 + i * 9;
        const isActive = i === activeIndex;
        return (
          <div key={cls} className="flex items-center gap-2">
            {/* Arrow bar */}
            <div
              className="relative flex items-center justify-start text-white text-[10px] font-bold px-2 py-[2px]"
              style={{
                width: `${widthPercent}%`,
                backgroundColor: colors[i],
                clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)',
                minHeight: '18px',
              }}
            >
              {cls}
            </div>
            {/* Active indicator */}
            {isActive && (
              <div
                className="flex items-center justify-center text-white text-xs font-bold px-3 py-[2px] rounded-sm"
                style={{
                  backgroundColor: '#1a1a1a',
                  clipPath: 'polygon(8px 0, 100% 0, 100% 100%, 8px 100%, 0 50%)',
                  minHeight: '20px',
                  paddingLeft: '14px',
                }}
              >
                {cls}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CO2Label;
