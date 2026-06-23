import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Handle, Position, useNodeConnections, useNodesData, type NodeProps } from '@xyflow/react';
import { AlertCircle, Loader2, Workflow, Wallet, Sparkles, Square, Search, RefreshCw } from 'lucide-react';
import { submitRh, queryRh, fetchRhAppInfo, uploadRhAsset, cancelGenerationTask } from '../../services/generation';
import { buildRunningHubAppInfoFromCatalog, fetchRunningHubCatalog, type RunningHubCatalogItem } from '../../services/runninghubCatalog';
import { buildRunningHubNodeSchema } from '../../utils/runninghubNodeSchema';
import { useUpdateNodeData } from './useUpdateNodeData';
import { useHasAutoOutput } from './useHasAutoOutput';
import { useRunTrigger } from '../../hooks/useRunTrigger';
import { useUpstreamMaterials, type Material } from './useUpstreamMaterials';
import { useOrderedMaterials } from './useOrderedMaterials';
import MaterialPreviewSection from './MaterialPreviewSection';
import MentionPromptInput from './MentionPromptInput';
import LoopingVideo from '../LoopingVideo';
import { resolveMediaMentions, type MediaMention } from './mediaMentions';
import {
  buildRhOutputStateFromUrls,
  countSchemaProperties,
  emptyRhOutputState,
  extractDefaultValue,
  extractFieldOptions,
  fieldDisplayLabel,
  inferValueType,
  mergeNodeInfoListWithPresetMetadata,
  normalizeRemoteNodeInfoList,
} from './runninghubNodeHelpers';
import { useThemeStore } from '../../stores/theme';
import { logBus } from '../../stores/logs';
import {
  countExcludedMaterials,
  excludeMaterialId,
  filterExcludedMaterials,
  normalizeExcludedMaterialIds,
} from '../../utils/materialExclusion';
import {
  areRhParamValuesEqual,
  applyRhTextBindings,
  findMaterialById,
  findRhTextMaterialForField,
  normalizeRhNodeId,
  rhParamKey,
  type RhParamValue,
} from '../../utils/rhTextBinding';

/**
 * RunningHubNode - 主工作流节点
 * 输入: 优先选择后台 RH 条目，运行目标仅作为高级兼容入口
 * 可选: 上游 RhConfig / image / video / audio / upload 节点补充参数
 * 流程: submit → 5s 轮询 outputs → 转存到 /output → 显示
 */

type RunningHubPollEntry = {
  timer: number;
  promise: Promise<void>;
};

const activeRunningHubPolls = new Map<string, RunningHubPollEntry>();
const runningHubPollKey = (nodeId: string, taskId: string) => `${nodeId}::${taskId}`;

// 上游媒体聚合现在由项目统一的 useUpstreamMaterials hook 处理（详见 ./useUpstreamMaterials.ts），
// 本文件不再手写 extractUpstreamUrl，避免与项目其他节点的 url 提取逻辑产生不一致。

const paramKey = rhParamKey;

