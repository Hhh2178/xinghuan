import { type CSSProperties } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ArrowLeft, Loader2, Search, Sparkles, Square } from 'lucide-react';

import MaterialPreviewSection from './MaterialPreviewSection';
import ResizableCorners from './ResizableCorners';
import RHToolsNodeParamSection from './RHToolsNodeParamSection';
import RHToolsNodeRuntimeSection from './RHToolsNodeRuntimeSection';
import type { MediaMention } from './mediaMentions';
import type { Material } from './useUpstreamMaterials';
import type { RHTool } from '../../services/api';
import type { RhParamValue } from '../../utils/rhTextBinding';

interface RHToolsNodeRunnerViewProps {
  activeApp: RHTool;
  webappId: string;
  selected: boolean;
  size: { w: number; h: number };
  accent: string;
  accentSoft: string;
  ringColor: string;
  bg: string;
  surface: string;
  text: string;
  subText: string;
  border: string;
  isLight: boolean;
  isDark: boolean;
  isPixel: boolean;
  fetchingInfo: boolean;
  instanceType: string;
  status: 'idle' | 'submitting' | 'polling' | 'success' | 'error' | 'cancelled';
  taskId?: string;
  rhProgress: string;
  rhQueueHint: string;
  urls: string[];
  error: string | null;
  isBusy: boolean;
  isCancelling: boolean;
  hasAutoOutput: boolean;
  nodeInfoList: any[];
  paramValues: Record<string, RhParamValue>;
  fieldKindIndex: Record<string, number>;
  orderedTexts: Material[];
  orderedImages: Material[];
  orderedVideos: Material[];
  orderedAudios: Material[];
  mentionMaterials: Material[];
  excludedUpstreamCount: number;
  materialOrder: string[];
  onResize: (_event: any, payload: { width: number; height: number }) => void;
  onBack: () => void;
  onFetchInfo: () => void;
  onRun: () => void;
  onStop: () => void;
  onMaterialOrderChange: (order: string[]) => void;
  onExcludeUpstreamMaterial: (material: Material) => void;
  onRestoreExcludedMaterials: () => void;
  onInstanceTypeChange: (value: string) => void;
  findUpstreamUrl: (kind: 'image' | 'video' | 'audio', idx?: number) => string;
  getParamMentions: (key: string) => MediaMention[];
  setParam: (key: string, patch: Partial<RhParamValue>) => void;
  setTextParam: (key: string, value: string, mentions: MediaMention[]) => void;
}

const handleStyle: CSSProperties = { zIndex: 10 };

