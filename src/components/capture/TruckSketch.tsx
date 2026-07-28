import React from 'react';
import imgTractorUnit from '@/assets/truck/tractor_unit.png';
import imgRigidTruck from '@/assets/truck/rigid_truck.png';
import imgRigidTruckTrailer from '@/assets/truck/rigid_truck_with_trailer.png';
import imgSemiTruck from '@/assets/truck/semi_truck.png';
import imgSemiTruckTrailer from '@/assets/truck/semi_truck_with_trailer.png';
import imgTrailerOnly from '@/assets/truck/trailer_only.png';
import imgBodyBoxClosed from '@/assets/truck/body_box_closed.png';
import imgBodyPlatformOpen from '@/assets/truck/body_platform_open.png';
import imgBodyTipper from '@/assets/truck/body_tipper.png';
import imgBodyTank from '@/assets/truck/body_tank.png';
import imgBodyLowLoader from '@/assets/truck/body_low_loader.png';
import imgBodyVehicleTransport from '@/assets/truck/body_vehicle_transport.png';
import imgBodyUnknown from '@/assets/truck/body_unknown.png';


/**
 * Technische Strichzeichnungen (Schemaskizzen) für den Lkw-Workflow.
 * Bewusst reduziert, eindeutig und ohne Marken- oder Fotobezug.
 */

const VB = '0 0 120 60';

const wheel = (cx: number, cy = 48, r = 7) => (
  <circle key={`w${cx}`} cx={cx} cy={cy} r={r} />
);

/* ── Bausteine für die detaillierten Konfigurations-Skizzen ───────────────── */

/** Rad mit Nabe (Seitenansicht). */
const rim = (cx: number, key: string) => (
  <g key={key}>
    <circle cx={cx} cy={80} r={10} />
    <circle cx={cx} cy={80} r={4} />
  </g>
);

/** Fahrerhaus / Zugmaschine, Front zeigt nach links. Breite ca. 52. */
const cab = (x: number) => (
  <g key={`cab${x}`}>
    <path
      d={`M${x} 78 V46 Q${x} 40 ${x + 8} 39 L${x + 12} 20 Q${x + 13} 15 ${x + 20} 15 H${x + 46} Q${x + 52} 15 ${x + 52} 22 V78`}
    />
    <path d={`M${x + 14} 38 L${x + 18} 22 Q${x + 19} 19 ${x + 24} 19 H${x + 36} V38 Z`} />
    <path d={`M${x + 38} 20 V62`} />
    <path d={`M${x + 41} 46 h5`} />
    <path d={`M${x} 66 H${x + 9}`} />
    <path d={`M${x + 6} 30 v8`} />
  </g>
);

/** Kastenaufbau / Auflieger-Box. */
const box = (x: number, w: number, top = 16) => (
  <g key={`box${x}`}>
    <rect x={x} y={top} width={w} height={54 - (top - 16)} rx={2} />
    <path d={`M${x} ${top + 6} H${x + w}`} />
  </g>
);

/** Fahrgestell-Rahmen unter einem Aufbau. */
const frame = (x1: number, x2: number) => (
  <g key={`fr${x1}`}>
    <path d={`M${x1} 70 H${x2}`} />
    <path d={`M${x1} 74 H${x2}`} />
  </g>
);

/** Deichsel zwischen Motorwagen und Anhänger. */
const drawbar = (x1: number, x2: number) => (
  <g key={`db${x1}`}>
    <path d={`M${x1} 72 H${x2}`} />
    <path d={`M${x1 + 2} 68 v8`} />
  </g>
);

/** Stützfüße eines Aufliegers. */
const legs = (x: number) => (
  <g key={`lg${x}`}>
    <path d={`M${x} 70 v18 M${x - 5} 88 h10`} />
    <path d={`M${x + 12} 70 v18 M${x + 7} 88 h10`} />
  </g>
);

const SKETCHES: Record<string, React.ReactNode> = {
  // ── Konfigurationen (detaillierte Seitenansichten) ──
  tractor_unit: (
    <>
      {cab(8)}
      <path d="M60 70 H74 V78" />
      <path d="M56 62 h16" />
      {rim(24, 'a')}
      {rim(58, 'b')}
    </>
  ),
  rigid_truck: (
    <>
      {cab(8)}
      {box(60, 96)}
      {frame(60, 158)}
      {rim(24, 'a')}
      {rim(112, 'b')}
      {rim(136, 'c')}
    </>
  ),
  rigid_truck_with_trailer: (
    <>
      {cab(8)}
      {box(60, 80)}
      {frame(60, 142)}
      {drawbar(142, 162)}
      {box(162, 84)}
      {frame(162, 246)}
      {rim(24, 'a')}
      {rim(112, 'b')}
      {rim(178, 'c')}
      {rim(230, 'd')}
    </>
  ),
  semi_truck: (
    <>
      {cab(8)}
      {box(52, 154, 14)}
      {frame(60, 206)}
      {rim(24, 'a')}
      {rim(48, 'b')}
      {rim(158, 'c')}
      {rim(182, 'd')}
    </>
  ),
  semi_truck_with_trailer: (
    <>
      {cab(8)}
      {box(52, 118, 14)}
      {frame(60, 170)}
      {drawbar(170, 190)}
      {box(190, 94, 14)}
      {frame(190, 284)}
      {rim(24, 'a')}
      {rim(48, 'b')}
      {rim(132, 'c')}
      {rim(206, 'd')}
      {rim(262, 'e')}
    </>
  ),
  trailer_only: (
    <>
      {box(10, 148, 14)}
      {frame(10, 158)}
      {legs(40)}
      {rim(108, 'a')}
      {rim(132, 'b')}
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

/** Eigene viewBox je Konfigurations-Skizze (unterschiedliche Fahrzeuglängen). */
const VIEWBOXES: Record<string, string> = {
  tractor_unit: '0 0 84 100',
  rigid_truck: '0 0 168 100',
  rigid_truck_with_trailer: '0 0 256 100',
  semi_truck: '0 0 216 100',
  semi_truck_with_trailer: '0 0 294 100',
  trailer_only: '0 0 168 100',
};

/** Exakte Fahrzeugskizzen (aus der Gestaltungsvorlage) je Konfiguration. */
const CONFIG_IMAGES: Record<string, string> = {
  tractor_unit: imgTractorUnit,
  rigid_truck: imgRigidTruck,
  rigid_truck_with_trailer: imgRigidTruckTrailer,
  semi_truck: imgSemiTruck,
  semi_truck_with_trailer: imgSemiTruckTrailer,
  trailer_only: imgTrailerOnly,
  body_box_closed: imgBodyBoxClosed,
  body_platform_open: imgBodyPlatformOpen,
  body_tipper: imgBodyTipper,
  body_tank: imgBodyTank,
  body_low_loader: imgBodyLowLoader,
  body_vehicle_transport: imgBodyVehicleTransport,
  body_unknown: imgBodyUnknown,
};

export interface TruckSketchProps {
  id?: string | null;
  className?: string;
}

export const TruckSketch: React.FC<TruckSketchProps> = ({ id, className }) => {
  const image = id ? CONFIG_IMAGES[id] : null;
  if (image) {
    return (
      <img
        src={image}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className={`object-contain ${className ?? ''}`}
      />
    );
  }

  const content = id ? SKETCHES[id] : null;
  if (!content) return null;
  return (
    <svg
      viewBox={(id && VIEWBOXES[id]) || VB}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={id && VIEWBOXES[id] ? 2.4 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {content}
    </svg>
  );
};


export default TruckSketch;