const RunningHubNode = ({ id, data, selected, type }: NodeProps) => {
  const update = useUpdateNodeData(id);
  const hasAutoOutput = useHasAutoOutput(id);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const currentPollKeyRef = useRef<string | null>(null);
  const [fetchingInfo, setFetchingInfo] = useState(false);
  const [workflowCatalog, setWorkflowCatalog] = useState<RunningHubCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState('');

  // v1.2.9.16: 取消 rhWalletApiKey 单独字段 —— RH 钱包应用与普通 RunningHub
  // 节点统一使用 settings.rhApiKey。useWallet 变量仅用于 UI 区分（标题/图标/配色），
  // 不再透传给 submitRh / queryRh / fetchRhAppInfo / uploadRhAsset。
  const useWallet = type === 'runninghub-wallet';
  const titleText = useWallet ? 'RH钱包应用' : 'RunningHub';
  const TitleIcon = useWallet ? Wallet : Workflow;
  // 主调色：默认套 cyan 主调；wallet 套 violet（与节点表主色一致）
  const accent = useWallet
    ? { ring: 'border-violet-400', shadow: 'shadow-violet-500/20', dot: 'rgba(139,92,246,.2)', dotInk: '#c4b5fd', dotEdge: 'rgba(139,92,246,.45)', handle: '!bg-violet-400', subBg: 'border-violet-500/20 bg-violet-500/5', sub: 'text-violet-200/80', tag: 'text-violet-300/60 bg-violet-500/10', primary: 'bg-violet-500/20 hover:bg-violet-500/30 text-violet-200', spin: 'text-violet-200/80' }
    : { ring: 'border-cyan-400', shadow: 'shadow-cyan-500/20', dot: 'rgba(6,182,212,.2)', dotInk: '#67e8f9', dotEdge: 'rgba(6,182,212,.45)', handle: '!bg-cyan-400', subBg: 'border-cyan-500/20 bg-cyan-500/5', sub: 'text-cyan-200/80', tag: 'text-cyan-300/60 bg-cyan-500/10', primary: 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200', spin: 'text-cyan-200/80' };

  const d = data as any;
  const webappId: string = d?.webappId || '';
  const workflowPresetId: string = d?.rhWorkflowPresetId || '';
  const showManualRunTarget: boolean = d?.rhShowManualRunTarget === true;
  const instanceType: string = d?.instanceType || '';
  const status: 'idle' | 'submitting' | 'polling' | 'success' | 'error' | 'cancelled' = d?.status || 'idle';
  const taskId: string | undefined = d?.taskId;
  const rhProgress: string = d?.rhProgress || '';
  const rhQueueHint: string = d?.rhQueueHint || '';
  const urls: string[] = d?.urls || [];
  const appInfo: any = d?.appInfo;
  // paramValues: 在节点内为每个 nodeInfoList 条目保存的当前编辑值
  // 结构: { 'nodeId::fieldName': { value: string; sourceFromUpstream?: boolean; sourceMaterialId?: string; sourceRhNodeId?: string } }
  const paramValues: Record<string, RhParamValue> = d?.paramValues || {};
  const paramMentions: Record<string, MediaMention[]> =
    d?.paramMentions && typeof d.paramMentions === 'object' ? d.paramMentions : {};
  const selectedWorkflowPreset = useMemo(
    () => workflowCatalog.find((item) => item.catalogId === workflowPresetId) || null,
    [workflowCatalog, workflowPresetId],
  );
  const presetMixedStateError = useMemo(() => {
    if (!selectedWorkflowPreset) return '';
    if (selectedWorkflowPreset.kind === 'app' && selectedWorkflowPreset.workflowId) {
      return '当前 RunningHub 条目是 AI 应用，但仍残留 workflowId，请先在后台重新保存该条目';
    }
    if (selectedWorkflowPreset.kind === 'workflow' && selectedWorkflowPreset.appId) {
      return '当前 RunningHub 条目是工作流，但仍残留 appId，请先在后台重新保存该条目';
    }
    return '';
  }, [selectedWorkflowPreset]);
  const resolvedTargetType: 'app' | 'workflow' = selectedWorkflowPreset?.kind === 'app' ? 'app' : 'workflow';
  const resolvedRunTargetId = selectedWorkflowPreset?.runTargetId
    || (resolvedTargetType === 'app' ? selectedWorkflowPreset?.appId : selectedWorkflowPreset?.workflowId)
    || webappId;
  const selectedWorkflowSchema = useMemo(
    () => (selectedWorkflowPreset ? buildRunningHubNodeSchema(selectedWorkflowPreset) : null),
    [selectedWorkflowPreset],
  );
  const localPresetAppInfo = useMemo(
    () => (selectedWorkflowPreset ? buildRunningHubAppInfoFromCatalog(selectedWorkflowPreset) : null),
    [selectedWorkflowPreset],
  );
  const currentNodeInfoList = useMemo(() => {
    return mergeNodeInfoListWithPresetMetadata(appInfo?.nodeInfoList, localPresetAppInfo?.nodeInfoList);
  }, [appInfo?.nodeInfoList, localPresetAppInfo?.nodeInfoList]);
  const presetFieldCount = Array.isArray(localPresetAppInfo?.nodeInfoList) ? localPresetAppInfo.nodeInfoList.length : 0;
  const shouldHydrateAuthoritativeAppInfo = selectedWorkflowPreset?.kind === 'app';
  const selectedSchemaPropertyCount = countSchemaProperties(selectedWorkflowPreset?.parameterSchema);
  const selectedPresetAllowsEmptyInputs = selectedWorkflowPreset?.allowsEmptyInputs === true;
  const selectedPresetHasNoResolvedFields = Boolean(selectedWorkflowPreset) && !selectedPresetAllowsEmptyInputs && presetFieldCount <= 0 && currentNodeInfoList.length <= 0;
  const resolvedPageId = selectedWorkflowPreset?.pageId || selectedWorkflowPreset?.id || resolvedRunTargetId;
  const resolvedWebappId = resolvedTargetType === 'app'
    ? (selectedWorkflowPreset?.appId || resolvedRunTargetId)
    : '';
  const resolvedWorkflowId = resolvedTargetType === 'workflow'
    ? (selectedWorkflowPreset?.workflowId || resolvedRunTargetId)
    : '';
  const resolvedTaskCapability: 'image' | 'video' | 'audio' | 'chat' =
    selectedWorkflowPreset?.taskCapability === 'image'
      || selectedWorkflowPreset?.taskCapability === 'audio'
      || selectedWorkflowPreset?.taskCapability === 'chat'
      ? selectedWorkflowPreset.taskCapability
      : 'video';

  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    fetchRunningHubCatalog()
      .then((catalog) => {
        if (cancelled) return;
        setWorkflowCatalog(Array.isArray(catalog.items) && catalog.items.length > 0 ? catalog.items : Array.isArray(catalog.workflows) ? catalog.workflows : []);
        setCatalogError('');
      })
      .catch((err: any) => {
        if (cancelled) return;
        setCatalogError(err?.message || '读取工作流目录失败');
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedWorkflowPreset) return;
    if (appInfo?.presetCatalogId === selectedWorkflowPreset.catalogId) return;
    update({
      webappId: selectedWorkflowPreset.runTargetId || (selectedWorkflowPreset.kind === 'app' ? selectedWorkflowPreset.appId : selectedWorkflowPreset.workflowId),
      appInfo: localPresetAppInfo,
      paramValues: {},
      paramMentions: {},
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkflowPreset?.catalogId, localPresetAppInfo]);

  const stopPoll = (tid?: string) => {
    const key = tid
      ? runningHubPollKey(id, tid)
      : currentPollKeyRef.current || (taskId ? runningHubPollKey(id, taskId) : null);
    if (!key) return;
    const entry = activeRunningHubPolls.get(key);
    if (entry) {
      window.clearInterval(entry.timer);
      activeRunningHubPolls.delete(key);
    }
    if (currentPollKeyRef.current === key) {
      currentPollKeyRef.current = null;
    }
  };
  useEffect(() => () => stopPoll(), []);

  // ========== 上游节点（响应式订阅）==========
  // 之前用 useReactFlow().getEdges/getNodes 是非响应式的，上游 data 变化（例如上传图像节点上传完产出 imageUrl）
  // 不会触发重渲染，导致下面 useEffect 同步上游 url → paramValues 永不触发，节点内媒体预览缺失。
  // 改用 useNodeConnections + useNodesData，xyflow 内部对依赖做了稳定化，上游连/断/data 任一变化都会立即同步。
  const conns = useNodeConnections({ id, handleType: 'target' });
  const upstreamIds = useMemo(
    () => Array.from(new Set(conns.map((c: any) => c.source).filter(Boolean))) as string[],
    [conns],
  );
  const upstreamNodesData = useNodesData(upstreamIds);
  const upstreamNodes = useMemo(
    () => (Array.isArray(upstreamNodesData) ? upstreamNodesData : [upstreamNodesData]).filter(Boolean) as any[],
    [upstreamNodesData],
  );

  // ========== 上游媒体聚合（与 Image/Video/Audio 节点一致的预览体验）==========
  // 使用项目统一的 useUpstreamMaterials hook，按 kind 聚合上游 image/video/audio，
  // 交给 MaterialPreviewSection 统一呈现（含 dnd-kit 拖拽排序、多图并列、双主题适配）。
  // materialOrder 写入本节点 data，负责序列化限定。
  const upstream = useUpstreamMaterials(id);
  const excludedMaterialIds = useMemo(
    () => normalizeExcludedMaterialIds(d?.excludedMaterialIds),
    [d?.excludedMaterialIds],
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
  const visibleUpstreamTexts = useMemo(
    () => filterExcludedMaterials(upstream.texts, excludedMaterialIds),
    [upstream.texts, excludedMaterialIds],
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
  const mentionMaterials = useMemo<Material[]>(
    () => [...orderedTexts, ...orderedImages, ...orderedVideos, ...orderedAudios],
    [orderedTexts, orderedImages, orderedVideos, orderedAudios],
  );
  // 日志来源标识：供 TerminalPanel 面板展示 [src] 前缀。
  // 与 VideoNode/SeedanceNode 保持一致，不同节点类型使用不同前缀 rh / rh-wallet。
  const src = `${type === 'rhWallet' ? 'rh-wallet' : 'rh'}:${id}`;
  const setMaterialOrder = (newOrder: string[]) => update({ materialOrder: newOrder });
  const handleExcludeUpstreamMaterial = (m: Material) => {
    if (m.origin !== 'upstream') return;
    update({
      excludedMaterialIds: excludeMaterialId(excludedMaterialIds, m.id),
      materialOrder: materialOrder.filter((itemId) => itemId !== m.id),
    });
  };
  const handleRestoreExcludedMaterials = () => update({ excludedMaterialIds: [] });
  const { style, theme } = useThemeStore();
  const isPixel = style === 'pixel';
  const isDark = theme === 'dark';

  // 如今需要按“字段在同 kind 下的出现顺序”取第 idx 个排序后的上游素材 url，
  // 实现多个 image/video/audio 字段逆向分配上游多个素材。并受 MaterialPreviewSection 的拖拽排序控制。
  const findUpstreamUrl = (kind: 'image' | 'video' | 'audio', idx = 0): string => {
    const arr = kind === 'image' ? orderedImages : kind === 'video' ? orderedVideos : orderedAudios;
    return arr[idx]?.url || '';
  };

  // 计算每个 media 字段在同 kind 下的索引（用于字段内“同步”按钮定位素材）
  const fieldKindIndex = useMemo(() => {
    const m: Record<string, number> = {};
    const counters: Record<string, number> = { image: 0, video: 0, audio: 0 };
    const list: any[] = currentNodeInfoList;
    for (const it of list) {
      const vt = inferValueType(it?.fieldType);
      if (vt === 'image' || vt === 'video' || vt === 'audio') {
        m[paramKey(it.nodeId, it.fieldName)] = counters[vt]++;
      }
    }
    return m;
  }, [appInfo]);

  // ========== 保存某一条 paramValue ==========
  const setParam = (k: string, patch: Partial<RhParamValue>) => {
    const cur = paramValues[k] || { value: '' };
    const next = { ...paramValues, [k]: { ...cur, ...patch } };
    update({ paramValues: next });
  };

  const getParamMentions = (k: string): MediaMention[] =>
    Array.isArray(paramMentions[k]) ? paramMentions[k] : [];

  const setTextParam = (k: string, value: string, mentions: MediaMention[]) => {
    const cur = paramValues[k] || { value: '' };
    update({
      paramValues: { ...paramValues, [k]: { ...cur, value, sourceFromUpstream: false, sourceMaterialId: '', sourceRhNodeId: '' } },
      paramMentions: { ...paramMentions, [k]: mentions },
    });
  };

  // 对于媒体类字段，随上游节点 url 变化同步回填：
  //   - sourceFromUpstream === true   → 已启用，连续跟进
  //   - sourceFromUpstream === undefined → 用户从未交互过（包括拉取后只填了默认 fieldValue），
  //                                       一旦上游出现对应 url → 自动启用 + 填值（避免用户漏勾导致提交默认值）
  //   - sourceFromUpstream === false  → 用户主动取消过，不动
  // 分配策略：同 kind 下的多个字段按 list 顺序逐个取 orderedImages/Videos/Audios[i]，与 MaterialPreviewSection 的拖拽排序联动。
  useEffect(() => {
    const list: any[] = currentNodeInfoList;
    if (!Array.isArray(list) || list.length === 0) return;
    let changed = false;
    const next = { ...paramValues };
    const counters: Record<string, number> = { image: 0, video: 0, audio: 0 };
    for (const it of list) {
      const vt = inferValueType(it?.fieldType);
      if (vt !== 'image' && vt !== 'video' && vt !== 'audio') continue;
      const k = paramKey(it.nodeId, it.fieldName);
      const cur = next[k];
      const idx = counters[vt]++;
      const upUrl = findUpstreamUrl(vt, idx);
      if (!upUrl) continue;
      if (cur?.sourceFromUpstream === false) continue; // 用户主动关闭
      if (cur?.sourceFromUpstream === true) {
        if (upUrl !== cur.value) {
          next[k] = { ...cur, value: upUrl };
          changed = true;
        }
      } else {
        // undefined → 首次看到上游，自动启用
        next[k] = { value: upUrl, sourceFromUpstream: true };
        changed = true;
      }
    }
    const withTextBindings = applyRhTextBindings(list, orderedTexts, next);
    if (changed || !areRhParamValuesEqual(paramValues, withTextBindings)) {
      update({ paramValues: withTextBindings });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedTexts, orderedImages, orderedVideos, orderedAudios, appInfo]);

  // ========== 以当前 upstreamNodes + appInfo + paramValues 为输入，同步重算最新 paramValues ==========
  // 用途：handleRun 产业路径上跳过 React state 异步更新陷阱。用户刚连上传视频节点后立刻点
  // 运行， useEffect 同步上游 url 到 paramValues 还未生效；this fn 返回一份实时快照，避免用过期 state。
  const computeFreshValuesNow = (
    list: any[] | undefined,
  ): Record<string, RhParamValue> => {
    const next: Record<string, RhParamValue> = { ...paramValues };
    if (!Array.isArray(list)) return next;
    const counters: Record<string, number> = { image: 0, video: 0, audio: 0 };
    for (const it of list) {
      const vt = inferValueType(it?.fieldType);
      if (vt !== 'image' && vt !== 'video' && vt !== 'audio') continue;
      const k = paramKey(it.nodeId, it.fieldName);
      const cur = next[k];
      const idx = counters[vt]++;
      if (cur?.sourceFromUpstream === false) continue; // 用户主动关闭
      const upUrl = findUpstreamUrl(vt, idx);
      if (!upUrl) continue;
      // sourceFromUpstream === true 或 undefined（初次看到上游）都采用上游实时 url
      next[k] = { value: upUrl, sourceFromUpstream: true };
    }
    return applyRhTextBindings(list, orderedTexts, next);
  };

  // ========== 收集上游 RhConfig nodeInfoList（保留向后兼容）==========
  const collectUpstreamConfigList = () => {
    const list: any[] = [];
    for (const n of upstreamNodes) {
      const arr = (n?.data as any)?.nodeInfoList;
      if (Array.isArray(arr)) list.push(...arr);
    }
    return list;
  };

  // ========== 从节点内表单 + 上游 RhConfig 合并出原始 nodeInfoList（同一个 (nodeId,fieldName) 表单优先）==========
  // 同样接受可选的 override 参数让 handleRun 同步路径能用 freshly fetched 结果
  //
  // 媒体多素材说明：
  //   - RH 协议中 fieldValue 必须是单个 fileName（不能是多行/逗号拼接，否则 LoadImage 节点会
  //     会报 "Custom validation failed for node"）
  //   - 同 (nodeId, fieldName) 重复条目会被后覆盖前丢首
  //   - 因此：不进行任何多 url 拼接也不追加重复记录。如果 webapp 模板只暴露 1 个 image 字段但用户
  //     连了 N 张图，仅使用顶部预览「首张」（fieldKindIndex 对应的 orderedImages[0]）作为该字段值，
  //     剩余素材仅在节点内预览，不会提交到 RH。多图需要 webapp 内部提供多个 image 字段。
  const buildRawNodeInfoList = (
    overrideList?: any[],
    overrideValues?: Record<string, RhParamValue>,
  ): any[] => {
    const seen = new Set<string>();
    const out: any[] = [];
    // 1. 节点内表单
    const list: any[] = overrideList ?? currentNodeInfoList ?? [];
    const values = overrideValues ?? paramValues;
    for (const it of list) {
      const k = paramKey(it.nodeId, it.fieldName);
      const vt = inferValueType(it?.fieldType);
      const v = values[k]?.value;
      // 未填 且 原始 fieldValue 为空且非必填 → 跳过
      // 如果 fieldValue 是数组（选项集），走 extractDefaultValue 取首项，避免被隐式转成 "a,b,c"。
      const finalVal = v != null && v !== '' ? v : extractDefaultValue(it);
      const submitVal =
        vt === 'text'
          ? resolveMediaMentions(String(finalVal), getParamMentions(k), mentionMaterials)
          : finalVal;
      seen.add(k);
      out.push({
        nodeId: it.nodeId,
        fieldName: it.fieldName,
        fieldValue: submitVal,
        valueType: vt,
      });
    }
    // 2. 上游 RhConfig 补充（同 key 已被节点内覆盖则跳过）
    const upstreamList = collectUpstreamConfigList();
    for (const it of upstreamList) {
      const k = paramKey(it?.nodeId, it?.fieldName);
      if (seen.has(k)) continue;
      out.push(it);
    }
    return out;
  };

  /**
   * 提交前处理：将 valueType=image|video|audio 且 fieldValue 是 url 的条目
   * 调 /upload-asset 转成 RH 内部 fileName。text/number 原样保留。
   * 输出: 干净的 nodeInfoList（仅含 nodeId/fieldName/fieldValue）。
   */
  const resolveNodeInfoList = async (raw: any[]): Promise<any[]> => {
    const out: any[] = [];
    for (const it of raw) {
      const nodeId = it?.nodeId;
      const fieldName = it?.fieldName;
      let fieldValue = it?.fieldValue;
      const vt = it?.valueType;
      if (!nodeId || !fieldName) continue;
      if (vt === 'image' || vt === 'video' || vt === 'audio') {
        let v = String(fieldValue || '').trim();
        // 多行兼容：如果 fieldValue 含换行（旧残留或人工输入），只取首行，避免 RH LoadImage
        // 节点报 "Custom validation failed for node"。多图仅节点内预览不提交到 RH。
        if (v.includes('\n')) {
          const first = v.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0] || '';
          console.log('[RH/resolve] strip multiline', fieldName, '→ keep first only');
          logBus.warn(`多行 fieldValue 检测到1-${fieldName}，仅保留首行`, src);
          v = first;
        }
        // 最后一道兼底：如果当前值看起来不是 url（可能是 RH 内部默认 hash 或用户手填 fileName），
        // 但上游连了对应类型的媒体节点，且用户没有主动取消 sourceFromUpstream，
        // 则强制用上游 url，避免 state 异步/race condition 导致仍提交默认 hash。
        const isUrlLike0 =
          /^https?:\/\//i.test(v) ||
          v.startsWith('/files/output/') ||
          v.startsWith('/output/') ||
          v.startsWith('/files/input/') ||
          v.startsWith('/input/');
        if (!isUrlLike0) {
          const k = paramKey(nodeId, fieldName);
          const cur = paramValues[k];
          if (cur?.sourceFromUpstream !== false) {
            const upUrl = findUpstreamUrl(vt as any);
            if (upUrl) {
              console.log('[RH/resolve] override field', fieldName, 'from', v || '(empty)', '→ upstream', upUrl);
              logBus.debug(`字段 ${fieldName} 从上游覆写 → ${upUrl}`, src);
              v = upUrl;
            }
          }
        }
        if (!v) continue; // 未提供资源 → 跳过该条目
        // 判定为本地/远程 url 的样式 → 走 /upload-asset 转 fileName
        const isUrlLike =
          /^https?:\/\//i.test(v) ||
          v.startsWith('/files/output/') ||
          v.startsWith('/output/') ||
          v.startsWith('/files/input/') ||
          v.startsWith('/input/');
        if (isUrlLike) {
          const r = await uploadRhAsset(v);
          fieldValue = r.fileName;
        } else {
          fieldValue = v;
        }
      } else if (vt === 'number') {
        const num = Number(fieldValue);
        fieldValue = Number.isFinite(num) ? num : fieldValue;
      }
      out.push({ nodeId, fieldName, fieldValue });
    }
    return out;
  };

  // v1.2.9.12: 返回 Promise，调用方 await 直到任务真正成功/失败/超时才 resolve/reject。
  //   原设计中 startPolling 启动 setInterval 后立即返回 → handleRun 提交后也立即返回 →
  //   useRunTrigger 认为 runFn 完成 markDone(true)。但实际任务 urls/imageUrl/videoUrl 还未赋值 →
  //   LoopNode awaitNode 立即继续 → extractFromNode 读不到产物 → result=null → failCount++。
  //   修复: 轮询完成才 resolve，handleRun await 它，markDone 时机=任务真正结束。
  //   同样适用于 RH 钱包应用节点 (runninghubWallet)，同一个组件复用。
  const startPolling = (tid: string): Promise<void> => {
    const key = runningHubPollKey(id, tid);
    const existing = activeRunningHubPolls.get(key);
    if (existing) {
      currentPollKeyRef.current = key;
      return existing.promise;
    }
    stopPoll();
    currentPollKeyRef.current = key;
    let timer: number | null = null;
    const promise = new Promise<void>((resolve, reject) => {
      let elapsed = 0;
      const POLL_INT = 5000;
      const MAX = 480;
      const finish = (ok: boolean, error?: Error) => {
        if (timer != null) {
          window.clearInterval(timer);
        }
        if (activeRunningHubPolls.get(key)?.timer === timer) {
          activeRunningHubPolls.delete(key);
        }
        if (currentPollKeyRef.current === key) {
          currentPollKeyRef.current = null;
        }
        if (ok) resolve();
        else reject(error || new Error('RH 轮询失败'));
      };
      timer = window.setInterval(async () => {
        elapsed += 1;
        if (elapsed > MAX) {
          update({ status: 'error', error: '轮询超时' });
          setError('轮询超时');
          finish(false, new Error('轮询超时'));
          return;
        }
        try {
          const r = await queryRh(tid);
          console.log('[RH/poll] taskId=', tid, 'status=', r.status, 'code=', r.code, 'urls=', r.urls?.length || 0);
          // 轮询进度写入面板：每 30s 一条 debug，避免刷屏
          if (elapsed % 6 === 0) {
            logBus.debug(`[${elapsed * 5}s] status=${r.status} code=${r.code} urls=${r.urls?.length || 0}`, src);
          }
          if (r.status === 'SUCCESS') {
            const list: string[] = Array.isArray(r.urls) ? r.urls : [];
            const patch: any = { status: 'success', ...buildRhOutputStateFromUrls(list) };
            console.log('[RH/done] taskId=', tid, 'urls=', list);
            logBus.success(`任务完成 · ${list.length} 个输出 → ${list[0] || ''}`, src);
            update(patch);
            finish(true);
          } else if (r.status === 'FAILED') {
            // failReason 可能是 ComfyUI 报错对象(含 traceback/exception_type 等)，
            // 需序列化为字符串避免 React JSX 直接渲染 object 崩溃
            let reason: string;
            if (r.failReason == null) {
              reason = `RH 失败 code=${r.code}`;
            } else if (typeof r.failReason === 'string') {
              reason = r.failReason;
            } else {
              try {
                const o: any = r.failReason;
                reason = o?.exception_message || o?.message || JSON.stringify(o);
              } catch {
                reason = `RH 失败 code=${r.code}`;
              }
            }
            update({ status: 'error', error: reason });
            setError(reason);
            logBus.error(`生成失败: ${reason}`, src);
            finish(false, new Error(reason));
          } else {
            update({
              status: 'polling',
              rhCode: r.code,
              rhProgress: r.progress || (r.status === 'QUEUED' ? '5%' : '45%'),
              rhQueueHint: r.queueHint || (r.status === 'QUEUED' ? '任务队列排队中' : '任务已提交，正在生成'),
            });
          }
        } catch (e: any) {
          console.warn('RH 轮询出错', e?.message);
          logBus.warn(`轮询出错: ${e?.message || e}`, src);
        }
      }, POLL_INT);
    });
    if (timer != null) {
      activeRunningHubPolls.set(key, { timer, promise });
    }
    return promise;
  };

  // 返回本次拉取与计算后的可用 list + paramValues，供 handleRun 同步路径直接使用
  // （避免 React state 异步更新后 closure 还指向旧值）
  const handleFetchInfo = async (): Promise<{
    list: any[];
    paramValues: Record<string, RhParamValue>;
  } | null> => {
    setError(null);
    if (presetMixedStateError) {
      setError(presetMixedStateError);
      return null;
    }
    if (!resolvedRunTargetId) {
      setError('请先选择后台条目，或展开高级方式填写运行目标');
      return null;
    }
    setFetchingInfo(true);
    try {
      const existingNodeInfoList = mergeNodeInfoListWithPresetMetadata(appInfo?.nodeInfoList, localPresetAppInfo?.nodeInfoList);
      const info = await fetchRhAppInfo(resolvedRunTargetId);
      const list = normalizeRemoteNodeInfoList(
        info?.nodeInfoList || [],
        existingNodeInfoList,
      );
      // 调试日志：打印原始 nodeInfoList 结构，方便后续按实际字段名/fieldType 扩充 LIST 词典
      try {
        console.log('[RH/fetchInfo] runTargetId=', resolvedRunTargetId, 'nodeInfoList=', JSON.parse(JSON.stringify(list)));
      } catch {}
      logBus.info(`拉取应用信息 · runTargetId=${resolvedRunTargetId} · ${list.length} 个字段`, src);
      const next: Record<string, RhParamValue> = { ...paramValues };
      for (const it of list) {
        const k = paramKey(it.nodeId, it.fieldName);
        const vt = inferValueType(it?.fieldType);
        if (k in next) continue;
        if (vt === 'image' || vt === 'video' || vt === 'audio') {
          // 媒体类字段默认勾选「从上游自动获取」。
          //   - 上游已接入对应媒体 → 填上游 url
          //   - 上游未接入 → 值为空，等上游连接后同步 useEffect 会自动填入
          const upUrl = findUpstreamUrl(vt);
          next[k] = { value: upUrl || '', sourceFromUpstream: true };
          continue;
        }
        // 非媒体字段：如果 fieldValue 是数组（选项集充当默认值），取第 0 个项作为默认选中。
        next[k] = { value: extractDefaultValue(it) };
      }
      const withTextBindings = applyRhTextBindings(list, orderedTexts, next);
      update({
        appInfo: {
          ...(localPresetAppInfo || {}),
          ...(appInfo || {}),
          ...(info || {}),
          presetCatalogId: selectedWorkflowPreset?.catalogId || appInfo?.presetCatalogId || '',
          appName: info?.appName || info?.title || localPresetAppInfo?.appName || appInfo?.appName || '',
          name: info?.name || info?.title || localPresetAppInfo?.name || appInfo?.name || '',
          pageId: info?.pageId || resolvedPageId,
          runTargetId: info?.runTargetId || resolvedRunTargetId,
          targetType: resolvedTargetType,
          webappId: resolvedTargetType === 'app' ? (info?.webappId || resolvedWebappId || resolvedRunTargetId) : '',
          workflowId: resolvedTargetType === 'workflow' ? (info?.workflowId || resolvedWorkflowId) : '',
          nodeInfoList: list,
        },
        paramValues: withTextBindings,
      });
      return { list, paramValues: withTextBindings };
    } catch (e: any) {
      setError(e?.message || '查询失败');
      logBus.error(`拉取应用信息失败: ${e?.message || e}`, src);
      return null;
    } finally {
      setFetchingInfo(false);
    }
  };

  // 自动拉取：第一次已有运行目标且上游有可用素材（文本/媒体）且还未拉取过任何 appInfo 时，
  // 静默拉一次，避免用户漏点搜索按钮导致提交空 nodeInfoList 后 RH 用了应用默认参数。
  const autoFetchedRef = useRef(false);
  const autoHydratedCatalogRef = useRef('');
  useEffect(() => {
    if (autoFetchedRef.current) return;
    if (!resolvedRunTargetId) return;
    if (appInfo) return;
    if (fetchingInfo) return;
    const hasUpstreamPayload = orderedTexts.length > 0 || !!(findUpstreamUrl('image') || findUpstreamUrl('video') || findUpstreamUrl('audio'));
    if (!hasUpstreamPayload) return;
    autoFetchedRef.current = true;
    void handleFetchInfo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedRunTargetId, upstreamNodes, appInfo]);

  useEffect(() => {
    if (!selectedWorkflowPreset) {
      autoHydratedCatalogRef.current = '';
      return;
    }
    if (!resolvedRunTargetId) return;
    if (fetchingInfo) return;
    if (!shouldHydrateAuthoritativeAppInfo && presetFieldCount > 0) return;
    const hydrateKey = `${selectedWorkflowPreset.catalogId}:${resolvedRunTargetId}:${shouldHydrateAuthoritativeAppInfo ? 'app-authoritative' : 'workflow-empty'}`;
    if (autoHydratedCatalogRef.current === hydrateKey) return;
    autoHydratedCatalogRef.current = hydrateKey;
    void handleFetchInfo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkflowPreset?.catalogId, presetFieldCount, resolvedRunTargetId, fetchingInfo, shouldHydrateAuthoritativeAppInfo]);

  useEffect(() => {
    if (status !== 'polling' || !taskId || !resolvedRunTargetId) return;
    void startPolling(taskId).catch(() => undefined);
    // startPolling 本身由节点当前 data 派生，内部有全局去重；这里故意只跟随持久化运行态恢复轮询。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, taskId, resolvedRunTargetId]);

  const handleRun = async () => {
    setError(null);
    if (presetMixedStateError) {
      setError(presetMixedStateError);
      return;
    }
    if (!resolvedRunTargetId) {
      setError('请先选择后台条目，或展开高级方式填写运行目标');
      return;
    }
    // 兑底：如果还没拉过 appInfo 且上游接了媒体节点，先同步拉一次，
    // 避免提交空 nodeInfoList 后 RH 黙默用了应用默认参数。
    let freshList: any[] | null = null;
    let freshValues: Record<string, RhParamValue> | null = null;
    if (!currentNodeInfoList.length) {
      const hasUpstreamPayload = orderedTexts.length > 0 || !!(findUpstreamUrl('image') || findUpstreamUrl('video') || findUpstreamUrl('audio'));
      if (hasUpstreamPayload) {
        const r = await handleFetchInfo();
        if (r) {
          freshList = r.list;
          freshValues = r.paramValues;
        }
      }
    }
    // 关键：无论 appInfo 是否已存在，进入 handleRun 都以当前 upstreamNodes 为准重算
    // 一次 paramValues，避免 React state 异步更新陷阱（刚连上游立刻运行，state 还没生效）。
    const effectiveList = freshList ?? currentNodeInfoList ?? [];
    const effectiveValues = freshValues ?? computeFreshValuesNow(effectiveList);
    // 同步一份到 state，避免 UI 显示与提交不一致
    if (Object.keys(effectiveValues).length > 0) {
      update({ paramValues: effectiveValues });
    }
    update({
      status: 'submitting',
      error: null,
      taskId: null,
      rhProgress: '5%',
      rhQueueHint: '任务提交中',
      ...emptyRhOutputState(),
    });
    try {
      const rawList = buildRawNodeInfoList(effectiveList, effectiveValues);
      // 提交前：把媒体类 url 转成 RH 内部 fileName
      const nodeInfoList = await resolveNodeInfoList(rawList);
      console.log('[RH/submit] runTargetId=', resolvedRunTargetId, 'nodeInfoList=', JSON.parse(JSON.stringify(nodeInfoList)));
      logBus.info(`提交任务 · runTargetId=${resolvedRunTargetId} · ${nodeInfoList.length} 个字段${useWallet ? ' · 钱包模式' : ''}`, src);
      const r = await submitRh({
        webappId: resolvedWebappId,
        pageId: resolvedPageId,
        workflowId: resolvedWorkflowId || undefined,
        runTargetId: resolvedRunTargetId,
        targetType: resolvedTargetType,
        taskCapability: resolvedTaskCapability,
        nodeInfoList,
        instanceType: instanceType || undefined,
      });
      console.log('[RH/submit] taskId=', r.taskId);
      logBus.success(`异步任务已提交 taskId=${r.taskId} 进入轮询…`, src);
      update({ status: 'polling', taskId: r.taskId, rhProgress: '5%', rhQueueHint: '任务队列排队中' });
      // v1.2.9.12: await 让 useRunTrigger 等到任务真正完成才 markDone，循环器才能拿到 urls
      await startPolling(r.taskId);
    } catch (e: any) {
      console.error('[RH/submit] error:', e);
      logBus.error(`提交失败: ${e?.message || e}`, src);
      setError(e?.message || '提交失败');
      update({ status: 'error', error: e?.message });
    }
  };

  // 接入运行总线,供批量运行调起(不重复调起轮询中的任务)
  useRunTrigger(id, async () => {
    if (status === 'submitting' || status === 'polling') return;
    await handleRun();
  });

  const handleStop = async () => {
    if (isCancelling) return;
    if (!taskId) {
      stopPoll();
      update({ status: 'idle', rhQueueHint: '已停止本地观察' });
      logBus.warn('用户停止本地观察', src);
      return;
    }
    setIsCancelling(true);
    try {
      const cancelled = await cancelGenerationTask({
        taskId,
        kind: 'external',
        providerId: selectedWorkflowPreset?.providerId || 'runninghub',
        providerModel: resolvedRunTargetId,
      });
      stopPoll(taskId);
      update({
        status: 'cancelled',
        error: null,
        rhProgress: '100%',
        rhQueueHint: cancelled.message || '任务已取消',
        ...emptyRhOutputState(),
      });
      logBus.warn(cancelled.message || '用户已取消任务', src);
    } catch (e: any) {
      setError(e?.message || '取消任务失败');
      logBus.error(`取消失败: ${e?.message || e}`, src);
    } finally {
      setIsCancelling(false);
    }
  };

  const isBusy = status === 'submitting' || status === 'polling' || isCancelling;
  const runningCount = isBusy ? 1 : 0;
  const successCount = status === 'success' ? 1 : 0;
  const failureCount = status === 'error' ? 1 : 0;
  const nodeInfoList: any[] = currentNodeInfoList;
  const schemaInputCount = selectedWorkflowSchema?.inputSlots.length || 0;
  const schemaOutputCount = selectedWorkflowSchema?.outputs.length || 0;
  const visibleTargetHandleStyle = { top: 124 } as const;
  const hiddenLegacyHandleStyle = (top: number) => ({
    top,
    opacity: 0,
    pointerEvents: 'none' as const,
  });

  return (
    <div
      className={`relative rounded-xl border-2 transition-all w-[324px] ${
        selected ? `${accent.ring} shadow-2xl ${accent.shadow}` : 'border-white/15 hover:border-white/30'
      }`}
      style={{
        // 像素风：不透明背景 + 取消 backdrop blur，避免亚像素渲染导致节点内文字发虚
        background: isPixel ? 'var(--px-surface)' : 'rgba(20,20,22,.92)',
        backdropFilter: isPixel ? 'none' : 'blur(8px)',
        color: isPixel ? 'var(--px-ink)' : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} style={visibleTargetHandleStyle} className={`${accent.handle} !border-0`} />
      <Handle id="text-in" type="target" position={Position.Left} style={hiddenLegacyHandleStyle(96)} className={`${accent.handle} !border-0`} />
      <Handle id="image-in" type="target" position={Position.Left} style={hiddenLegacyHandleStyle(136)} className={`${accent.handle} !border-0`} />
      <Handle id="video-in" type="target" position={Position.Left} style={hiddenLegacyHandleStyle(176)} className={`${accent.handle} !border-0`} />
      <Handle id="audio-in" type="target" position={Position.Left} style={hiddenLegacyHandleStyle(216)} className={`${accent.handle} !border-0`} />
      <Handle id="json-in" type="target" position={Position.Left} style={hiddenLegacyHandleStyle(256)} className={`${accent.handle} !border-0`} />
      <Handle type="source" position={Position.Right} className={`${accent.handle} !border-0`} />

      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <div
          className="w-6 h-6 rounded flex items-center justify-center"
          style={{ background: accent.dot, color: accent.dotInk, boxShadow: `inset 0 0 0 1px ${accent.dotEdge}` }}
        >
          <TitleIcon size={13} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">{titleText}</div>
          <div className="text-[10px] text-white/40 truncate">{appInfo?.appName || appInfo?.name || (useWallet ? 'RH 钱包应用 (共享 APIKEY)' : 'AI 工作流')}</div>
        </div>
      </div>
      {isBusy ? (
        <div className="px-3 pt-2">
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-cyan-400 transition-all"
              style={{ width: rhProgress || (status === 'submitting' ? '5%' : '45%') }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-cyan-200/80">
            <span>{rhQueueHint || (status === 'submitting' ? '任务提交中' : '任务已提交，正在生成')}</span>
            <span>{rhProgress || (status === 'submitting' ? '5%' : '45%')}</span>
          </div>
        </div>
      ) : null}

      <div className="p-2.5 space-y-2" onMouseDown={(e) => e.stopPropagation()}>
        {/* 上游素材聚合预览区：文本 RH# 会联动下方 RH 参数，媒体仍按类型顺序自动分配。 */}
        {(orderedTexts.length + orderedImages.length + orderedVideos.length + orderedAudios.length + excludedUpstreamCount) > 0 && (
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
            onChange={(e) => {
              const nextId = e.target.value;
              if (!nextId) {
                update({ rhWorkflowPresetId: '', appInfo: null, webappId: '' });
                return;
              }
              const preset = workflowCatalog.find((item) => item.catalogId === nextId);
              if (!preset) return;
              update({
                rhWorkflowPresetId: nextId,
                webappId: preset.runTargetId,
                appInfo: buildRunningHubAppInfoFromCatalog(preset),
                paramValues: {},
                paramMentions: {},
              });
              setError(null);
            }}
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
            <span>{orderedTexts.length + orderedImages.length + orderedVideos.length + orderedAudios.length} 项</span>
          </div>
          <div className="mt-1 text-[10px] leading-4 text-white/40">
            文本、图片、视频、音频统一从左侧一个输入口进入，再按后台条目的字段规则自动分配。
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 text-[10px] text-white/45">
          <span>
            文本 {currentNodeInfoList.filter((it: any) => inferValueType(it?.fieldType) === 'text').length}
            {' '}· 图片 {currentNodeInfoList.filter((it: any) => inferValueType(it?.fieldType) === 'image').length}
            {' '}· 视频 {currentNodeInfoList.filter((it: any) => inferValueType(it?.fieldType) === 'video').length}
            {' '}· 音频 {currentNodeInfoList.filter((it: any) => inferValueType(it?.fieldType) === 'audio').length}
          </span>
          <button
            type="button"
            onClick={() => update({ rhShowManualRunTarget: !showManualRunTarget })}
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
              onChange={(e) => update({ webappId: e.target.value, rhWorkflowPresetId: '' })}
              placeholder="仅在后台目录尚未配置时使用"
              className="flex-1 rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30 placeholder:text-white/30"
            />
            <button
              onClick={handleFetchInfo}
              disabled={fetchingInfo}
              title="拉取运行目标信息"
              className="px-2 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 disabled:opacity-50"
            >
              {fetchingInfo ? <Loader2 size={11} className="animate-spin" /> : <Search size={11} />}
            </button>
          </div>
        </div>
        ) : null}

        {/* 参数表单：拉取 nodeInfoList 后逐条展开 */}
        {/* nowheel: 阻止 xyflow 把滚轮事件接管成画布缩放，让节点内列表可滚动；nodrag: 鼠标按下不触发节点拖动 */}
        {nodeInfoList.length > 0 && (
          <div
            className={`nowheel nodrag rounded border ${accent.subBg} p-2 space-y-2 max-h-[420px] overflow-auto overscroll-contain`}
            onWheelCapture={(e) => e.stopPropagation()}
          >
            <div className={`text-[10px] ${accent.sub} flex items-center justify-between`}>
              <span>参数 ({nodeInfoList.length})</span>
              <span className="text-white/30">点击字段可编辑</span>
            </div>
            {nodeInfoList.map((it: any, i: number) => {
              const vt = inferValueType(it?.fieldType);
              const k = paramKey(it.nodeId, it.fieldName);
              const cur = paramValues[k] || { value: extractDefaultValue(it) };
              const isMedia = vt === 'image' || vt === 'video' || vt === 'audio';
              const fieldDataOptions = extractFieldOptions(it);
              const currentFieldDisplayLabel = fieldDisplayLabel(it);
              return (
                <div key={i} className="space-y-1 pb-2 border-b border-white/5 last:border-0 last:pb-0">
                  <div className="flex items-center gap-1 text-[10px] leading-tight">
                    <span className="text-white/80 font-medium truncate">{currentFieldDisplayLabel || it.fieldName}</span>
                    <span className="text-white/20">|</span>
                    <span className="text-cyan-300/60 px-1 rounded bg-cyan-500/10">
                      {fieldDataOptions ? `select(${fieldDataOptions.length})` : vt}
                    </span>
                    <span className="text-white/20">|</span>
                    <span className="text-white/30">#{it.nodeId}</span>
                  </div>
                  {isMedia ? (
                    <>
                      <div className="flex items-center justify-between text-[10px]">
                        <label className="flex items-center gap-1 text-cyan-200/80 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!cur.sourceFromUpstream}
                            onChange={(e) => setParam(k, { sourceFromUpstream: e.target.checked })}
                            className="accent-cyan-400"
                          />
                          从上游自动获取
                        </label>
                        {cur.sourceFromUpstream && (
                          <button
                            onClick={() => {
                              const u = findUpstreamUrl(vt, fieldKindIndex[k] ?? 0);
                              if (u) setParam(k, { value: u });
                            }}
                            className="flex items-center gap-1 text-cyan-200/80 hover:text-cyan-100"
                            title="重新同步上游 url"
                          >
                            <RefreshCw size={9} /> 同步
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={cur.value}
                        onChange={(e) => setParam(k, { value: e.target.value })}
                        placeholder={cur.sourceFromUpstream ? '(从上游自动填入)' : `${vt} url 或 fileName`}
                        readOnly={!!cur.sourceFromUpstream}
                        className={`w-full rounded border px-2 py-1 text-[11px] text-white outline-none placeholder:text-white/30 ${
                          cur.sourceFromUpstream
                            ? 'bg-cyan-500/10 border-cyan-500/30 cursor-not-allowed'
                            : 'bg-white/5 border-white/10 focus:border-white/30'
                        }`}
                      />
                      {/* 字段内联预览已迁到顶部 MaterialPreviewSection 统一展示（与 Image/Video/Audio 节点样式一致，支持多图 + 拖拽排序），
                          这里不再重复渲染缩略图，仅保留输入框 + 从上游勾选按钮，避免与顶部预览区重复。 */}
                    </>
                  ) : fieldDataOptions ? (
                    <select
                      value={cur.value}
                      onChange={(e) => setParam(k, { value: e.target.value })}
                      className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-white outline-none focus:border-white/30"
                    >
                      {/* 当前值不在 options 里（用户手填/定制值）→ 保留一个“(当前) value”项避免丢失选中 */}
                      {cur.value && !fieldDataOptions.some((o) => String(o) === String(cur.value)) && (
                        <option value={String(cur.value)}>(当前) {String(cur.value)}</option>
                      )}
                      {!cur.value && <option value="">(选择)</option>}
                      {fieldDataOptions.map((opt, oi) => (
                        <option key={oi} value={String(opt)}>{String(opt)}</option>
                      ))}
                    </select>
                  ) : vt === 'number' ? (
                    <input
                      type="number"
                      value={cur.value}
                      onChange={(e) => setParam(k, { value: e.target.value })}
                      placeholder={extractDefaultValue(it)}
                      className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-white outline-none focus:border-white/30 placeholder:text-white/30"
                    />
                  ) : (
                    (() => {
                      const selectedTextMaterial = findMaterialById(orderedTexts, cur.sourceMaterialId);
                      const autoTextMatch = findRhTextMaterialForField(it, orderedTexts);
                      const linkedTextMaterial = selectedTextMaterial || (autoTextMatch.status === 'matched' ? autoTextMatch.material || null : null);
                      const isLinked = !!cur.sourceFromUpstream && !!linkedTextMaterial;
                      const bindHint =
                        autoTextMatch.status === 'conflict'
                          ? `多个上游文本都填写了 RH#${normalizeRhNodeId(it.nodeId)}，请改成唯一 RH# 或手动选择。`
                          : autoTextMatch.status === 'no-match'
                            ? `给文本节点填写 RH#${normalizeRhNodeId(it.nodeId)} 后可自动绑定。`
                            : isLinked
                              ? `已绑定 ${linkedTextMaterial?.rhNodeId ? `RH#${linkedTextMaterial.rhNodeId}` : '手动选择的文本'}`
                              : '可按文本节点 RH# 自动绑定，也可手动选择上游文本。';
                      return (
                        <>
                          {orderedTexts.length > 0 && (
                            <div className="rounded border border-white/10 bg-white/[0.03] px-2 py-1.5 space-y-1">
                              <div className="flex items-center justify-between gap-2 text-[10px]">
                                <label className="flex items-center gap-1 text-cyan-200/80 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={!!cur.sourceFromUpstream}
                                    onChange={(e) => {
                                      if (!e.target.checked) {
                                        setParam(k, { sourceFromUpstream: false, sourceMaterialId: '', sourceRhNodeId: '' });
                                        return;
                                      }
                                      const fallback = linkedTextMaterial || (orderedTexts.length === 1 ? orderedTexts[0] : null);
                                      if (fallback) {
                                        setParam(k, {
                                          value: fallback.url,
                                          sourceFromUpstream: true,
                                          sourceMaterialId: fallback.id,
                                          sourceRhNodeId: normalizeRhNodeId(fallback.rhNodeId),
                                        });
                                      } else {
                                        setParam(k, { sourceFromUpstream: true });
                                      }
                                    }}
                                    className="accent-cyan-400"
                                  />
                                  从上游文本获取
                                </label>
                                {linkedTextMaterial && (
                                  <button
                                    onClick={() => setParam(k, {
                                      value: linkedTextMaterial.url,
                                      sourceFromUpstream: true,
                                      sourceMaterialId: linkedTextMaterial.id,
                                      sourceRhNodeId: normalizeRhNodeId(linkedTextMaterial.rhNodeId),
                                    })}
                                    className="flex items-center gap-1 text-cyan-200/80 hover:text-cyan-100"
                                    title="重新同步上游文本"
                                  >
                                    <RefreshCw size={9} /> 同步
                                  </button>
                                )}
                              </div>
                              <select
                                value={cur.sourceMaterialId || ''}
                                onChange={(e) => {
                                  const material = findMaterialById(orderedTexts, e.target.value);
                                  if (!material) {
                                    setParam(k, { sourceMaterialId: '', sourceRhNodeId: '', sourceFromUpstream: true });
                                    return;
                                  }
                                  setParam(k, {
                                    value: material.url,
                                    sourceFromUpstream: true,
                                    sourceMaterialId: material.id,
                                    sourceRhNodeId: normalizeRhNodeId(material.rhNodeId),
                                  });
                                }}
                                className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-white outline-none focus:border-white/30"
                              >
                                <option value="">按 RH# 自动匹配</option>
                                {orderedTexts.map((material) => (
                                  <option key={material.id} value={material.id}>
                                    {material.rhNodeId ? `RH#${material.rhNodeId}` : '未填 RH#'} · {material.label || material.url.slice(0, 24)}
                                  </option>
                                ))}
                              </select>
                              <div className="text-[9px] text-white/35 leading-tight">{bindHint}</div>
                            </div>
                          )}
                          {isLinked ? (
                            <textarea
                              value={cur.value}
                              readOnly
                              className="w-full min-h-14 resize-none rounded bg-cyan-500/10 border border-cyan-500/30 px-2 py-1 text-[11px] text-white outline-none cursor-not-allowed"
                              title="已从上游文本同步；取消勾选后可手动编辑"
                            />
                          ) : (
                            <MentionPromptInput
                              value={cur.value}
                              mentions={getParamMentions(k)}
                              materials={mentionMaterials}
                              onChange={(value, mentions) => setTextParam(k, value, mentions)}
                              placeholder={extractDefaultValue(it)}
                              isDark={isDark}
                              isPixel={isPixel}
                              className="w-full min-h-14 resize-none rounded bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-white outline-none focus:border-white/30 placeholder:text-white/30"
                            />
                          )}
                        </>
                      );
                    })()
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div>
          <label className="text-[10px] text-white/50 block mb-1">实例类型(可选)</label>
          <select
            value={instanceType || ''}
            onChange={(e) => update({ instanceType: e.target.value })}
            className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
          >
            <option value="" className="bg-zinc-800">默认</option>
            <option value="plus" className="bg-zinc-800">plus</option>
          </select>
        </div>

        {!isBusy ? (
          <button
            onClick={handleRun}
            className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded ${accent.primary} text-xs font-medium transition-colors`}
          >
            <Sparkles size={12} /> {useWallet ? '运行钱包工作流' : '运行工作流'}
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-zinc-500/20 hover:bg-zinc-500/30 text-zinc-200 text-xs font-medium transition-colors"
          >
            <Square size={11} /> {taskId ? '取消任务' : '停止观察'}
          </button>
        )}

        {isBusy && (
          <div className={`flex items-center gap-1 text-[10px] ${accent.spin}`}>
            <Loader2 size={11} className="animate-spin" />
            {isCancelling
              ? '正在取消任务'
              : (rhQueueHint || (status === 'submitting' ? '任务提交中' : '任务已提交，正在生成'))}
            {taskId && <span className="ml-auto text-white/30">{String(taskId).slice(0, 10)}…</span>}
          </div>
        )}

        {status === 'cancelled' && !isBusy ? (
          <div className="text-[10px] text-amber-200/85">
            {rhQueueHint || '任务已取消'}
          </div>
        ) : null}

        {!isBusy && (
          <div className="text-[10px] text-white/45">
            进行中 {runningCount} · 成功 {successCount} · 失败 {failureCount}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-1 text-[10px] text-red-300 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
            <AlertCircle size={11} className="mt-0.5 flex-shrink-0" />
            <span className="break-all">{error}</span>
          </div>
        )}
      </div>

      {urls.length > 0 && !hasAutoOutput && (
        <div className="border-t border-white/10 p-2 space-y-1">
          {urls.map((u, i) => {
            if (/\.(mp4|webm|mov)$/i.test(u)) {
              return <LoopingVideo key={i} src={u} controls className="w-full rounded" />;
            }
            if (/\.(mp3|wav|ogg)$/i.test(u)) {
              return <audio key={i} src={u} controls className="w-full h-8" />;
            }
            return <img key={i} src={u} alt={`输出 ${i}`} className="w-full rounded object-cover" />;
          })}
        </div>
      )}
    </div>
  );
};

export default memo(RunningHubNode);
