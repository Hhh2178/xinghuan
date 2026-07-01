import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Moon, Sun, Wifi, WifiOff, Sparkles, Library, LogOut, UserRound, Bell, Gauge } from 'lucide-react';
import { useThemeStore } from './stores/theme';
import { usePerformanceModeStore } from './stores/performanceMode';
import { useApiKeysStore } from './stores/apiKeys';
import { useModelCatalogStore } from './stores/modelCatalog';
import { useShortcutStore } from './stores/shortcuts';
import { AnnouncementCenterDrawer } from './components/AnnouncementCenterDrawer';
import { AnnouncementStrongReminderModal } from './components/AnnouncementStrongReminderModal';
import LoginGate from './components/LoginGate';
import ErrorBoundary from './components/ErrorBoundary';
import CyberTransitionStage from './components/CyberTransitionStage';
import EmptyCanvasPreviewShell from './components/EmptyCanvasPreviewShell';
import * as api from './services/api';
import brandStellarGlitchLogo from './assets/brand-stellar-glitch-logo.png';
import type { NodeType } from './types/canvas';
import type { AuthUser, GenerationLibraryItem, ResourceItem } from './services/api';
import { useAnnouncements } from './hooks/useAnnouncements';
import { applyThemeTemplate } from './theme/applyTheme';
import { resolveThemeTemplate } from './theme/defaultTemplates';
import { materialSetItemsToData, type MaterialSetKind, type MaterialSetItem } from './utils/materialSet';
import { createLazyImportWithReloadRecovery } from './utils/lazyImportRecovery';
import { resolveWorkflowResourceFragment } from './utils/workflowResource';
import { matchesAnyShortcut } from './utils/keyboardShortcuts';
import { applyVisualPerformanceMode } from './utils/visualPerformanceMode';
import {
  buildPortraitPrompt,
  normalizePortraitLocks,
  normalizePortraitSelection,
  normalizePortraitWeights,
  portraitSelectionStats,
  resolvePortraitPreview,
  summarizePortraitSelection,
  type PortraitLanguage,
} from './data/portraitMasterOptions';

const Sidebar = lazy(createLazyImportWithReloadRecovery(() => import('./components/Sidebar')));
const Canvas = lazy(createLazyImportWithReloadRecovery(() => import('./components/Canvas')));
const ResourceLibraryDrawer = lazy(createLazyImportWithReloadRecovery(() => import('./components/ResourceLibraryDrawer')));
const GenerationLibraryDrawer = lazy(createLazyImportWithReloadRecovery(() => import('./components/GenerationLibraryDrawer')));
const MaterialContextMenu = lazy(createLazyImportWithReloadRecovery(() => import('./components/MaterialContextMenu')));
const RHToolsProvider = lazy(() =>
  createLazyImportWithReloadRecovery(() =>
    import('./providers/RHToolsProvider').then((module) => ({ default: module.RHToolsProvider })),
  )(),
);
const preloadRHToolsProvider = createLazyImportWithReloadRecovery(() =>
  import('./providers/RHToolsProvider').then((module) => ({ default: module.RHToolsProvider })),
);
const preloadWorkspaceShell = Promise.all([
  createLazyImportWithReloadRecovery(() => import('./components/Sidebar'))(),
  createLazyImportWithReloadRecovery(() => import('./components/Canvas'))(),
  preloadRHToolsProvider(),
]);

type AddNodeFn = import('./components/Canvas').AddNodeFn;
type InsertWorkflowFn = import('./components/Canvas').InsertWorkflowFn;

// vite.config 注入的编译期常量（与 package.json 同步），勿硬编码 v1.x.x
declare const __APP_VERSION__: string;

function isShortcutTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable ||
    Boolean(target.closest('[contenteditable="true"]'))
  );
}

function safePortraitLanguage(value: unknown): PortraitLanguage {
  return value === 'zh' ? 'zh' : 'en';
}

function getDevPreviewMode(): 'login' | 'transition' | 'empty-canvas' | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('preview');
  return raw === 'login' || raw === 'transition' || raw === 'empty-canvas' ? raw : null;
}

