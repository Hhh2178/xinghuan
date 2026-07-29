import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { AlertCircle, Loader2, Video as VideoIcon, Sparkles, Square, X } from 'lucide-react';
import {
  VIDEO_MODELS,
  isFalVideoModel,
  VIDEO_FAL_REGISTRY,
  type VideoModelDef,
  VEO_FAL_RATIOS,
  VEO_FAL_DURATIONS,
  VEO_FAL_RESOLUTIONS,
  GROK_FAL_RATIOS,
  GROK_FAL_RESOLUTIONS,
  GROK_FAL_MODES,
  SORA2_FAL_MODES,
  SORA2_FAL_RATIOS,
  SORA2_FAL_DURATIONS,
  SORA2_FAL_RESOLUTIONS,
} from '../../providers/models';
import {
  generateExternalVideo,
  submitExternalVideoTask,
  queryExternalVideoTask,
  submitVideo,
  queryVideo,
  submitVideoFal,
  queryVideoFal,
  cancelGenerationTask,
  type VideoSubmitRequest,
  type VideoFalSubmitRequest,
} from '../../services/generation';
import { useUpdateNodeData } from './useUpdateNodeData';
import { useHasAutoOutput } from './useHasAutoOutput';
import { useRunTrigger } from '../../hooks/useRunTrigger';
import { logBus } from '../../stores/logs';
import { useThemeStore } from '../../stores/theme';
import { useUpstreamMaterials, type Material } from './useUpstreamMaterials';
import { useOrderedMaterials } from './useOrderedMaterials';
import MaterialPreviewSection from './MaterialPreviewSection';
import MentionPromptInput from './MentionPromptInput';
import NodeRuntimeCard from './NodeRuntimeCard';
import { useNodeExecutionProjection } from './useNodeExecutionProjection';
import { useSyncNodeInternalsOnResize } from './useSyncNodeInternalsOnResize';
import LoopingVideo from '../LoopingVideo';
import { resolveMediaMentions, type MediaMention } from './mediaMentions';
import { useDragMaterialStore, type MaterialPayload } from '../../stores/dragMaterial';
import { useMaterialDropTarget } from '../../hooks/useMaterialDropTarget';
import { taskCompletionSound } from '../../stores/taskCompletionSound';
import {
  mergeUniqueUrls,
  resumableTaskRuns,
  taskRunIds,
  type PersistedGenerationTaskRun,
} from './generationTaskResume';
import { useApiKeysStore } from '../../stores/apiKeys';
import { useModelCatalogStore } from '../../stores/modelCatalog';
import type { PublicModelRecord } from '../../services/api';
import {
  advancedProviderModelOptions,
  advancedProvidersForNode,
  resolveAdvancedProviderSelection,
} from '../../utils/advancedProviders';
import {
  countExcludedMaterials,
  excludeMaterialId,
  filterExcludedMaterials,
  normalizeExcludedMaterialIds,
} from '../../utils/materialExclusion';
import { buildPublishedModelPersistencePatch, resolvePublishedModelSelection } from '../../utils/publishedModelSelection';
import {
  getBackendFrameModeOptions,
  getBackendImageSlotCount,
  getBackendVideoInputValidationError,
  normalizeBackendFrameMode,
  resolveBackendVideoInputAssignment,
  resolveVideoPreviewGroups,
  type BackendVideoFrameMode,
} from './videoNodeBackendInputs';
import { appendGeneratedVideoUrls } from './videoGenerationAccumulation';

/**
 * VideoNode - 异步视频生成(完全对齐 gpt-image-2-web)
 * 支持:
 *   - Veo 3.1   (kind=veo)      — 13 个子模型 / aspect_ratio(16:9|9:16) / seed / enhance_prompt / enable_upsample / images(≤3)
 *   - Grok Video(kind=grok)     — Grok Video 1.5 FAL 默认 / 旧版 FAL / grok-video-3 / images(≤7)
 *   - Sora2 FAL (kind=sora)     — 文生/图生视频 / Base64 参考图(≤1) / duration / resolution
 *   - Seedance  (kind=seedance) — 零破坏兼容旧 veo 字段
 * 流程: submit → poll(5s 间隔) → 转存 → 展示
 */
const VIDEO_POLL_TIMEOUT_SECONDS = 3600;
const VIDEO_POLL_INTERVAL_MS = 5000;
const VIDEO_MAX_POLL = Math.ceil((VIDEO_POLL_TIMEOUT_SECONDS * 1000) / VIDEO_POLL_INTERVAL_MS);
const VIDEO_FAL_POLL_INTERVAL_MS = 6000;
const VIDEO_FAL_MAX_POLL = Math.ceil((VIDEO_POLL_TIMEOUT_SECONDS * 1000) / VIDEO_FAL_POLL_INTERVAL_MS);
const JIMENG_SEEDANCE_LIMITS = { images: 9, videos: 3, audios: 3 };

const splitGrokFalRefUrls = (raw: string): string[] =>
  String(raw || '')
    .split(/[\n,，]+/)
    .map((s) => s.trim())
    .filter(Boolean);
