import { useState, type PointerEvent } from 'react';
import { Compass } from 'lucide-react';

type MultiAngleControl = 'azimuth' | 'elevation' | 'distance';

export interface ToolboxMultiAngleStageProps {
  azimuth: number;
  elevation: number;
  distance: number;
  imageUrl?: string;
  clipId: string;
  labels: { hZh: string; vZh: string; zZh: string };
  onChange: (patch: Partial<Record<'multiAngleAzimuth' | 'multiAngleElevation' | 'multiAngleDistance', number>>) => void;
}

function normalizeAngle(value: number) {
  return ((value % 360) + 360) % 360;
}

function clampNumber(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function roundAngle(value: number) {
  return Math.round(value);
}

export function ToolboxMultiAngleStage({ azimuth, elevation, distance, imageUrl, clipId, labels, onChange }: ToolboxMultiAngleStageProps) {
  const [dragControl, setDragControl] = useState<MultiAngleControl | null>(null);
  const cx = 178;
  const cy = 138;
  const ringR = 72;
  const azRad = (normalizeAngle(azimuth) * Math.PI) / 180;
  const camX = cx + Math.sin(azRad) * ringR;
  const camY = cy + Math.cos(azRad) * ringR;
  const distX1 = 252;
  const distX2 = 330;
  const distY = 202;
  const distX = distX1 + (clampNumber(distance, 0, 10, 5) / 10) * (distX2 - distX1);
  const elevTop = 58;
  const elevBottom = 218;
  const elevCenter = (elevTop + elevBottom) / 2;
  const safeElevation = clampNumber(elevation, -30, 60, 0);
  const elevY = safeElevation >= 0
    ? elevCenter - (safeElevation / 60) * (elevCenter - elevTop)
    : elevCenter + (Math.abs(safeElevation) / 30) * (elevBottom - elevCenter);

  const svgPoint = (event: PointerEvent<SVGElement>) => {
    const svg = event.currentTarget instanceof SVGSVGElement ? event.currentTarget : event.currentTarget.ownerSVGElement;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * 360,
      y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * 260,
    };
  };

  const applyDrag = (control: MultiAngleControl, event: PointerEvent<SVGElement>) => {
    const point = svgPoint(event);
    if (control === 'azimuth') {
      const degrees = normalizeAngle((Math.atan2(point.x - cx, point.y - cy) * 180) / Math.PI);
      onChange({ multiAngleAzimuth: Math.round(degrees) });
    } else if (control === 'elevation') {
      const y = clampNumber(point.y, elevTop, elevBottom, elevY);
      const next = y <= elevCenter
        ? ((elevCenter - y) / (elevCenter - elevTop)) * 60
        : -((y - elevCenter) / (elevBottom - elevCenter)) * 30;
      onChange({ multiAngleElevation: Math.round(next) });
    } else {
      const x = clampNumber(point.x, distX1, distX2, distX);
      const next = ((x - distX1) / (distX2 - distX1)) * 10;
      onChange({ multiAngleDistance: Number(next.toFixed(1)) });
    }
  };

  const startDrag = (control: MultiAngleControl, event: PointerEvent<SVGElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const svg = event.currentTarget instanceof SVGSVGElement ? event.currentTarget : event.currentTarget.ownerSVGElement;
    try { svg?.setPointerCapture(event.pointerId); } catch {}
    setDragControl(control);
    applyDrag(control, event);
  };

  return (
    <div className="t8-card p-2 space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: 'var(--t8-text-muted)' }}>
        <Compass size={12} />
        可视化机位
        <span className="ml-auto text-[10px] font-semibold" style={{ color: 'var(--t8-text-dim)' }}>
          {roundAngle(azimuth)}° / {roundAngle(elevation)}° / {distance.toFixed(1)}
        </span>
      </div>
      <svg
        viewBox="0 0 360 260"
        className="block w-full h-[230px] cursor-crosshair select-none"
        aria-label="可视化多角度相机控制"
        onPointerMove={(event) => { if (dragControl) applyDrag(dragControl, event); }}
        onPointerUp={() => setDragControl(null)}
        onPointerLeave={() => setDragControl(null)}
      >
        <defs>
          <clipPath id={clipId}><rect x="142" y="89" width="72" height="98" rx="9" /></clipPath>
          <linearGradient id={`${clipId}-card`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="var(--t8-bg-panel-elevated)" />
            <stop offset="1" stopColor="var(--t8-bg-panel-muted)" />
          </linearGradient>
        </defs>
        <rect x="8" y="8" width="344" height="244" rx="18" fill="var(--t8-bg-panel-muted)" opacity="0.7" />
        {Array.from({ length: 8 }).map((_, index) => (
          <path key={`grid-${index}`} d={`M${48 + index * 36} 34 V226`} stroke="var(--t8-grid-line)" strokeDasharray="2 8" opacity="0.42" />
        ))}
        {Array.from({ length: 5 }).map((_, index) => (
          <path key={`grid-h-${index}`} d={`M34 ${58 + index * 38} H326`} stroke="var(--t8-grid-line)" strokeDasharray="2 8" opacity="0.34" />
        ))}
        <circle cx={cx} cy={cy} r={ringR} fill="none" stroke="var(--t8-accent)" strokeWidth="5" opacity="0.16" onPointerDown={(event) => startDrag('azimuth', event)} />
        <circle cx={cx} cy={cy} r={ringR} fill="none" stroke="var(--t8-accent)" strokeWidth="2" strokeDasharray="5 7" opacity="0.62" onPointerDown={(event) => startDrag('azimuth', event)} />
        <line x1={camX} y1={camY} x2={cx} y2={cy} stroke="var(--t8-accent)" strokeWidth="2" opacity="0.76" />
        <circle cx={camX} cy={camY} r="12" fill="var(--t8-accent)" opacity="0.25" />
        <circle cx={camX} cy={camY} r="7" fill="var(--t8-accent)" stroke="var(--t8-bg-panel)" strokeWidth="2" onPointerDown={(event) => startDrag('azimuth', event)} />
        <path d={`M74 ${elevBottom} C48 154 52 96 74 ${elevTop}`} fill="none" stroke="var(--t8-secondary)" strokeWidth="5" opacity="0.18" />
        <path d={`M74 ${elevBottom} C48 154 52 96 74 ${elevTop}`} fill="none" stroke="var(--t8-secondary)" strokeWidth="2" opacity="0.7" onPointerDown={(event) => startDrag('elevation', event)} />
        <circle cx="74" cy={elevY} r="7" fill="var(--t8-secondary)" stroke="var(--t8-bg-panel)" strokeWidth="2" onPointerDown={(event) => startDrag('elevation', event)} />
        <text x="32" y="54" fontSize="9" fontWeight="800" fill="var(--t8-text-dim)">高</text>
        <text x="32" y="222" fontSize="9" fontWeight="800" fill="var(--t8-text-dim)">低</text>
        <line x1={distX1} y1={distY} x2={distX2} y2={distY} stroke="var(--t8-warning, #f59e0b)" strokeWidth="7" opacity="0.22" />
        <line x1={distX1} y1={distY} x2={distX2} y2={distY} stroke="var(--t8-warning, #f59e0b)" strokeWidth="2.5" strokeLinecap="round" onPointerDown={(event) => startDrag('distance', event)} />
        <circle cx={distX} cy={distY} r="7" fill="var(--t8-warning, #f59e0b)" stroke="var(--t8-bg-panel)" strokeWidth="2" onPointerDown={(event) => startDrag('distance', event)} />
        <text x="246" y="186" fontSize="9" fontWeight="800" fill="var(--t8-text-dim)">远</text>
        <text x="324" y="186" fontSize="9" fontWeight="800" fill="var(--t8-text-dim)">近</text>
        <rect x="142" y="89" width="72" height="98" rx="9" fill={`url(#${clipId}-card)`} stroke="var(--t8-border-strong)" strokeWidth="2" />
        {imageUrl ? (
          <image href={imageUrl} x="142" y="89" width="72" height="98" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipId})`} />
        ) : (
          <g opacity="0.85">
            <circle cx="178" cy="127" r="10" fill="var(--t8-accent)" opacity="0.22" />
            <path d="M164 169 C168 154 188 154 192 169" fill="var(--t8-accent)" opacity="0.18" />
            <path d="M164 169 C168 154 188 154 192 169" fill="none" stroke="var(--t8-accent)" strokeWidth="2" />
            <circle cx="178" cy="127" r="9" fill="none" stroke="var(--t8-accent)" strokeWidth="2" />
          </g>
        )}
        <rect x="142" y="89" width="72" height="98" rx="9" fill="none" stroke="var(--t8-border-strong)" strokeWidth="2" />
        <path d="M142 187 L214 187 L224 201 L132 201 Z" fill="var(--t8-accent)" opacity="0.12" />
        <g fontSize="10" fontWeight="800">
          <text x="178" y="32" textAnchor="middle" fill="var(--t8-text-main)">背面 180°</text>
          <text x="178" y="240" textAnchor="middle" fill="var(--t8-text-main)">正面 0°</text>
          <text x="315" y="142" textAnchor="middle" fill="var(--t8-text-main)">右侧</text>
          <text x="43" y="142" textAnchor="middle" fill="var(--t8-text-main)">左侧</text>
        </g>
      </svg>
      <div className="grid grid-cols-3 gap-1 text-[10px]">
        <div className="t8-card px-2 py-1"><div style={{ color: 'var(--t8-text-dim)' }}>水平</div><div className="font-bold truncate">{labels.hZh}</div></div>
        <div className="t8-card px-2 py-1"><div style={{ color: 'var(--t8-text-dim)' }}>垂直</div><div className="font-bold truncate">{labels.vZh}</div></div>
        <div className="t8-card px-2 py-1"><div style={{ color: 'var(--t8-text-dim)' }}>远近</div><div className="font-bold truncate">{labels.zZh}</div></div>
      </div>
    </div>
  );
}
