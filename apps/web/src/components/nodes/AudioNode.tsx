import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { AlertCircle, Loader2, Music, Sparkles, Square, Upload, X } from 'lucide-react';
import {
  submitAudio,
  queryAudio,
  uploadAudioForSuno,
  cancelGenerationTask,
  fileToDataUrl,
  generateExternalAudio,
  type AudioMode,
} from '../../services/generation';
import { SUNO_VERSIONS, DEFAULT_SUNO_VERSION } from '../../providers/models';
import { useUpdateNodeData } from './useUpdateNodeData';
import { useHasAutoOutput } from './useHasAutoOutput';
import { useRunTrigger } from '../../hooks/useRunTrigger';
import { logBus } from '../../stores/logs';
import { PORT_COLOR } from '../../config/portTypes';
import { useThemeStore } from '../../stores/theme';
import { useUpstreamMaterials, type Material } from './useUpstreamMaterials';
import { useOrderedMaterials } from './useOrderedMaterials';
import MaterialPreviewSection from './MaterialPreviewSection';
import MentionPromptInput from './MentionPromptInput';
import NodeRuntimeCard from './NodeRuntimeCard';
import { useSyncNodeInternalsOnResize } from './useSyncNodeInternalsOnResize';
import { resolveMediaMentions, type MediaMention } from './mediaMentions';
import { useDragMaterialStore, type MaterialPayload } from '../../stores/dragMaterial';
import { useMaterialDropTarget } from '../../hooks/useMaterialDropTarget';
import { taskCompletionSound } from '../../stores/taskCompletionSound';
import {
  countExcludedMaterials,
  excludeMaterialId,
  filterExcludedMaterials,
  normalizeExcludedMaterialIds,
} from '../../utils/materialExclusion';
import { useModelCatalogStore } from '../../stores/modelCatalog';
import { filterAudioModelsByMode, resolveCompatibleAudioProviderSelection } from '../../utils/publishedModelSelection';
import type { PublicModelRecord } from '../../services/api';

/**
 * AudioNode - Suno (generate / cover / extend) — 完全对齐 gpt-image-2-web
 * 参考: gpt-image-2-web/index.html runSuno (L3979) / runSunoCover (L4282) / runSunoExtend (L4313) / pollSuno (L4015) / _sunoUploadAudio (L4210)
 * 该节点不提供 FAL 模式。
 */

const MODES: Array<{ id: AudioMode; label: string }> = [
  { id: 'generate', label: '生成' },
  { id: 'cover', label: '翻唱(Cover)' },
  { id: 'extend', label: '续写(Extend)' },
];

const PROVIDER_AUDIO_MODES = [
  { id: 'tts', label: '生成语音' },
  { id: 'voice_clone', label: '克隆音色' },
  { id: 'voice_design', label: '音色定制' },
] as const;

const PILL_FIELD_SHELL =
  'rounded-xl border border-white/10 bg-black/20 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';
const PILL_SELECT_CLASS =
  'w-full appearance-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-medium text-white outline-none transition focus:border-violet-300/35 focus:bg-white/[0.08]';
const PILL_INPUT_CLASS =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-medium text-white outline-none transition focus:border-violet-300/35 focus:bg-white/[0.08] placeholder:text-white/28';

const SUNO_POLL_INTERVAL_MS = 3000;
const SUNO_POLL_TIMEOUT_SECONDS = 3600;
const SUNO_MAX_POLL = Math.ceil((SUNO_POLL_TIMEOUT_SECONDS * 1000) / SUNO_POLL_INTERVAL_MS);
const LEGACY_SUNO_AVAILABLE = false;
const clampGenerationCount = (value: unknown, fallback = 1) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(4, Math.max(1, Math.trunc(num)));
};

