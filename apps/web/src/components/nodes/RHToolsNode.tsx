/**
 * RH 工具节点（启动器 + 运行器双视图）— v1.2.10.1 重构版
 *
 * 设计：
 *   1. 节点初始为「启动器视图」：分类 Tab + 应用按钮网格（2 列）+ 搜索 + 「+ 增加 / ✎ 编辑 / 导出 / 导入」
 *   2. 用户点击应用 → 切换到「运行器视图」：完全复用 RunningHubNode 的运行链路：
 *      - 上游素材 (text/image/video/audio) 聚合预览（MaterialPreviewSection 拖拽排序）
 *      - 拉取 nodeInfoList → 表单展开（select / number / textarea / 媒体字段「从上游」勾选）
 *      - 实例类型 select（默认 / plus）
 *      - 提交 submitRh → startPolling 轮询（5s × 480）→ 按扩展名分流到 imageUrl/videoUrl/audioUrl
 *   3. 接入 useRunTrigger（循环器/批量执行可调起）
 *   4. 接入 useHasAutoOutput（下游已挂 OutputNode 时省略节点内预览）
 *   5. Handle 双侧（左 target / 右 source），z-index 提升避免被 UI 覆盖
 *
 * 与 RunningHubNode 的差异：
 *   - 节点头部为「应用启动器」品牌（紫罗兰系），非「RunningHub」
 *   - 运行器视图增加「← 返回应用列表」按钮
 *   - webappId 由所选应用注入，节点内不再单独输入
 *   - 支持 ResizableCorners 四角同比例缩放
 *
 * 数据：useRHToolsSafe()（多个节点共享 categories/tools）
 * 主题：useThemeStore（theme=dark/light + style=pixel/tech）
 */
