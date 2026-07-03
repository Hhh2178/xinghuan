import { memo, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { AlertCircle, ArrowLeft, Loader2, Play, RefreshCw, Search, ServerCog, Workflow } from 'lucide-react';
import { getComfyuiAppCatalog } from '../../services/api';
import { runComfyuiApp } from '../../services/comfyuiApps';
import { PORT_COLOR } from '../../config/portTypes';
import { useRunTrigger } from '../../hooks/useRunTrigger';
import { logBus } from '../../stores/logs';
import { taskCompletionSound } from '../../stores/taskCompletionSound';
import { useThemeStore } from '../../stores/theme';
import {
  buildComfyAppFromCatalogWorkflow,
  comfyAppInputRequirements,
  defaultComfyAppParamValues,
  type ComfyAppDefinition,
} from '../../utils/comfyuiApps';
import {
  countExcludedMaterials,
  excludeMaterialId,
  filterExcludedMaterials,
  normalizeExcludedMaterialIds,
} from '../../utils/materialExclusion';
import MaterialPreviewSection from './MaterialPreviewSection';
import ResizableCorners from './ResizableCorners';
import { useOrderedMaterials } from './useOrderedMaterials';
import { useUpdateNodeData } from './useUpdateNodeData';
import { useUpstreamMaterials, type Material } from './useUpstreamMaterials';
import type {
  AdvancedProviderConfig,
  ComfyuiCatalogInstance,
  ComfyuiCatalogResponse,
  ComfyuiCatalogWorkflow,
  ComfyuiRunOutput,
} from '../../types/canvas';

const handleStyle: CSSProperties = {
  width: 12,
  height: 12,
  border: 'none',
  zIndex: 20,
};

function parseInputValue(kind: string, value: unknown) {
  if (kind === 'number') {
    const n = Number(value);
    return Number.isFinite(n) ? n : '';
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

interface CatalogEntry {
  workflow: ComfyuiCatalogWorkflow;
  instance: ComfyuiCatalogInstance | null;
  app: ComfyAppDefinition;
}

function buildProviderFromEntry(entry: CatalogEntry): AdvancedProviderConfig {
  return {
    id: `comfyui-instance-${entry.instance?.id || entry.workflow.instanceId}`,
    label: entry.instance?.name || entry.workflow.instanceId,
    protocol: 'comfyui',
    enabled: true,
    baseUrl: entry.instance?.baseUrl || 'http://127.0.0.1:8188',
    comfyuiConfig: {
      instances: [entry.instance?.baseUrl || 'http://127.0.0.1:8188'],
      workflows: [
        {
          id: entry.workflow.sharedWorkflowId || entry.workflow.id,
          name: entry.workflow.title,
          workflowJson: entry.workflow.workflowJson as Record<string, any>,
          fields: entry.app.fields,
        },
      ],
    },
  };
}

function outputStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  if (typeof value === 'string') {
    const text = value.trim();
    return text ? [text] : [];
  }
  return [];
}

const ComfyUIApplicationNode = ({ id, data, selected }: NodeProps) => {
  const update = useUpdateNodeData(id);
  const { theme, style } = useThemeStore();
  const isLight = theme === 'light';
  const isDark = theme === 'dark';
  const isPixel = style === 'pixel';
  const d = (data || {}) as any;
  const size = d.size && typeof d.size.w === 'number' ? d.size : { w: 420, h: 620 };
  const [catalog, setCatalog] = useState<ComfyuiCatalogResponse | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogMessage, setCatalogMessage] = useState('');

  async function refreshCatalog() {
    setCatalogLoading(true);
    setCatalogMessage('');
    try {
      const nextCatalog = await getComfyuiAppCatalog();
      setCatalog(nextCatalog);
    } catch (error) {
      setCatalogMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setCatalogLoading(false);
    }
  }

  useEffect(() => {
    void refreshCatalog();
  }, []);

  const entries = useMemo<CatalogEntry[]>(() => {
    const instancesById = new Map((catalog?.instances || []).map((instance) => [instance.id, instance]));
    return (catalog?.workflows || []).map((workflow) => {
      const instance = instancesById.get(workflow.instanceId) || null;
      return {
        workflow,
        instance,
        app: buildComfyAppFromCatalogWorkflow(workflow, instance),
      };
    });
  }, [catalog]);

  const activeWorkflowId = String(d.sharedWorkflowId || d.comfyuiAppWorkflowId || '');
  const activeEntry = useMemo(
    () => entries.find((entry) => (
      entry.workflow.sharedWorkflowId === activeWorkflowId
      || entry.workflow.id === activeWorkflowId
    )) || null,
    [entries, activeWorkflowId],
  );

  useEffect(() => {
    if (!entries.length) return;
    if (activeEntry) return;
    const fallback = entries[0];
    update({
      sharedWorkflowId: fallback.workflow.sharedWorkflowId || fallback.workflow.id,
      comfyuiAppWorkflowId: fallback.workflow.sharedWorkflowId || fallback.workflow.id,
      comfyuiAppInstanceId: fallback.workflow.instanceId,
      comfyuiAppParamValues: defaultComfyAppParamValues(fallback.app),
      comfyuiAppSelectedOutputKey: fallback.app.outputs[0]?.key || '',
    });
  }, [activeEntry, entries, update]);

  const query = String(d.comfyuiAppSearchQuery || '').trim().toLowerCase();
  const filteredEntries = useMemo(() => (
    entries.filter((entry) => {
      if (!query) return true;
      return `${entry.workflow.title} ${entry.workflow.description || ''} ${entry.instance?.name || ''} ${(entry.instance?.capabilities || []).join(' ')}`
        .toLowerCase()
        .includes(query);
    })
  ), [entries, query]);

  const app = activeEntry?.app || null;
  const req = comfyAppInputRequirements(app);
  const paramValues = {
    ...defaultComfyAppParamValues(app),
    ...(d.comfyuiAppParamValues || {}),
  };
  const status = d.status || 'idle';
  const isBusy = status === 'running' || status === 'submitting';
  const namedOutputs: ComfyuiRunOutput[] = Array.isArray(d.outputs) ? d.outputs : [];
  const namedOutputImages = namedOutputs.flatMap((item) => item.kind === 'image' ? outputStringList(item.value) : []);
  const namedOutputVideos = namedOutputs.flatMap((item) => item.kind === 'video' ? outputStringList(item.value) : []);
  const namedOutputAudios = namedOutputs.flatMap((item) => item.kind === 'audio' ? outputStringList(item.value) : []);
  const namedOutputTexts = namedOutputs
    .filter((item) => item.kind === 'text')
    .map((item) => String(item.value ?? '').trim())
    .filter(Boolean);
  const outputImages: string[] = namedOutputImages.length
    ? namedOutputImages
    : Array.isArray(d.imageUrls) ? d.imageUrls : (d.imageUrl ? [d.imageUrl] : []);
  const outputVideos: string[] = namedOutputVideos.length
    ? namedOutputVideos
    : Array.isArray(d.videoUrls) ? d.videoUrls : [];
  const outputAudios: string[] = namedOutputAudios.length
    ? namedOutputAudios
    : Array.isArray(d.audioUrls) ? d.audioUrls : [];
  const outputText = namedOutputTexts.join('\n').trim() || String(d.outputText || '');

  const upstream = useUpstreamMaterials(id);
  const excludedMaterialIds = useMemo(() => normalizeExcludedMaterialIds(d.excludedMaterialIds), [d.excludedMaterialIds]);
  const visibleTexts = useMemo(() => filterExcludedMaterials(upstream.texts, excludedMaterialIds), [upstream.texts, excludedMaterialIds]);
  const visibleImages = useMemo(() => filterExcludedMaterials(upstream.images, excludedMaterialIds), [upstream.images, excludedMaterialIds]);
  const visibleVideos = useMemo(() => filterExcludedMaterials(upstream.videos, excludedMaterialIds), [upstream.videos, excludedMaterialIds]);
  const visibleAudios = useMemo(() => filterExcludedMaterials(upstream.audios, excludedMaterialIds), [upstream.audios, excludedMaterialIds]);
  const excludedCount = useMemo(
    () => countExcludedMaterials(excludedMaterialIds, [...upstream.texts, ...upstream.images, ...upstream.videos, ...upstream.audios]),
    [excludedMaterialIds, upstream.texts, upstream.images, upstream.videos, upstream.audios],
  );
  const order: string[] = Array.isArray(d.materialOrder) ? d.materialOrder : [];
  const orderedTexts = useOrderedMaterials(visibleTexts, order);
  const orderedImages = useOrderedMaterials(visibleImages, order);
  const orderedVideos = useOrderedMaterials(visibleVideos, order);
  const orderedAudios = useOrderedMaterials(visibleAudios, order);

  const bg = isPixel ? 'var(--px-surface)' : isLight ? '#ffffff' : 'rgba(15, 23, 42, 0.96)';
  const text = isPixel ? 'var(--px-ink)' : isLight ? '#0f172a' : '#e5f7fb';
  const sub = isPixel ? 'var(--px-ink-soft)' : isLight ? '#64748b' : 'rgba(229,247,251,0.62)';
  const border = isPixel ? 'var(--px-ink)' : isLight ? 'rgba(14,165,233,0.24)' : 'rgba(56,189,248,0.24)';
  const accent = '#38bdf8';
  const inputCls = isPixel ? 'px-input nodrag nowheel w-full px-2 py-1 text-xs' : 'nodrag nowheel w-full rounded border px-2 py-1 text-xs outline-none';
  const inputStyle: CSSProperties = isPixel ? {} : {
    background: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.06)',
    borderColor: border,
    color: text,
  };
  const buttonCls = isPixel
    ? 'px-btn nodrag nowheel inline-flex items-center justify-center gap-1 px-2 py-1 text-[11px]'
    : 'nodrag nowheel inline-flex items-center justify-center gap-1 rounded border px-2 py-1 text-[11px]';
  const rootStyle: CSSProperties = {
    width: size.w,
    height: size.h,
    minWidth: 360,
    minHeight: 460,
    background: bg,
    color: text,
    border: `2px solid ${selected ? accent : border}`,
    borderRadius: isPixel ? 8 : 14,
    overflow: 'hidden',
    boxShadow: isPixel ? '3px 3px 0 var(--px-ink)' : 'var(--t8-node-shadow, 0 12px 30px rgba(0,0,0,0.28))',
  };

  const setOrder = (next: string[]) => update({ materialOrder: next });
  const excludeMaterial = (material: Material) => {
    if (material.origin !== 'upstream') return;
    update({
      excludedMaterialIds: excludeMaterialId(excludedMaterialIds, material.id),
      materialOrder: order.filter((item) => item !== material.id),
    });
  };
  const setParam = (key: string, value: unknown) => update({ comfyuiAppParamValues: { ...paramValues, [key]: value } });
  const selectEntry = (entry: CatalogEntry) => update({
    sharedWorkflowId: entry.workflow.sharedWorkflowId || entry.workflow.id,
    comfyuiAppWorkflowId: entry.workflow.sharedWorkflowId || entry.workflow.id,
    comfyuiAppInstanceId: entry.workflow.instanceId,
    comfyuiAppParamValues: defaultComfyAppParamValues(entry.app),
    comfyuiAppSelectedOutputKey: entry.app.outputs[0]?.key || '',
    status: 'idle',
    error: '',
  });

  const handleRun = async () => {
    const src = `comfyui-app:${id.slice(0, 6)}`;
    if (!activeEntry || !app) {
      update({ status: 'error', error: '请先选择一个共享 ComfyUI 工作流。' });
      throw new Error('请先选择一个共享 ComfyUI 工作流。');
    }
    if (!activeEntry.instance) {
      update({ status: 'error', error: '当前共享工作流缺少可用实例。' });
      throw new Error('当前共享工作流缺少可用实例。');
    }
    taskCompletionSound.primeAudio();
    update({ status: 'running', error: '', imageUrl: '', imageUrls: [], videoUrls: [], audioUrls: [], outputText: '', outputs: [], progress: '提交中' });
    logBus.info(`共享 ComfyUI 工作流提交: ${activeEntry.workflow.title} · ${activeEntry.instance.baseUrl}`, src);
    try {
      const result = await runComfyuiApp({
        provider: buildProviderFromEntry(activeEntry),
        app,
        sharedWorkflowId: activeEntry.workflow.sharedWorkflowId || activeEntry.workflow.id,
        instanceId: activeEntry.workflow.instanceId,
        userParams: paramValues,
        inputs: {
          texts: orderedTexts.map((item) => item.url),
          images: orderedImages.map((item) => item.url),
          videos: orderedVideos.map((item) => item.url),
          audios: orderedAudios.map((item) => item.url),
        },
      });
      const resultOutputs = Array.isArray(result.outputs) ? result.outputs : [];
      const resultOutputImages = resultOutputs.flatMap((item) => item.kind === 'image' ? outputStringList(item.value) : []);
      const resultOutputVideos = resultOutputs.flatMap((item) => item.kind === 'video' ? outputStringList(item.value) : []);
      const resultOutputAudios = resultOutputs.flatMap((item) => item.kind === 'audio' ? outputStringList(item.value) : []);
      const resultOutputText = resultOutputs
        .filter((item) => item.kind === 'text')
        .map((item) => String(item.value ?? '').trim())
        .filter(Boolean)
        .join('\n')
        .trim();
      const imageUrls = resultOutputImages.length ? resultOutputImages : result.imageUrls;
      const videoUrls = resultOutputVideos.length ? resultOutputVideos : (result.videoUrls || []);
      const audioUrls = resultOutputAudios.length ? resultOutputAudios : (result.audioUrls || []);
      const outputTextValue = resultOutputText || result.text || '';
      update({
        status: 'success',
        progress: '100%',
        taskId: result.taskId || '',
        imageUrl: imageUrls[0] || '',
        imageUrls,
        videoUrls,
        audioUrls,
        outputText: outputTextValue,
        outputs: resultOutputs,
        error: '',
      });
      logBus.success(`共享 ComfyUI 工作流完成: ${activeEntry.workflow.title}`, src);
      taskCompletionSound.notifyComplete(id, app.outputs[0]?.kind || 'image');
    } catch (error: any) {
      const message = error?.message || '共享 ComfyUI 工作流运行失败';
      update({ status: 'error', error: message, progress: '' });
      logBus.error(message, src);
      throw error;
    }
  };

  useRunTrigger(id, handleRun, app?.outputs[0]?.kind || 'image');

  return (
    <div className="relative flex flex-col nowheel" style={rootStyle}>
      <Handle type="target" position={Position.Left} style={{ ...handleStyle, background: PORT_COLOR.image, left: -6 }} />
      <Handle type="source" position={Position.Right} style={{ ...handleStyle, background: PORT_COLOR.image, right: -6 }} />
      <ResizableCorners
        selected={selected}
        minWidth={360}
        minHeight={460}
        accent={accent}
        keepAspectRatio={false}
        onResize={(_, params) => update({ size: { w: Math.round(params.width), h: Math.round(params.height) } })}
        onResizeEnd={(_, params) => update({ size: { w: Math.round(params.width), h: Math.round(params.height) } })}
      />

      <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: border }}>
        <div className="flex h-8 w-8 items-center justify-center rounded border" style={{ borderColor: accent, color: accent }}>
          <Workflow size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-black">ComfyUI 应用</div>
          <div className="truncate text-[11px]" style={{ color: sub }}>
            {activeEntry ? `${activeEntry.workflow.title} · ${activeEntry.instance?.name || '未知实例'}` : `${entries.length} 个共享工作流`}
          </div>
        </div>
        {activeEntry && (
          <button type="button" className={buttonCls} style={inputStyle} onClick={() => update({ comfyuiAppWorkflowId: '' })}>
            <ArrowLeft size={12} /> 列表
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-3 space-y-3 nowheel">
        {!activeEntry ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 opacity-60" />
                <input
                  value={d.comfyuiAppSearchQuery || ''}
                  onChange={(event) => update({ comfyuiAppSearchQuery: event.target.value })}
                  className={`${inputCls} pl-7`}
                  style={inputStyle}
                  placeholder="搜索共享 ComfyUI 工作流"
                />
              </div>
              <button type="button" className={buttonCls} style={inputStyle} onClick={() => void refreshCatalog()} disabled={catalogLoading}>
                {catalogLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                刷新
              </button>
            </div>

            {catalogMessage && (
              <div className="flex gap-1 rounded border px-2 py-1 text-[11px] text-red-400" style={{ borderColor: 'rgba(248,113,113,0.45)' }}>
                <AlertCircle size={12} className="mt-0.5 shrink-0" />
                <span className="break-all">{catalogMessage}</span>
              </div>
            )}

            {filteredEntries.length ? (
              <div className="space-y-1.5">
                {filteredEntries.map((entry) => (
                  <button
                    key={entry.workflow.id}
                    type="button"
                    className="nodrag nowheel w-full rounded border p-2 text-left"
                    style={{ borderColor: border, background: isLight ? 'rgba(15,23,42,0.03)' : 'rgba(255,255,255,0.05)' }}
                    onClick={() => selectEntry(entry)}
                  >
                    <div className="flex items-center gap-2">
                      <ServerCog size={14} style={{ color: accent }} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-black">{entry.workflow.title}</div>
                        <div className="truncate text-[10px]" style={{ color: sub }}>
                          {entry.instance?.name || entry.workflow.instanceId} · {entry.instance?.health || 'unknown'} · {entry.app.userParams.length} 参数
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded border p-3 text-[11px]" style={{ borderColor: border, color: sub }}>
                {catalogLoading ? '正在加载共享 ComfyUI 工作流...' : '还没有可用的共享 ComfyUI 工作流。请先在后台推送到共享区。'}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded border p-2" style={{ borderColor: border, background: isLight ? 'rgba(14,165,233,0.06)' : 'rgba(56,189,248,0.08)' }}>
              <div className="text-xs font-black">{activeEntry.workflow.title}</div>
              <div className="mt-1 text-[10px]" style={{ color: sub }}>
                {activeEntry.instance?.name || activeEntry.workflow.instanceId} · 需要：图片 {req.images} / 视频 {req.videos} / 音频 {req.audios}
              </div>
              <div className="mt-1 text-[10px]" style={{ color: sub }}>
                输出：{app?.outputs.map((output) => output.label || output.kind).join(' / ') || 'image'}
              </div>
            </div>

            <MaterialPreviewSection
              texts={orderedTexts}
              images={orderedImages}
              videos={orderedVideos}
              audios={orderedAudios}
              order={order}
              onReorder={setOrder}
              onExcludeUpstream={excludeMaterial}
              excludedCount={excludedCount}
              onRestoreExcluded={() => update({ excludedMaterialIds: [] })}
              selected={!!selected}
              isDark={isDark}
              isPixel={isPixel}
              groups={['text', 'image', 'video', 'audio']}
              title="上游素材 · 可拖拽调整顺序"
            />

            <div className="space-y-2">
              <div className="text-xs font-black">参数</div>
              {app?.userParams.length ? app.userParams.map((param) => (
                <label key={param.key} className="block space-y-1">
                  <span className="text-[11px] font-bold" style={{ color: sub }}>{param.label}</span>
                  {param.kind === 'textarea' ? (
                    <textarea
                      value={String(paramValues[param.key] ?? '')}
                      onChange={(event) => setParam(param.key, event.target.value)}
                      rows={param.rows || 4}
                      className={`${inputCls} resize-y`}
                      style={inputStyle}
                      placeholder={param.placeholder}
                    />
                  ) : param.kind === 'boolean' ? (
                    <input type="checkbox" checked={!!paramValues[param.key]} onChange={(event) => setParam(param.key, event.target.checked)} />
                  ) : (
                    <input
                      type={param.kind === 'number' ? 'number' : 'text'}
                      min={param.min}
                      max={param.max}
                      step={param.step}
                      value={parseInputValue(param.kind, paramValues[param.key])}
                      onChange={(event) => setParam(param.key, param.kind === 'number' ? event.target.value : event.target.value)}
                      className={inputCls}
                      style={inputStyle}
                      placeholder={param.placeholder}
                    />
                  )}
                </label>
              )) : (
                <div className="rounded border px-2 py-2 text-[11px]" style={{ borderColor: border, color: sub }}>
                  当前工作流没有暴露可编辑参数，直接运行即可。
                </div>
              )}
            </div>

            <button type="button" className={`${buttonCls} w-full py-2 text-sm font-black`} style={{ ...inputStyle, borderColor: accent, color: accent }} disabled={isBusy} onClick={handleRun}>
              {isBusy ? <><Loader2 size={14} className="animate-spin" /> 运行中...</> : <><Play size={14} /> 运行共享 ComfyUI</>}
            </button>

            {d.error && (
              <div className="flex gap-1 rounded border px-2 py-1 text-[11px] text-red-400" style={{ borderColor: 'rgba(248,113,113,0.45)' }}>
                <AlertCircle size={12} className="mt-0.5 shrink-0" />
                <span className="break-all">{d.error}</span>
              </div>
            )}

            {outputImages.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5">
                {outputImages.slice(0, 4).map((url, index) => (
                  <img key={`${url}-${index}`} src={url} alt="ComfyUI 输出" className="w-full rounded object-contain" />
                ))}
              </div>
            )}
            {outputVideos.length > 0 && (
              <div className="space-y-1.5">
                {outputVideos.slice(0, 2).map((url, index) => (
                  <video key={`${url}-${index}`} src={url} controls className="w-full rounded" />
                ))}
              </div>
            )}
            {outputAudios.length > 0 && (
              <div className="space-y-1.5">
                {outputAudios.slice(0, 2).map((url, index) => (
                  <audio key={`${url}-${index}`} src={url} controls className="w-full" />
                ))}
              </div>
            )}
            {outputText && <pre className="max-h-24 overflow-auto rounded border p-2 text-[10px] whitespace-pre-wrap" style={{ borderColor: border }}>{outputText}</pre>}

            <button type="button" className={buttonCls} style={inputStyle} onClick={() => void refreshCatalog()} disabled={catalogLoading}>
              {catalogLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              刷新共享目录
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(ComfyUIApplicationNode);
