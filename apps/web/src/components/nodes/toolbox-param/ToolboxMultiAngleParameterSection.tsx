import { Compass, SlidersHorizontal, Wand2 } from 'lucide-react';
import type {
  MultiAngleBatchMode,
  MultiAnglePatch,
  MultiAnglePreset,
  MultiAnglePromptMode,
  PromptLanguage,
} from './toolbox-param-schema';

export const TOOLBOX_PARAMETER_SECTION_LABELS = ['精准调节', '角度列表', '输出设置'] as const;

export interface ToolboxMultiAngleParameterSectionProps {
  azimuth: number;
  elevation: number;
  distance: number;
  selectedAzimuthPresetId: string;
  selectedElevationPresetId: string;
  selectedDistancePresetId: string;
  selectedCreativePresetId: string;
  batchMode: MultiAngleBatchMode;
  batchAngles: number[];
  promptMode: MultiAnglePromptMode;
  language: PromptLanguage;
  customAngles: string;
  azimuthPresets: readonly MultiAnglePreset[];
  elevationPresets: readonly MultiAnglePreset[];
  distancePresets: readonly MultiAnglePreset[];
  creativePresets: readonly MultiAnglePreset[];
  batchPresets: ReadonlyArray<{ id: MultiAngleBatchMode; label: string; angles: number[] }>;
  compactSelectClass: string;
  onPatch: (patch: MultiAnglePatch) => void;
}

function roundAngle(value: number) {
  return Math.round(value);
}

export function ToolboxMultiAngleParameterSection({
  azimuth,
  elevation,
  distance,
  selectedAzimuthPresetId,
  selectedElevationPresetId,
  selectedDistancePresetId,
  selectedCreativePresetId,
  batchMode,
  batchAngles,
  promptMode,
  language,
  customAngles,
  azimuthPresets,
  elevationPresets,
  distancePresets,
  creativePresets,
  batchPresets,
  compactSelectClass,
  onPatch,
}: ToolboxMultiAngleParameterSectionProps) {
  return (
    <>
      <section className="t8-card p-2 space-y-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: 'var(--t8-text-muted)' }}>
          <SlidersHorizontal size={12} />
          精准调节
        </div>
        <div className="grid grid-cols-[52px_1fr_40px] gap-2 items-center text-[11px]">
          <span style={{ color: 'var(--t8-text-dim)' }}>水平</span>
          <input type="range" min={0} max={360} step={1} value={roundAngle(azimuth)} onChange={(e) => onPatch({ multiAngleAzimuth: Number(e.target.value) })} style={{ accentColor: 'var(--t8-accent)' }} />
          <span className="text-right font-bold">{roundAngle(azimuth)}°</span>
          <span style={{ color: 'var(--t8-text-dim)' }}>垂直</span>
          <input type="range" min={-30} max={60} step={1} value={roundAngle(elevation)} onChange={(e) => onPatch({ multiAngleElevation: Number(e.target.value) })} style={{ accentColor: 'var(--t8-secondary)' }} />
          <span className="text-right font-bold">{roundAngle(elevation)}°</span>
          <span style={{ color: 'var(--t8-text-dim)' }}>远近</span>
          <input type="range" min={0} max={10} step={0.1} value={distance} onChange={(e) => onPatch({ multiAngleDistance: Number(e.target.value) })} style={{ accentColor: 'var(--t8-warning, #f59e0b)' }} />
          <span className="text-right font-bold">{distance.toFixed(1)}</span>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <div className="t8-card p-2 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: 'var(--t8-text-muted)' }}>
            <Compass size={12} />
            角度列表
          </div>
          <select className={compactSelectClass} value={selectedAzimuthPresetId} onChange={(e) => {
            const preset = azimuthPresets.find((item) => item.id === e.target.value);
            if (preset) onPatch({ multiAngleAzimuth: preset.azimuth });
          }}>
            <option value="">方向：当前 {roundAngle(azimuth)}°</option>
            {azimuthPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
          </select>
          <select className={compactSelectClass} value={selectedElevationPresetId} onChange={(e) => {
            const preset = elevationPresets.find((item) => item.id === e.target.value);
            if (preset) onPatch({ multiAngleElevation: preset.elevation });
          }}>
            <option value="">高度：当前 {roundAngle(elevation)}°</option>
            {elevationPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
          </select>
          <select className={compactSelectClass} value={selectedDistancePresetId} onChange={(e) => {
            const preset = distancePresets.find((item) => item.id === e.target.value);
            if (preset) onPatch({ multiAngleDistance: preset.distance });
          }}>
            <option value="">远近：当前 {distance.toFixed(1)}</option>
            {distancePresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
          </select>
          <select className={compactSelectClass} value={selectedCreativePresetId} onChange={(e) => {
            const preset = creativePresets.find((item) => item.id === e.target.value);
            if (preset) onPatch({ multiAngleAzimuth: preset.azimuth, multiAngleElevation: preset.elevation, multiAngleDistance: preset.distance });
          }}>
            <option value="">快捷机位</option>
            {creativePresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
          </select>
        </div>

        <div className="t8-card p-2 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: 'var(--t8-text-muted)' }}>
            <Wand2 size={12} />
            输出设置
          </div>
          <select className={compactSelectClass} value={batchMode} onChange={(e) => onPatch({ multiAngleBatchMode: e.target.value as MultiAngleBatchMode })}>
            {batchPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}{preset.id === 'single' ? '' : ` · ${preset.id === 'custom' ? batchAngles.length || 0 : preset.angles.length}条`}
              </option>
            ))}
          </select>
          {batchMode === 'custom' && (
            <input className="t8-input w-full h-8 px-2 text-[11px]" value={customAngles} placeholder="0,45,90,180" onChange={(e) => onPatch({ multiAngleBatchCustomAngles: e.target.value })} />
          )}
          <select className={compactSelectClass} value={promptMode} onChange={(e) => onPatch({ multiAnglePromptMode: e.target.value as MultiAnglePromptMode })}>
            <option value="qwen">Prompt：Qwen</option>
            <option value="general">Prompt：通用</option>
            <option value="dual">Prompt：双格式</option>
          </select>
          <select className={compactSelectClass} value={language} onChange={(e) => onPatch({ multiAngleLanguage: e.target.value as PromptLanguage })}>
            <option value="en">语言：EN</option>
            <option value="zh">语言：中</option>
          </select>
        </div>
      </section>
    </>
  );
}