import { memo, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNodeConnections, useNodesData, useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import { submitRh, queryRh, fetchRhAppInfo, uploadRhAsset, cancelGenerationTask } from '../../services/generation';
import { useUpdateNodeData } from './useUpdateNodeData';
import { useHasAutoOutput } from './useHasAutoOutput';
import { useRunTrigger } from '../../hooks/useRunTrigger';
import { useUpstreamMaterials, type Material } from './useUpstreamMaterials';
import { useOrderedMaterials } from './useOrderedMaterials';
import { resolveMediaMentions, type MediaMention } from './mediaMentions';
import RHToolsNodeLauncherView from './RHToolsNodeLauncherView';
import RHToolsNodeRunnerView from './RHToolsNodeRunnerView';
import { useRHToolsSafe } from '../../providers/RHToolsProvider';
import { useThemeStore } from '../../stores/theme';
import { logBus } from '../../stores/logs';
import { fuzzyMatch } from '../../utils/pinyinMatch';
import {
  countExcludedMaterials,
  excludeMaterialId,
  filterExcludedMaterials,
  normalizeExcludedMaterialIds,
} from '../../utils/materialExclusion';
import {
  areRhParamValuesEqual,
  applyRhTextBindings,
  rhParamKey,
  type RhParamValue,
} from '../../utils/rhTextBinding';
import {
  buildRhToolsOutputStateFromUrls,
  emptyRhToolsOutputState,
  extractRhToolsDefaultValue,
  inferRhToolsValueType,
} from './rhToolsNodeHelpers';
import type { RHTool, RHToolsBackup } from '../../services/api';

const ALL = 'all';
const UNCATEGORIZED = 'uncategorized';

const paramKey = rhParamKey;

type RHToolsPollEntry = {
  timer: number;
  promise: Promise<void>;
};

const activeRHToolsPolls = new Map<string, RHToolsPollEntry>();
const rhToolsPollKey = (nodeId: string, taskId: string) => `${nodeId}::${taskId}`;

const RHToolsNode = ({ id, data, selected }: NodeProps) => {
  const update = useUpdateNodeData(id);
  const updateNodeInternals = useUpdateNodeInternals();
  const { theme, style: themeStyle } = useThemeStore();
  const isLight = theme === 'light';
  const isPixel = themeStyle === 'pixel';
  const isDark = theme === 'dark';

  const ctx = useRHToolsSafe();
  const categories = ctx?.categories ?? [];
  const tools = ctx?.tools ?? [];
  const importBackup = ctx?.importBackup;

  const d = data as any;
  // 启动器
  const activeCategoryId: string = d?.rhToolsActiveCategoryId || ALL;
  const searchQuery: string = d?.rhToolsSearchQuery || '';
  const activeAppId: string = d?.rhToolsActiveAppId || '';
  const activeApp: RHTool | undefined = activeAppId ? tools.find((t) => t.id === activeAppId) : undefined;
  const webappId: string = activeApp?.webappId || '';
  // 运行态（与 RunningHubNode 字段对齐）
  const instanceType: string = d?.instanceType || '';
  const status: 'idle' | 'submitting' | 'polling' | 'success' | 'error' | 'cancelled' = d?.status || 'idle';
  const taskId: string | undefined = d?.taskId;
  const rhProgress: string = d?.rhProgress || '';
  const rhQueueHint: string = d?.rhQueueHint || '';
  const urls: string[] = d?.urls || [];
  const appInfo: any = d?.appInfo;
  const paramValues: Record<string, RhParamValue> = d?.paramValues || {};
  const paramMentions: Record<string, MediaMention[]> =
    d?.paramMentions && typeof d.paramMentions === 'object' ? d.paramMentions : {};

  // 主题色（青调 cyan，与 RunningHubNode 一致）—— v1.2.10.2 修复某些主题下紫色面板过于伤眼问题
  // v1.2.10.3: 像素风不再用 cyan 混入, 改走 RunningHubNode 同款糖果调色板（px-surface/px-muted/px-ink/px-yellow）
  const accent = isPixel
    ? 'var(--px-ink)'
    : (isLight ? 'rgb(8, 145, 178)' : 'rgb(34, 211, 238)'); // cyan-600 / cyan-400
  const accentSoft = isPixel
    ? 'var(--px-yellow)'
    : (isLight ? 'rgba(8, 145, 178, 0.10)' : 'rgba(34, 211, 238, 0.12)');
  const ringColor = isPixel
    ? 'var(--px-ink)'
    : (isLight ? 'rgba(8,145,178,0.30)' : 'rgba(34,211,238,0.45)');
  const bg = isPixel ? 'var(--px-surface)' : (isLight ? '#ffffff' : '#1c1c1e');
  const surface = isPixel ? 'var(--px-muted)' : (isLight ? '#f3f4f6' : '#2c2c2e');
  const surfaceHover = isPixel ? 'var(--px-yellow)' : (isLight ? '#e5e7eb' : '#3a3a3c');
  const text = isPixel ? 'var(--px-ink)' : (isLight ? '#1c1c1e' : '#e5e5e7');
  const subText = isPixel ? 'var(--px-ink-soft)' : (isLight ? '#6b7280' : '#9ca3af');
  const border = isPixel ? 'var(--px-ink)' : (isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)');

  // 节点尺寸（持久化到 data.size，避免每次渲染重置）
  const initialSize = (d?.size && typeof d.size.w === 'number') ? d.size : { w: 320, h: 440 };
  const [size, setSize] = useState<{ w: number; h: number }>(initialSize);
  const [showEditor, setShowEditor] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [searchVisible, setSearchVisible] = useState(!!searchQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [transferMsg, setTransferMsg] = useState('');

  // ===================== 运行器侧 hooks (始终调用以保证 hooks 顺序稳定) =====================
  const hasAutoOutput = useHasAutoOutput(id);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const mountedRef = useRef(true);
  const currentPollKeyRef = useRef<string | null>(taskId ? rhToolsPollKey(id, taskId) : null);
  const [fetchingInfo, setFetchingInfo] = useState(false);

  const setVisibleError = (message: string | null) => {
    if (mountedRef.current) setError(message);
  };

  const stopPoll = (tid?: string) => {
    const key = tid
      ? rhToolsPollKey(id, tid)
      : currentPollKeyRef.current || (taskId ? rhToolsPollKey(id, taskId) : null);
    if (!key) return;
    const entry = activeRHToolsPolls.get(key);
    if (entry) {
      window.clearInterval(entry.timer);
      activeRHToolsPolls.delete(key);
    }
    if (currentPollKeyRef.current === key) {
      currentPollKeyRef.current = null;
    }
  };
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 上游连接（响应式）
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

  // 上游素材聚合（与 RunningHubNode 一致）
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
  const setMaterialOrder = (newOrder: string[]) => update({ materialOrder: newOrder });
  const handleExcludeUpstreamMaterial = (m: Material) => {
    if (m.origin !== 'upstream') return;
    update({
      excludedMaterialIds: excludeMaterialId(excludedMaterialIds, m.id),
      materialOrder: materialOrder.filter((itemId) => itemId !== m.id),
    });
  };
  const handleRestoreExcludedMaterials = () => update({ excludedMaterialIds: [] });
  const src = `rh-tools:${id}`;

  const findUpstreamUrl = (kind: 'image' | 'video' | 'audio', idx = 0): string => {
    const arr = kind === 'image' ? orderedImages : kind === 'video' ? orderedVideos : orderedAudios;
    return arr[idx]?.url || '';
  };

  // 字段在同 kind 下的索引
  const fieldKindIndex = useMemo(() => {
    const m: Record<string, number> = {};
    const counters: Record<string, number> = { image: 0, video: 0, audio: 0 };
    const list: any[] = appInfo?.nodeInfoList || [];
    for (const it of list) {
      const vt = inferRhToolsValueType(it?.fieldType);
      if (vt === 'image' || vt === 'video' || vt === 'audio') {
        m[paramKey(it.nodeId, it.fieldName)] = counters[vt]++;
      }
    }
    return m;
  }, [appInfo]);

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

  // 媒体字段随上游 url 自动同步
  useEffect(() => {
    const list: any[] = appInfo?.nodeInfoList;
    if (!Array.isArray(list) || list.length === 0) return;
    let changed = false;
    const next = { ...paramValues };
    const counters: Record<string, number> = { image: 0, video: 0, audio: 0 };
    for (const it of list) {
      const vt = inferRhToolsValueType(it?.fieldType);
      if (vt !== 'image' && vt !== 'video' && vt !== 'audio') continue;
      const k = paramKey(it.nodeId, it.fieldName);
      const cur = next[k];
      const idx = counters[vt]++;
      const upUrl = findUpstreamUrl(vt, idx);
      if (!upUrl) continue;
      if (cur?.sourceFromUpstream === false) continue;
      if (cur?.sourceFromUpstream === true) {
        if (upUrl !== cur.value) {
          next[k] = { ...cur, value: upUrl };
          changed = true;
        }
      } else {
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

  // 同步重算最新 paramValues（避免 React state 异步陷阱）
  const computeFreshValuesNow = (
    list: any[] | undefined,
  ): Record<string, RhParamValue> => {
    const next: Record<string, RhParamValue> = { ...paramValues };
    if (!Array.isArray(list)) return next;
    const counters: Record<string, number> = { image: 0, video: 0, audio: 0 };
    for (const it of list) {
      const vt = inferRhToolsValueType(it?.fieldType);
      if (vt !== 'image' && vt !== 'video' && vt !== 'audio') continue;
      const k = paramKey(it.nodeId, it.fieldName);
      const cur = next[k];
      const idx = counters[vt]++;
      if (cur?.sourceFromUpstream === false) continue;
      const upUrl = findUpstreamUrl(vt, idx);
      if (!upUrl) continue;
      next[k] = { value: upUrl, sourceFromUpstream: true };
    }
    return applyRhTextBindings(list, orderedTexts, next);
  };

  // 收集上游 RhConfig nodeInfoList（保留兼容）
  const collectUpstreamConfigList = () => {
    const list: any[] = [];
    for (const n of upstreamNodes) {
      const arr = (n?.data as any)?.nodeInfoList;
      if (Array.isArray(arr)) list.push(...arr);
    }
    return list;
  };

  const buildRawNodeInfoList = (
    overrideList?: any[],
    overrideValues?: Record<string, RhParamValue>,
  ): any[] => {
    const seen = new Set<string>();
    const out: any[] = [];
    const list: any[] = overrideList ?? appInfo?.nodeInfoList ?? [];
    const values = overrideValues ?? paramValues;
    for (const it of list) {
      const k = paramKey(it.nodeId, it.fieldName);
      const vt = inferRhToolsValueType(it?.fieldType);
      const v = values[k]?.value;
      const finalVal = v != null && v !== '' ? v : extractRhToolsDefaultValue(it);
      const submitVal =
        vt === 'text'
          ? resolveMediaMentions(String(finalVal), getParamMentions(k), mentionMaterials)
          : finalVal;
      seen.add(k);
      out.push({ nodeId: it.nodeId, fieldName: it.fieldName, fieldValue: submitVal, valueType: vt });
    }
    const upstreamList = collectUpstreamConfigList();
    for (const it of upstreamList) {
      const k = paramKey(it?.nodeId, it?.fieldName);
      if (seen.has(k)) continue;
      out.push(it);
    }
    return out;
  };

  const handleExportBackup = () => {
    const payload: RHToolsBackup = {
      schema: 't8-rh-tools',
      version: 1,
      exportedAt: new Date().toISOString(),
      categories,
      tools,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `t8-rh-tools-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setTransferMsg(`已导出 ${categories.length} 个分类 / ${tools.length} 个应用`);
  };

  const handleImportBackup = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!importBackup) {
      setTransferMsg('导入失败：RH 超市服务未就绪');
      return;
    }
    try {
      const json = JSON.parse(await file.text());
      const payload: RHToolsBackup = {
        schema: json?.schema || 't8-rh-tools',
        version: Number(json?.version || 1),
        exportedAt: json?.exportedAt,
        categories: Array.isArray(json?.categories) ? json.categories : [],
        tools: Array.isArray(json?.tools) ? json.tools : [],
      };
      if (payload.categories.length === 0 && payload.tools.length === 0) {
        setTransferMsg('导入失败：文件里没有 RH 超市数据');
        return;
      }
      const ok = window.confirm(
        `导入将覆盖当前 RH 超市数据。\n\n文件中包含 ${payload.categories.length} 个分类 / ${payload.tools.length} 个应用，是否继续?`,
      );
      if (!ok) return;
      const success = await importBackup(payload, 'replace');
      setTransferMsg(success ? `导入完成：${payload.categories.length} 个分类 / ${payload.tools.length} 个应用` : '导入失败：后端写入失败');
    } catch (err) {
      console.error(err);
      setTransferMsg('导入失败：JSON 解析错误');
    }
  };

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
        if (v.includes('\n')) {
          const first = v.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0] || '';
          logBus.warn(`多行 fieldValue 检测到-${fieldName}，仅保留首行`, src);
          v = first;
        }
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
              logBus.debug(`字段 ${fieldName} 从上游覆写 → ${upUrl}`, src);
              v = upUrl;
            }
          }
        }
        if (!v) continue;
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

  // Promise 化轮询（让 useRunTrigger 等到任务真正完成才 markDone）
  const startPolling = (tid: string): Promise<void> => {
    const key = rhToolsPollKey(id, tid);
    const existing = activeRHToolsPolls.get(key);
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
        if (activeRHToolsPolls.get(key)?.timer === timer) {
          activeRHToolsPolls.delete(key);
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
          setVisibleError('轮询超时');
          finish(false, new Error('轮询超时'));
          return;
        }
        try {
          const r = await queryRh(tid);
          if (elapsed % 6 === 0) {
            logBus.debug(`[${elapsed * 5}s] status=${r.status} code=${r.code} urls=${r.urls?.length || 0}`, src);
          }
          if (r.status === 'SUCCESS') {
            const list: string[] = Array.isArray(r.urls) ? r.urls : [];
            const patch: any = { status: 'success', ...buildRhToolsOutputStateFromUrls(list) };
            logBus.success(`任务完成 · ${list.length} 个输出 → ${list[0] || ''}`, src);
            update(patch);
            finish(true);
          } else if (r.status === 'FAILED') {
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
            setVisibleError(reason);
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
          logBus.warn(`轮询出错: ${e?.message || e}`, src);
        }
      }, POLL_INT);
    });
    if (timer != null) {
      activeRHToolsPolls.set(key, { timer, promise });
    }
    return promise;
  };

  const handleFetchInfo = async (): Promise<{
    list: any[];
    paramValues: Record<string, RhParamValue>;
  } | null> => {
    setVisibleError(null);
    if (!webappId) {
      setVisibleError('请先选择应用');
      return null;
    }
    setFetchingInfo(true);
    try {
      const info = await fetchRhAppInfo(webappId);
      const list: any[] = info?.nodeInfoList || [];
      logBus.info(`拉取应用信息 · webappId=${webappId} · ${list.length} 个字段`, src);
      const next: Record<string, RhParamValue> = { ...paramValues };
      for (const it of list) {
        const k = paramKey(it.nodeId, it.fieldName);
        const vt = inferRhToolsValueType(it?.fieldType);
        if (k in next) continue;
        if (vt === 'image' || vt === 'video' || vt === 'audio') {
          const upUrl = findUpstreamUrl(vt);
          next[k] = { value: upUrl || '', sourceFromUpstream: true };
          continue;
        }
        next[k] = { value: extractRhToolsDefaultValue(it) };
      }
      const withTextBindings = applyRhTextBindings(list, orderedTexts, next);
      update({ appInfo: info, paramValues: withTextBindings });
      return { list, paramValues: withTextBindings };
    } catch (e: any) {
      setVisibleError(e?.message || '查询失败');
      logBus.error(`拉取应用信息失败: ${e?.message || e}`, src);
      return null;
    } finally {
      setFetchingInfo(false);
    }
  };

  // 自动拉取：activeApp 有效 + 上游有媒体 + 还未拉过 appInfo 时静默拉一次
  // 也支持「webappId 与 appInfo 不匹配」时主动重拉（用户切换应用）
  const autoFetchedRef = useRef<string>('');
  useEffect(() => {
    if (!activeAppId || !webappId) return;
    if (fetchingInfo) return;
    if (autoFetchedRef.current === activeAppId) return;
    // appInfo 还在但 webappId 已经变 → 视为旧数据
    const lastWebappId = appInfo?.webappId;
    if (appInfo && lastWebappId && lastWebappId === webappId) {
      autoFetchedRef.current = activeAppId;
      return;
    }
    autoFetchedRef.current = activeAppId;
    void handleFetchInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAppId, webappId]);

  useEffect(() => {
    if (status !== 'polling' || !taskId || !activeAppId || !webappId) return;
    void startPolling(taskId).catch(() => undefined);
    // startPolling 本身由节点当前 data 派生，内部有全局去重；这里故意只跟随持久化运行态恢复轮询。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, taskId, activeAppId, webappId]);

  const handleRun = async () => {
    setVisibleError(null);
    if (!webappId) {
      setVisibleError('请先选择应用');
      return;
    }
    let freshList: any[] | null = null;
    let freshValues: Record<string, RhParamValue> | null = null;
    if (!appInfo?.nodeInfoList?.length) {
      const r = await handleFetchInfo();
      if (r) {
        freshList = r.list;
        freshValues = r.paramValues;
      } else {
        return; // 拉取失败直接退出
      }
    }
    const effectiveList = freshList ?? appInfo?.nodeInfoList ?? [];
    const effectiveValues = freshValues ?? computeFreshValuesNow(effectiveList);
    if (Object.keys(effectiveValues).length > 0) {
      update({ paramValues: effectiveValues });
    }
    update({
      status: 'submitting',
      error: null,
      taskId: null,
      rhProgress: '5%',
      rhQueueHint: '任务提交中',
      ...emptyRhToolsOutputState(),
    });
    try {
      const rawList = buildRawNodeInfoList(effectiveList, effectiveValues);
      const nodeInfoList = await resolveNodeInfoList(rawList);
      logBus.info(`提交任务 · webappId=${webappId} · ${nodeInfoList.length} 个字段`, src);
      const r = await submitRh({
        webappId,
        nodeInfoList,
        instanceType: instanceType || undefined,
      });
      logBus.success(`异步任务已提交 taskId=${r.taskId} 进入轮询…`, src);
      update({ status: 'polling', taskId: r.taskId, rhProgress: '5%', rhQueueHint: '任务队列排队中' });
      await startPolling(r.taskId);
    } catch (e: any) {
      logBus.error(`提交失败: ${e?.message || e}`, src);
      setVisibleError(e?.message || '提交失败');
      update({ status: 'error', error: e?.message });
    }
  };

  // 接入运行总线（循环器/批量执行）
  useRunTrigger(id, async () => {
    if (!activeAppId || !webappId) return; // 启动器视图不可被调起
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
        providerId: 'runninghub',
        providerModel: webappId,
      });
      stopPoll(taskId);
      update({
        status: 'cancelled',
        error: null,
        rhProgress: '100%',
        rhQueueHint: cancelled.message || '任务已取消',
        urls: [],
        imageUrl: '',
        imageUrls: [],
        videoUrl: '',
        videoUrls: [],
        audioUrl: '',
        audioUrls: [],
      });
      logBus.warn(cancelled.message || '用户已取消任务', src);
    } catch (e: any) {
      setVisibleError(e?.message || '取消任务失败');
      logBus.error(`取消失败: ${e?.message || e}`, src);
    } finally {
      setIsCancelling(false);
    }
  };

  const isBusy = status === 'submitting' || status === 'polling' || isCancelling;
  const nodeInfoList: any[] = appInfo?.nodeInfoList || [];

  // 启动器：过滤后的工具列表
  const filteredTools = useMemo(() => {
    let list = tools;
    if (activeCategoryId === UNCATEGORIZED) {
      list = list.filter((t) => !t.categoryId || !categories.find((c) => c.id === t.categoryId));
    } else if (activeCategoryId !== ALL) {
      list = list.filter((t) => t.categoryId === activeCategoryId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim();
      list = list.filter((t) => fuzzyMatch(`${t.title} ${t.description || ''}`, q));
    }
    return list;
  }, [tools, categories, activeCategoryId, searchQuery]);

  const previewApp = useMemo(() => {
    if (hoveredId) return tools.find((t) => t.id === hoveredId);
    return undefined;
  }, [hoveredId, tools]);

  // ===== 持久化尺寸 =====
  const handleResize = (_e: any, p: { width: number; height: number }) => {
    setSize({ w: p.width, h: p.height });
    update({ size: { w: p.width, h: p.height } });
  };

  const appInfoFieldCount = Array.isArray(appInfo?.nodeInfoList) ? appInfo.nodeInfoList.length : 0;
  useEffect(() => {
    const raf = window.requestAnimationFrame(() => updateNodeInternals(id));
    return () => window.cancelAnimationFrame(raf);
  }, [id, updateNodeInternals, activeAppId, size.w, size.h, selected, status, searchVisible, appInfoFieldCount]);

  return activeApp ? (
    <RHToolsNodeRunnerView
      activeApp={activeApp}
      webappId={webappId}
      selected={selected}
      size={size}
      accent={accent}
      accentSoft={accentSoft}
      ringColor={ringColor}
      bg={bg}
      surface={surface}
      text={text}
      subText={subText}
      border={border}
      isLight={isLight}
      isDark={isDark}
      isPixel={isPixel}
      fetchingInfo={fetchingInfo}
      instanceType={instanceType}
      status={status}
      taskId={taskId}
      rhProgress={rhProgress}
      rhQueueHint={rhQueueHint}
      urls={urls}
      error={error}
      isBusy={isBusy}
      isCancelling={isCancelling}
      hasAutoOutput={hasAutoOutput}
      nodeInfoList={nodeInfoList}
      paramValues={paramValues}
      fieldKindIndex={fieldKindIndex}
      orderedTexts={orderedTexts}
      orderedImages={orderedImages}
      orderedVideos={orderedVideos}
      orderedAudios={orderedAudios}
      mentionMaterials={mentionMaterials}
      excludedUpstreamCount={excludedUpstreamCount}
      materialOrder={materialOrder}
      onResize={handleResize}
      onBack={() => {
        stopPoll();
        update({
          rhToolsActiveAppId: '',
          appInfo: null,
          paramValues: {},
          materialOrder: [],
          instanceType: '',
          status: 'idle',
          taskId: '',
          urls: [],
          error: '',
          rhCode: 0,
          imageUrl: '',
          videoUrl: '',
          audioUrl: '',
        });
      }}
      onFetchInfo={handleFetchInfo}
      onRun={handleRun}
      onStop={handleStop}
      onMaterialOrderChange={setMaterialOrder}
      onExcludeUpstreamMaterial={handleExcludeUpstreamMaterial}
      onRestoreExcludedMaterials={handleRestoreExcludedMaterials}
      onInstanceTypeChange={(value) => update({ instanceType: value })}
      findUpstreamUrl={findUpstreamUrl}
      getParamMentions={getParamMentions}
      setParam={setParam}
      setTextParam={setTextParam}
    />
  ) : (
    <RHToolsNodeLauncherView
      selected={selected}
      size={size}
      accent={accent}
      accentSoft={accentSoft}
      ringColor={ringColor}
      bg={bg}
      surface={surface}
      surfaceHover={surfaceHover}
      text={text}
      subText={subText}
      border={border}
      isLight={isLight}
      activeCategoryId={activeCategoryId}
      searchQuery={searchQuery}
      searchVisible={searchVisible}
      transferMsg={transferMsg}
      categories={[{ id: ALL, name: '全部' }, { id: UNCATEGORIZED, name: '未分类' }, ...categories.map((category) => ({ id: category.id, name: category.name }))]}
      tools={tools}
      filteredTools={filteredTools}
      hoveredId={hoveredId}
      previewApp={previewApp}
      showEditor={showEditor}
      searchInputRef={searchInputRef}
      importInputRef={importInputRef}
      onResize={handleResize}
      onToggleSearch={() => {
        setSearchVisible((visible) => {
          const next = !visible;
          if (next) setTimeout(() => searchInputRef.current?.focus(), 0);
          else update({ rhToolsSearchQuery: '' });
          return next;
        });
      }}
      onSearchChange={(value) => update({ rhToolsSearchQuery: value })}
      onOpenEditor={() => setShowEditor(true)}
      onExportBackup={handleExportBackup}
      onTriggerImport={() => importInputRef.current?.click()}
      onImportBackup={handleImportBackup}
      onSelectCategory={(categoryId) => update({ rhToolsActiveCategoryId: categoryId })}
      onSelectTool={(toolId) => {
        update({
          rhToolsActiveAppId: toolId,
          appInfo: null,
          paramValues: {},
          materialOrder: [],
          instanceType: '',
          status: 'idle',
          taskId: '',
          urls: [],
          error: '',
          rhCode: 0,
          imageUrl: '',
          videoUrl: '',
          audioUrl: '',
        });
      }}
      onHoverTool={(toolId) => setHoveredId(toolId)}
      onCloseEditor={() => setShowEditor(false)}
    />
  );
};

export default memo(RHToolsNode);