export default function RHToolsNodeRunnerView({
  activeApp,
  webappId,
  selected,
  size,
  accent,
  accentSoft,
  ringColor,
  bg,
  surface,
  text,
  subText,
  border,
  isLight,
  isDark,
  isPixel,
  fetchingInfo,
  instanceType,
  status,
  taskId,
  rhProgress,
  rhQueueHint,
  urls,
  error,
  isBusy,
  isCancelling,
  hasAutoOutput,
  nodeInfoList,
  paramValues,
  fieldKindIndex,
  orderedTexts,
  orderedImages,
  orderedVideos,
  orderedAudios,
  mentionMaterials,
  excludedUpstreamCount,
  materialOrder,
  onResize,
  onBack,
  onFetchInfo,
  onRun,
  onStop,
  onMaterialOrderChange,
  onExcludeUpstreamMaterial,
  onRestoreExcludedMaterials,
  onInstanceTypeChange,
  findUpstreamUrl,
  getParamMentions,
  setParam,
  setTextParam,
}: RHToolsNodeRunnerViewProps) {
  return (
    <div
      className="t8-rh-tools-node relative rounded-xl shadow-lg flex flex-col"
      style={{
        background: bg,
        color: text,
        width: size.w,
        height: size.h,
        minWidth: 280,
        minHeight: 360,
        boxSizing: 'border-box',
        border: `2px solid ${selected ? accent : ringColor}`,
        overflow: 'visible',
      }}
    >
      <Handle type="target" position={Position.Left} className="!bg-cyan-400 !border-0" style={handleStyle} />
      <Handle type="source" position={Position.Right} className="!bg-cyan-400 !border-0" style={handleStyle} />

      <ResizableCorners
        selected={selected}
        minWidth={280}
        minHeight={360}
        accent={accent}
        onResize={onResize}
      />

      <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ borderBottom: `1px solid ${border}` }}>
        <button
          onClick={onBack}
          onMouseDown={(event) => event.stopPropagation()}
          className="p-1 rounded hover:opacity-80 nodrag"
          title="返回应用列表"
          style={{ color: subText }}
        >
          <ArrowLeft size={14} />
        </button>
        <div
          className="flex items-center justify-center"
          style={{ width: 24, height: 24, borderRadius: 6, background: accentSoft, color: accent }}
        >
          <Sparkles size={13} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-tight truncate" style={{ color: text }}>
            {activeApp.title}
          </div>
          <div className="text-[10px] truncate" style={{ color: subText }}>
            {activeApp.description || `webappId: ${webappId}`}
          </div>
        </div>
      </div>

      {isBusy ? (
        <div className="px-3 pt-2 shrink-0">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: border }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: rhProgress || (status === 'submitting' ? '5%' : '45%'), background: accent }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px]" style={{ color: accent }}>
            <span>{rhQueueHint || (status === 'submitting' ? '任务提交中' : '任务已提交，正在生成')}</span>
            <span>{rhProgress || (status === 'submitting' ? '5%' : '45%')}</span>
          </div>
        </div>
      ) : null}

      <div
        className="flex-1 overflow-y-auto px-2.5 py-2 space-y-2 nowheel nodrag"
        style={{ minHeight: 0 }}
        onMouseDown={(event) => event.stopPropagation()}
        onWheelCapture={(event) => event.stopPropagation()}
      >
        {(orderedTexts.length + orderedImages.length + orderedVideos.length + orderedAudios.length + excludedUpstreamCount) > 0 && (
          <MaterialPreviewSection
            texts={orderedTexts}
            images={orderedImages}
            videos={orderedVideos}
            audios={orderedAudios}
            order={materialOrder}
            onReorder={onMaterialOrderChange}
            onExcludeUpstream={onExcludeUpstreamMaterial}
            excludedCount={excludedUpstreamCount}
            onRestoreExcluded={onRestoreExcludedMaterials}
            isDark={isDark}
            isPixel={isPixel}
            groups={['text', 'image', 'video', 'audio']}
            title="上游素材 · 拖拽可调整顺序"
          />
        )}

        <div>
          <label className="text-[10px] block mb-1" style={{ color: subText }}>Webapp ID</label>
          <div className="flex gap-1">
            <input
              type="text"
              value={webappId}
              readOnly
              className="flex-1 rounded px-2 py-1 text-xs outline-none cursor-not-allowed"
              style={{ background: surface, color: text, border: `1px solid ${border}` }}
            />
            <button
              onClick={onFetchInfo}
              disabled={fetchingInfo}
              title="重新拉取应用信息"
              onMouseDown={(event) => event.stopPropagation()}
              className="px-2 rounded disabled:opacity-50 nodrag"
              style={{ background: surface, color: subText, border: `1px solid ${border}` }}
            >
              {fetchingInfo ? <Loader2 size={11} className="animate-spin" /> : <Search size={11} />}
            </button>
          </div>
        </div>

        <RHToolsNodeParamSection
          nodeInfoList={nodeInfoList}
          paramValues={paramValues}
          orderedTexts={orderedTexts}
          mentionMaterials={mentionMaterials}
          fieldKindIndex={fieldKindIndex}
          accent={accent}
          accentSoft={accentSoft}
          border={border}
          ringColor={ringColor}
          surface={surface}
          bg={bg}
          text={text}
          subText={subText}
          isDark={isDark}
          isPixel={isPixel}
          findUpstreamUrl={findUpstreamUrl}
          getParamMentions={getParamMentions}
          setParam={setParam}
          setTextParam={setTextParam}
        />

        <div>
          <label className="text-[10px] block mb-1" style={{ color: subText }}>实例类型(可选)</label>
          <select
            value={instanceType || ''}
            onChange={(event) => onInstanceTypeChange(event.target.value)}
            className="w-full rounded px-2 py-1 text-xs outline-none"
            style={{ background: surface, color: text, border: `1px solid ${border}` }}
          >
            <option value="">默认</option>
            <option value="plus">plus</option>
            <option value="pro">pro</option>
          </select>
        </div>

        {!isBusy ? (
          <button
            onClick={onRun}
            onMouseDown={(event) => event.stopPropagation()}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium nodrag"
            style={{ background: accentSoft, color: accent, border: `1px solid ${ringColor}` }}
            onMouseEnter={(event) => (event.currentTarget.style.background = isPixel ? 'var(--px-yellow)' : (isLight ? 'rgba(8,145,178,0.20)' : 'rgba(34,211,238,0.25)'))}
            onMouseLeave={(event) => (event.currentTarget.style.background = accentSoft)}
          >
            <Sparkles size={12} /> 运行应用
          </button>
        ) : (
          <button
            onClick={onStop}
            onMouseDown={(event) => event.stopPropagation()}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium nodrag"
            style={{ background: surface, color: text, border: `1px solid ${border}` }}
          >
            <Square size={11} /> {taskId ? '取消任务' : '停止观察'}
          </button>
        )}

        <RHToolsNodeRuntimeSection
          isBusy={isBusy}
          status={status}
          rhProgress={rhProgress}
          rhQueueHint={rhQueueHint}
          taskId={taskId}
          isCancelling={isCancelling}
          error={error}
          urls={urls}
          hasAutoOutput={hasAutoOutput}
          border={border}
          accent={accent}
          subText={subText}
          isLight={isLight}
        />
      </div>
    </div>
  );
}
