import { memo, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Workflow } from 'lucide-react';

import { PORT_COLOR } from '../../config/portTypes';
import { useRunTrigger } from '../../hooks/useRunTrigger';
import { runComfyuiApp } from '../../services/comfyuiApps';
import { getComfyuiAppCatalog } from '../../services/api';
import { logBus } from '../../stores/logs';
import { taskCompletionSound } from '../../stores/taskCompletionSound';
import { useThemeStore } from '../../stores/theme';
import type {
  AdvancedProviderConfig,
  ComfyuiCatalogInstance,
  ComfyuiCatalogResponse,
  ComfyuiCatalogWorkflow,
  ComfyuiRunOutput,
} from '../../types/canvas';
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
import ComfyUINodeOutputSummarySection from './ComfyUINodeOutputSummarySection';
import ComfyUINodeParamSection from './ComfyUINodeParamSection';
import ComfyUINodeRunSection from './ComfyUINodeRunSection';
import ComfyUINodeSelectorSection from './ComfyUINodeSelectorSection';
import MaterialPreviewSection from './MaterialPreviewSection';
import ResizableCorners from './ResizableCorners';
import {
  buildComfyuiMachineCatalog,
  buildComfyuiMachineOptions,
  type ComfyuiCatalogEntry,
  type ComfyuiMachineCatalogItem,
  resolveComfyuiMachineWorkflow,
  resolveDefaultComfyuiMachineId,
  splitVisibleComfyuiParams,
} from './comfyuiNodeHelpers';
import { useOrderedMaterials } from './useOrderedMaterials';
import { useUpdateNodeData } from './useUpdateNodeData';
import { useUpstreamMaterials, type Material } from './useUpstreamMaterials';

const handleStyle: CSSProperties = {
  width: 12,
  height: 12,
  border: 'none',
  zIndex: 20,
};