function portraitResourceToNodeData(item: ResourceItem): Record<string, any> | null {
  if (item.kind !== 'set' || item.materialSetKind !== 'text' || !Array.isArray(item.materialSetItems)) return null;
  const rawText = item.materialSetItems
    .map((entry) => String(entry.text || '').trim())
    .find((text) => text.includes('"t8-portrait-master"'));
  if (!rawText) return null;
  try {
    const parsed = JSON.parse(rawText);
    if (!parsed || parsed.schema !== 't8-portrait-master') return null;
    const selection = normalizePortraitSelection(parsed.selection);
    const locks = normalizePortraitLocks(parsed.locks);
    const weights = normalizePortraitWeights(parsed.weights);
    const customText = typeof parsed.customText === 'string' ? parsed.customText : '';
    const language = safePortraitLanguage(parsed.language);
    const prompt = buildPortraitPrompt({ selection, weights, customText, language });
    return {
      portraitLanguage: language,
      portraitSelection: selection,
      portraitLocks: locks,
      portraitWeights: weights,
      portraitCustomText: customText,
      prompt,
      text: prompt,
      outputText: prompt,
      portraitMetadata: {
        schema: 't8-portrait-master',
        version: 1,
        selection,
        locks,
        weights,
        customText,
        language,
        prompt,
        preview: resolvePortraitPreview(selection),
      },
      portraitSummary: summarizePortraitSelection(selection, 'zh'),
      portraitStats: portraitSelectionStats(selection),
      portraitSchemaVersion: 1,
    };
  } catch {
    return null;
  }
}

function poseBackupToNodeData(value: unknown): Record<string, any> | null {
  const raw = value && typeof value === 'object' ? (value as Record<string, any>) : null;
  const backup = raw?.schema === 't8-pose-master-resource' ? raw.poseBackup : raw;
  if (!backup || typeof backup !== 'object' || (backup as any).schema !== 't8-pose-master') return null;
  const pose = backup as Record<string, any>;
  const people = Array.isArray(pose.people)
    ? pose.people
    : pose.hasPeople === false
      ? []
      : pose.points
        ? [pose.points]
        : [];
  const prompt = typeof pose.prompt === 'string' ? pose.prompt : '';
  return {
    kind: 'pose-master',
    posePoints: pose.points,
    posePointVersion: Number(pose.pointVersion) || 4,
    poseHasPeople: pose.hasPeople !== false,
    posePeople: people,
    poseActivePersonIndex: 0,
    poseHandControls: pose.handControls,
    posePresetId: typeof pose.presetId === 'string' ? pose.presetId : 'standing',
    poseViewId: typeof pose.viewId === 'string' ? pose.viewId : 'front',
    poseShotId: typeof pose.shotId === 'string' ? pose.shotId : 'full-body',
    poseIntensityId: typeof pose.intensityId === 'string' ? pose.intensityId : 'natural',
    poseLanguage: pose.language === 'zh' ? 'zh' : 'en',
    poseCustomText: typeof pose.custom === 'string' ? pose.custom : '',
    poseCanvasRatioId: typeof pose.canvasRatioId === 'string' ? pose.canvasRatioId : 'default',
    poseCanvasCustomWidth: Number(pose.canvasCustomWidth) || 620,
    poseCanvasCustomHeight: Number(pose.canvasCustomHeight) || 520,
    prompt,
    text: prompt,
    outputText: prompt,
    posePrompt: prompt,
    metadata: {
      schema: 't8-pose-master',
      resourceRestoredAt: Date.now(),
      sourceName: typeof pose.name === 'string' ? pose.name : '',
    },
  };
}

async function poseResourceToNodeData(item: ResourceItem): Promise<Record<string, any> | null> {
  if (item.kind !== 'pose' || !item.fileUrl) return null;
  const res = await fetch(item.fileUrl);
  if (!res.ok) throw new Error(`读取姿势资源失败: HTTP ${res.status}`);
  return poseBackupToNodeData(await res.json());
}

async function workflowResourceToFragment(item: ResourceItem) {
  return resolveWorkflowResourceFragment(item);
}

/**
 * T8-penguin-canvas 应用根组件 (Phase 1)
 * 布局: [侧边栏(画布管理 + 节点列表)] [画布主体] + 头部状态栏
 */
