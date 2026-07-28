import React from 'react';

/**
 * Technische Strichzeichnungen (Schemaskizzen) für den Lkw-Workflow.
 * Bewusst reduziert, eindeutig und ohne Marken- oder Fotobezug.
 */

const VB = '0 0 120 60';

const wheel = (cx: number, cy = 48, r = 7) => (
  <circle key={`w${cx}`} cx={cx} cy={cy} r={r} />
);

const SKETCHES: Record<string, React.ReactNode> = {
  // ── Konfigurationen ──
  tractor_unit: (
    <>
      <path d="M14 48V26h16l6-10h16v32" />
      <path d="M52 34h10" />
      {wheel(24)}
      {wheel(48)}
    </>
  ),
  rigid_truck: (
    <>
      <path d="M8 48V26h14l6-10h12v32" />
      <rect x="40" y="14" width="70" height="34" />
      {wheel(20)}
      {wheel(78)}
      {wheel(96)}
    </>
  ),
  rigid_truck_with_trailer: (
    <>
      <path d="M4 48V28h10l5-9h9v29" />
      <rect x="28" y="18" width="36" height="30" />
      <path d="M64 42h8" />
      <rect x="72" y="18" width="44" height="30" />
      {wheel(14, 50, 5)}
      {wheel(46, 50, 5)}
      {wheel(82, 50, 5)}
      {wheel(108, 50, 5)}
    </>
  ),
  semi_truck: (
    <>
      <path d="M6 48V28h12l5-10h11v30" />
      <rect x="30" y="14" width="84" height="34" />
      {wheel(18)}
      {wheel(38)}
      {wheel(94)}
      {wheel(108)}
    </>
  ),
  semi_truck_with_trailer: (
    <>
      <path d="M2 48V30h9l4-8h8v26" />
      <rect x="23" y="18" width="46" height="30" />
      <path d="M69 42h7" />
      <rect x="76" y="20" width="42" height="28" />
      {wheel(12, 50, 5)}
      {wheel(28, 50, 5)}
      {wheel(60, 50, 5)}
      {wheel(86, 50, 5)}
      {wheel(110, 50, 5)}
    </>
  ),
  trailer_only: (
    <>
      <rect x="12" y="16" width="96" height="32" />
      <path d="M24 48v8M24 56h-8" />
      {wheel(88)}
      {wheel(102)}
    </>
  ),

  // ── Aufbauarten ──
  body_box_closed: (
    <>
      <rect x="14" y="14" width="92" height="34" />
      <path d="M92 14v34M60 14v34" />
      {wheel(84)}
    </>
  ),
  body_platform_open: (
    <>
      <path d="M14 40h92M14 40V24M106 40V24" />
      <path d="M14 30h92" />
      {wheel(84, 50, 6)}
      {wheel(40, 50, 6)}
    </>
  ),
  body_tipper: (
    <>
      <path d="M16 42h88l-8-24H26z" />
      <path d="M26 30h72" />
      {wheel(40)}
      {wheel(84)}
    </>
  ),
  body_tank: (
    <>
      <rect x="14" y="18" width="92" height="26" rx="13" />
      <path d="M44 18v26M76 18v26" />
      {wheel(84, 50, 6)}
    </>
  ),
  body_low_loader: (
    <>
      <path d="M12 26h26v14h44v-14h20" />
      <path d="M102 26v14" />
      {wheel(24, 46, 6)}
      {wheel(96, 46, 6)}
    </>
  ),
  body_vehicle_transport: (
    <>
      <path d="M10 44h100M10 30h100M10 16h72" />
      <path d="M10 16v28M110 30v14M82 16v14" />
      <path d="M110 30l-10-14" />
      {wheel(34, 50, 5)}
      {wheel(92, 50, 5)}
    </>
  ),
  body_unknown: (
    <>
      <rect x="20" y="16" width="80" height="32" strokeDasharray="6 5" />
      <path d="M54 40v-3c0-4 8-4 8-9a5 5 0 10-10 0" />
      <circle cx="58" cy="45" r="1.5" />
    </>
  ),

  // ── Aufnahme-Slots ──
  cab_34_front_left: (
    <>
      <path d="M20 48V26l10-12h22v34z" />
      <path d="M52 48V22h34v26z" />
      <path d="M24 22h20" />
      {wheel(34)}
      {wheel(76)}
    </>
  ),
  cab_side_left: (
    <>
      <path d="M14 48V26h14l6-10h14v32" />
      <path d="M28 26h12" />
      {wheel(24)}
      {wheel(44)}
    </>
  ),
  cab_front: (
    <>
      <rect x="30" y="12" width="60" height="38" rx="4" />
      <path d="M36 20h48M30 36h60" />
      <rect x="34" y="40" width="10" height="6" />
      <rect x="76" y="40" width="10" height="6" />
    </>
  ),
  mirror_detail: (
    <>
      <path d="M40 8v46" />
      <path d="M40 18h16v14H40z" />
      <path d="M56 25h10" />
      <circle cx="72" cy="25" r="4" />
    </>
  ),
  cab_interior: (
    <>
      <path d="M12 50V16h96v34" />
      <circle cx="42" cy="34" r="10" />
      <path d="M32 34h20" />
      <rect x="66" y="26" width="30" height="12" rx="2" />
    </>
  ),
  fifth_wheel: (
    <>
      <path d="M18 44V26h20v18z" />
      <path d="M38 38h58" />
      <ellipse cx="72" cy="34" rx="18" ry="6" />
      {wheel(52, 50, 6)}
      {wheel(88, 50, 6)}
    </>
  ),
  body_side_left: (
    <>
      <rect x="10" y="16" width="100" height="30" />
      <path d="M10 30h100" />
      {wheel(38, 50, 5)}
      {wheel(86, 50, 5)}
    </>
  ),
  body_rear: (
    <>
      <rect x="28" y="10" width="64" height="38" />
      <path d="M60 10v38" />
      <path d="M24 48h72" />
      <rect x="30" y="42" width="8" height="5" />
      <rect x="82" y="42" width="8" height="5" />
    </>
  ),
  body_34_rear_right: (
    <>
      <path d="M28 46V14h40v32z" />
      <path d="M68 14l24 8v24l-24 4z" />
      <path d="M48 14v32" />
      {wheel(84, 50, 5)}
    </>
  ),
  cargo_area: (
    <>
      <path d="M16 12h88v40H16z" />
      <path d="M34 24h52v20H34z" />
      <path d="M16 12l18 12M104 12L86 24M16 52l18-8M104 52l-18-8" />
    </>
  ),
  vin_plate: (
    <>
      <rect x="18" y="18" width="84" height="26" rx="3" />
      <path d="M26 28h48M26 36h34" />
      <path d="M84 26l8 8-8 8" />
    </>
  ),
};

export interface TruckSketchProps {
  id?: string | null;
  className?: string;
}

export const TruckSketch: React.FC<TruckSketchProps> = ({ id, className }) => {
  const content = id ? SKETCHES[id] : null;
  if (!content) return null;
  return (
    <svg
      viewBox={VB}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {content}
    </svg>
  );
};

export default TruckSketch;