function buildProviderFromEntry(entry: ComfyuiCatalogEntry<ComfyAppDefinition>): AdvancedProviderConfig {
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
  const size = d.size && typeof d.size.w === 'number' ? d.size : { w: 420, h: 760 };
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

  const entries = useMemo<ComfyuiCatalogEntry<ComfyAppDefinition>[]>(() => {
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

  const machineCatalog = useMemo(
    () => buildComfyuiMachineCatalog(entries, catalog?.instances || []),
    [entries, catalog?.instances],
  );
  const machineOptions = useMemo(
    () => buildComfyuiMachineOptions(machineCatalog),
    [machineCatalog],
  );
  const persistedMachineId = String(d.comfyuiInstanceId || d.comfyuiAppInstanceId || '');
  const selectedMachineId = resolveDefaultComfyuiMachineId(machineCatalog, persistedMachineId);
  const activeMachine = useMemo<ComfyuiMachineCatalogItem<ComfyAppDefinition> | null>(
    () => machineCatalog.find((item) => item.id === selectedMachineId) || null,
    [machineCatalog, selectedMachineId],
  );
  const selectedWorkflowId = String(d.sharedWorkflowId || d.comfyuiWorkflowId || d.comfyuiAppWorkflowId || '');
  const workflowOptions = useMemo(
    () => (activeMachine?.workflows || []).map((entry) => ({
      id: entry.workflow.sharedWorkflowId || entry.workflow.id,
      label: entry.workflow.title,
    })),
    [activeMachine],
  );
  const activeEntry = useMemo(
    () => resolveComfyuiMachineWorkflow(activeMachine, selectedWorkflowId),
    [activeMachine, selectedWorkflowId],
  );
  const selectedMachineLabel = activeMachine?.instance.name || machineOptions.find((item) => item.id === selectedMachineId)?.label || '';

  useEffect(() => {
    if (!machineCatalog.length) return;
    const nextMachineId = resolveDefaultComfyuiMachineId(machineCatalog, persistedMachineId);
    const nextMachine = machineCatalog.find((item) => item.id === nextMachineId) || null;
    const nextEntry = resolveComfyuiMachineWorkflow(nextMachine, selectedWorkflowId);
    if (!nextMachineId || !nextEntry) return;
    const nextWorkflowId = nextEntry.workflow.sharedWorkflowId || nextEntry.workflow.id;
    const machineChanged = persistedMachineId !== nextMachineId;
    const workflowChanged = selectedWorkflowId !== nextWorkflowId;
    if (!machineChanged && !workflowChanged) return;
    update({
      sharedWorkflowId: nextWorkflowId,
      comfyuiWorkflowId: nextWorkflowId,
      comfyuiAppWorkflowId: nextWorkflowId,
      comfyuiInstanceId: nextMachineId,
      comfyuiAppInstanceId: nextMachineId,
      ...(workflowChanged ? {
        comfyuiParamValues: defaultComfyAppParamValues(nextEntry.app),
        comfyuiAppParamValues: defaultComfyAppParamValues(nextEntry.app),
        comfyuiSelectedOutputKey: nextEntry.app.outputs[0]?.key || '',
        comfyuiAppSelectedOutputKey: nextEntry.app.outputs[0]?.key || '',
        status: 'idle',
        error: '',
      } : {}),
    });
  }, [machineCatalog, persistedMachineId, selectedWorkflowId, update]);

  const app = activeEntry?.app || null;
  const req = comfyAppInputRequirements(app);
  const paramValues = {
    ...defaultComfyAppParamValues(app),
    ...(d.comfyuiParamValues || {}),
    ...(d.comfyuiAppParamValues || {}),
  };
  const visibleParams = useMemo(
    () => splitVisibleComfyuiParams(activeEntry?.workflow, app?.userParams || []),
    [activeEntry?.workflow, app?.userParams],
  );

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
  const outputsForSummary = namedOutputs.length
    ? namedOutputs
    : [
      ...(outputImages[0] ? [{ key: 'image-1', label: '输出图 1', kind: 'image' as const, value: outputImages[0] }] : []),
      ...(outputVideos[0] ? [{ key: 'video-1', label: '输出视频 1', kind: 'video' as const, value: outputVideos[0] }] : []),
      ...(outputAudios[0] ? [{ key: 'audio-1', label: '输出音频 1', kind: 'audio' as const, value: outputAudios[0] }] : []),
      ...(outputText ? [{ key: 'text-1', label: '输出文本 1', kind: 'text' as const, value: outputText }] : []),
    ];

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
  const inputClassName = isPixel ? 'px-input nodrag nowheel w-full px-2 py-1 text-xs' : 'nodrag nowheel w-full rounded border px-2 py-1 text-xs outline-none';
  const inputStyle: CSSProperties = isPixel ? {} : {
    background: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.06)',
    borderColor: border,
    color: text,
  };
  const buttonClassName = isPixel
    ? 'px-btn nodrag nowheel inline-flex items-center justify-center gap-1 px-2 py-1 text-[11px]'
    : 'nodrag nowheel inline-flex items-center justify-center gap-1 rounded border px-2 py-1 text-[11px]';
  const runButtonStyle: CSSProperties = {
    ...inputStyle,
    borderColor: accent,
    color: accent,
  };
  const rootStyle: CSSProperties = {
    width: size.w,
    minWidth: 380,
    minHeight: 420,
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
  const setParam = (key: string, value: unknown) => update({
    comfyuiParamValues: { ...paramValues, [key]: value },
    comfyuiAppParamValues: { ...paramValues, [key]: value },
  });

  const handleRun = async () => {
    const src = `comfyui:${id.slice(0, 6)}`;
    if (!activeEntry || !app) {
      update({ status: 'error', error: '请先选择一个共享 ComfyUI 工作流。' });
      throw new Error('请先选择一个共享 ComfyUI 工作流。');
    }
    if (!selectedMachineId) {
      update({ status: 'error', error: '请先选择一台可用的 ComfyUI 机器。' });
      throw new Error('请先选择一台可用的 ComfyUI 机器。');
    }
    if (activeMachine?.instance.health === 'offline') {
      update({ status: 'error', error: `机器 ${activeMachine.instance.name} 当前离线，请切换到在线机器后再运行。` });
      throw new Error(`机器 ${activeMachine.instance.name} 当前离线，请切换到在线机器后再运行。`);
    }
    taskCompletionSound.primeAudio();
    update({
      status: 'running',
      error: '',
      imageUrl: '',
      imageUrls: [],
      videoUrls: [],
      audioUrls: [],
      outputText: '',
      outputs: [],
      progress: '提交中',
      comfyuiLastRunInstanceId: selectedMachineId,
      comfyuiLastRunInstanceLabel: selectedMachineLabel,
    });
    logBus.info(`共享 ComfyUI 工作流提交: ${activeEntry.workflow.title} · ${selectedMachineLabel || selectedMachineId}`, src);
    try {
      const result = await runComfyuiApp({
        provider: buildProviderFromEntry({
          ...activeEntry,
          instance: activeMachine?.instance || activeEntry.instance,
        }),
        app,
        sharedWorkflowId: activeEntry.workflow.sharedWorkflowId || activeEntry.workflow.id,
        instanceId: selectedMachineId,
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
        comfyuiLastRunInstanceId: result.instanceId || selectedMachineId,
        comfyuiLastRunInstanceLabel: result.instanceName || selectedMachineLabel,
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
        minWidth={380}
        minHeight={540}
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
          <div className="truncate text-base font-black">comfyui</div>
          <div className="truncate text-[11px]" style={{ color: sub }}>
            {activeEntry
              ? `${activeEntry.workflow.title} · ${selectedMachineLabel || '未选机器'}`
              : `${entries.length} 个共享工作流`}
          </div>
        </div>
      </div>

      <div className="space-y-3 p-3 nowheel">
        <ComfyUINodeSelectorSection
          workflowId={selectedWorkflowId}
          machineId={selectedMachineId}
          workflowOptions={workflowOptions}
          machineOptions={machineOptions}
          inputClassName={inputClassName}
          buttonClassName={buttonClassName}
          inputStyle={inputStyle}
          loading={catalogLoading}
          onRefresh={() => void refreshCatalog()}
          onSelectWorkflow={(workflowId) => {
            const entry = resolveComfyuiMachineWorkflow(activeMachine, workflowId);
            if (!entry) {
              update({ sharedWorkflowId: '', comfyuiWorkflowId: '', comfyuiAppWorkflowId: '' });
              return;
            }
            update({
              sharedWorkflowId: workflowId,
              comfyuiWorkflowId: workflowId,
              comfyuiAppWorkflowId: workflowId,
              comfyuiInstanceId: selectedMachineId,
              comfyuiAppInstanceId: selectedMachineId,
              comfyuiParamValues: defaultComfyAppParamValues(entry.app),
              comfyuiAppParamValues: defaultComfyAppParamValues(entry.app),
              comfyuiSelectedOutputKey: entry.app.outputs[0]?.key || '',
              comfyuiAppSelectedOutputKey: entry.app.outputs[0]?.key || '',
              status: 'idle',
              error: '',
            });
          }}
          onSelectMachine={(instanceId) => {
            const nextMachine = machineCatalog.find((item) => item.id === instanceId) || null;
            const nextEntry = resolveComfyuiMachineWorkflow(nextMachine, selectedWorkflowId);
            const nextWorkflowId = nextEntry ? (nextEntry.workflow.sharedWorkflowId || nextEntry.workflow.id) : '';
            update({
              comfyuiInstanceId: instanceId,
              comfyuiAppInstanceId: instanceId,
              sharedWorkflowId: nextWorkflowId,
              comfyuiWorkflowId: nextWorkflowId,
              comfyuiAppWorkflowId: nextWorkflowId,
              ...(nextEntry && nextWorkflowId !== selectedWorkflowId ? {
                comfyuiParamValues: defaultComfyAppParamValues(nextEntry.app),
                comfyuiAppParamValues: defaultComfyAppParamValues(nextEntry.app),
                comfyuiSelectedOutputKey: nextEntry.app.outputs[0]?.key || '',
                comfyuiAppSelectedOutputKey: nextEntry.app.outputs[0]?.key || '',
              } : {}),
              status: 'idle',
              error: '',
            });
          }}
        />

        {catalogMessage ? (
          <div className="rounded border px-2 py-1 text-[11px] text-red-400" style={{ borderColor: 'rgba(248,113,113,0.45)' }}>
            {catalogMessage}
          </div>
        ) : null}

        {activeEntry ? (
          <>
            <div className="rounded border p-2" style={{ borderColor: border, background: isLight ? 'rgba(14,165,233,0.06)' : 'rgba(56,189,248,0.08)' }}>
              <div className="text-xs font-black">{activeEntry.workflow.title}</div>
              <div className="mt-1 text-[10px]" style={{ color: sub }}>
                输入需求：图片 {req.images} / 视频 {req.videos} / 音频 {req.audios}
              </div>
              <div className="mt-1 text-[10px]" style={{ color: sub }}>
                执行机器：{activeMachine ? activeMachine.instance.name : '未选择机器'}
              </div>
              <div className="mt-1 text-[10px]" style={{ color: sub }}>
                共享工作流：{workflowOptions.length ? `${workflowOptions.length} 个可选` : '当前机器暂无可用工作流'}
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
              title="通用输入 · 拖拽可调整顺序"
            />

            <ComfyUINodeParamSection
              primaryFields={visibleParams.primary}
              secondaryFields={visibleParams.secondary}
              advancedFields={visibleParams.advanced}
              values={paramValues}
              inputClassName={inputClassName}
              inputStyle={inputStyle}
              onChange={setParam}
            />

            <ComfyUINodeRunSection
              status={status}
              progress={String(d.progress || '')}
              machineLabel={selectedMachineLabel || String(d.comfyuiLastRunInstanceLabel || '')}
              error={String(d.error || '')}
              isBusy={isBusy}
              runLabel="运行 comfyui"
              buttonClassName={buttonClassName}
              buttonStyle={runButtonStyle}
              onRun={() => void handleRun()}
            />

            <ComfyUINodeOutputSummarySection
              workflow={activeEntry.workflow}
              outputs={outputsForSummary}
              status={status}
              borderColor={border}
              subColor={sub}
              textColor={text}
            />
          </>
        ) : (
          <div className="rounded border p-3 text-[11px]" style={{ borderColor: border, color: sub }}>
            {catalogLoading ? '正在加载共享 comfyui 工作流...' : '还没有可用的共享 comfyui 工作流。请先在后台推送到共享区。'}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(ComfyUIApplicationNode);