const clampGenerationCount = (value: unknown, fallback = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(4, Math.round(parsed)));
};
const videoGenerationErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (error && typeof error === 'object') {
    const row = error as Record<string, unknown>;
    for (const key of ['message', 'error', 'failureReason', 'reason', 'detail']) {
      const value = row[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  const text = String(error || '').trim();
  return text || '未知错误';
};
const durationOptionsFromRange = (range?: { min: number; max: number; step: number; default: number }) => {
  if (!range) return [];
  const out: number[] = [];
  for (let value = range.min; value <= range.max; value += range.step) {
    out.push(value);
    if (out.length > 128) break;
  }
  if (!out.includes(range.default)) {
    out.push(range.default);
    out.sort((a, b) => a - b);
  }
  return out;
};
type TaskRunState = PersistedGenerationTaskRun & { kind: 'video' };

const VideoNode = ({ id, data, selected }: NodeProps) => {
  const update = useUpdateNodeData(id);
  const { rootRef } = useSyncNodeInternalsOnResize(id);
  const hasAutoOutput = useHasAutoOutput(id);
  const { getEdges, getNodes } = useReactFlow();
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<number | null>(null);
  const pollTimers = useRef<Set<number>>(new Set());
  const resumeStartedRef = useRef(false);
  const src = `video:${id.slice(0, 6)}`;

  // 主题适配 (默认科技风深色, 传递给聚合预览区)
  const { theme, style: themeStyle } = useThemeStore();
  const isDark = theme === 'dark';
  const isPixel = themeStyle === 'pixel';

  const d = useNodeExecutionProjection(data) as any;
  const backendVideoModels = useModelCatalogStore((s) => s.catalog.videoModels);
  const modelSource: 'backend' | 'local' = d?.modelSource === 'local' ? 'local' : 'backend';
  const backendSelection = useMemo(
    () => resolvePublishedModelSelection(backendVideoModels, {
      selectedModelId: d?.backendModelId,
      selectedProviderId: d?.backendProviderId,
    }),
    [backendVideoModels, d?.backendModelId, d?.backendProviderId],
  );
  const backendModel: PublicModelRecord | null = backendSelection.selectedModel;
  const backendProviderGroups = backendSelection.providerGroups;
  const backendProviderGroup = backendSelection.selectedProviderGroup;
  const isBackendSelected = modelSource === 'backend' && Boolean(backendModel);

  useEffect(() => {
    if (!isBackendSelected) return;
    const patch = buildPublishedModelPersistencePatch(backendSelection, {
      modelSource: d?.modelSource,
      backendProviderId: d?.backendProviderId,
      backendModelId: d?.backendModelId,
      providerSource: d?.providerSource,
      providerId: d?.providerId,
      providerModel: d?.providerModel,
    });
    if (patch) update(patch);
  }, [
    backendSelection,
    d?.backendModelId,
    d?.backendProviderId,
    d?.modelSource,
    d?.providerId,
    d?.providerModel,
    d?.providerSource,
    isBackendSelected,
    update,
  ]);

  const backendVideoCaps = backendModel?.ui.inputCapabilities ?? {
    prompt: true,
    imageReference: false,
    multiImage: false,
    firstFrame: false,
    lastFrame: false,
    audioReference: false,
    videoReference: false,
  };
  const backendSupportsVideoReference = Boolean(backendVideoCaps.videoReference);
  const backendSupportsAudioReference = Boolean(backendVideoCaps.audioReference);
  const backendImageSlotCount = isBackendSelected
    ? getBackendImageSlotCount(backendVideoCaps, backendModel?.ui.maxReferenceImages || 1)
    : 0;
  const backendShowsImageInputs = isBackendSelected && backendImageSlotCount > 0;
  const rawFrameMode = typeof d?.frameMode === 'string' ? d.frameMode : undefined;
  const backendFrameModeOptions = useMemo(() => {
    if (!isBackendSelected) return [];
    return getBackendFrameModeOptions(backendVideoCaps);
  }, [backendVideoCaps, isBackendSelected]);
  const frameMode = normalizeBackendFrameMode(rawFrameMode, backendFrameModeOptions);
  const backendImageInputLimit = frameMode === 'first' || frameMode === 'last'
    ? 1
    : frameMode === 'firstlast'
      ? 2
      : backendModel?.ui.maxReferenceImages || 0;
  const advancedProviders = useApiKeysStore((s) => s.settings.advancedProviders);
  const videoAdvancedProviders = useMemo(
    () => advancedProvidersForNode(advancedProviders, 'video'),
    [advancedProviders],
  );
  const providerSelection = useMemo(
    () => resolveAdvancedProviderSelection(advancedProviders, 'video', {
      providerSource: d?.providerSource,
      providerId: d?.providerId,
      providerModel: d?.providerModel,
    }),
    [advancedProviders, d?.providerSource, d?.providerId, d?.providerModel],
  );
  const isExternalSelected = !isBackendSelected && providerSelection.available && providerSelection.providerSource !== 'zhenzhen';
  const savedExternalMissing = !isBackendSelected && !!d?.providerSource && d.providerSource !== 'zhenzhen' && !providerSelection.available;
  const externalModelOptions = providerSelection.provider
    ? advancedProviderModelOptions(providerSelection.provider, 'video')
    : [];
  const externalProviderModel = providerSelection.providerModel || externalModelOptions[0] || '';
  const isJimengCliSelected = isExternalSelected && providerSelection.provider?.protocol === 'jimeng-cli';
  const isJimengSeedanceSelected = isJimengCliSelected && /seedance|jimeng-video|video/i.test(externalProviderModel);
  // 主模型 id (对应 VIDEO_MODELS 项)
  const rawModel = typeof d?.model === 'string' ? d.model : '';
  const isLegacySora2Model = /^sora-2(?:-\d{4}-\d{2}-\d{2})?$/.test(rawModel);
  const mainId = d?.mainId || (isLegacySora2Model ? 'sora-2' : (d?.model && VIDEO_MODELS.find((m) => m.id === d.model || m.apiModelOptions.some((o) => o.value === d.model))?.id)) || VIDEO_MODELS[0].id;
  const modelDef = useMemo(() => VIDEO_MODELS.find((m) => m.id === mainId) || VIDEO_MODELS[0], [mainId]);
  // 子模型(上游真实 model 名)
  const apiModel: string = d?.model && modelDef.apiModelOptions.some((o) => o.value === d.model) ? d.model : modelDef.apiModelOptions[0].value;
  // 各参数(跳过着调用 update 默认值)
  const ratio: string = d?.ratio || backendModel?.ui.defaultAspectRatio || modelDef.defaultRatio;
  const generationCount = clampGenerationCount(d?.generationCount ?? 1);
  const accumulateOutputs = d?.accumulateOutputs === true;
  const duration: number | string = d?.duration ?? backendModel?.ui.defaultDuration ?? modelDef.defaultDuration ?? (modelDef.durations?.[0] || 0);
  const resolution: string = d?.resolution || backendModel?.ui.defaultResolution || (isJimengSeedanceSelected ? '720p' : modelDef.defaultResolution || '');
  const seed: number = typeof d?.seed === 'number' ? d.seed : 0;
  const enhancePrompt: boolean = d?.enhancePrompt ?? false;
  const enableUpsample: boolean = d?.enableUpsample ?? false;

  // FAL 专属参数
  const isFal = isFalVideoModel(apiModel);
  const falReg = isFal ? VIDEO_FAL_REGISTRY[apiModel] : null;
  const isGrokFalV15 = apiModel === 'grok-imagine-video-1.5';
  const showBuiltinFalControls = !isBackendSelected && !isExternalSelected && isFal && !!falReg;
  const showGenericVideoControls = isBackendSelected || isExternalSelected || !isFal;
  const ratioOptions = isBackendSelected && backendModel
    ? backendModel.ui.aspectRatios
    : isJimengSeedanceSelected
    ? ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9']
    : modelDef.ratios;
  const durationOptions = isBackendSelected && backendModel
    ? (backendModel.ui.durationMode === 'range' && backendModel.ui.durationRange
      ? durationOptionsFromRange(backendModel.ui.durationRange)
      : backendModel.ui.durationOptions)
    : isJimengSeedanceSelected
    ? [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
    : modelDef.durations || [];
  const resolutionOptions = isBackendSelected && backendModel
    ? backendModel.ui.resolutionOptions
    : isJimengSeedanceSelected
    ? ['480p', '720p', '1080p']
    : modelDef.resolutions || [];
  const showImageMaterials = isBackendSelected ? backendShowsImageInputs : modelDef.supportImages;

  useEffect(() => {
    if (!isBackendSelected || !backendModel) return;
    const patch: Record<string, unknown> = {};
    if (!backendModel.ui.aspectRatios.includes(ratio)) patch.ratio = backendModel.ui.defaultAspectRatio;
    if (!durationOptions.includes(Number(duration))) patch.duration = backendModel.ui.defaultDuration;
    if (!backendModel.ui.resolutionOptions.includes(resolution)) patch.resolution = backendModel.ui.defaultResolution;
    if (backendFrameModeOptions.length > 0 && rawFrameMode !== frameMode) patch.frameMode = frameMode;
    if (Object.keys(patch).length) update(patch);
  }, [
    backendFrameModeOptions,
    backendModel,
    duration,
    frameMode,
    isBackendSelected,
    rawFrameMode,
    ratio,
    resolution,
    update,
  ]);

  // veo-fal 专属
  const vfRatio: string = d?.vfRatio || '16:9';
  const vfDuration: string = d?.vfDuration || '8s';
  const vfResolution: string = d?.vfResolution || '720p';
  const vfAudio: boolean = d?.vfAudio ?? false;
  const vfSafety: number = d?.vfSafety ?? 4;
  // grok-fal 专属
  const gkfMode: 'image_to_video' | 'reference_to_video' = isGrokFalV15
    ? 'image_to_video'
    : d?.gkfMode === 'image_to_video' ? 'image_to_video' : 'reference_to_video';
  const gkfRatio: string = d?.gkfRatio || '16:9';
  const gkfDuration: number = d?.gkfDuration ?? 6;
  const gkfResolution: string = d?.gkfResolution || '720p';
  const gkfReferenceUrls: string = d?.gkfReferenceUrls || '';
  // sora-fal 专属(图片传入默认 base64,与 gpt-image-2-web srf_imgway 默认一致)
  const soraMode: 'auto' | 'text_to_video' | 'image_to_video' = d?.soraMode || 'auto';
  const soraRatio: string = d?.soraRatio || '16:9';
  const soraDuration: number = d?.soraDuration ?? 4;
  const soraResolution: string = d?.soraResolution || '720p';
  const soraDeleteVideo: boolean = d?.soraDeleteVideo ?? true;
  const soraBlockIp: boolean = d?.soraBlockIp ?? false;
  const soraCharacterIds: string = d?.soraCharacterIds || '';

  const status: 'idle' | 'submitting' | 'polling' | 'success' | 'error' = d?.status || 'idle';
  const taskId: string | undefined = d?.taskId;
  const taskIds: string[] = Array.isArray(d?.taskIds) ? d.taskIds.filter((item: unknown): item is string => typeof item === 'string' && item.length > 0) : [];
  const taskRuns: TaskRunState[] = Array.isArray(d?.taskRuns) ? d.taskRuns : [];
  const taskRunsRef = useRef<TaskRunState[]>(taskRuns);
  taskRunsRef.current = taskRuns;
  const videoUrl: string | undefined = d?.videoUrl;
  const progress: string = d?.progress || '';
  const startedAt: number | undefined = typeof d?.startedAt === 'number' ? d.startedAt : undefined;
  const finishedAt: number | undefined = typeof d?.finishedAt === 'number' ? d.finishedAt : undefined;
  const lastDurationMs: number | undefined = typeof d?.lastDurationMs === 'number' ? d.lastDurationMs : undefined;
  const localPrompt: string = d?.prompt || '';
  const promptMentions: MediaMention[] = Array.isArray(d?.promptMentions) ? d.promptMentions : [];

  // === 上游素材聚合 (跨节点统一机制) ===
  const upstream = useUpstreamMaterials(id);
  const excludedMaterialIds = useMemo(
    () => normalizeExcludedMaterialIds(d?.excludedMaterialIds),
    [d?.excludedMaterialIds],
  );
  const visibleUpstreamTexts = useMemo(
    () => filterExcludedMaterials(upstream.texts, excludedMaterialIds),
    [upstream.texts, excludedMaterialIds],
  );
  const visibleUpstreamImages = useMemo(
    () => filterExcludedMaterials(upstream.images, excludedMaterialIds),
    [upstream.images, excludedMaterialIds],
  );
  const visibleUpstreamVideos = useMemo(
    () => filterExcludedMaterials(upstream.videos, excludedMaterialIds),
    [upstream.videos, excludedMaterialIds],
  );
  const visibleUpstreamAudios = useMemo(
    () => filterExcludedMaterials(upstream.audios, excludedMaterialIds),
    [upstream.audios, excludedMaterialIds],
  );
  const excludedUpstreamCount = useMemo(
    () => countExcludedMaterials(excludedMaterialIds, [...upstream.texts, ...upstream.images, ...upstream.videos, ...upstream.audios]),
    [excludedMaterialIds, upstream.texts, upstream.images, upstream.videos, upstream.audios],
  );
  const materialOrder: string[] = Array.isArray(d?.materialOrder) ? d.materialOrder : [];
  const orderedTexts = useOrderedMaterials(visibleUpstreamTexts, materialOrder);
  const orderedImages = useOrderedMaterials(visibleUpstreamImages, materialOrder);
  const orderedVideos = useOrderedMaterials(visibleUpstreamVideos, materialOrder);
  const orderedAudios = useOrderedMaterials(visibleUpstreamAudios, materialOrder);
  const setMaterialOrder = (newOrder: string[]) => update({ materialOrder: newOrder });
  const handleExcludeUpstreamMaterial = (m: Material) => {
    if (m.origin !== 'upstream') return;
    update({
      excludedMaterialIds: excludeMaterialId(excludedMaterialIds, m.id),
      materialOrder: materialOrder.filter((itemId) => itemId !== m.id),
    });
  };
  const handleRestoreExcludedMaterials = () => update({ excludedMaterialIds: [] });

  const markRuntimeStarted = () => {
    const nextStartedAt = Date.now();
    update({ startedAt: nextStartedAt, finishedAt: null, lastDurationMs: null });
    return nextStartedAt;
  };

  const markRuntimeFinished = (runtimeStartedAt: number | null, patch: Record<string, unknown>) => {
    const nextFinishedAt = Date.now();
    update({
      ...patch,
      finishedAt: nextFinishedAt,
      lastDurationMs:
        typeof runtimeStartedAt === 'number'
          ? Math.max(0, nextFinishedAt - runtimeStartedAt)
          : null,
    });
  };

  const markRuntimeFailed = (runtimeStartedAt: number | null, message: string) => {
    const nextFinishedAt = Date.now();
    update({
      status: 'error',
      error: message,
      finishedAt: nextFinishedAt,
      lastDurationMs:
        typeof runtimeStartedAt === 'number'
          ? Math.max(0, nextFinishedAt - runtimeStartedAt)
          : null,
    });
  };
  const patchTaskRun = (batchIndex: number, patch: Partial<TaskRunState>) => {
    const current = taskRunsRef.current;
    const next = current.map((item) =>
      item.batchIndex === batchIndex ? { ...item, ...patch } : item
    );
    taskRunsRef.current = next;
    update({ taskRuns: next });
  };

  // === 本地拖入参考素材 (跨节点 Ctrl 拖拽) ===
  const localRefImages: string[] = Array.isArray(d?.localRefImages) ? d.localRefImages : [];
  const localRefVideos: string[] = Array.isArray(d?.localRefVideos) ? d.localRefVideos : [];
  const localRefAudios: string[] = Array.isArray(d?.localRefAudios) ? d.localRefAudios : [];
  const localRefMaterials: Material[] = useMemo(
    () => [
      ...localRefImages.map((url, i) => ({
        id: `local::video-image:${url}`,
        kind: 'image' as const,
        url,
        sourceNodeId: id,
        origin: 'local' as const,
        label: `本地图片${i + 1}`,
      })),
      ...localRefVideos.map((url, i) => ({
        id: `local::video-video:${url}`,
        kind: 'video' as const,
        url,
        sourceNodeId: id,
        origin: 'local' as const,
        label: `本地视频${i + 1}`,
      })),
      ...localRefAudios.map((url, i) => ({
        id: `local::video-audio:${url}`,
        kind: 'audio' as const,
        url,
        sourceNodeId: id,
        origin: 'local' as const,
        label: `本地音频${i + 1}`,
      })),
    ],
    [localRefImages, localRefVideos, localRefAudios, id],
  );
  const maxMentionRefs =
    isBackendSelected
      ? backendImageInputLimit
      : isJimengSeedanceSelected
      ? JIMENG_SEEDANCE_LIMITS.images
      : isFal && falReg
      ? falReg.paramKind === 'grok-fal' && (isGrokFalV15 || gkfMode !== 'reference_to_video')
        ? 1
        : falReg.maxRefImages
      : modelDef.maxRefImages;
  const maxMentionVideos = isBackendSelected && backendSupportsVideoReference
    ? backendModel?.ui.maxReferenceVideos || 0
    : isJimengSeedanceSelected
      ? JIMENG_SEEDANCE_LIMITS.videos
      : 0;
  const maxMentionAudios = isBackendSelected && backendSupportsAudioReference
    ? backendModel?.ui.maxReferenceAudios || 0
    : isJimengSeedanceSelected
      ? JIMENG_SEEDANCE_LIMITS.audios
      : 0;
  const mentionMaterials = useMemo(
    () => [
      ...[...orderedImages, ...localRefMaterials.filter((m) => m.kind === 'image')].slice(0, maxMentionRefs),
      ...[...orderedVideos, ...localRefMaterials.filter((m) => m.kind === 'video')].slice(0, maxMentionVideos),
      ...[...orderedAudios, ...localRefMaterials.filter((m) => m.kind === 'audio')].slice(0, maxMentionAudios),
    ],
    [orderedImages, orderedVideos, orderedAudios, localRefMaterials, maxMentionRefs, maxMentionVideos, maxMentionAudios],
  );

  // 分组动态跟随子模型: Seedance / 即梦 CLI 支持 image/video/audio, 其他 (grok/veo/sora) 仅 image
  const previewGroups = useMemo<ReadonlyArray<'text' | 'image' | 'video' | 'audio'>>(
    () => resolveVideoPreviewGroups({
      isBackendSelected,
      isJimengSeedanceSelected,
      localKind: modelDef.kind,
      showImageMaterials,
      showVideoMaterials: isBackendSelected && backendSupportsVideoReference,
      showAudioMaterials: isBackendSelected && backendSupportsAudioReference,
    }),
    [backendSupportsAudioReference, backendSupportsVideoReference, isBackendSelected, isJimengSeedanceSelected, modelDef.kind, showImageMaterials],
  );
  const showMaterialPreview = showImageMaterials || (isBackendSelected && (backendSupportsVideoReference || backendSupportsAudioReference));

  // 收集上游 prompt + 参考图/视频/音频 (按用户拖拽顺序), 合并本地拖入素材
  const collectUpstream = (): { prompt: string; imageUrls: string[]; videoUrls: string[]; audioUrls: string[] } => {
    const prompts = orderedTexts.map((t) => t.url).filter((s) => !!s);
    const upImageUrls = orderedImages.map((m) => m.url).filter((s) => !!s);
    const upVideoUrls = orderedVideos.map((m) => m.url).filter((s) => !!s);
    const upAudioUrls = orderedAudios.map((m) => m.url).filter((s) => !!s);
    const dedupe = (items: string[]) => {
      const out: string[] = [];
      for (const item of items) if (item && !out.includes(item)) out.push(item);
      return out;
    };
    return {
      prompt: prompts.join('\n').trim(),
      imageUrls: dedupe([...upImageUrls, ...localRefImages]),
      videoUrls: dedupe([...upVideoUrls, ...localRefVideos]),
      audioUrls: dedupe([...upAudioUrls, ...localRefAudios]),
    };
  };

  // 本地 URL 转 base64(veo/seedance 路径使用;grok 可直接传 URL)
  const urlToBase64 = async (url: string): Promise<string> => {
    const r = await fetch(url);
    const blob = await r.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const stopPoll = () => {
    if (pollTimer.current) {
      window.clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    pollTimers.current.forEach((timer) => window.clearInterval(timer));
    pollTimers.current.clear();
  };

  useEffect(() => () => stopPoll(), []);

  // 切主模型时重置所有参数为该模型默认值(避免跨模型参数遗留)
  const switchMainModel = (nextId: string) => {
    const def = VIDEO_MODELS.find((m) => m.id === nextId) || VIDEO_MODELS[0];
    const nextModel = def.apiModelOptions[0].value;
    update({
      modelSource: 'local',
      backendProviderId: '',
      backendModelId: '',
      mainId: def.id,
      model: nextModel,
      ratio: def.defaultRatio,
      duration: def.defaultDuration ?? def.durations?.[0],
      resolution: def.defaultResolution || '',
      ...(nextModel === 'grok-imagine-video-1.5' ? { gkfMode: 'image_to_video' } : {}),
    });
  };

  const switchBackendVideoModel = (catalogId: string) => {
    const next = backendVideoModels.find((item) => item.id === catalogId) || backendProviderGroup?.models[0] || backendVideoModels[0];
    if (!next) {
      update({ modelSource: 'local', backendProviderId: '', backendModelId: '' });
      return;
    }
    const patch: any = {
      modelSource: 'backend',
      backendProviderId: next.providerId,
      backendModelId: next.id,
      providerSource: '',
      providerId: next.providerId,
      providerModel: next.modelId,
    };
    if (!next.ui.aspectRatios.includes(ratio)) patch.ratio = next.ui.defaultAspectRatio;
    const nextDurationOptions = next.ui.durationMode === 'range' && next.ui.durationRange
      ? durationOptionsFromRange(next.ui.durationRange)
      : next.ui.durationOptions;
    if (!nextDurationOptions.includes(Number(duration))) patch.duration = next.ui.defaultDuration;
    if (!next.ui.resolutionOptions.includes(resolution)) patch.resolution = next.ui.defaultResolution;
    update(patch);
  };

  const switchBackendVideoProvider = (providerId: string) => {
    const nextProvider = backendProviderGroups.find((item) => item.providerId === providerId) || backendProviderGroups[0];
    const nextModel = nextProvider?.models[0] || null;
    if (!nextProvider || !nextModel) {
      update({ modelSource: 'local', backendProviderId: '', backendModelId: '' });
      return;
    }
    const patch: any = {
      modelSource: 'backend',
      backendProviderId: nextProvider.providerId,
      backendModelId: nextModel.id,
      providerSource: '',
      providerId: nextModel.providerId,
      providerModel: nextModel.modelId,
    };
    if (!nextModel.ui.aspectRatios.includes(ratio)) patch.ratio = nextModel.ui.defaultAspectRatio;
    const nextDurationOptions = nextModel.ui.durationMode === 'range' && nextModel.ui.durationRange
      ? durationOptionsFromRange(nextModel.ui.durationRange)
      : nextModel.ui.durationOptions;
    if (!nextDurationOptions.includes(Number(duration))) patch.duration = nextModel.ui.defaultDuration;
    if (!nextModel.ui.resolutionOptions.includes(resolution)) patch.resolution = nextModel.ui.defaultResolution;
    update(patch);
  };

  const startPolling = (tid: string): Promise<{ videoUrl: string }> => {
    return new Promise<{ videoUrl: string }>((resolve, reject) => {
      let elapsed = 0;
      const POLL_INT = VIDEO_POLL_INTERVAL_MS;
      const MAX = VIDEO_MAX_POLL;
      let lastProgress = '';
      const timer = window.setInterval(async () => {
        elapsed += 1;
        if (elapsed > MAX) {
          window.clearInterval(timer);
          pollTimers.current.delete(timer);
          reject(new Error('轮询超时'));
          return;
        }
        try {
          const r = await queryVideo(tid, apiModel);
          if (r.progress && r.progress !== lastProgress) {
            lastProgress = r.progress;
            logBus.debug(`[${elapsed}/${MAX}] status=${r.status} progress=${r.progress}`, src);
          }
          if (r.status === 'SUCCESS' && r.videoUrl) {
            window.clearInterval(timer);
            pollTimers.current.delete(timer);
            logBus.success(`任务完成 → ${r.videoUrl}`, src);
            resolve({ videoUrl: r.videoUrl });
          } else if (r.status === 'FAILURE') {
            window.clearInterval(timer);
            pollTimers.current.delete(timer);
            reject(new Error(r.failReason || '生成失败'));
          } else {
            update({ status: 'polling', progress: r.progress || '' });
          }
        } catch (e: any) {
          console.warn('轮询出错', e?.message);
        }
      }, POLL_INT);
      pollTimer.current = timer;
      pollTimers.current.add(timer);
    });
  };

  const startExternalVideoTaskPolling = (tid: string, batchIndex?: number): Promise<{ videoUrls: string[]; remoteVideoUrls: string[] }> => {
    return new Promise<{ videoUrls: string[]; remoteVideoUrls: string[] }>((resolve, reject) => {
      let elapsed = 0;
      const timer = window.setInterval(async () => {
        elapsed += 1;
        if (elapsed > VIDEO_MAX_POLL) {
          window.clearInterval(timer);
          pollTimers.current.delete(timer);
          reject(new Error('后台视频任务轮询超时'));
          return;
        }
        try {
          const r = await queryExternalVideoTask(tid);
          const videoUrls = Array.isArray(r.videoUrls) ? r.videoUrls.filter(Boolean) : [];
          const remoteVideoUrls = Array.isArray(r.remoteVideoUrls) ? r.remoteVideoUrls.filter(Boolean) : [];
          if (r.status === 'succeeded' && videoUrls.length > 0) {
            window.clearInterval(timer);
            pollTimers.current.delete(timer);
            logBus.success(`后台视频任务完成 → ${videoUrls[0]}`, src);
            if (typeof batchIndex === 'number') {
              patchTaskRun(batchIndex, { status: 'success', progress: '100%', outputCount: videoUrls.length, finishedAt: Date.now() });
            }
            resolve({ videoUrls, remoteVideoUrls });
            return;
          }
          if (r.status === 'succeeded') {
            window.clearInterval(timer);
            pollTimers.current.delete(timer);
            reject(new Error('后台视频任务完成但没有返回可用视频'));
            return;
          }
          if (r.status === 'failed' || r.status === 'cancelled') {
            window.clearInterval(timer);
            pollTimers.current.delete(timer);
            if (typeof batchIndex === 'number') {
              patchTaskRun(batchIndex, { status: r.status === 'cancelled' ? 'cancelled' : 'error', error: r.error || (r.status === 'cancelled' ? '任务已取消' : '后台视频任务失败'), finishedAt: Date.now() });
            }
            reject(new Error(r.error || (r.status === 'cancelled' ? '任务已取消' : '后台视频任务失败')));
            return;
          }
          if (typeof batchIndex === 'number') {
            patchTaskRun(batchIndex, { status: 'polling', progress: r.progress || (r.status === 'running' ? '45%' : '5%') });
          }
          update({ status: 'polling', taskId: tid, progress: r.progress || (r.status === 'running' ? '45%' : '5%') });
        } catch (e: any) {
          console.warn('后台视频任务轮询出错', e?.message);
        }
      }, VIDEO_POLL_INTERVAL_MS);
      pollTimer.current = timer;
      pollTimers.current.add(timer);
    });
  };

  useEffect(() => {
    if (resumeStartedRef.current) return;
    resumeStartedRef.current = true;
    const saved = (data as any) || {};
    if (saved.status !== 'submitting' && saved.status !== 'polling') return;
    const runs = resumableTaskRuns(saved.taskRuns, ['external-video', 'fal-video', 'legacy-video']);
    if (runs.length === 0) return;

    update({ status: 'polling', error: null, progress: saved.progress || '5%' });
    void (async () => {
      let videoUrls = mergeUniqueUrls(saved.videoUrls, [saved.videoUrl]);
      let remoteVideoUrls = mergeUniqueUrls(saved.remoteVideoUrls);
      const settled = await Promise.allSettled(runs.map(async (run) => {
        let result: { videoUrls: string[]; remoteVideoUrls: string[] };
        try {
          if (run.resumeKind === 'external-video') {
            result = await startExternalVideoTaskPolling(run.taskId!, run.batchIndex);
          } else if (run.resumeKind === 'fal-video') {
            const params = run.resumeParams || {};
            const polled = await startFalPolling({
              requestId: run.taskId!,
              responseUrl: String(params.responseUrl || ''),
              endpoint: String(params.endpoint || ''),
            });
            result = { videoUrls: [polled.videoUrl], remoteVideoUrls: [] };
          } else {
            const polled = await startPolling(run.taskId!);
            result = { videoUrls: [polled.videoUrl], remoteVideoUrls: [] };
          }
          patchTaskRun(run.batchIndex, { status: 'success', progress: '100%', outputCount: result.videoUrls.length, finishedAt: Date.now() });
        } catch (resumeError) {
          patchTaskRun(run.batchIndex, { status: 'error', error: videoGenerationErrorMessage(resumeError), finishedAt: Date.now() });
          throw resumeError;
        }
        videoUrls = mergeUniqueUrls(videoUrls, result.videoUrls);
        remoteVideoUrls = mergeUniqueUrls(remoteVideoUrls, result.remoteVideoUrls);
        update({
          status: 'polling',
          videoUrl: videoUrls[0] || null,
          videoUrls: [...videoUrls],
          remoteVideoUrls: [...remoteVideoUrls],
          taskId: run.taskId,
          taskIds: taskRunIds(taskRunsRef.current),
        });
      }));
      const failures = settled.filter((item): item is PromiseRejectedResult => item.status === 'rejected');
      const finishedAt = Date.now();
      if (videoUrls.length > 0) {
        update({
          status: 'success',
          progress: '100%',
          videoUrl: videoUrls[0],
          videoUrls,
          remoteVideoUrls,
          taskIds: taskRunIds(taskRunsRef.current),
          finishedAt,
          lastDurationMs: typeof saved.startedAt === 'number' ? Math.max(0, finishedAt - saved.startedAt) : null,
          error: failures.length > 0 ? `${failures.length} 个恢复任务失败` : null,
        });
        return;
      }
      const message = failures[0]?.reason instanceof Error ? failures[0].reason.message : '恢复视频任务失败';
      setError(message);
      update({ status: 'error', error: message, finishedAt });
    })();
    // Recovery intentionally consumes only the persisted mount snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const falPollRef = useRef<{ responseUrl?: string; endpoint?: string; requestId?: string } | null>(null);

  const startFalPolling = (params = falPollRef.current): Promise<{ videoUrl: string }> => {
    return new Promise<{ videoUrl: string }>((resolve, reject) => {
      let elapsed = 0;
      const POLL_INT = VIDEO_FAL_POLL_INTERVAL_MS;
      const MAX = VIDEO_FAL_MAX_POLL;
      const timer = window.setInterval(async () => {
        elapsed += 1;
        if (elapsed > MAX) {
          window.clearInterval(timer);
          pollTimers.current.delete(timer);
          reject(new Error('FAL 轮询超时'));
          return;
        }
        try {
          const r = await queryVideoFal(params!);
          if (elapsed % 10 === 0) logBus.debug(`[FAL ${elapsed}/${MAX}] status=${r.status}`, src);
          if (r.status === 'completed' && r.videoUrl) {
            window.clearInterval(timer);
            pollTimers.current.delete(timer);
            logBus.success(`FAL 视频完成 → ${r.videoUrl}`, src);
            resolve({ videoUrl: r.videoUrl });
          } else if (r.status === 'failed') {
            window.clearInterval(timer);
            pollTimers.current.delete(timer);
            reject(new Error(r.error || 'FAL 生成失败'));
          } else {
            update({ status: 'polling', progress: `${Math.min(95, Math.round(20 + elapsed / MAX * 75))}%` });
          }
        } catch (e: any) {
          console.warn('FAL 轮询出错', e?.message);
        }
      }, POLL_INT);
      pollTimer.current = timer;
      pollTimers.current.add(timer);
    });
  };

  const handleGenerate = async () => {
    setError(null);
    const { prompt: upstreamPrompt, imageUrls, videoUrls, audioUrls } = collectUpstream();
    const resolvedLocalPrompt = resolveMediaMentions(localPrompt, promptMentions, mentionMaterials);
    const finalPrompt = (upstreamPrompt || resolvedLocalPrompt || '').trim();
    if (!finalPrompt) {
      setError('未连接 text 节点也未填写 prompt');
      logBus.error('生成中止: 缺少 prompt', src);
      return;
    }
    if (isBackendSelected && backendModel) {
      const inputError = getBackendVideoInputValidationError({
        frameMode,
        imageCount: imageUrls.length,
        videoCount: videoUrls.length,
        audioCount: audioUrls.length,
        maxReferenceImages: backendModel.ui.maxReferenceImages,
        maxReferenceVideos: backendModel.ui.maxReferenceVideos,
        maxReferenceAudios: backendModel.ui.maxReferenceAudios,
        inputCapabilities: backendVideoCaps,
      });
      if (inputError) {
        setError(inputError);
        logBus.error(`生成中止: ${inputError}`, src);
        return;
      }
    }

    taskCompletionSound.primeAudio();
    const runtimeStartedAt = markRuntimeStarted();

    const runSingleVideoGeneration = async (batchIndex: number) => {
      const batchLabel = generationCount > 1 ? `第 ${batchIndex + 1}/${generationCount} 次` : '本次';
      patchTaskRun(batchIndex, {
        status: 'submitting',
        progress: '0%',
        startedAt: Date.now(),
      });

      if (isBackendSelected && backendModel) {
        const assignment = resolveBackendVideoInputAssignment({
          imageUrls,
          frameMode,
          maxReferenceImages: backendModel.ui.maxReferenceImages,
          inputCapabilities: backendVideoCaps,
        });
        logBus.info(
          `${batchLabel} 后台视频模型提交: ${backendModel.provider.name} · ${backendModel.modelId} · mode=${frameMode} images=${assignment.orderedImages.length} audios=${audioUrls.length}`,
          src,
        );
        const r = await submitExternalVideoTask({
          providerId: backendModel.providerId,
          providerModel: backendModel.modelId,
          model: backendModel.modelId,
          prompt: finalPrompt,
          aspect_ratio: ratio,
          ratio,
          duration,
          resolution,
          seed: seed > 0 ? seed : undefined,
          images: assignment.orderedImages,
          videos: videoUrls.slice(0, backendModel.ui.maxReferenceVideos),
          first_frame: assignment.firstFrameUrl,
          last_frame: assignment.lastFrameUrl,
          audios: audioUrls,
          providerParams: {
            ...(d?.providerParams || {}),
            modelRecordId: backendModel.id,
            sourceNodeId: id,
            videoInputMode: frameMode,
          },
        });
        if (!r.taskId) throw new Error(`后台视频任务没有返回任务号：${backendModel.provider.name} / ${backendModel.modelId}`);
        patchTaskRun(batchIndex, {
          status: 'polling',
          taskId: r.taskId,
          resumeKind: 'external-video',
          progress: r.progress || '5%',
          startedAt: Date.now(),
        });
        update({ status: 'polling', taskId: r.taskId, lastPrompt: finalPrompt, progress: r.progress || '5%' });
        const polled = await startExternalVideoTaskPolling(r.taskId, batchIndex);
        if (!polled.videoUrls[0]) throw new Error(`后台视频任务完成但没有返回视频：${backendModel.provider.name} / ${backendModel.modelId}`);
        return { videoUrls: polled.videoUrls, remoteVideoUrls: polled.remoteVideoUrls || [], taskId: r.taskId };
      }

      if (isExternalSelected && providerSelection.provider) {
        const providerModel = externalProviderModel;
        const refs = imageUrls.slice(0, Math.max(1, maxMentionRefs || modelDef.maxRefImages || 8));
        const videoRefs = videoUrls.slice(0, maxMentionVideos);
        const audioRefs = audioUrls.slice(0, maxMentionAudios);
        const isAicopyAsyncVideo = providerSelection.provider.protocol === 'aicopy';
        logBus.info(
          isJimengSeedanceSelected
            ? `${batchLabel} 扩展平台视频提交: ${providerSelection.provider.label || providerSelection.provider.id} · ${providerModel} · 图${refs.length}/视${videoRefs.length}/音${audioRefs.length}`
            : `${batchLabel} 扩展平台视频提交: ${providerSelection.provider.label || providerSelection.provider.id} · ${providerModel} · refs=${refs.length}`,
          src,
        );
        if (isAicopyAsyncVideo) {
          const r = await submitExternalVideoTask({
            providerId: providerSelection.provider.id,
            providerModel,
            model: providerModel,
            prompt: finalPrompt,
            aspect_ratio: ratio,
            ratio,
            duration,
            resolution,
            seed: seed > 0 ? seed : undefined,
            images: refs,
            videos: videoRefs,
            audios: audioRefs,
            providerParams: {
              ...(d?.providerParams || {}),
              sourceNodeId: id,
            },
          });
          if (!r.taskId) {
            throw new Error(`AICopy 后台视频任务没有返回任务号：${providerSelection.provider.label || providerSelection.provider.id} / ${providerModel}`);
          }
          patchTaskRun(batchIndex, {
            status: 'polling',
            taskId: r.taskId,
            resumeKind: 'external-video',
            progress: r.progress || '5%',
            startedAt: Date.now(),
          });
          update({ status: 'polling', taskId: r.taskId, lastPrompt: finalPrompt, progress: r.progress || '5%' });
          const polled = await startExternalVideoTaskPolling(r.taskId, batchIndex);
          if (!polled.videoUrls[0]) {
            throw new Error(`AICopy 后台视频任务完成但没有返回视频：${providerSelection.provider.label || providerSelection.provider.id} / ${providerModel}`);
          }
          return { videoUrls: polled.videoUrls, remoteVideoUrls: polled.remoteVideoUrls || [], taskId: r.taskId };
        }
        const r = await generateExternalVideo({
          providerId: providerSelection.provider.id,
          providerModel,
          model: providerModel,
          prompt: finalPrompt,
          aspect_ratio: ratio,
          ratio,
          duration,
          resolution,
          seed: seed > 0 ? seed : undefined,
          images: refs,
          videos: videoRefs,
          audios: audioRefs,
          providerParams: d?.providerParams,
        });
        if (!r.videoUrls[0]) {
          const upstreamReason = typeof r.raw?.failureReason === 'string' ? r.raw.failureReason.trim() : '';
          throw new Error(upstreamReason || `扩展平台没有返回视频：${providerSelection.provider.label || providerSelection.provider.id} / ${providerModel}`);
        }
        return { videoUrls: r.videoUrls, remoteVideoUrls: r.remoteVideoUrls || [], taskId: r.taskId || null };
      }

      if (isFal && falReg) {
        const falMaxRefs =
          falReg.paramKind === 'grok-fal' && (isGrokFalV15 || gkfMode !== 'reference_to_video')
            ? 1
            : falReg.maxRefImages;
        const refs = imageUrls.slice(0, falMaxRefs);
        const images = refs.length > 0 ? refs : undefined;
        const falReq: VideoFalSubmitRequest = { apiModel, prompt: finalPrompt };
        if (images?.length) falReq.images = images;

        if (falReg.paramKind === 'veo-fal') {
          falReq.aspect_ratio = vfRatio;
          falReq.duration = vfDuration;
          falReq.resolution = vfResolution;
          falReq.generate_audio = vfAudio;
          falReq.safety_tolerance = vfSafety;
        } else if (falReg.paramKind === 'grok-fal') {
          const effectiveGkfMode = isGrokFalV15 ? 'image_to_video' : gkfMode;
          const pastedReferenceUrls = isGrokFalV15
            ? []
            : splitGrokFalRefUrls(gkfReferenceUrls).slice(0, Math.max(0, 7 - (images?.length || 0)));
          if (isGrokFalV15 && (!images || images.length === 0)) {
            throw new Error('Grok Video 1.5 需要至少 1 张参考图');
          }
          if (!isGrokFalV15 && effectiveGkfMode === 'reference_to_video' && (!images || images.length === 0) && pastedReferenceUrls.length === 0) {
            throw new Error('Grok FAL 参考生视频需要至少 1 张参考图或 URL');
          }
          falReq.gkMode = effectiveGkfMode;
          if (!isGrokFalV15) {
            falReq.gkRatio = effectiveGkfMode === 'reference_to_video' && gkfRatio === 'auto' ? '16:9' : gkfRatio;
          }
          falReq.gkDuration = gkfDuration;
          falReq.resolution = gkfResolution;
          falReq.image_mode = falReg.defaultImageMode || 'base64';
          if (pastedReferenceUrls.length) falReq.gkReferenceUrls = pastedReferenceUrls;
        } else if (falReg.paramKind === 'sora-fal') {
          if (soraMode === 'image_to_video' && (!images || images.length === 0)) {
            throw new Error('Sora2 图生视频需要 1 张参考图');
          }
          falReq.soraMode = soraMode;
          falReq.soraRatio = soraRatio;
          falReq.soraDuration = soraDuration;
          falReq.soraResolution = soraResolution;
          falReq.soraDeleteVideo = soraDeleteVideo;
          falReq.soraBlockIp = soraBlockIp;
          falReq.soraCharacterIds = soraCharacterIds;
          falReq.image_mode = falReg.defaultImageMode || 'base64';
        }

        logBus.info(`${batchLabel} 提交 FAL 视频: ${apiModel} refs=${images?.length || 0}`, src);
        const r = await submitVideoFal(falReq);
        if (r.sync && r.videoUrl) {
          return { videoUrls: [r.videoUrl], remoteVideoUrls: [], taskId: r.requestId || null };
        }
        falPollRef.current = { responseUrl: r.responseUrl, endpoint: r.endpoint, requestId: r.requestId };
        if (r.requestId) {
          patchTaskRun(batchIndex, {
            status: 'polling',
            taskId: r.requestId,
            resumeKind: 'fal-video',
            resumeParams: { responseUrl: r.responseUrl, endpoint: r.endpoint },
            progress: '15%',
          });
        }
        update({ status: 'polling', lastPrompt: finalPrompt, progress: '15%' });
        const polled = await startFalPolling();
        return { videoUrls: [polled.videoUrl], remoteVideoUrls: [], taskId: r.requestId || null };
      }

      const refs = imageUrls.slice(0, modelDef.maxRefImages);
      let images: string[] | undefined;
      if (modelDef.supportImages && refs.length > 0) {
        if (modelDef.kind === 'grok') {
          images = refs;
        } else {
          const arr: string[] = [];
          for (const u of refs) {
            try { arr.push(await urlToBase64(u)); }
            catch (e) { console.warn('图像编码失败', e); }
          }
          if (arr.length) images = arr;
        }
      }

      const payload: VideoSubmitRequest = { model: apiModel, prompt: finalPrompt };
      if (modelDef.kind === 'grok') {
        payload.ratio = ratio;
        payload.duration = Number(duration) || modelDef.defaultDuration || 15;
        payload.resolution = resolution || modelDef.defaultResolution || '720P';
        if (seed > 0) payload.seed = seed;
      } else {
        payload.aspect_ratio = ratio;
        payload.enhance_prompt = enhancePrompt;
        if (enableUpsample) payload.enable_upsample = true;
        if (seed > 0) payload.seed = seed;
      }
      if (images?.length) payload.images = images;

      logBus.info(`${batchLabel} 提交任务: kind=${modelDef.kind} model=${apiModel} refs=${images?.length || 0}`, src);
      const r = await submitVideo(payload);
      patchTaskRun(batchIndex, {
        status: 'polling',
        taskId: r.taskId,
        resumeKind: 'legacy-video',
        resumeParams: { apiModel },
        progress: '0%',
      });
      update({ status: 'polling', taskId: r.taskId, lastPrompt: finalPrompt, progress: '0%' });
      const polled = await startPolling(r.taskId);
      return { videoUrls: [polled.videoUrl], remoteVideoUrls: [], taskId: r.taskId };
    };

    const initialTaskRuns: TaskRunState[] = Array.from({ length: generationCount }, (_, batchIndex) => ({
      batchIndex,
      kind: "video",
      status: "queued",
      progress: "0%",
      outputCount: 0,
      startedAt: Date.now(),
      finishedAt: null,
    }));
    const existingVideoUrls = accumulateOutputs
      ? appendGeneratedVideoUrls(d?.videoUrls, d?.videoUrl)
      : [];
    update({
      status: 'submitting',
      error: null,
      videoUrl: existingVideoUrls[0] || null,
      videoUrls: existingVideoUrls,
      taskId: null,
      taskRuns: initialTaskRuns,
    });
    try {
      const aggregatedVideoUrls: string[] = [...existingVideoUrls];
      const aggregatedRemoteVideoUrls: string[] = [];
      const taskIds: string[] = [];
      let lastTaskId: string | null = null;

      const appendVideoGenerationResult = (batchIndex: number, result: Awaited<ReturnType<typeof runSingleVideoGeneration>>) => {
        for (const url of result.videoUrls) if (url && !aggregatedVideoUrls.includes(url)) aggregatedVideoUrls.push(url);
        for (const url of result.remoteVideoUrls) if (url && !aggregatedRemoteVideoUrls.includes(url)) aggregatedRemoteVideoUrls.push(url);
        if (result.taskId) {
          lastTaskId = result.taskId;
          if (!taskIds.includes(result.taskId)) taskIds.push(result.taskId);
        }
        patchTaskRun(batchIndex, {
          status: 'success',
          taskId: result.taskId || undefined,
          progress: '100%',
          outputCount: result.videoUrls.length,
          finishedAt: Date.now(),
        });
        update({
          status: 'polling',
          progress: generationCount > 1 ? `${aggregatedVideoUrls.length}/${generationCount}` : '95%',
          videoUrl: aggregatedVideoUrls[0] || null,
          videoUrls: [...aggregatedVideoUrls],
          remoteVideoUrls: [...aggregatedRemoteVideoUrls],
          taskId: lastTaskId,
          taskIds: [...taskIds],
        });
      };

      const runConcurrentVideoGenerations = async () => {
        const jobs = Array.from({ length: generationCount }, (_, batchIndex) =>
          runSingleVideoGeneration(batchIndex)
            .then((result) => {
              appendVideoGenerationResult(batchIndex, result);
              return result;
            })
            .catch((error) => {
              patchTaskRun(batchIndex, {
                status: 'error',
                error: videoGenerationErrorMessage(error),
                finishedAt: Date.now(),
              });
              throw error;
            })
        );
        return Promise.allSettled(jobs);
      };

      const settled = await runConcurrentVideoGenerations();
      const rejected = settled.filter((item): item is PromiseRejectedResult => item.status === 'rejected');

      const nextVideoUrl = aggregatedVideoUrls[0];
      if (!nextVideoUrl) {
        const reasons = rejected.map((item) => videoGenerationErrorMessage(item.reason)).filter(Boolean);
        throw new Error(reasons.length > 0 ? `视频生成失败：${reasons.join('；')}` : '视频生成失败：没有返回可用视频。');
      }
      markRuntimeFinished(runtimeStartedAt, {
        status: 'success',
        videoUrl: nextVideoUrl,
        videoUrls: aggregatedVideoUrls,
        remoteVideoUrls: aggregatedRemoteVideoUrls,
        taskId: lastTaskId,
        taskIds,
        lastPrompt: finalPrompt,
        progress: '100%',
        taskRuns: taskRunsRef.current.length > 0 ? taskRunsRef.current : initialTaskRuns,
      });
      if (rejected.length > 0) {
        logBus.warn(`部分视频生成失败: ${rejected.map((item) => videoGenerationErrorMessage(item.reason)).join('；')}`, src);
      }
      taskCompletionSound.notifyComplete(id, 'video');
    } catch (e: any) {
      const msg = e?.message || '提交失败';
      setError(msg);
      markRuntimeFailed(runtimeStartedAt, msg);
      logBus.error(`提交失败: ${msg}`, src);
    }
  };

  const handleStop = () => {
    stopPoll();
    const ids = mergeUniqueUrls(taskIds, [taskId], taskRunIds(taskRunsRef.current));
    Promise.allSettled(ids.map((tid) => cancelGenerationTask({ taskId: tid, kind: 'video', model: apiModel })))
      .catch((error) => logBus.warn(`取消上游任务失败: ${error?.message || error}`, src));
    update({ status: 'idle', progress: '', startedAt: null, finishedAt: null, lastDurationMs: null });
    logBus.warn('用户主动停止', src);
  };

  // 批量运行接入
  useRunTrigger(id, async () => {
    if (status === 'submitting' || status === 'polling') return;
    await handleGenerate();
  }, 'video');

  // === 跨节点拖拽: source (输出视频可拖出) ===
  const startDrag = useDragMaterialStore((s) => s.start);
  const beginMaterialDrag = (e: React.MouseEvent, payload: MaterialPayload) => {
    if (e.button !== 0 || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    e.stopPropagation();
    startDrag(payload, e.clientX, e.clientY);
  };

  // === 跨节点拖拽: target (接收 image/video/audio/text) ===
  const handleDrop = (payload: MaterialPayload) => {
    if (payload.kind === 'image' && payload.url) {
      const cur = Array.isArray(d?.localRefImages) ? d.localRefImages : [];
      if (cur.indexOf(payload.url) !== -1) return;
      const cap = isBackendSelected
        ? backendImageInputLimit
        : isJimengSeedanceSelected
          ? JIMENG_SEEDANCE_LIMITS.images
          : (modelDef.maxRefImages || 7) + 4;
      if (orderedImages.length + cur.length >= cap) {
        setError(frameMode === 'first' ? '首帧模式需要且只能使用 1 张图片' : frameMode === 'last' ? '尾帧模式需要且只能使用 1 张图片' : frameMode === 'firstlast' ? '首尾帧模式需要且只能使用 2 张图片' : `参考图最多允许 ${cap} 张`);
        return;
      }
      update({ localRefImages: [...cur, payload.url] });
    } else if (payload.kind === 'video' && payload.url && (isJimengSeedanceSelected || (isBackendSelected && backendSupportsVideoReference))) {
      const cur = Array.isArray(d?.localRefVideos) ? d.localRefVideos : [];
      if (cur.indexOf(payload.url) !== -1) return;
      if (orderedVideos.length + cur.length >= maxMentionVideos) {
        setError(`参考视频最多允许 ${maxMentionVideos} 条`);
        return;
      }
      update({ localRefVideos: [...cur, payload.url] });
    } else if (payload.kind === 'audio' && payload.url && (isJimengSeedanceSelected || (isBackendSelected && backendSupportsAudioReference))) {
      const cur = Array.isArray(d?.localRefAudios) ? d.localRefAudios : [];
      if (cur.indexOf(payload.url) !== -1) return;
      if (orderedAudios.length + cur.length >= maxMentionAudios) {
        setError(`参考音频最多允许 ${maxMentionAudios} 条`);
        return;
      }
      update({ localRefAudios: [...cur, payload.url] });
    } else if (payload.kind === 'text' && typeof payload.text === 'string') {
      update({ prompt: payload.text });
    }
  };
  const { dropProps, isAccepting } = useMaterialDropTarget({
    id,
    accepts: isJimengSeedanceSelected
        ? ['image', 'video', 'audio', 'text']
      : isBackendSelected
        ? [...(showImageMaterials ? ['image' as const] : []), ...(backendSupportsVideoReference ? ['video' as const] : []), ...(backendSupportsAudioReference ? ['audio' as const] : []), 'text']
        : showImageMaterials
          ? ['image', 'text']
          : ['text'],
    onDrop: handleDrop,
  });

  const isBusy = status === 'submitting' || status === 'polling';
  const refsCount = orderedImages.length + localRefImages.length;
  const videoRefsCount = orderedVideos.length + localRefVideos.length;
  const audioRefsCount = orderedAudios.length + localRefAudios.length;
  const previewTitle = isBackendSelected
    ? `上游素材 · 图${refsCount}/${Math.max(maxMentionRefs, 0)}${backendSupportsVideoReference ? ` 视${videoRefsCount}/${Math.max(maxMentionVideos, 0)}` : ''}${backendSupportsAudioReference ? ` 音${audioRefsCount}/${Math.max(maxMentionAudios, 0)}` : ''}`
    : isJimengSeedanceSelected
    ? `上游素材 · 图${Math.min(refsCount, JIMENG_SEEDANCE_LIMITS.images)}/${JIMENG_SEEDANCE_LIMITS.images} 视${Math.min(videoRefsCount, JIMENG_SEEDANCE_LIMITS.videos)}/${JIMENG_SEEDANCE_LIMITS.videos} 音${Math.min(audioRefsCount, JIMENG_SEEDANCE_LIMITS.audios)}/${JIMENG_SEEDANCE_LIMITS.audios}`
    : `上游素材 · 参考图 ${Math.min(refsCount, Math.max(maxMentionRefs, 0))}/${Math.max(maxMentionRefs, 0)}`;

  const handleBackendFrameModeChange = (nextMode: BackendVideoFrameMode) => {
    const nextLimit = nextMode === 'first' || nextMode === 'last'
      ? 1
      : nextMode === 'firstlast'
        ? 2
        : backendModel?.ui.maxReferenceImages || 0;
    const imageMaterials = [
      ...orderedImages,
      ...localRefMaterials.filter((material) => material.kind === 'image'),
    ];
    if (imageMaterials.length <= nextLimit) {
      update({ frameMode: nextMode });
      return;
    }
    const confirmed = window.confirm(
      `切换后最多保留 ${nextLimit} 张图片。确认排除其余 ${imageMaterials.length - nextLimit} 张素材吗？`,
    );
    if (!confirmed) return;

    const kept = imageMaterials.slice(0, nextLimit);
    const removed = imageMaterials.slice(nextLimit);
    const removedIds = new Set(removed.map((material) => material.id));
    const nextExcludedMaterialIds = removed
      .filter((material) => material.origin === 'upstream')
      .reduce((ids, material) => excludeMaterialId(ids, material.id), excludedMaterialIds);
    update({
      frameMode: nextMode,
      excludedMaterialIds: nextExcludedMaterialIds,
      localRefImages: kept.filter((material) => material.origin === 'local').map((material) => material.url),
      materialOrder: materialOrder.filter((materialId) => !removedIds.has(materialId)),
    });
  };

  return (
    <div
      ref={rootRef}
      {...dropProps}
      className={`t8-generation-node t8-generation-node--video relative rounded-xl border-2 transition-all w-[300px] ${
        selected ? 'border-rose-400 shadow-2xl shadow-rose-500/20' : isAccepting ? 'border-emerald-400' : 'border-white/15 hover:border-white/30'
      }`}
      style={{
        background: 'rgba(20,20,22,.92)',
        backdropFilter: 'blur(8px)',
        boxShadow: isAccepting ? '0 0 0 2px rgba(52,211,153,.45), 0 12px 30px rgba(52,211,153,.18)' : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} className="!bg-rose-400 !border-0" />
      <Handle type="source" position={Position.Right} className="!bg-rose-400 !border-0" />

      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <div
          className="w-6 h-6 rounded flex items-center justify-center"
          style={{ background: 'rgba(244,63,94,.2)', color: '#fda4af', boxShadow: 'inset 0 0 0 1px rgba(244,63,94,.45)' }}
        >
          <VideoIcon size={13} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">视频</div>
          <div className="text-[10px] text-white/40">
            {isBackendSelected && backendModel
              ? `${backendModel.provider.name} · ${backendModel.displayName || backendModel.modelId}`
              : isExternalSelected && providerSelection.provider
              ? `${providerSelection.provider.label || providerSelection.provider.id} · ${externalProviderModel || '未选模型'}`
              : `${modelDef.label} · ${modelDef.kind}`}
          </div>
        </div>
        {isBusy && (
          <button
            type="button"
            onClick={handleStop}
            onMouseDown={(e) => e.stopPropagation()}
            className="nodrag nopan flex h-7 w-7 items-center justify-center rounded-lg border border-red-300/30 bg-red-500/15 text-red-200 transition hover:bg-red-500/25"
            title="终止当前生成任务"
          >
            <Square size={12} />
          </button>
        )}
      </div>

      <NodeRuntimeCard
        status={status}
        progress={progress}
        startedAt={startedAt}
        finishedAt={finishedAt}
        lastDurationMs={lastDurationMs}
        accent="#f43f5e"
        taskId={taskId}
        taskRuns={taskRuns}
      />

      <div className="p-2.5 space-y-2" onMouseDown={(e) => e.stopPropagation()}>
        {backendVideoModels.length > 0 && (
          <div className="rounded border border-cyan-300/25 bg-cyan-400/[0.06] p-2 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[10px] font-semibold text-cyan-100">发布模型</label>
              <span className="text-[10px] text-cyan-200/70">{backendVideoModels.length} 个已发布</span>
            </div>
            <div className="grid gap-2">
              <div>
                <label className="text-[10px] text-white/50 block mb-1">供应商</label>
                <select
                  value={isBackendSelected && backendProviderGroup ? backendProviderGroup.providerId : (backendProviderGroups[0]?.providerId || '')}
                  onChange={(e) => {
                    switchBackendVideoProvider(e.target.value);
                  }}
                  style={{ background: '#18181b', color: '#ffffff' }}
                  className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-cyan-300/60"
                >
                  {backendProviderGroups.map((group) => (
                    <option key={group.providerId} value={group.providerId} style={{ background: '#18181b', color: '#ffffff' }}>
                      {group.providerName}
                    </option>
                  ))}
                </select>
              </div>
              {isBackendSelected && backendProviderGroup && (
                <div>
                  <label className="text-[10px] text-white/50 block mb-1">模型</label>
                  <select
                    value={backendModel?.id || ''}
                    onChange={(e) => switchBackendVideoModel(e.target.value)}
                    style={{ background: '#18181b', color: '#ffffff' }}
                    className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-cyan-300/60"
                  >
                    {backendProviderGroup.models.map((item) => (
                      <option key={item.id} value={item.id} style={{ background: '#18181b', color: '#ffffff' }}>
                        {item.displayName || item.modelId}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {!isBackendSelected && videoAdvancedProviders.length > 0 && (
          <div className="rounded border border-white/10 bg-white/[0.03] p-2 space-y-2">
            <button
              type="button"
              onClick={() => update({ advancedProviderOpen: !d?.advancedProviderOpen })}
              className="w-full flex items-center justify-between text-[10px] font-semibold text-white/70 hover:text-white"
            >
              <span>高级来源</span>
              <span>{isExternalSelected && providerSelection.provider ? providerSelection.provider.label : '默认视频接口'}</span>
            </button>
            {d?.advancedProviderOpen && (
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-white/50 block mb-1">平台</label>
                  <select
                    value={isExternalSelected ? providerSelection.providerId : 'zhenzhen'}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      if (nextId === 'zhenzhen') {
                        update({ providerSource: 'zhenzhen', providerId: '', providerModel: '' });
                        return;
                      }
                      const provider = videoAdvancedProviders.find((item) => item.id === nextId);
                      if (!provider) return;
                      const nextModels = advancedProviderModelOptions(provider, 'video');
                      update({
                        providerSource: provider.protocol,
                        providerId: provider.id,
                        providerModel: nextModels[0] || '',
                      });
                    }}
                    style={{ background: '#18181b', color: '#ffffff' }}
                    className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
                  >
                    <option value="zhenzhen" style={{ background: '#18181b', color: '#ffffff' }}>贞贞工坊（默认）</option>
                    {videoAdvancedProviders.map((provider) => (
                      <option key={provider.id} value={provider.id} style={{ background: '#18181b', color: '#ffffff' }}>
                        {provider.label || provider.id}
                      </option>
                    ))}
                  </select>
                </div>
                {isExternalSelected && providerSelection.provider && (
                  <div>
                    <label className="text-[10px] text-white/50 block mb-1">外部模型</label>
                    <select
                      value={externalProviderModel}
                      onChange={(e) => update({ providerModel: e.target.value })}
                      style={{ background: '#18181b', color: '#ffffff' }}
                      className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
                    >
                      {externalModelOptions.map((m) => (
                        <option key={m} value={m} style={{ background: '#18181b', color: '#ffffff' }}>{m}</option>
                      ))}
                    </select>
                  </div>
                )}
                {savedExternalMissing && (
                  <div className="text-[10px] text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1">
                    当前画布记录的扩展平台未启用或不存在，已临时回到默认来源。
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 主模型 */}
        {!isBackendSelected && !isExternalSelected && (
        <div>
          <label className="text-[10px] text-white/50 block mb-1">模型类型</label>
          <select
            value={modelDef.id}
            onChange={(e) => switchMainModel(e.target.value)}
            className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
          >
            {VIDEO_MODELS.filter((m) => m.kind !== 'seedance').map((m) => (
              <option key={m.id} value={m.id} className="bg-zinc-900">{m.label}</option>
            ))}
          </select>
        </div>
        )}

        {/* 子模型(主项目 veo_model / gk_model) */}
        {!isBackendSelected && !isExternalSelected && modelDef.apiModelOptions.length > 1 && (
          <div>
            <label className="text-[10px] text-white/50 block mb-1">具体模型</label>
            <select
              value={apiModel}
              onChange={(e) => {
                const nextModel = e.target.value;
                update({
                  model: nextModel,
                  ...(nextModel === 'grok-imagine-video-1.5' ? { gkfMode: 'image_to_video' } : {}),
                });
              }}
              className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
            >
              {modelDef.apiModelOptions.map((o) => (
                <option key={o.value} value={o.value} className="bg-zinc-900">{o.label}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="text-[10px] text-white/50 block mb-1">生成数量</label>
          <select
            value={generationCount}
            onChange={(e) => update({ generationCount: clampGenerationCount(e.target.value) })}
            className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
          >
            {[1, 2, 3, 4].map((count) => (
              <option key={count} value={count} className="bg-zinc-900">{count}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-1.5 text-[10px] text-white/60 cursor-pointer">
          <input
            type="checkbox"
            checked={accumulateOutputs}
            onChange={(e) => update({ accumulateOutputs: e.target.checked })}
            className="accent-rose-400"
          />
          输出累积（跨次生成追加）
        </label>

        {/* === FAL 专属参数面板 === */}
        {showBuiltinFalControls && falReg?.paramKind === 'veo-fal' && (
          <>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="text-[10px] text-white/50 block mb-1">比例 (FAL)</label>
                <select value={vfRatio} onChange={(e) => update({ vfRatio: e.target.value })} className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30">
                  {VEO_FAL_RATIOS.map((r) => <option key={r} value={r} className="bg-zinc-900">{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1">时长</label>
                <select value={vfDuration} onChange={(e) => update({ vfDuration: e.target.value })} className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30">
                  {VEO_FAL_DURATIONS.map((d) => <option key={d} value={d} className="bg-zinc-900">{d}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="text-[10px] text-white/50 block mb-1">分辨率</label>
                <select value={vfResolution} onChange={(e) => update({ vfResolution: e.target.value })} className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30">
                  {VEO_FAL_RESOLUTIONS.map((r) => <option key={r} value={r} className="bg-zinc-900">{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1">安全等级</label>
                <select value={String(vfSafety)} onChange={(e) => update({ vfSafety: Number(e.target.value) })} className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30">
                  {[1,2,3,4,5,6].map((s) => <option key={s} value={s} className="bg-zinc-900">{s}</option>)}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-1 text-[10px] text-white/60 cursor-pointer">
              <input type="checkbox" checked={vfAudio} onChange={(e) => update({ vfAudio: e.target.checked })} className="accent-rose-400" />
              生成音频
            </label>
          </>
        )}

        {showBuiltinFalControls && falReg?.paramKind === 'grok-fal' && (
          <>
            {isGrokFalV15 ? (
              <div className="rounded border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] leading-relaxed text-white/60">
                Grok Video 1.5 仅支持图生视频，必须有 1 张参考图；图像传入模式默认 Base64，不发送比例参数。
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-[10px] text-white/50 block mb-1">模式 (FAL)</label>
                  <select
                    value={gkfMode}
                    onChange={(e) => {
                      const next = e.target.value as 'image_to_video' | 'reference_to_video';
                      update({
                        gkfMode: next,
                        ...(next === 'reference_to_video' && gkfRatio === 'auto' ? { gkfRatio: '16:9' } : {}),
                      });
                    }}
                    className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
                  >
                    {GROK_FAL_MODES.map((m) => <option key={m.value} value={m.value} className="bg-zinc-900">{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-white/50 block mb-1">比例 (FAL)</label>
                  <select value={gkfRatio} onChange={(e) => update({ gkfRatio: e.target.value })} className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30">
                    {GROK_FAL_RATIOS.map((r) => <option key={r} value={r} className="bg-zinc-900">{r}</option>)}
                  </select>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="text-[10px] text-white/50 block mb-1">时长(s)</label>
                <input type="number" value={gkfDuration} min={1} max={30} onChange={(e) => update({ gkfDuration: Number(e.target.value) || 6 })} className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1">分辨率</label>
                <select value={gkfResolution} onChange={(e) => update({ gkfResolution: e.target.value })} className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30">
                  {GROK_FAL_RESOLUTIONS.map((r) => <option key={r} value={r} className="bg-zinc-900">{r}</option>)}
                </select>
              </div>
            </div>
            {!isGrokFalV15 && gkfMode === 'reference_to_video' && (
              <div>
                <label className="text-[10px] text-white/50 block mb-1">公开参考 URL(可选)</label>
                <textarea
                  value={gkfReferenceUrls}
                  onChange={(e) => update({ gkfReferenceUrls: e.target.value })}
                  placeholder="每行或逗号分隔，最多补足到 7 张"
                  className="w-full h-12 resize-none rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
                />
              </div>
            )}
            <div className="text-[10px] text-white/45 leading-relaxed">
              {isGrokFalV15
                ? '只取第 1 张参考图，提交到 v1.5 image-to-video；Base64 为默认传入方式。'
                : gkfMode === 'reference_to_video'
                ? '参考生视频最多 7 张，优先使用上游/本地图，再补充 URL。'
                : '图生视频只取第 1 张参考图；无图时保留文生视频 fallback。'}
            </div>
          </>
        )}

        {showBuiltinFalControls && falReg?.paramKind === 'sora-fal' && (
          <>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="text-[10px] text-white/50 block mb-1">FAL Mode</label>
                <select value={soraMode} onChange={(e) => update({ soraMode: e.target.value })} className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30">
                  {SORA2_FAL_MODES.map((m) => <option key={m.value} value={m.value} className="bg-zinc-900">{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1">比例</label>
                <select value={soraRatio} onChange={(e) => update({ soraRatio: e.target.value })} className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30">
                  {SORA2_FAL_RATIOS.map((r) => <option key={r} value={r} className="bg-zinc-900">{r}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="text-[10px] text-white/50 block mb-1">时长</label>
                <select value={String(soraDuration)} onChange={(e) => update({ soraDuration: Number(e.target.value) || 4 })} className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30">
                  {SORA2_FAL_DURATIONS.map((d) => <option key={d} value={d} className="bg-zinc-900">{d}s</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1">分辨率</label>
                <select value={soraResolution} onChange={(e) => update({ soraResolution: e.target.value })} className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30">
                  {SORA2_FAL_RESOLUTIONS.map((r) => <option key={r} value={r} className="bg-zinc-900">{r}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-white/50 block mb-1">Character IDs</label>
              <input
                value={soraCharacterIds}
                onChange={(e) => update({ soraCharacterIds: e.target.value })}
                placeholder="id1, id2"
                className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30 placeholder:text-white/25"
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <label className="flex items-center gap-1 text-[10px] text-white/60 cursor-pointer">
                <input type="checkbox" checked={soraDeleteVideo} onChange={(e) => update({ soraDeleteVideo: e.target.checked })} className="accent-rose-400" />
                Delete Video
              </label>
              <label className="flex items-center gap-1 text-[10px] text-white/60 cursor-pointer">
                <input type="checkbox" checked={soraBlockIp} onChange={(e) => update({ soraBlockIp: e.target.checked })} className="accent-rose-400" />
                Block IP
              </label>
            </div>
            <div className="rounded border border-white/10 bg-white/5 px-2 py-1 text-[10px] leading-relaxed text-white/45">
              默认用 Base64 传入第 1 张参考图；Auto 无图时走文生视频。
            </div>
          </>
        )}

        {/* 比例(非 FAL 时显示原始控件) */}
        {showGenericVideoControls && (
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="text-[10px] text-white/50 block mb-1">比例</label>
            <select
              value={ratio}
              onChange={(e) => update({ ratio: e.target.value })}
              className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
            >
              {ratioOptions.map((r) => (
                <option key={r} value={r} className="bg-zinc-900">{r}</option>
              ))}
            </select>
          </div>
          {/* 时长(grok / seedance) */}
          {durationOptions.length > 0 && (
            <div>
              <label className="text-[10px] text-white/50 block mb-1">时长(s)</label>
              <select
                value={String(duration)}
                onChange={(e) => update({ duration: Number(e.target.value) })}
              className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
            >
                {durationOptions.map((s) => (
                  <option key={s} value={s} className="bg-zinc-900">{s}s</option>
                ))}
              </select>
            </div>
          )}
        </div>
        )}

        {/* 分辨率(仅 grok 非FAL) */}
        {showGenericVideoControls && resolutionOptions.length > 0 && (
          <div>
            <label className="text-[10px] text-white/50 block mb-1">分辨率</label>
            <select
              value={resolution || resolutionOptions[0]}
              onChange={(e) => update({ resolution: e.target.value })}
              className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
            >
              {resolutionOptions.map((r) => (
                <option key={r} value={r} className="bg-zinc-900">{r}</option>
              ))}
            </select>
          </div>
        )}

        {isBackendSelected && backendFrameModeOptions.length > 1 && (
          <div>
            <label className="text-[10px] text-white/50 block mb-1">图片输入模式</label>
            <select
              value={frameMode}
              onChange={(e) => handleBackendFrameModeChange(e.target.value as BackendVideoFrameMode)}
              className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
            >
              {backendFrameModeOptions.map((item) => (
                <option key={item.value} value={item.value} className="bg-zinc-900">{item.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* veo 专用选项(非FAL) */}
        {!isBackendSelected && !isExternalSelected && !isFal && modelDef.kind === 'veo' && (
          <div className="grid grid-cols-2 gap-1.5">
            <label className="flex items-center gap-1 text-[10px] text-white/60 cursor-pointer">
              <input
                type="checkbox"
                checked={enhancePrompt}
                onChange={(e) => update({ enhancePrompt: e.target.checked })}
                className="accent-rose-400"
              />
              Enhance Prompt
            </label>
            <label className="flex items-center gap-1 text-[10px] text-white/60 cursor-pointer">
              <input
                type="checkbox"
                checked={enableUpsample}
                onChange={(e) => update({ enableUpsample: e.target.checked })}
                className="accent-rose-400"
              />
              Upsample
            </label>
          </div>
        )}

        {/* Seed(非FAL) */}
        {showGenericVideoControls && (
        <div>
          <label className="text-[10px] text-white/50 block mb-1">Seed (0=随机)</label>
          <input
            type="number"
            value={seed}
            min={0}
            max={2147483647}
            onChange={(e) => update({ seed: Number(e.target.value) || 0 })}
            className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
          />
        </div>
        )}

        {/* 上游素材聚合预览区 (代替原「参考图(上游)」计数提示) */}
        {showMaterialPreview && (
          <MaterialPreviewSection
            texts={orderedTexts}
            images={orderedImages}
            videos={orderedVideos}
            audios={orderedAudios}
            order={materialOrder}
            onReorder={setMaterialOrder}
            onExcludeUpstream={handleExcludeUpstreamMaterial}
            excludedCount={excludedUpstreamCount}
            onRestoreExcluded={handleRestoreExcludedMaterials}
            selected={!!selected}
            isDark={isDark}
            isPixel={isPixel}
            presentation="modern"
            groups={previewGroups}
            title={previewTitle}
          />
        )}

        {/* 本地拖入参考素材 (Ctrl+拖拽自其他节点) */}
        {showMaterialPreview && (localRefImages.length + localRefVideos.length + localRefAudios.length) > 0 && (
          <div className="rounded border border-emerald-400/30 bg-emerald-500/5 p-1.5 space-y-1">
            <div className="text-[10px] text-emerald-200/80">
              本地拖入 · 图{localRefImages.length} 视{localRefVideos.length} 音{localRefAudios.length}
            </div>
            {localRefImages.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {localRefImages.map((u, i) => (
                  <div key={`img-${i}`} className="relative w-10 h-10">
                    <img
                      src={u}
                      alt=""
                      data-drag-source
                      data-drag-kind="image"
                      data-drag-url={u}
                      data-drag-preview={u}
                      data-drag-node-id={id}
                      onMouseDown={(e) => beginMaterialDrag(e, { kind: 'image', url: u, sourceNodeId: id, previewUrl: u })}
                      className="w-10 h-10 object-cover rounded border border-white/10 cursor-grab"
                    />
                    <button
                      onClick={() => update({ localRefImages: localRefImages.filter((x) => x !== u) })}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center"
                    >
                      <X size={9} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {localRefVideos.length > 0 && (
              <div className="space-y-1">
                {localRefVideos.map((u, i) => (
                  <div key={`vid-${i}`} className="flex items-center gap-1">
                    <LoopingVideo
                      src={u}
                      data-drag-source
                      data-drag-kind="video"
                      data-drag-url={u}
                      data-drag-preview={u}
                      data-drag-node-id={id}
                      onMouseDown={(e) => beginMaterialDrag(e, { kind: 'video', url: u, sourceNodeId: id, previewUrl: u })}
                      className="w-12 h-8 object-cover rounded border border-white/10 cursor-grab"
                    />
                    <span className="flex-1 truncate text-[10px] text-white/50">{u.split('/').pop()}</span>
                    <button
                      onClick={() => update({ localRefVideos: localRefVideos.filter((x) => x !== u) })}
                      className="text-rose-300/60 hover:text-rose-200"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {localRefAudios.length > 0 && (
              <div className="space-y-1">
                {localRefAudios.map((u, i) => (
                  <div key={`aud-${i}`} className="flex items-center gap-1">
                    <span
                      data-drag-source
                      data-drag-kind="audio"
                      data-drag-url={u}
                      data-drag-node-id={id}
                      onMouseDown={(e) => beginMaterialDrag(e, { kind: 'audio', url: u, sourceNodeId: id, previewUrl: u })}
                      className="text-[14px] cursor-grab"
                      title="按住 Ctrl 拖拽"
                    >
                      ♪
                    </span>
                    <span className="flex-1 truncate text-[10px] text-white/50">{u.split('/').pop()}</span>
                    <button
                      onClick={() => update({ localRefAudios: localRefAudios.filter((x) => x !== u) })}
                      className="text-rose-300/60 hover:text-rose-200"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Prompt */}
        <div>
          <label className="text-[10px] text-white/50 block mb-1">本地 Prompt(可选)</label>
          <MentionPromptInput
            value={localPrompt}
            mentions={promptMentions}
            materials={mentionMaterials}
            onChange={(value, mentions) => update({ prompt: value, promptMentions: mentions })}
            placeholder="备用:无上游连接时使用"
            isDark={isDark}
            isPixel={isPixel}
            className="w-full h-12 resize-none rounded bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-white outline-none focus:border-white/30 placeholder:text-white/30"
          />
        </div>

        {!isBusy ? (
          <button
            onClick={handleGenerate}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-medium transition-colors"
          >
            <Sparkles size={12} /> 生成视频
          </button>
        ) : (
          <div className="flex items-center justify-center gap-1.5 rounded border border-rose-300/15 bg-rose-500/10 py-1.5 text-xs font-medium text-rose-100/80">
            <Loader2 size={11} className="animate-spin" />
            {progress || (status === 'submitting' ? '提交中' : '排队中')}
          </div>
        )}

        {isBusy && (
          <div className="flex items-center gap-1 text-[10px] text-rose-200/80">
            <Loader2 size={11} className="animate-spin" />
            {status === 'submitting' ? '提交任务...' : `轮询中 ${progress}`}
            {taskId && <span className="ml-auto text-white/30">{taskId.slice(0, 10)}…</span>}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-1 text-[10px] text-red-300 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
            <AlertCircle size={11} className="mt-0.5 flex-shrink-0" />
            <span className="break-all">{error}</span>
          </div>
        )}
      </div>

      {videoUrl && !hasAutoOutput && (
        <div className="border-t border-white/10 p-2">
          <LoopingVideo
            src={videoUrl}
            controls
            className="w-full rounded"
            style={{ aspectRatio: ratio.replace(':', '/') }}
            data-drag-source
            data-drag-kind="video"
            data-drag-url={videoUrl}
            data-drag-preview={videoUrl}
            data-drag-node-id={id}
            onMouseDown={(e) => beginMaterialDrag(e, { kind: 'video', url: videoUrl, sourceNodeId: id, previewUrl: videoUrl })}
            title="按住 Ctrl 拖拽到其他节点"
          />
        </div>
      )}
    </div>
  );
};

export default memo(VideoNode);
