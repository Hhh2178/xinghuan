import { Loader2, RefreshCw, Search } from 'lucide-react';

import type { RunningHubCatalogItem } from '../../services/runninghubCatalog';
import { inferValueType } from './runninghubNodeHelpers';
import type { Material } from './useUpstreamMaterials';
import MaterialPreviewSection from './MaterialPreviewSection';

interface RunningHubNodeConfigSectionProps {
  accent: Record<string, string>;
  isDark: boolean;
  isPixel: boolean;
  workflowPresetId: string;
  workflowCatalog: RunningHubCatalogItem[];
  catalogLoading: boolean;
  catalogError: string;
  selectedWorkflowPreset: RunningHubCatalogItem | null;
  selectedSchemaPropertyCount: number;
  schemaInputCount: number;
  schemaOutputCount: number;
  selectedPresetHasNoResolvedFields: boolean;
  selectedPresetAllowsEmptyInputs: boolean;
  presetMixedStateError: string;
  currentNodeInfoList: any[];
  orderedTexts: Material[];
  orderedImages: Material[];
  orderedVideos: Material[];
  orderedAudios: Material[];
  excludedUpstreamCount: number;
  materialOrder: string[];
  showManualRunTarget: boolean;
  webappId: string;
  fetchingInfo: boolean;
  onReorderMaterials: (nextOrder: string[]) => void;
  onExcludeUpstreamMaterial: (material: Material) => void;
  onRestoreExcludedMaterials: () => void;
  onSelectWorkflowPreset: (catalogId: string) => void;
  onToggleManualRunTarget: () => void;
  onChangeWebappId: (value: string) => void;
  onFetchInfo: () => void;
}