function App() {
  const { theme, style, templateId, toggleTheme } = useThemeStore();
  const performanceMode = usePerformanceModeStore((state) => state.mode);
  const { load: loadSettings } = useApiKeysStore();
  const { load: loadModelCatalog } = useModelCatalogStore();
  const shortcuts = useShortcutStore((s) => s.shortcuts);
  const [bootSplashVisible, setBootSplashVisible] = useState(true);
  const [workspaceShellReady, setWorkspaceShellReady] = useState(false);
  const currentTemplate = useMemo(
    () => resolveThemeTemplate(templateId),
    [templateId],
  );
  const [backendStatus, setBackendStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [authStatus, setAuthStatus] = useState<'checking' | 'ready'>('checking');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [resourceOpen, setResourceOpen] = useState(false);
  const [generationLibraryOpen, setGenerationLibraryOpen] = useState(false);
  const previewMode = getDevPreviewMode();
  const announcements = useAnnouncements(Boolean(currentUser));
  // 画布接收节点添加的 ref(从 Sidebar -> Canvas)
  const addNodeRef = useRef<AddNodeFn | null>(null);
  const insertWorkflowRef = useRef<InsertWorkflowFn | null>(null);

  useEffect(() => {
    if (!resourceOpen && !generationLibraryOpen) return;

    const onDocPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (
        target.closest('.t8-topbar') ||
        target.closest('.xh-announcement-drawer') ||
        target.closest('.xh-announcement-modal') ||
        target.closest('.resource-library-drawer') ||
        target.closest('.generation-library-drawer') ||
        target.closest('[data-canvas-floating-ui]') ||
        target.closest('.react-flow__node') ||
        target.closest('.react-flow__edge') ||
        target.closest('.react-flow__controls') ||
        target.closest('.react-flow__minimap') ||
        target.closest('.t8-control-rail')
      ) {
        return;
      }

      setResourceOpen(false);
      setGenerationLibraryOpen(false);
    };

    document.addEventListener('pointerdown', onDocPointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown, true);
    };
  }, [generationLibraryOpen, resourceOpen]);

  // 将主题状态注入 <html> 供 CSS 选择器使用
  useEffect(() => {
    const root = document.documentElement;
    applyThemeTemplate(currentTemplate, theme);
    // 全局禁用拼写检查(节点提示词为中文/@变量语法,不需红色波浪线干扰)
    // spellcheck 属性 HTML 标准上是可继承的 → 根上设一次,所有后代 textarea/input 都生效
    root.setAttribute('spellcheck', 'false');
    document.body.setAttribute('spellcheck', 'false');
  }, [currentTemplate, theme]);

  // 全局 MutationObserver: 为动态挂载的 textarea / input 自动设置 spellcheck=false
  // (Chromium 对 textarea 默认 spellcheck=true,不会从祖先继承 → 需逐个设置)
  //
  // 同时：全局为所有 textarea / input / select 添加 `nodrag` + `nowheel` className
  // — xyflow v12 识别 `nodrag` 后不触发节点拖动，避免「框选文字时整个节点跟着鼠标走」
  // — `nowheel` 让 textarea 内部可独立滚轮滚动，不被 xyflow 接管为画布缩放
  // — 不覆盖节点原有 className(classList.add 只追加)，零侵入
  useEffect(() => {
    const apply = (el: Element) => {
      const tag = el.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') {
        if (tag !== 'SELECT') {
          el.setAttribute('spellcheck', 'false');
          el.setAttribute('autocorrect', 'off');
          el.setAttribute('autocapitalize', 'off');
        }
        // xyflow noDragClassName / noWheelClassName 默认 'nodrag' / 'nowheel'
        // 加上后该元素上的 pointerdown 不会被 xyflow 当作节点拖拽启动
        el.classList.add('nodrag', 'nowheel');
      }
    };
    // 初始扫描
    document.querySelectorAll('textarea, input, select').forEach(apply);
    // 增量监听
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          const el = n as Element;
          apply(el);
          el.querySelectorAll?.('textarea, input, select').forEach(apply);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  // 启动探测后端
  useEffect(() => {
    const check = async () => {
      const ok = await api.checkBackendStatus();
      setBackendStatus(ok ? 'ok' : 'error');
    };
    check();
    const t = window.setInterval(check, 15_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    applyVisualPerformanceMode(root, performanceMode === 'optimized' ? 'reduced' : 'default');
  }, [performanceMode]);

  useEffect(() => {
    let alive = true;
    const startedAt = Date.now();
    api.getCurrentUser()
      .then((user) => {
        if (alive) setCurrentUser(user);
      })
      .catch(() => {
        if (alive) setCurrentUser(null);
      })
      .finally(() => {
        const remain = Math.max(0, 850 - (Date.now() - startedAt));
        window.setTimeout(() => {
          if (!alive) return;
          setAuthStatus('ready');
          window.setTimeout(() => {
            if (alive) setBootSplashVisible(false);
          }, 140);
        }, remain);
      });
    return () => {
      alive = false;
    };
  }, []);

  // 预加载 settings
  useEffect(() => {
    if (!currentUser) return;
    loadSettings();
    loadModelCatalog();
  }, [currentUser, loadSettings, loadModelCatalog]);

  useEffect(() => {
    let alive = true;
    if (!currentUser) {
      setWorkspaceShellReady(false);
      return () => {
        alive = false;
      };
    }
    setWorkspaceShellReady(false);
    preloadWorkspaceShell
      .then(() => {
        if (alive) setWorkspaceShellReady(true);
      })
      .catch(() => {
        if (alive) setWorkspaceShellReady(true);
      });
    return () => {
      alive = false;
    };
  }, [currentUser]);

  // 资源库快捷键：未选中任何节点时打开 / 关闭资源库。输入框内不拦截，避免打断提示词编辑。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!matchesAnyShortcut(shortcuts['global.resource-library'], e)) return;
      if (e.repeat) return;
      if (isShortcutTypingTarget(e.target)) return;
      if (document.querySelector('.react-flow__node.selected')) return;
      e.preventDefault();
      setResourceOpen((open) => !open);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcuts]);

  const isDark = theme === 'dark';
  const isPixel = style === 'pixel';
  const isOp = currentTemplate.visuals?.style === 'op';
  const isRh = currentTemplate.visuals?.style === 'rh';
  const isNaruto = currentTemplate.visuals?.style === 'naruto';
  const isEva = currentTemplate.visuals?.style === 'eva';
  const isYyh = currentTemplate.visuals?.style === 'yyh';
  const isSlamdunk = currentTemplate.visuals?.style === 'slamdunk';
  const isSoccer = currentTemplate.visuals?.style === 'soccer-hero';
  const utilityButtonClassName = isPixel
    ? 'px-btn px-btn--sm'
    : 'relative flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors border';
  const announcementButtonClassName = isPixel
    ? `${utilityButtonClassName} px-btn--ghost`
    : `${utilityButtonClassName} bg-cyan-500/10 border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/20`;
  const resourceButtonClassName = isPixel
    ? `${utilityButtonClassName} px-btn--mint`
    : `${utilityButtonClassName} bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-300 hover:bg-fuchsia-500/20`;
  const generationButtonClassName = isPixel
    ? `${utilityButtonClassName} px-btn--yellow`
    : `${utilityButtonClassName} bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20`;
  const performanceButtonClassName = isPixel
    ? `${utilityButtonClassName} px-btn--ghost`
    : `${utilityButtonClassName} bg-sky-500/10 border-sky-500/30 text-sky-200 hover:bg-sky-500/20`;

  const handleAddNode = (type: NodeType) => {
    addNodeRef.current?.(type);
  };

  const handleInsertResource = async (item: ResourceItem) => {
    const portraitData = portraitResourceToNodeData(item);
    if (portraitData) {
      addNodeRef.current?.('portrait-master', { data: portraitData });
      void api.updateResourceItem(item.id, { touch: true });
      return;
    }
    if (item.kind === 'pose') {
      const poseData = await poseResourceToNodeData(item);
      if (!poseData) throw new Error('姿势资源格式无效');
      addNodeRef.current?.('pose-master', { data: poseData });
      void api.updateResourceItem(item.id, { touch: true });
      return;
    }
    if (item.kind === 'workflow') {
      const fragment = await workflowResourceToFragment(item);
      if (!fragment) throw new Error('工作流资源格式无效');
      insertWorkflowRef.current?.(fragment, { title: item.title || '工作流' });
      void api.updateResourceItem(item.id, { touch: true });
      return;
    }
    if (item.kind === 'set' && item.materialSetKind && item.materialSetItems?.length) {
      addNodeRef.current?.('material-set', {
        data: materialSetItemsToData(
          item.materialSetKind as MaterialSetKind,
          item.materialSetItems as MaterialSetItem[],
        ),
      });
      return;
    }
    const data: Record<string, any> = {
      uploadType: item.kind,
      fileName: item.title || item.originalName || '资源库素材',
      fileSize: item.size || 0,
      mime: item.mime || '',
    };
    if (item.kind === 'image') {
      data.imageUrl = item.fileUrl;
    } else if (item.kind === 'video') {
      data.videoUrl = item.fileUrl;
    } else if (item.kind === 'audio') {
      data.audioUrl = item.fileUrl;
    }
    addNodeRef.current?.('upload', { data });
  };

  const handleInsertGeneration = async (item: GenerationLibraryItem) => {
    const data: Record<string, any> = {
      uploadType: item.kind,
      fileName: item.title || '生成素材',
      fileSize: item.size || 0,
      mime: item.mime || '',
    };
    if (item.kind === 'image') {
      data.imageUrl = item.fileUrl;
      data.imageUrls = [item.fileUrl];
    } else if (item.kind === 'video') {
      data.videoUrl = item.fileUrl;
      data.videoUrls = [item.fileUrl];
    } else if (item.kind === 'audio') {
      data.audioUrl = item.fileUrl;
      data.audioUrls = [item.fileUrl];
    }
    addNodeRef.current?.('upload', { data });
  };

  const handleLogout = async () => {
    await api.logout().catch(() => undefined);
    setCurrentUser(null);
  };

  const handlePerformanceModeToggle = () => {
    const nextMode = performanceMode === 'optimized' ? 'normal' : 'optimized';
    usePerformanceModeStore.getState().setMode(nextMode);
    window.location.reload();
  };

  if (previewMode === 'transition') {
    return <CyberTransitionStage />;
  }

  if (previewMode === 'login') {
    return <LoginGate onLogin={() => undefined} />;
  }

  if (previewMode === 'empty-canvas') {
    return <EmptyCanvasPreviewShell backendStatus={backendStatus} />;
  }

  if (authStatus === 'checking' || bootSplashVisible || (Boolean(currentUser) && !workspaceShellReady)) {
    return <CyberTransitionStage />;
  }

  if (!currentUser) {
    return <LoginGate onLogin={setCurrentUser} />;
  }

  return (
    <Suspense fallback={null}>
    <RHToolsProvider>
    <div
      className={`t8-app-shell h-screen flex flex-col overflow-hidden ${
        isPixel ? '' : isDark ? 'bg-zinc-950 text-white' : 'bg-zinc-50 text-zinc-900'
      } ${isOp ? 't8-app-shell--op' : ''} ${isRh ? 't8-app-shell--rh' : ''} ${isNaruto ? 't8-app-shell--naruto' : ''} ${isEva ? 't8-app-shell--eva' : ''} ${isYyh ? 't8-app-shell--yyh' : ''} ${isSlamdunk ? 't8-app-shell--slamdunk' : ''} ${isSoccer ? 't8-app-shell--soccer' : ''}`}
      style={{ background: 'var(--t8-bg-app)', color: 'var(--t8-text-main)' }}
    >
      {/* 头部状态栏 */}
      <header
        className={`t8-topbar flex items-center justify-between px-4 py-2 border-b ${
          isPixel
            ? 'px-panel'
            : isDark
              ? 'bg-zinc-900 border-white/10'
              : 'bg-white border-black/10'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <img className="xh-cyber-topbar-logo xh-cyber-topbar-logo--large" src={brandStellarGlitchLogo} alt="星幻画布" />
          <span
            className={
              isPixel
                ? 'px-chip px-chip--mint text-[10px]'
                : `t8-topbar-status-chip text-[10px] px-1.5 py-0.5 rounded ${
                    isDark ? 'bg-white/10 text-white/60' : 'bg-black/5 text-zinc-500'
                  }`
            }
          >
            v{__APP_VERSION__}
          </span>
          {/* 后端状态 */}
          {isPixel ? (
            <span
              className={`px-chip ${
                backendStatus === 'ok'
                  ? 'px-chip--mint'
                  : backendStatus === 'error'
                    ? 'px-chip--pink'
                    : 'px-chip--yellow'
              }`}
            >
              {backendStatus === 'ok' ? <Wifi size={11} /> : <WifiOff size={11} />}
              {backendStatus === 'ok' && '后端已连接'}
              {backendStatus === 'error' && '后端未连接'}
              {backendStatus === 'checking' && '检测中...'}
            </span>
          ) : (
            <div
              className={`t8-topbar-status-chip flex items-center gap-1.5 text-[11px] ${
                backendStatus === 'ok'
                  ? 'text-emerald-400'
                  : backendStatus === 'error'
                    ? 'text-red-400'
                    : 'text-yellow-400'
              }`}
            >
              {backendStatus === 'ok' ? <Wifi size={12} /> : <WifiOff size={12} />}
              {backendStatus === 'ok' && '后端已连接'}
              {backendStatus === 'error' && '后端未连接'}
              {backendStatus === 'checking' && '检测中...'}
            </div>
          )}
          <span className="t8-topbar-status-chip flex items-center gap-1.5 text-[11px] text-cyan-100">
            <UserRound size={12} />
            {currentUser.name}
          </span>
          <button
            className="t8-icon-button"
            title="退出登录"
            type="button"
            onClick={handleLogout}
          >
            <LogOut size={14} />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={announcements.openDrawer}
            className={`${announcementButtonClassName} xh-topbar-pill--announcement`}
            title="公告中心"
          >
            <BellBadge unreadCount={announcements.unreadCount} />
          </button>
          <button
            onClick={() => {
              setGenerationLibraryOpen(false);
              setResourceOpen(true);
            }}
            className={resourceButtonClassName}
            title="资源库"
          >
            <Library size={14} />
            <span className="text-[11px]">资源库</span>
          </button>
          <button
            onClick={() => {
              setResourceOpen(false);
              setGenerationLibraryOpen(true);
            }}
            className={generationButtonClassName}
            title="生成库"
          >
            <Sparkles size={14} />
            <span className="text-[11px]">生成库</span>
          </button>
          <button
            type="button"
            className={`${performanceButtonClassName} xh-topbar-pill--performance ${performanceMode === 'optimized' ? 'is-active' : ''}`}
            title="切换性能优化模式"
            aria-pressed={performanceMode === 'optimized'}
            onClick={handlePerformanceModeToggle}
          >
            <span className="xh-topbar-pill--performance__label">
              <Gauge size={13} />
              <span className="text-[11px]">性能优化</span>
            </span>
            <span className="xh-topbar-pill--performance__rail" aria-hidden="true">
              <span className="xh-topbar-pill--performance__thumb" />
            </span>
          </button>
          <button
            onClick={toggleTheme}
            className={
              isPixel
                ? 'px-btn px-btn--icon px-btn--ghost'
                : `p-2 rounded-md ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`
            }
            title={`切换到${isDark ? '浅色' : '深色'}主题`}
          >
            {isDark ? <Sun size={isPixel ? 14 : 16} /> : <Moon size={isPixel ? 14 : 16} />}
          </button>
        </div>
      </header>

      {/* 主体两栏布局 */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar onAddNode={handleAddNode} />
        <ErrorBoundary fallbackTitle="画布渲染出错了，已被错误边界捕获">
          <Canvas onAddNodeRef={addNodeRef} onInsertWorkflowRef={insertWorkflowRef} />
        </ErrorBoundary>
      </div>

      <ResourceLibraryDrawer
        open={resourceOpen}
        onClose={() => setResourceOpen(false)}
        onInsertMaterial={handleInsertResource}
        currentUser={currentUser}
      />
      <GenerationLibraryDrawer
        open={generationLibraryOpen}
        onClose={() => setGenerationLibraryOpen(false)}
        onInsertMaterial={handleInsertGeneration}
      />
      <AnnouncementCenterDrawer
        open={announcements.drawerOpen}
        items={announcements.items}
        unreadCount={announcements.unreadCount}
        loading={announcements.loading}
        error={announcements.error}
        onClose={announcements.closeDrawer}
        onMarkRead={async (id) => {
          await announcements.markRead(id);
        }}
      />
      <AnnouncementStrongReminderModal
        announcement={announcements.strongReminder}
        onAcknowledge={announcements.dismissStrongReminder}
        onClose={announcements.dismissStrongReminder}
        onViewDetail={async (id) => {
          await announcements.dismissStrongReminder(id);
          announcements.openDrawer();
        }}
      />
      <MaterialContextMenu />
    </div>
    </RHToolsProvider>
    </Suspense>
  );
}

function BellBadge({ unreadCount }: { unreadCount: number }) {
  return (
    <>
      <Bell size={14} />
      <span className="xh-announcement-trigger__label">公告</span>
      {unreadCount > 0 ? <span className="xh-announcement-badge">{unreadCount > 99 ? '99+' : unreadCount}</span> : null}
    </>
  );
}

export default App;