const AudioNode = ({ id, data, selected }: NodeProps) => {
  const update = useUpdateNodeData(id);
  const { rootRef } = useSyncNodeInternalsOnResize(id);
  const hasAutoOutput = useHasAutoOutput(id);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const pollTimer = useRef<number | null>(null);
  const pollTimers = useRef<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const src = `audio:${id.slice(0, 6)}`;

  // 主题适配
  const { theme, style: themeStyle } = useThemeStore();
  const isDark = theme === 'dark';
  const isPixel = themeStyle === 'pixel';

  const d = data as any;
  const backendAudioModels = useModelCatalogStore((s) => s.catalog.audioModels);
  const audioEngine: 'provider' | 'suno' = d?.audioEngine === 'suno' ? 'suno' : 'provider';
  const providerAudioMode: 'tts' | 'voice_clone' | 'voice_design' =
    d?.providerAudioMode === 'voice_clone'
      ? 'voice_clone'
      : d?.providerAudioMode === 'voice_design'
        ? 'voice_design'
        : 'tts';
  const compatibleBackendAudioModels = useMemo(
    () => filterAudioModelsByMode(backendAudioModels, providerAudioMode),
    [backendAudioModels, providerAudioMode],
  );
  const backendSelection = useMemo(
    () => resolveCompatibleAudioProviderSelection(backendAudioModels, providerAudioMode, {
      selectedModelId: d?.backendModelId,
      selectedProviderId: d?.backendProviderId,
    }),
    [backendAudioModels, providerAudioMode, d?.backendModelId, d?.backendProviderId],
  );
  const backendAudioModel: PublicModelRecord | null = backendSelection.selectedModel;
  const backendProviderGroups = backendSelection.providerGroups;
  const backendProviderGroup = backendSelection.selectedProviderGroup;
  const voiceOptions = useMemo(
    () =>
      Array.isArray(backendAudioModel?.parameterSchema?.voice?.options)
        ? backendAudioModel?.parameterSchema?.voice?.options
            .map((item: unknown) => String(item || '').trim())
            .filter((item: string, index: number, list: string[]) => Boolean(item) && list.indexOf(item) === index)
        : [],
    [backendAudioModel?.parameterSchema?.voice?.options],
  );
  const audioFormatOptions = useMemo(
    () =>
      Array.isArray(backendAudioModel?.parameterSchema?.audioFormat?.options)
        ? backendAudioModel?.parameterSchema?.audioFormat?.options
            .map((item: unknown) => String(item || '').trim().toLowerCase())
            .filter((item: string, index: number, list: string[]) => Boolean(item) && list.indexOf(item) === index)
        : ['wav', 'mp3', 'pcm16'],
    [backendAudioModel?.parameterSchema?.audioFormat?.options],
  );
  const voice: string = d?.voice || backendAudioModel?.parameterSchema?.voice?.default || voiceOptions[0] || 'mimo_default';
  const audioFormat: string = d?.audioFormat || backendAudioModel?.parameterSchema?.audioFormat?.default || audioFormatOptions[0] || 'wav';
  const showPresetVoiceControls = audioEngine === 'provider' && providerAudioMode === 'tts';
  const showReferenceAudioInput = audioEngine === 'provider' && providerAudioMode === 'voice_clone';
  const providerStyleLabel = providerAudioMode === 'voice_design' ? '音色定制描述' : '语气 / 风格';
  const providerPromptLabel = providerAudioMode === 'voice_design' ? '要播报的文本' : '要生成的语音文本';
  const mode: AudioMode = d?.mode || 'generate';
  const version: string = d?.version || DEFAULT_SUNO_VERSION;
  const generationCount = clampGenerationCount(d?.generationCount ?? 1);
  const title: string = d?.title || '';
  const tags: string = d?.tags || '';
  const localPrompt: string = d?.prompt || '';
  const promptMentions: MediaMention[] = Array.isArray(d?.promptMentions) ? d.promptMentions : [];
  const seed: number = typeof d?.seed === 'number' ? d.seed : 0;
  const continueAt: number = d?.continueAt ?? 28;
  // 预传 clipId(手动调起 _sunoUploadAudio 后保存)
  const uploadedClipId: string = d?.uploadedClipId || '';
  const uploadedFilename: string = d?.uploadedFilename || '';

  const status: 'idle' | 'submitting' | 'polling' | 'success' | 'error' = d?.status || 'idle';
  const taskId: string | undefined = d?.taskId;
  const taskIds: string[] = Array.isArray(d?.taskIds) ? d.taskIds.filter((item: unknown): item is string => typeof item === 'string' && item.length > 0) : [];
  const tracks: Array<{ id?: string; clipId?: string; audioUrl: string; remoteUrl?: string; imageUrl?: string; title?: string; tags?: string }>
    = d?.tracks || [];
  const pollProgress: string = d?.progress || '';
  const startedAt: number | undefined = typeof d?.startedAt === 'number' ? d.startedAt : undefined;
  const finishedAt: number | undefined = typeof d?.finishedAt === 'number' ? d.finishedAt : undefined;
  const lastDurationMs: number | undefined = typeof d?.lastDurationMs === 'number' ? d.lastDurationMs : undefined;

  const stopPoll = () => {
    if (pollTimer.current) {
      window.clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    pollTimers.current.forEach((timer) => window.clearInterval(timer));
    pollTimers.current.clear();
  };
  useEffect(() => () => stopPoll(), []);

  useEffect(() => {
    if (audioEngine !== 'provider') return;
    const nextProviderId = backendSelection.selectedProviderGroup?.providerId || '';
    const nextModelId = backendSelection.selectedModel?.id || '';
    const nextProviderModelId = backendSelection.selectedModel?.modelId || '';
    if (
      d?.backendProviderId === nextProviderId &&
      d?.backendModelId === nextModelId &&
      d?.providerId === nextProviderId &&
      d?.providerModel === nextProviderModelId
    ) {
      return;
    }
    update({
      backendProviderId: nextProviderId,
      backendModelId: nextModelId,
      providerId: nextProviderId,
      providerModel: nextProviderModelId,
    });
  }, [
    audioEngine,
    backendSelection.selectedModel?.id,
    backendSelection.selectedModel?.modelId,
    backendSelection.selectedProviderGroup?.providerId,
    d?.backendModelId,
    d?.backendProviderId,
    d?.providerId,
    d?.providerModel,
    update,
  ]);

  useEffect(() => {
    if (!showPresetVoiceControls || !voiceOptions.length) return;
    if (voiceOptions.includes(String(d?.voice || '').trim())) return;
    update({ voice: backendAudioModel?.parameterSchema?.voice?.default || voiceOptions[0] });
  }, [backendAudioModel?.parameterSchema?.voice?.default, d?.voice, showPresetVoiceControls, update, voiceOptions]);

  useEffect(() => {
    if (audioEngine !== 'provider' || !audioFormatOptions.length) return;
    const currentAudioFormat = String(d?.audioFormat || '').trim().toLowerCase();
    if (currentAudioFormat && audioFormatOptions.includes(currentAudioFormat)) return;
    update({ audioFormat: backendAudioModel?.parameterSchema?.audioFormat?.default || audioFormatOptions[0] });
  }, [audioEngine, audioFormatOptions, backendAudioModel?.parameterSchema?.audioFormat?.default, d?.audioFormat, update]);

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
  const visibleUpstreamAudios = useMemo(
    () => filterExcludedMaterials(upstream.audios, excludedMaterialIds),
    [upstream.audios, excludedMaterialIds],
  );
  const excludedUpstreamCount = useMemo(
    () => countExcludedMaterials(excludedMaterialIds, [...upstream.texts, ...upstream.audios]),
    [excludedMaterialIds, upstream.texts, upstream.audios],
  );
  const materialOrder: string[] = Array.isArray(d?.materialOrder) ? d.materialOrder : [];
  const orderedTexts = useOrderedMaterials(visibleUpstreamTexts, materialOrder);
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

  // === 本地拖入参考音频 (跨节点 Ctrl 拖拽) ===
  const localRefAudio: string = typeof d?.localRefAudio === 'string' ? d.localRefAudio : '';
  const localRefAudioMaterials: Material[] = useMemo(
    () =>
      localRefAudio
        ? [{
            id: `local::audio-ref:${localRefAudio}`,
            kind: 'audio' as const,
            url: localRefAudio,
            sourceNodeId: id,
            origin: 'local' as const,
            label: '本地参考音频',
          }]
        : [],
    [localRefAudio, id],
  );
  const mentionMaterials = useMemo(
    () => [...orderedAudios, ...localRefAudioMaterials],
    [orderedAudios, localRefAudioMaterials],
  );
  
  // 分组动态跟随模式: generate 只要文本, cover/extend 需要参考音频
  const previewGroups = useMemo<ReadonlyArray<'text' | 'image' | 'video' | 'audio'>>(
    () => (audioEngine === 'provider' ? (providerAudioMode === 'voice_clone' ? ['text', 'audio'] : ['text']) : mode === 'generate' ? ['text'] : ['text', 'audio']),
    [audioEngine, mode, providerAudioMode],
  );
  
  // 收集上游: prompt + audioUrl(cover/extend 兼底, 取 ordered 首个, 后补本地拖入)
  const collectUpstream = (): { prompt: string; audioUrl: string } => {
    const prompt = orderedTexts.map((t) => t.url).filter((s) => !!s).join('\n').trim();
    const audioUrl = orderedAudios[0]?.url || localRefAudio || '';
    return { prompt, audioUrl };
  };

  // 上传本地音频 → 获取 clipId
  const uploadFile = async (file: File): Promise<string> => {
    setUploading(true);
    try {
      logBus.info(`上传音频: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`, src);
      const r = await uploadAudioForSuno(file);
      update({ uploadedClipId: r.clipId, uploadedFilename: r.filename });
      logBus.success(`上传成功, clipId=${r.clipId}`, src);
      return r.clipId;
    } finally {
      setUploading(false);
    }
  };

  // 将 URL 抓为 File 后上传(上游节点传入 audioUrl 时)
  const fetchUrlAndUpload = async (url: string): Promise<string> => {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`下载上游音频失败: ${resp.status}`);
    const blob = await resp.blob();
    const ext = (url.match(/\.(mp3|wav|m4a|ogg|flac|aac)/i)?.[1] || 'mp3').toLowerCase();
    const file = new File([blob], `upstream_audio.${ext}`, { type: blob.type || 'audio/mpeg' });
    return await uploadFile(file);
  };

  const audioUrlToDataUrl = async (url: string): Promise<string> => {
    if (/^data:audio\//i.test(url)) return url;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`下载参考音频失败: ${resp.status}`);
    const blob = await resp.blob();
    return await fileToDataUrl(new File([blob], 'reference-audio', { type: blob.type || 'audio/wav' }));
  };

  const onSelectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    try {
      if (audioEngine === 'provider') {
        const dataUrl = await fileToDataUrl(f);
        update({ localRefAudio: dataUrl, uploadedClipId: '', uploadedFilename: f.name });
        logBus.success(`已载入参考音频: ${f.name}`, src);
      } else {
        await uploadFile(f);
      }
    } catch (err: any) {
      setError(err?.message || '上传失败');
      logBus.error(err?.message || '上传失败', src);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const clearUpload = () => update({ uploadedClipId: '', uploadedFilename: '' });

  const handleProviderGenerate = async (finalPrompt: string, runtimeStartedAt: number) => {
    if (!backendAudioModel) throw new Error('后台未发布可用的音频模型，请先在 API 服务商中发布 MiMo 音频模型');
    const referenceUrl = orderedAudios[0]?.url || localRefAudio || '';
    if (providerAudioMode === 'voice_clone' && !referenceUrl) throw new Error('音色克隆需要连接或上传一段参考音频');
    if (providerAudioMode === 'voice_design' && !(tags || title || '').trim()) throw new Error('音色定制需要填写音色描述');
    const sampleDataUrl = providerAudioMode === 'voice_clone' ? await audioUrlToDataUrl(referenceUrl) : '';
    logBus.info(`提交音频 Provider: ${backendAudioModel.provider.name} · ${backendAudioModel.modelId} · ${providerAudioMode}`, src);
    const result = await generateExternalAudio({
      providerId: backendAudioModel.providerId,
      providerModel: backendAudioModel.modelId,
      model: backendAudioModel.modelId,
      mode: providerAudioMode,
      text: finalPrompt,
      stylePrompt: tags || title || '',
      voice: providerAudioMode === 'tts' ? voice : '',
      audioFormat,
      sampleDataUrl,
      providerParams: { modelRecordId: backendAudioModel.id },
    });
    const audioUrls = result.audioUrls || [];
    if (audioUrls.length === 0) throw new Error('音频生成完成但未返回音频文件');
    const nextTracks = audioUrls.map((audioUrl, index) => ({
      id: `${backendAudioModel.id}-${Date.now()}-${index}`,
      audioUrl,
      title: title || (providerAudioMode === 'voice_clone' ? '克隆语音' : providerAudioMode === 'voice_design' ? '定制语音' : '生成语音'),
      tags,
    }));
    markRuntimeFinished(runtimeStartedAt, {
      status: 'success',
      tracks: nextTracks,
      audioUrl: audioUrls[0] || '',
      audioUrl_1: audioUrls[1] || '',
      audioUrls,
      taskId: null,
      taskIds: [],
      lastPrompt: finalPrompt,
      progress: '100%',
    });
    taskCompletionSound.notifyComplete(id, 'audio');
  };

  // 轮询: 3000ms × 1200 次 = 3600s，避免 Suno 长任务 3 分钟提前超时。
  // v1.2.9.11: 返回 Promise，调用方 await 直到任务成功/失败/超时才 resolve/reject。
  //   原设计中 startPolling 启动 setInterval 后立即返回 → handleGenerate 提交成功后也立即返回→
  //   useRunTrigger 认为 runFn 完成 markDone(true)。 但实际任务 audioUrl 还未赋值 → LoopNode awaitNode
  //   立即继续 → extractFromNode 读不到 audioUrl → result=null → failCount++。
  //   修复后: 轮询完成才 resolve，handleGenerate await 它，什么时候 markDone 什么时候任务真正结束。
  const startPolling = (clipIds: string[]): Promise<{ tracks: Array<{ id?: string; clipId?: string; audioUrl: string; remoteUrl?: string; imageUrl?: string; title?: string; tags?: string }> }> => {
    return new Promise<{ tracks: Array<{ id?: string; clipId?: string; audioUrl: string; remoteUrl?: string; imageUrl?: string; title?: string; tags?: string }> }>((resolve, reject) => {
      let elapsed = 0;
      const POLL_INT = SUNO_POLL_INTERVAL_MS;
      const MAX = SUNO_MAX_POLL;
      const timer = window.setInterval(async () => {
        elapsed += 1;
        if (elapsed > MAX) {
          window.clearInterval(timer);
          pollTimers.current.delete(timer);
          logBus.error('轮询超时', src);
          reject(new Error('轮询超时 (60min)'));
          return;
        }
        try {
          const r = await queryAudio(clipIds, true);
          if (r.status === 'SUCCESS' && r.tracks.length > 0) {
            window.clearInterval(timer);
            pollTimers.current.delete(timer);
            logBus.success(`完成 ${r.tracks.length} 轨: ${r.tracks.map((t) => t.audioUrl).join(' | ')}`, src);
            resolve({ tracks: r.tracks });
          } else {
            update({ status: 'polling', progress: `${r.completed}/${r.total} · #${elapsed}` });
            if (elapsed % 3 === 0) logBus.info(`轮询 #${elapsed} · ${r.completed}/${r.total}`, src);
          }
        } catch (e: any) {
          logBus.warn(`轮询出错: ${e?.message}`, src);
        }
      }, POLL_INT);
      pollTimer.current = timer;
      pollTimers.current.add(timer);
    });
  };

  const handleGenerate = async () => {
    setError(null);
    if (audioEngine === 'suno' && !LEGACY_SUNO_AVAILABLE) {
      const message = '旧 Suno 链路当前未接入后端代理，请改用 Provider 语音模式；历史节点仍可保留查看。';
      setError(message);
      logBus.error(message, src);
      update({ status: 'error', error: message });
      return;
    }
    const upstream = collectUpstream();
    const resolvedLocalPrompt = resolveMediaMentions(localPrompt, promptMentions, mentionMaterials);
    const finalPrompt = (upstream.prompt || resolvedLocalPrompt || '').trim();
    if (!finalPrompt) {
      setError('请填写歌词 / 提示词');
      return;
    }
    taskCompletionSound.primeAudio();
    const runtimeStartedAt = markRuntimeStarted();
    update({ status: 'submitting', error: null, tracks: [], audioUrl: undefined, audioUrl_1: '', audioUrls: [], clipIds: [], taskId: null, progress: generationCount > 1 ? `1/${generationCount}` : '0/?' });
    try {
      if (audioEngine === 'provider') {
        await handleProviderGenerate(finalPrompt, runtimeStartedAt);
        return;
      }
      // cover/extend: 如预传 clipId 为空但上游有 audioUrl, 则自动上传
      let clipIdForRef = uploadedClipId;
      if ((mode === 'cover' || mode === 'extend') && !clipIdForRef && upstream.audioUrl) {
        logBus.info('检测到上游音频 URL, 自动上传 Suno...', src);
        clipIdForRef = await fetchUrlAndUpload(upstream.audioUrl);
      }
      if ((mode === 'cover' || mode === 'extend') && !clipIdForRef) {
        throw new Error(`${mode === 'cover' ? '翻唱' : '续写'}模式需先上传参考音频 (或连接上游音频节点)`);
      }

      const runSingleAudioGeneration = async (batchIndex: number) => {
        const batchLabel = generationCount > 1 ? `第 ${batchIndex + 1}/${generationCount} 次` : '本次';
        logBus.info(`${batchLabel} 提交 Suno ${version} (${mode})...`, src);
        const r = await submitAudio({
          mode,
          prompt: finalPrompt,
          title: title || '',
          tags: tags || '',
          version,
          seed: seed > 0 ? seed : undefined,
          cover_clip_id: mode === 'cover' ? clipIdForRef : undefined,
          continue_clip_id: mode === 'extend' ? clipIdForRef : undefined,
          continue_at: mode === 'extend' ? continueAt : undefined,
        });
        logBus.success(`${batchLabel} taskId=${r.taskId} clips=${(r.clipIds || []).join(',') || '?'}`, src);
        update({ status: 'polling', taskId: r.taskId, clipIds: r.clipIds, lastPrompt: finalPrompt, progress: generationCount > 1 ? `${batchIndex + 1}/${generationCount}` : '0/?' });
        const idsToPoll = r.clipIds && r.clipIds.length > 0 ? r.clipIds : [r.taskId];
        const polled = await startPolling(idsToPoll);
        return { tracks: polled.tracks, taskId: r.taskId, clipIds: r.clipIds || idsToPoll };
      };

      const aggregatedTracks: Array<{ id?: string; clipId?: string; audioUrl: string; remoteUrl?: string; imageUrl?: string; title?: string; tags?: string }> = [];
      const aggregatedAudioUrls: string[] = [];
      const aggregatedClipIds: string[] = [];
      const taskIds: string[] = [];
      let lastTaskId: string | null = null;

      const appendAudioGenerationResult = (result: Awaited<ReturnType<typeof runSingleAudioGeneration>>) => {
        for (const clipId of result.clipIds) {
          if (clipId && !aggregatedClipIds.includes(clipId)) aggregatedClipIds.push(clipId);
        }
        for (const track of result.tracks) {
          if (!track?.audioUrl || aggregatedAudioUrls.includes(track.audioUrl)) continue;
          aggregatedTracks.push(track);
          aggregatedAudioUrls.push(track.audioUrl);
        }
        lastTaskId = result.taskId;
        if (result.taskId && !taskIds.includes(result.taskId)) taskIds.push(result.taskId);
        update({
          status: 'polling',
          tracks: [...aggregatedTracks],
          audioUrl: aggregatedAudioUrls[0] || '',
          audioUrl_1: aggregatedAudioUrls[1] || '',
          audioUrls: [...aggregatedAudioUrls],
          clipIds: [...aggregatedClipIds],
          taskId: lastTaskId,
          taskIds: [...taskIds],
          progress: generationCount > 1 ? `${aggregatedAudioUrls.length}/${generationCount}` : '95%',
        });
      };

      const runConcurrentAudioGenerations = async () => {
        const jobs = Array.from({ length: generationCount }, (_, batchIndex) =>
          runSingleAudioGeneration(batchIndex).then((result) => {
            appendAudioGenerationResult(result);
            return result;
          })
        );
        return Promise.allSettled(jobs);
      };

      const settled = await runConcurrentAudioGenerations();
      const rejected = settled.filter((item): item is PromiseRejectedResult => item.status === 'rejected');

      if (aggregatedTracks.length === 0) throw new Error('音频生成完成但未返回音频');
      markRuntimeFinished(runtimeStartedAt, {
        status: 'success',
        tracks: aggregatedTracks,
        audioUrl: aggregatedAudioUrls[0] || '',
        audioUrl_1: aggregatedAudioUrls[1] || '',
        audioUrls: aggregatedAudioUrls,
        clipIds: aggregatedClipIds,
        taskId: lastTaskId,
        taskIds,
        lastPrompt: finalPrompt,
        progress: '100%',
      });
      if (rejected.length > 0) {
        logBus.warn(`部分音频生成失败: ${rejected.map((item) => item.reason?.message || '未知错误').join('；')}`, src);
      }
      taskCompletionSound.notifyComplete(id, 'audio');
    } catch (e: any) {
      const msg = e?.message || '提交失败';
      setError(msg);
      logBus.error(msg, src);
      markRuntimeFailed(runtimeStartedAt, msg);
    }
  };

  const handleStop = () => {
    stopPoll();
    const ids = Array.from(new Set([...(taskIds || []), taskId].filter(Boolean) as string[]));
    Promise.allSettled(ids.map((tid) => cancelGenerationTask({ taskId: tid, kind: 'audio', model: version })))
      .catch((error) => logBus.warn(`取消上游任务失败: ${error?.message || error}`, src));
    update({ status: 'idle', progress: '', startedAt: null, finishedAt: null, lastDurationMs: null });
  };

  // 接入运行总线
  useRunTrigger(id, async () => {
    if (status === 'submitting' || status === 'polling') return;
    await handleGenerate();
  }, 'audio');

  // === 跨节点拖拽: source (输出 tracks 可拖出) ===
  const startDrag = useDragMaterialStore((s) => s.start);
  const beginMaterialDrag = (e: React.MouseEvent, payload: MaterialPayload) => {
    if (e.button !== 0 || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    e.stopPropagation();
    startDrag(payload, e.clientX, e.clientY);
  };

  // === 跨节点拖拽: target (接收 audio → localRefAudio, text → prompt) ===
  const handleDrop = (payload: MaterialPayload) => {
    if (payload.kind === 'audio' && payload.url) {
      update({ localRefAudio: payload.url, uploadedClipId: '', uploadedFilename: '' });
      logBus.info('已接受拖入参考音频, 生成时将自动上传', src);
    } else if (payload.kind === 'text' && typeof payload.text === 'string') {
      update({ prompt: payload.text });
    }
  };
  const { dropProps, isAccepting } = useMaterialDropTarget({
    id,
    accepts: ['audio', 'text'],
    onDrop: handleDrop,
  });

  const isBusy = status === 'submitting' || status === 'polling';
  const showRefArea = audioEngine === 'provider' ? showReferenceAudioInput : mode === 'cover' || mode === 'extend';
  const audioColor = PORT_COLOR.audio;

  return (
    <div
      ref={rootRef}
      {...dropProps}
      className={`relative rounded-xl border-2 transition-all w-[320px] ${
        selected ? 'border-violet-400 shadow-2xl shadow-violet-500/20' : isAccepting ? 'border-emerald-400' : 'border-white/15 hover:border-white/30'
      }`}
      style={{
        background: 'rgba(20,20,22,.92)',
        backdropFilter: 'blur(8px)',
        boxShadow: isAccepting ? '0 0 0 2px rgba(52,211,153,.45), 0 12px 30px rgba(52,211,153,.18)' : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: audioColor, border: 0 }} />
      {/* 双输出口: 轨道 1 / 轨道 2 */}
      <Handle type="source" id="audio-0" position={Position.Right} style={{ background: audioColor, border: 0, top: '48%' }} />
      <Handle type="source" id="audio-1" position={Position.Right} style={{ background: audioColor, border: 0, top: '52%' }} />
      {/* 轨道标签 */}
      <div className="absolute right-[-2px] text-[8px] font-bold text-violet-300/70 pointer-events-none" style={{ top: '48%', transform: 'translateX(100%) translateY(-50%)' }}>♪1</div>
      <div className="absolute right-[-2px] text-[8px] font-bold text-violet-300/70 pointer-events-none" style={{ top: '52%', transform: 'translateX(100%) translateY(-50%)' }}>♪2</div>

      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <div
          className="w-6 h-6 rounded flex items-center justify-center"
          style={{ background: 'rgba(139,92,246,.2)', color: audioColor, boxShadow: 'inset 0 0 0 1px rgba(139,92,246,.45)' }}
        >
          <Music size={13} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">{audioEngine === 'suno' ? '音频 Suno（旧）' : '语音生成 / 克隆 / 定制'}</div>
          <div className="text-[10px] text-white/40 truncate">
            {audioEngine === 'provider'
              ? `${backendAudioModel?.provider.name || '未配置供应商'} · ${PROVIDER_AUDIO_MODES.find((m) => m.id === providerAudioMode)?.label}`
              : `${version} · ${MODES.find((m) => m.id === mode)?.label} · 历史兼容`}
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
        progress={pollProgress}
        startedAt={startedAt}
        finishedAt={finishedAt}
        lastDurationMs={lastDurationMs}
        accent={audioColor}
        taskId={taskId}
      />

      <div className="p-2.5 space-y-2" onMouseDown={(e) => e.stopPropagation()}>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-white/50 block mb-1">引擎</label>
            <div className={PILL_FIELD_SHELL}>
              <select
                value={audioEngine}
                onChange={(e) => update({ audioEngine: e.target.value })}
                className={PILL_SELECT_CLASS}
              >
                <option value="provider" className="bg-zinc-900">Provider 语音</option>
                <option value="suno" className="bg-zinc-900">Legacy Suno</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-white/50 block mb-1">用途</label>
            {audioEngine === 'provider' ? (
              <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
                {PROVIDER_AUDIO_MODES.map((m) => {
                  const active = providerAudioMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => update({ providerAudioMode: m.id })}
                      className={`rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${
                        active
                          ? 'bg-violet-500/25 text-violet-100 shadow-[inset_0_0_0_1px_rgba(196,181,253,0.35)]'
                          : 'text-white/55 hover:bg-white/5 hover:text-white/80'
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <select
                value={mode}
                onChange={(e) => update({ mode: e.target.value })}
                className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
              >
                {MODES.map((m) => (
                  <option key={m.id} value={m.id} className="bg-zinc-900">
                    {m.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {audioEngine === 'provider' && (
          <div className="rounded-2xl border border-violet-300/20 bg-[linear-gradient(180deg,rgba(124,58,237,0.14),rgba(15,23,42,0.4))] p-3 space-y-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-violet-100">Provider 语音链路</div>
                <div className="text-[10px] leading-5 text-white/45">
                  {providerAudioMode === 'voice_clone'
                    ? '仅展示支持音色克隆的模型，并要求接入参考音频。'
                    : providerAudioMode === 'voice_design'
                      ? '仅展示支持音色定制的模型，使用文本描述新的音色特征。'
                      : '仅展示可直接播报文本的语音模型，并优先读取后台预设音色。'}
                </div>
              </div>
              <div className="shrink-0 rounded-full border border-violet-200/15 bg-white/5 px-2 py-1 text-[10px] text-violet-100/80">
                {compatibleBackendAudioModels.length || 0} 个兼容模型
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-white/50 block mb-1">供应商</label>
                <div className={PILL_FIELD_SHELL}>
                  <select
                    value={backendProviderGroup?.providerId || ''}
                    onChange={(e) => {
                      const nextProvider = backendProviderGroups.find((item) => item.providerId === e.target.value) || backendProviderGroups[0];
                      const nextModel = nextProvider?.models[0];
                      update({
                        backendProviderId: nextProvider?.providerId || '',
                        backendModelId: nextModel?.id || '',
                        providerId: nextModel?.providerId || '',
                        providerModel: nextModel?.modelId || '',
                      });
                    }}
                    className={PILL_SELECT_CLASS}
                  >
                    {backendProviderGroups.length === 0 && <option className="bg-zinc-900" value="">当前模式暂无模型</option>}
                    {backendProviderGroups.map((group) => (
                      <option key={group.providerId} value={group.providerId} className="bg-zinc-900">
                        {group.provider.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1">模型</label>
                <div className={PILL_FIELD_SHELL}>
                  <select
                    value={backendAudioModel?.id || ''}
                    onChange={(e) => {
                      const next = backendProviderGroup?.models.find((item) => item.id === e.target.value) || backendProviderGroup?.models[0];
                      update({
                        backendModelId: next?.id || '',
                        backendProviderId: next?.providerId || '',
                        providerId: next?.providerId || '',
                        providerModel: next?.modelId || '',
                      });
                    }}
                    className={PILL_SELECT_CLASS}
                  >
                    {!backendProviderGroup && <option className="bg-zinc-900" value="">暂无兼容模型</option>}
                    {backendProviderGroup?.models.map((model) => (
                      <option key={model.id} value={model.id} className="bg-zinc-900">
                        {model.displayName || model.modelId}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className={`grid gap-2 ${showPresetVoiceControls ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {showPresetVoiceControls && (
                <div>
                  <label className="text-[10px] text-white/50 block mb-1">音色</label>
                  {voiceOptions.length ? (
                    <div className={PILL_FIELD_SHELL}>
                      <select
                        value={voice}
                        onChange={(e) => update({ voice: e.target.value })}
                        className={PILL_SELECT_CLASS}
                      >
                        {voiceOptions.map((item: string) => (
                          <option key={item} value={item} className="bg-zinc-900">{item}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className={PILL_FIELD_SHELL}>
                      <input
                        value={voice}
                        onChange={(e) => update({ voice: e.target.value })}
                        placeholder="mimo_default"
                        className={PILL_INPUT_CLASS}
                      />
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="text-[10px] text-white/50 block mb-1">格式</label>
                <div className={PILL_FIELD_SHELL}>
                  <select
                    value={audioFormat}
                    onChange={(e) => update({ audioFormat: e.target.value })}
                    className={PILL_SELECT_CLASS}
                  >
                    {audioFormatOptions.map((fmt: string) => (
                      <option key={fmt} value={fmt} className="bg-zinc-900">{fmt}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            {showPresetVoiceControls && voiceOptions.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-black/15 px-2.5 py-2">
                <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-violet-100/45">预设音色</div>
                <div className="flex flex-wrap gap-1.5">
                  {voiceOptions.map((item: string) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => update({ voice: item })}
                      className={`rounded-full border px-2 py-1 text-[10px] transition ${
                        voice === item
                          ? 'border-violet-200/40 bg-violet-400/20 text-violet-50'
                          : 'border-white/10 bg-white/5 text-white/55 hover:border-white/20 hover:text-white/85'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {audioEngine === 'suno' && !LEGACY_SUNO_AVAILABLE && (
          <div className="rounded border border-amber-400/25 bg-amber-500/[0.08] px-2 py-1.5 text-[10px] leading-snug text-amber-100/90">
            该节点使用旧版 Suno 音频链路，当前后端未接入对应代理接口。
            建议迁移到上方的 Provider 语音模式；历史画布节点仍可保留查看与改配。
          </div>
        )}

        {audioEngine === 'suno' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-white/50 block mb-1">模式</label>
            <select
              value={mode}
              onChange={(e) => update({ mode: e.target.value })}
              className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
            >
              {MODES.map((m) => (
                <option key={m.id} value={m.id} className="bg-zinc-900">
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-white/50 block mb-1">生成数量</label>
            <select
              value={generationCount}
              onChange={(e) => update({ generationCount: clampGenerationCount(e.target.value) })}
              className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
            >
              {[1, 2, 3, 4].map((count) => (
                <option key={count} value={count} className="bg-zinc-900">
                  {count}
                </option>
              ))}
            </select>
          </div>
        </div>
        )}

        {audioEngine === 'suno' && (
        <div>
          <label className="text-[10px] text-white/50 block mb-1">版本</label>
          <select
            value={version}
            onChange={(e) => update({ version: e.target.value })}
            className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
          >
            {SUNO_VERSIONS.map((v) => (
              <option key={v.value} value={v.value} className="bg-zinc-900">
                {v.label}
              </option>
            ))}
          </select>
        </div>
        )}

        {audioEngine === 'suno' && (
        <div>
          <label className="text-[10px] text-white/50 block mb-1">标题</label>
          <input
            type="text"
            value={title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="My Song"
            className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30 placeholder:text-white/30"
          />
        </div>
        )}
        <div>
          <label className="text-[10px] text-white/50 block mb-1">{audioEngine === 'provider' ? providerStyleLabel : '风格 Tags'}</label>
          <input
            type="text"
            value={tags}
            onChange={(e) => update({ tags: e.target.value })}
            placeholder={audioEngine === 'provider' && providerAudioMode === 'voice_design' ? '例如：少女感、轻快、清亮、略带气声' : 'pop, electronic, female vocal'}
            className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30 placeholder:text-white/30"
          />
        </div>
        <div>
          <label className="text-[10px] text-white/50 block mb-1">{audioEngine === 'provider' ? providerPromptLabel : '歌词 / 提示词'}</label>
          <MentionPromptInput
            value={localPrompt}
            mentions={promptMentions}
            materials={mentionMaterials}
            onChange={(value, mentions) => update({ prompt: value, promptMentions: mentions })}
            placeholder="[Verse]..."
            isDark={isDark}
            isPixel={isPixel}
            className="w-full h-16 resize-none rounded bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-white outline-none focus:border-white/30 placeholder:text-white/30"
          />
        </div>

        {audioEngine === 'suno' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-white/50 block mb-1">Seed (0=随机)</label>
            <input
              type="number"
              value={seed}
              onChange={(e) => update({ seed: parseInt(e.target.value) || 0 })}
              className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
            />
          </div>
          {mode === 'extend' && (
            <div>
              <label className="text-[10px] text-white/50 block mb-1">续点 (s)</label>
              <input
                type="number"
                value={continueAt}
                onChange={(e) => update({ continueAt: parseInt(e.target.value) || 28 })}
                className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
              />
            </div>
          )}
        </div>
        )}

        {/* 上游素材聚合预览区 (generate=仅文本, cover/extend=文本+音频) */}
        <MaterialPreviewSection
          texts={orderedTexts}
          audios={orderedAudios}
          order={materialOrder}
          onReorder={setMaterialOrder}
          onExcludeUpstream={handleExcludeUpstreamMaterial}
          excludedCount={excludedUpstreamCount}
          onRestoreExcluded={handleRestoreExcludedMaterials}
          selected={!!selected}
          isDark={isDark}
          isPixel={isPixel}
          groups={previewGroups}
          title={mode === 'generate' ? '上游素材 · 歌词提示' : '上游素材 · 参考音频'}
        />

        {showRefArea && (
          <div className="rounded border border-violet-400/30 bg-violet-500/5 p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-violet-200/80">
                {audioEngine === 'provider' ? '参考音频 (音色克隆)' : mode === 'cover' ? '参考音频 (Cover)' : '参考音频 (Extend)'}
              </span>
              {(uploadedClipId || localRefAudio) && (
                <button
                  onClick={() => {
                    clearUpload();
                    if (localRefAudio) update({ localRefAudio: '' });
                  }}
                  className="text-violet-300/60 hover:text-violet-100"
                  title="清除"
                >
                  <X size={11} />
                </button>
              )}
            </div>
            {uploadedClipId ? (
              <div className="text-[10px] text-violet-100/90 truncate">
                🎵 {uploadedFilename || uploadedClipId.slice(0, 12)}
                <span className="text-white/40 ml-1">({uploadedClipId.slice(0, 8)}…)</span>
              </div>
            ) : localRefAudio ? (
              <div className="text-[10px] text-emerald-200/90 truncate">
                本地参考: {localRefAudio.startsWith('data:') ? (uploadedFilename || '音频样本') : localRefAudio.split('/').pop()}
                <span className="text-white/40 ml-1">{audioEngine === 'provider' ? '(生成时传入)' : '(生成时上传)'}</span>
              </div>
            ) : (
              <div className="text-[10px] text-white/40">未上传 · 连接上游音频节点可自动拉取</div>
            )}
            <div className="flex gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={onSelectFile}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-white/5 hover:bg-white/10 text-violet-100 text-[10px] disabled:opacity-50"
              >
                {uploading ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                {uploading ? '处理中…' : '选择本地音频'}
              </button>
            </div>
          </div>
        )}

        {!isBusy ? (
          <button
            onClick={handleGenerate}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-violet-500/20 hover:bg-violet-500/30 text-violet-200 text-xs font-medium transition-colors"
          >
            <Sparkles size={12} /> 生成音频
          </button>
        ) : (
          <div className="flex items-center justify-center gap-1.5 rounded border border-violet-300/15 bg-violet-500/10 py-1.5 text-xs font-medium text-violet-100/80">
            <Loader2 size={11} className="animate-spin" />
            {pollProgress || (status === 'submitting' ? '提交中' : '排队中')}
          </div>
        )}

        {isBusy && (
          <div className="flex items-center gap-1 text-[10px] text-violet-200/80">
            <Loader2 size={11} className="animate-spin" />
            {status === 'submitting' ? '提交任务...' : `轮询中 ${pollProgress}`}
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

      {tracks.length > 0 && !hasAutoOutput && (
        <div className="border-t border-white/10 p-2 space-y-2">
          {tracks.map((t, i) => (
            <div key={t.id || i} className="space-y-1">
              <div className="flex items-center gap-1 text-[10px] text-white/60">
                <span className="text-violet-200">#{i + 1}</span>
                {t.title && <span className="truncate">🎵 {t.title}</span>}
                {t.clipId && <span className="ml-auto text-white/30">{t.clipId.slice(0, 8)}…</span>}
              </div>
              <audio
                src={t.audioUrl}
                controls
                className="w-full h-8"
                data-drag-source
                data-drag-kind="audio"
                data-drag-url={t.audioUrl}
                data-drag-preview={t.audioUrl}
                data-drag-node-id={id}
                onMouseDown={(e) => beginMaterialDrag(e, { kind: 'audio', url: t.audioUrl, sourceNodeId: id, previewUrl: t.audioUrl })}
                title="按住 Ctrl 拖拽到其他节点"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(AudioNode);