export default function RunningHubNodeConfigSection({
  accent,
  isDark,
  isPixel,
  workflowPresetId,
  workflowCatalog,
  catalogLoading,
  catalogError,
  selectedWorkflowPreset,
  selectedSchemaPropertyCount,
  schemaInputCount,
  schemaOutputCount,
  selectedPresetHasNoResolvedFields,
  selectedPresetAllowsEmptyInputs,
  presetMixedStateError,
  currentNodeInfoList,
  orderedTexts,
  orderedImages,
  orderedVideos,
  orderedAudios,
  excludedUpstreamCount,
  materialOrder,
  showManualRunTarget,
  webappId,
  fetchingInfo,
  onReorderMaterials,
  onExcludeUpstreamMaterial,
  onRestoreExcludedMaterials,
  onSelectWorkflowPreset,
  onToggleManualRunTarget,
  onChangeWebappId,
  onFetchInfo,
}: RunningHubNodeConfigSectionProps) {
  const totalInputMaterials = orderedTexts.length + orderedImages.length + orderedVideos.length + orderedAudios.length;
  const textFieldCount = currentNodeInfoList.filter((item: any) => inferValueType(item?.fieldType) === 'text').length;
  const imageFieldCount = currentNodeInfoList.filter((item: any) => inferValueType(item?.fieldType) === 'image').length;
  const videoFieldCount = currentNodeInfoList.filter((item: any) => inferValueType(item?.fieldType) === 'video').length;
  const audioFieldCount = currentNodeInfoList.filter((item: any) => inferValueType(item?.fieldType) === 'audio').length;

  return (
    <>
      {(totalInputMaterials + excludedUpstreamCount) > 0 && (
        <MaterialPreviewSection
          texts={orderedTexts}
          images={orderedImages}
          videos={orderedVideos}
          audios={orderedAudios}
          order={materialOrder}
          onReorder={onReorderMaterials}
          onExcludeUpstream={onExcludeUpstreamMaterial}
          excludedCount={excludedUpstreamCount}
          onRestoreExcluded={onRestoreExcludedMaterials}
          isDark={isDark}
          isPixel={isPixel}
          groups={['text', 'image', 'video', 'audio']}
          title="通用输入 · 拖拽可调整顺序"
        />
      )}

      <div>
        <label className="text-[10px] text-white/50 block mb-1">后台条目</label>
        <select
          value={workflowPresetId}
          onChange={(event) => onSelectWorkflowPreset(event.target.value)}
          className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
        >
          <option value="">{catalogLoading ? '正在读取后台条目...' : '请选择后台已配置的 RH 条目'}</option>
          {workflowCatalog.map((workflow) => (
            <option key={workflow.catalogId} value={workflow.catalogId}>
              {`${workflow.title} · ${workflow.providerName} · ${workflow.fields.length} 字段`}
            </option>
          ))}
        </select>
        {selectedWorkflowPreset ? (
          <div className={`mt-1 rounded border ${accent.subBg} px-2 py-1.5`}>
            <div className="text-[11px] font-medium text-white/90 truncate">{selectedWorkflowPreset.title}</div>
            <div className="mt-1 text-[10px] text-white/70">
              {(selectedWorkflowPreset.taskCapability || 'video')} · 绑定 {schemaInputCount || selectedWorkflowPreset.fields.length} · Schema {selectedSchemaPropertyCount} · 输出 {schemaOutputCount}
            </div>
            {selectedWorkflowPreset.note ? (
              <div className="mt-1 rounded border border-white/10 bg-black/20 px-2 py-1.5">
                <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/60">备注</span>
                <div className="mt-1 text-[10px] leading-4 text-white/85 line-clamp-3">{selectedWorkflowPreset.note}</div>
              </div>
            ) : null}
          </div>
        ) : null}
        {selectedPresetHasNoResolvedFields ? (
          <div className="mt-1 rounded border border-amber-400/30 bg-amber-500/10 px-2 py-1.5 text-[10px] leading-4 text-amber-100/90">
            {selectedSchemaPropertyCount > 0
              ? `当前 RH 条目已定义 ${selectedSchemaPropertyCount} 个结构化参数，但还没有可执行的 RH 绑定字段。节点不会直接生成可提交表单，请先到后台 RH 工作台补齐 nodeId 和 fieldName。`
              : '当前 RH 条目还没有可用的输入槽定义。节点无法自动展开参数区，请先到后台 RH 工作台补齐至少一个包含 nodeId 和 fieldName 的输入槽。'}
          </div>
        ) : null}
        {selectedWorkflowPreset && selectedPresetAllowsEmptyInputs ? (
          <div className="mt-1 rounded border border-emerald-400/30 bg-emerald-500/10 px-2 py-1.5 text-[10px] leading-4 text-emerald-100/90">
            当前 RH 条目被标记为无入参工作流。参数区为空属于正常现象，可以直接运行。
          </div>
        ) : null}
        {presetMixedStateError ? (
          <div className="mt-1 rounded border border-rose-400/30 bg-rose-500/10 px-2 py-1.5 text-[10px] leading-4 text-rose-100/90">
            {presetMixedStateError}
          </div>
        ) : null}
        {!selectedWorkflowPreset && catalogError ? <div className="text-[10px] text-rose-300/80 mt-1">{catalogError}</div> : null}
      </div>

      <div className="rounded border border-white/10 bg-white/[0.03] px-2 py-1.5">
        <div className="flex items-center justify-between gap-2 text-[10px] text-white/70">
          <span>通用输入</span>
          <span>{totalInputMaterials} 项</span>
        </div>
        <div className="mt-1 text-[10px] leading-4 text-white/40">
          文本、图片、视频、音频统一从左侧一个输入口进入，再按后台条目的字段规则自动分配。
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-[10px] text-white/45">
        <span>
          文本 {textFieldCount}
          {' '}· 图片 {imageFieldCount}
          {' '}· 视频 {videoFieldCount}
          {' '}· 音频 {audioFieldCount}
        </span>
        <button
          type="button"
          onClick={onToggleManualRunTarget}
          className="text-[10px] text-cyan-200/80 hover:text-cyan-100 shrink-0"
        >
          {showManualRunTarget ? '收起高级' : '高级方式'}
        </button>
      </div>

      {showManualRunTarget ? (
        <div>
          <label className="text-[10px] text-white/50 block mb-1">手动运行目标</label>
          <div className="flex gap-1">
            <input
              type="text"
              value={webappId}
              onChange={(event) => onChangeWebappId(event.target.value)}
              placeholder="仅在后台目录尚未配置时使用"
              className="flex-1 rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30 placeholder:text-white/30"
            />
            <button
              onClick={onFetchInfo}
              disabled={fetchingInfo}
              title="拉取运行目标信息"
              className="px-2 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 disabled:opacity-50"
            >
              {fetchingInfo ? <Loader2 size={11} className="animate-spin" /> : <Search size={11} />}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
