import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties, type DragEvent as ReactDragEvent, type RefObject } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  SelectionMode,
  Handle,
  Position,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceBetween,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceBetween,
  Bot,
  Copy,
  CopyPlus,
  Download,
  FolderPlus,
  Grid3x3,
  LayoutGrid,
  Library,
  Magnet,
  PackagePlus,
  Play,
  Send as SendIcon,
  Sparkles,
  Trash2,
  Workflow,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useCanvasStore } from '../stores/canvas';
import { useThemeStore } from '../stores/theme';
import { useShortcutStore } from '../stores/shortcuts';
import { getTemplateMode, resolveThemeTemplate } from '../theme/defaultTemplates';
import { useRunBusStore } from '../stores/runBus';
import { useGroupBusStore, GROUP_COLORS, DEFAULT_GROUP_NAME } from '../stores/groupBus';
import { GROUP_EXECUTION_MANAGER_NODE_TYPE, buildGroupExecutionManagerDataFromNodes, findGroupExecutionManagerNode, normalizeGroupExecutionManagerData, type GroupExecutionManagerData } from './canvas/groupExecutionManager';
import StellarCursorAura from './StellarCursorAura';
import { topologicalSort } from '../utils/topologicalSort';
import { installGlobalWheelBlockObserver } from '../utils/wheelBlock';
import { createLazyImportWithReloadRecovery } from '../utils/lazyImportRecovery';
// v1.2.10.5: 节点落点防重叠解析器 (单节点/整组双模式 + 兜底+toast+飞镜)
import {
  placeSingleNode,
  placeBatchNodes,
  defaultSizeOf,
  rectOf,
  type Rect as PlacementRect,
} from '../utils/nodePlacement';
import {
  createOutputDataFromItems,
  createUploadDataFromItems,
  createUploadReplacementData,
  fileNameFromUrl,
  getMediaItemsFromData,
  type MediaItem,
  type MediaKind,
} from '../utils/mediaCollection';
import { markCanvasNodesDeleted } from '../utils/deletedNodeRegistry';
import {
  bucketSendableMaterials,
  collectSendableMaterialsFromNode,
  collectSendableMaterialsFromNodes,
  sendableMaterialKey,
  sendableMaterialSignature,
  sendableToMediaItem,
  summarizeSendableMaterials,
  type SendTargetMode,
  type SendableMaterial,
} from '../utils/sendMaterials';
import {
  buildSendNodeFragment,
  instantiateSendNodeFragment,
  summarizeSendNodeFragment,
  type InstantiatedSendNodeFragment,
  type SendNodeFragment,
} from '../utils/sendNodeFragment';
import { createWorkflowResourceManifest } from '../utils/workflowResource';
import {
  assignFreshNodeSerials,
  findNodeBySerialId,
  getNodeSerialId,
  normalizeCanvasNodeSerials,
  parseNodeSerialInput,
} from '../utils/nodeSerialIds';
import { migrateImportedNodes } from '../utils/nodeMigration';
import { resolveConnectionByNodeSerialId } from '../utils/connectByNodeSerialId';
import { formatShortcutList, matchesAnyShortcut } from '../utils/keyboardShortcuts';
import { applyNodeAlignment, type NodeAlignAction } from '../utils/nodeAlign';
import {
  collectMaterialSetBucketsFromData,
  isMaterialSetKind,
  materialSetItemsToData,
  nonEmptyMaterialSetKinds,
  normalizeMaterialSetItems,
  type MaterialSetItem,
  type MaterialSetKind,
} from '../utils/materialSet';
import { chooseDefaultSendMode, resolveEffectiveSendMode } from '../utils/sendMode';
import * as api from '../services/api';
import { logBus } from '../stores/logs';
import CanvasToolbar from './CanvasToolbar';
import TerminalPanel from './TerminalPanel';
import NodeActionBar from './NodeActionBar';
import CanvasAssistant from './CanvasAssistant';
import MaterialDragOverlay from './MaterialDragOverlay';
import SendMaterialsModal from './SendMaterialsModal';
import { useCanvasHistory } from '../hooks/useCanvasHistory';
import type { CanvasTemplate } from '../config/canvasTemplates';
import { useCanvasPersistence } from './canvas/useCanvasPersistence';
import { useCanvasConnectionPanMode } from './canvas/useCanvasConnectionPanMode';
import { CanvasFlowOverlays } from './canvas/CanvasFlowOverlays';
import { useCanvasRuntime } from './canvas/useCanvasRuntime';
import { useCanvasViewportHotkeys } from './canvas/useCanvasViewportHotkeys';
import { CanvasOverlayLayer } from './canvas/CanvasOverlayLayer';
import { useCanvasSelectionMenus } from './canvas/useCanvasSelectionMenus';
import { useCanvasBulkReconnect } from './canvas/useCanvasBulkReconnect';
import { useCanvasSendFlow } from './canvas/useCanvasSendFlow';
import type { AuthUser } from '../services/api';
import {
  CANVAS_MAX_ZOOM,
  CANVAS_MIN_ZOOM,
  findLockedGroupForNode,
  getGroupBoxLiveMemberIds,
  isGroupBoxLocked,
  isGroupBoxNode,
} from './canvas/groupBoxGuards';
import EmptyCanvasSplash from './EmptyCanvasSplash';
import PlaceholderNode from './nodes/PlaceholderNode';
import TextNode from './nodes/TextNode';
const ImageNode = lazy(createLazyImportWithReloadRecovery(() => import('./nodes/ImageNode')));
const LLMNode = lazy(createLazyImportWithReloadRecovery(() => import('./nodes/LLMNode')));
const VideoNode = lazy(createLazyImportWithReloadRecovery(() => import('./nodes/VideoNode')));
const SeedanceNode = lazy(createLazyImportWithReloadRecovery(() => import('./nodes/SeedanceNode')));
import AudioNode from './nodes/AudioNode';
const RunningHubNode = lazy(createLazyImportWithReloadRecovery(() => import('./nodes/RunningHubNode')));
import RhConfigNode from './nodes/RhConfigNode';
const RHToolsNode = lazy(createLazyImportWithReloadRecovery(() => import('./nodes/RHToolsNode')));
const RHToolboxNode = lazy(createLazyImportWithReloadRecovery(() => import('./nodes/RHToolboxNode')));
import ComfyUIStoreNode from './nodes/ComfyUIStoreNode';
import ComfyUIAppMakerNode from './nodes/ComfyUIAppMakerNode';
import ResizeNode from './nodes/ResizeNode';
import UpscaleNode from './nodes/UpscaleNode';
import GridCropNode from './nodes/GridCropNode';
import GridEditorNode from './nodes/GridEditorNode';
import CombineNode from './nodes/CombineNode';
import RemoveBgNode from './nodes/RemoveBgNode';
const ImageCompareNode = lazy(createLazyImportWithReloadRecovery(() => import('./nodes/ImageCompareNode')));
const ToolboxParamNode = lazy(createLazyImportWithReloadRecovery(() => import('./nodes/ToolboxParamNode')));
const PortraitMasterNode = lazy(createLazyImportWithReloadRecovery(() => import('./nodes/PortraitMasterNode')));
const PoseMasterNode = lazy(createLazyImportWithReloadRecovery(() => import('./nodes/PoseMasterNode')));
import IdeaNode from './nodes/IdeaNode';
import BpNode from './nodes/BpNode';
import RelayNode from './nodes/RelayNode';
import RemoveAiWatermarkNode from './nodes/RemoveAiWatermarkNode';
import VideoOutputNode from './nodes/VideoOutputNode';
import PortraitMetadataNode from './nodes/PortraitMetadataNode';
import StoryboardGridNode from './nodes/StoryboardGridNode';
import PresetImageNode from './nodes/PresetImageNode';
const DrawingBoardNode = lazy(createLazyImportWithReloadRecovery(() => import('./nodes/DrawingBoardNode')));
import BrowserNode from './nodes/BrowserNode';
import FrameExtractorNode from './nodes/FrameExtractorNode';
import FramePairNode from './nodes/FramePairNode';
const LoopNode = lazy(createLazyImportWithReloadRecovery(() => import('./nodes/LoopNode')));
import PickFromSetNode from './nodes/PickFromSetNode';
const TextSplitNode = lazy(createLazyImportWithReloadRecovery(() => import('./nodes/TextSplitNode')));
import MaterialSetNode from './nodes/MaterialSetNode';
import UploadNode from './nodes/UploadNode';
const OutputNode = lazy(createLazyImportWithReloadRecovery(() => import('./nodes/OutputNode')));
import GroupBoxNode from './nodes/GroupBoxNode';
import GroupExecutionManagerNode from './nodes/GroupExecutionManagerNode';
import DeletableEdge from './edges/DeletableEdge';
import { NODE_REGISTRY } from '../config/nodeRegistry';
import type { NodeType, NodeMeta } from '../types/canvas';
import {
  isConnectionValid,
  getNodeOutputs,
  getNodeInputs,
  arePortsCompatible,
  PORT_COLOR,
  PORT_LABEL,
  NODE_PORTS,
  type PortType,
} from '../config/portTypes';

const RHToolboxMakerNode = import.meta.env?.DEV
  ? lazy(createLazyImportWithReloadRecovery(() => import('./nodes/RHToolboxMakerNode')))
  : PlaceholderNode;

const RHToolboxMakerDevNode = (props: any) => import.meta.env?.DEV ? (
  <Suspense fallback={<PlaceholderNode {...props} />}>
    <RHToolboxMakerNode {...props} />
  </Suspense>
) : <PlaceholderNode {...props} />;

function withLazyNode<P extends object>(Component: ComponentType<P>) {
  return function LazyWrappedNode(props: P) {
    return (
      <Suspense fallback={<PlaceholderNode {...(props as any)} />}>
        <Component {...props} />
      </Suspense>
    );
  };
}

const LazyVideoNode = withLazyNode(VideoNode);
const LazyImageNode = withLazyNode(ImageNode);
const LazyLLMNode = withLazyNode(LLMNode);
const LazySeedanceNode = withLazyNode(SeedanceNode);
const LazyRunningHubNode = withLazyNode(RunningHubNode);
const LazyRHToolsNode = withLazyNode(RHToolsNode);
const LazyRHToolboxNode = withLazyNode(RHToolboxNode);
const LazyToolboxParamNode = withLazyNode(ToolboxParamNode);
const LazyPortraitMasterNode = withLazyNode(PortraitMasterNode);
const LazyPoseMasterNode = withLazyNode(PoseMasterNode);
const LazyDrawingBoardNode = withLazyNode(DrawingBoardNode);
const LazyImageCompareNode = withLazyNode(ImageCompareNode);
const LazyLoopNode = withLazyNode(LoopNode);
const LazyTextSplitNode = withLazyNode(TextSplitNode);
const LazyOutputNode = withLazyNode(OutputNode);

// Phase 4 阶段:全部 24 个节点均已实现业务逻辑
const SPECIFIC_NODES: Record<string, any> = {
  // Core (8)
  text: TextNode,
  image: LazyImageNode,
  video: LazyVideoNode,
  seedance: LazySeedanceNode, // 完全对齐 gpt-image-2-web Seedance2.0(独立 /seedance/v3 路径)
  audio: AudioNode,
  llm: LazyLLMNode,
  runninghub: LazyRunningHubNode,
  // RH 钱包应用：复用 RunningHubNode。v1.2.9.16 起与普通 RunningHub 节点统一使用 settings.rhApiKey
  'runninghub-wallet': LazyRunningHubNode,
  'rh-config': RhConfigNode,
  // RH 工具节点：内置启动器 + 应用运行面板（v1.2.10+）
  'rh-tools': LazyRHToolsNode,
  'rh-toolbox': LazyRHToolboxNode,
  ...(import.meta.env?.DEV ? { 'rh-toolbox-maker': RHToolboxMakerDevNode } : {}),
  'comfyui-store': ComfyUIStoreNode,
  'comfyui-app-maker': ComfyUIAppMakerNode,
  // Special (5)
  'multi-angle-3d': PresetImageNode,
  'panorama-720': PresetImageNode,
  'penguin-portrait': PresetImageNode,
  'portrait-metadata': PortraitMetadataNode,
  'storyboard-grid': StoryboardGridNode,
  // Utility (9)
  'drawing-board': LazyDrawingBoardNode,
  browser: BrowserNode,
  'image-compare': LazyImageCompareNode,
  'frame-extractor': FrameExtractorNode,
  'frame-pair': FramePairNode,
  loop: LazyLoopNode,
  'pick-from-set': PickFromSetNode,
  'text-split': LazyTextSplitNode,
  'material-set': MaterialSetNode,
  resize: ResizeNode,
  combine: CombineNode,
  'remove-bg': RemoveBgNode,
  upscale: UpscaleNode,
  'grid-crop': GridCropNode,
  'grid-editor': GridEditorNode,
  // Auxiliary (5)
  edit: ImageNode, // 复用 ImageNode,默认偏向 edit 能力
  idea: IdeaNode,
  bp: BpNode,
  relay: RelayNode,
  'remove-ai-watermark': RemoveAiWatermarkNode,
  'video-output': VideoOutputNode,
  // Toolbox (5)
  cinematic: LazyToolboxParamNode,
  'video-motion': LazyToolboxParamNode,
  'multi-angle-visual': LazyToolboxParamNode,
  'portrait-master': LazyPortraitMasterNode,
  'pose-master': LazyPoseMasterNode,
  // Input (1) - 上传素材
  upload: UploadNode,
  // Output (1) - 输出素材(文本/图像/视频/音频 预览 + 文本双击编辑)
  output: LazyOutputNode,
};

const NODE_SERIAL_ANCHOR_LEFT = '--t8-node-serial-anchor-left';
const NODE_SERIAL_ANCHOR_TOP = '--t8-node-serial-anchor-top';

function findNodeSerialAnchorTarget(badgeEl: HTMLElement): HTMLElement | null {
  const parent = badgeEl.parentElement;
  if (!parent) return null;
  for (const child of Array.from(parent.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (child === badgeEl) continue;
    if (child.classList.contains('react-flow__handle')) continue;
    if (child.classList.contains('t8-node-serial-badge')) continue;
    return child;
  }
  return null;
}

function formatBadgeAnchorPx(value: number): string {
  if (!Number.isFinite(value)) return '0px';
  return `${Math.round(value * 100) / 100}px`;
}

function useNodeSerialBadgeAnchor(badgeRef: RefObject<HTMLElement | null>, enabled: boolean) {
  useLayoutEffect(() => {
    if (!enabled) return;
    const badgeEl = badgeRef.current;
    const parentEl = badgeEl?.parentElement;
    if (!badgeEl || !parentEl || typeof window === 'undefined') return;
    const badge = badgeEl;
    const parent = parentEl;

    let frame = 0;
    let observedTarget: HTMLElement | null = null;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(applyAnchor);
    };

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => schedule());
    const mutationObserver = typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(() => schedule());

    function applyAnchor() {
      frame = 0;
      const targetEl = findNodeSerialAnchorTarget(badge);
      if (!targetEl) return;

      if (resizeObserver && observedTarget !== targetEl) {
        if (observedTarget) resizeObserver.unobserve(observedTarget);
        observedTarget = targetEl;
        resizeObserver.observe(targetEl);
      }

      const parentRect = parent.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const scaleX = targetEl.offsetWidth > 0 ? targetRect.width / targetEl.offsetWidth : 1;
      const scaleY = targetEl.offsetHeight > 0 ? targetRect.height / targetEl.offsetHeight : scaleX;
      const anchorLeft = scaleX > 0
        ? (targetRect.right - parentRect.left) / scaleX
        : targetEl.offsetLeft + targetEl.offsetWidth;
      const anchorTop = scaleY > 0
        ? (targetRect.top - parentRect.top) / scaleY
        : targetEl.offsetTop;

      badge.style.setProperty(NODE_SERIAL_ANCHOR_LEFT, formatBadgeAnchorPx(anchorLeft));
      badge.style.setProperty(NODE_SERIAL_ANCHOR_TOP, formatBadgeAnchorPx(anchorTop));
    }

    resizeObserver?.observe(parent);
    mutationObserver?.observe(parent, { childList: true });
    window.addEventListener('resize', schedule);
    applyAnchor();
    schedule();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener('resize', schedule);
      badge.style.removeProperty(NODE_SERIAL_ANCHOR_LEFT);
      badge.style.removeProperty(NODE_SERIAL_ANCHOR_TOP);
    };
  }, [badgeRef, enabled]);
}

function NodeSerialBadge({ data }: { data: unknown }) {
  const serialId = parseNodeSerialInput((data as any)?.nodeSerialId);
  const badgeRef = useRef<HTMLSpanElement | null>(null);
  useNodeSerialBadgeAnchor(badgeRef, Boolean(serialId));
  if (!serialId) return null;
  return (
    <span ref={badgeRef} className="t8-node-serial-badge" title={`NodeID #${serialId}`}>
      #{serialId}
    </span>
  );
}

function withNodeSerialBadge(Component: ComponentType<any>): ComponentType<any> {
  const WrappedNode = (props: any) => (
    <>
      <Component {...props} />
      <NodeSerialBadge data={props?.data} />
    </>
  );
  WrappedNode.displayName = `NodeSerialBadge(${Component.displayName || Component.name || 'Node'})`;
  return WrappedNode;
}

// 节点初始 data(用于区分共享组件的 kind/preset/model 等)
const INITIAL_DATA: Record<string, Record<string, any>> = {
  image: { model: 'gpt-image-2', aspectRatio: '1:1', sizeLevel: '1K', referenceImages: [] },
  edit: { mode: 'edit', model: 'gpt-image-2', aspectRatio: '1:1', sizeLevel: '1K', referenceImages: [] },
  seedance: {
    model: 'doubao-seedance-2-0-fast-260128',
    duration: 5,
    ratio: '16:9',
    resolution: '480p',
    generateAudio: true,
    returnLastFrame: false,
    watermark: false,
    webSearch: false,
    seed: -1,
    maxPoll: 360,
    pollInt: 10,
    frameMode: 'auto',
  },
  cinematic: { kind: 'cinematic', cinematicLanguage: 'en', cinematicStrength: 'balanced' },
  'video-motion': { kind: 'video-motion', motionLanguage: 'en' },
  'portrait-master': {
    portraitLanguage: 'en',
    portraitSelection: {},
    portraitLocks: {},
    portraitWeights: {},
    portraitCustomText: '',
    prompt: '',
  },
  'pose-master': {
    kind: 'pose-master',
    poseLanguage: 'en',
    posePresetId: 'standing',
    poseViewId: 'front',
    poseShotId: 'full-body',
    poseIntensityId: 'natural',
    poseBatchCount: 4,
    poseBatchMode: 'next',
    poseFavorites: [],
    poseCustomText: '',
    prompt: '',
  },
  'text-split': {
    sourceText: '',
    splitMode: 'line',
    delimiter: '---',
    chunkSize: 600,
    regexPattern: '',
    regexFlags: 'gm',
    regexStrategy: 'split',
    removeEmpty: true,
    trim: true,
    normalizeSpaces: false,
    stripNumbering: false,
    preferUpstream: true,
    textSplitFavorites: [],
    textSegments: [],
    segments: [],
  },
  'multi-angle-visual': {
    kind: 'multi-angle-visual',
    multiAngleAzimuth: 0,
    multiAngleElevation: 0,
    multiAngleDistance: 5,
    multiAnglePromptMode: 'qwen',
    multiAngleLanguage: 'en',
    multiAngleBatchMode: 'single',
    multiAngleBatchCustomAngles: '',
    multiAnglePrefix: '',
    multiAngleSuffix: '',
    multiAngleCustom: '',
    multiAngleFavorites: [],
    prompt: '<sks> front view eye-level shot medium shot',
  },
  'multi-angle-3d': { preset: 'multi-angle-3d' },
  'panorama-720': { preset: 'panorama-720' },
  'penguin-portrait': { preset: 'penguin-portrait' },
  audio: { mode: 'generate', version: 'v5.5', title: '', tags: '', seed: 0, continueAt: 28 },
  llm: {
    model: 'gemini-3.1-flash-lite-preview',
    system: '',
    prompt: '',
    temperature: 0.7,
    maxTokens: 4096,
    stream: true,
    history: [],
  },
  upload: { uploadType: null },
  'material-set': { materialSetKind: null, materialSetItems: [] },
  // RH 工具节点（v1.2.10.1+）：启动器状态字段 + 运行状态字段（与 RunningHubNode 对齐）
  // 启动器：rhToolsActiveCategoryId / rhToolsActiveAppId / rhToolsSearchQuery
  // 运行态：appInfo / paramValues / instanceType / status / taskId / urls / error / rhCode / materialOrder
  // 输出字段：imageUrl / videoUrl / audioUrl（按扩展名分流给下游 OutputNode）
  'rh-tools': {
    rhToolsActiveCategoryId: 'all',
    rhToolsActiveAppId: '',
    rhToolsSearchQuery: '',
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
  },
  'rh-toolbox': {
    rhToolboxCategoryId: 'all',
    rhToolboxActiveToolId: '',
    rhToolboxSearchQuery: '',
    rhToolboxUserParams: {},
    materialOrder: [],
    excludedMaterialIds: [],
    instanceType: '',
    status: 'idle',
    taskId: '',
    urls: [],
    imageUrl: '',
    imageUrls: [],
    videoUrl: '',
    videoUrls: [],
    audioUrl: '',
    audioUrls: [],
    outputText: '',
    error: '',
  },
  'comfyui-store': {
    comfyuiStoreProviderId: '',
    comfyuiStoreCategoryId: 'all',
    comfyuiStoreActiveAppId: '',
    comfyuiStoreSearchQuery: '',
    comfyuiStoreParamValues: {},
    materialOrder: [],
    excludedMaterialIds: [],
    status: 'idle',
    taskId: '',
    imageUrl: '',
    imageUrls: [],
    videoUrls: [],
    audioUrls: [],
    outputText: '',
    error: '',
  },
  'comfyui-app-maker': {
    comfyMakerTitle: 'Anima 文生图',
    comfyMakerAppId: 'anima-text-to-image-v1',
    comfyMakerCategoryId: 'image',
    comfyMakerDescription: '从 ComfyUI API Workflow 自动生成的本地应用',
    comfyMakerWorkflowRaw: '',
    text: '',
    outputText: '',
  },
  ...(import.meta.env?.DEV ? {
    'rh-toolbox-maker': {
      rhToolboxMakerTitle: '智能抠图',
      rhToolboxMakerId: 'image-cutout-v1',
      rhToolboxMakerDescription: '维护者预置 RH 工具模板',
      rhToolboxMakerCategoryId: 'image-tools',
      rhToolboxMakerWebappId: '',
      rhToolboxMakerCapabilities: 'image.cutout\nimage.edit',
      rhToolboxMakerEnabled: true,
      rhToolboxMakerShowInNode: true,
      rhToolboxMakerAccent: '#22c55e',
      rhToolboxMakerPollIntervalMs: 5000,
      rhToolboxMakerMaxPolls: 480,
      rhToolboxMakerInputs: [
        {
          rowId: 'input-1',
          key: 'source-image',
          label: '原图',
          kind: 'image',
          rhNodeId: '7',
          fieldName: 'image',
          required: true,
          uploadAsset: true,
        },
      ],
      rhToolboxMakerOutputs: [
        {
          rowId: 'output-1',
          key: 'output-image',
          label: '输出图',
          kind: 'image',
          role: 'append-output',
        },
      ],
      rhToolboxMakerUserParams: [],
      rhToolboxMakerFixedParams: [],
      text: '',
      outputText: '',
    },
  } : {}),
  // 循环器: 默认串联 + image kind
  loop: { mode: 'serial', kind: 'image', outputs: [], progress: { done: 0, total: 0, ok: 0, fail: 0 } },
  // 从合集获取: 默认 image + 第 1 个
  'pick-from-set': { pickKind: 'image', pickIndex: 1 },
  'image-compare': { mode: 'slider', align: 'contain', split: 50, opacity: 50, threshold: 24 },
  'drawing-board': { boardRatio: '16:9', boardWidth: 960, boardHeight: 540, boardElements: [], boardColor: '#111827', boardStrokeSize: 5 },
  'grid-crop': { rows: 3, cols: 3, gap: 0 },
  'grid-editor': {
    gridEditorRows: 3,
    gridEditorCols: 3,
    gridEditorWidth: 1200,
    gridEditorHeight: 1200,
    gridEditorGap: 0,
    gridEditorBackground: '#111827',
    gridEditorFit: 'adaptive',
    gridEditorShowIndexes: false,
    gridEditorOrder: [],
    gridEditorLocalItems: [],
    gridEditorHiddenIds: [],
  },
  'remove-ai-watermark': {
    aiWatermarkMode: 'smart',
    aiWatermarkProcessAll: false,
    aiWatermarkOptions: {
      mark: 'auto',
      detect: true,
      inpaint: true,
      inpaintMethod: 'ns',
      inpaintStrength: 0.85,
      stripMetadata: true,
      runInvisible: false,
      regions: [],
      backend: 'cv2',
      eraseMethod: 'telea',
      dilate: 3,
      pipeline: 'default',
      device: 'auto',
      steps: 50,
      humanize: 0,
      maxResolution: 0,
      protectText: false,
      protectFaces: false,
      keepStandardMetadata: true,
      noVisible: false,
    },
  },
};

// 可被“批量运行”调起的节点类型集合
// upload 亦被纳入: 点击 RUN 后会根据已上传素材创建下游 OutputNode (見 UploadNode.handleRun)
const EXECUTABLE_NODE_TYPES = new Set<string>([
  'image', 'edit',
  'multi-angle-3d', 'panorama-720', 'penguin-portrait',
  'video', 'seedance', 'audio', 'llm', 'runninghub', 'runninghub-wallet',
  // v1.2.10.1: rh-tools 与 RunningHub 同质，同样可被批量运行调起
  'rh-tools', 'rh-toolbox', 'comfyui-store',
  'resize', 'upscale', 'grid-crop', 'grid-editor', 'remove-bg', 'combine', 'image-compare', 'drawing-board',
  'frame-extractor', 'frame-pair',
  'upload',
  // v1.2.8 工具节点 (循环器 / 从合集获取)
  'loop', 'pick-from-set',
  // v1.4.8: 工具箱文本节点也可点击 RUN 直接外挂 OutputNode
  'cinematic', 'video-motion', 'multi-angle-visual', 'portrait-master', 'pose-master',
  'remove-ai-watermark',
]);

const GENERATION_LIBRARY_NODE_TYPES = new Set<string>([
  'image', 'edit',
  'multi-angle-3d', 'panorama-720', 'penguin-portrait',
  'video', 'seedance', 'audio', 'llm', 'runninghub', 'runninghub-wallet',
  'rh-tools', 'rh-toolbox', 'comfyui-store',
  'resize', 'upscale', 'grid-crop', 'grid-editor', 'remove-bg', 'combine', 'image-compare', 'drawing-board',
  'frame-extractor', 'frame-pair',
  'remove-ai-watermark',
]);

// 网格吸附步长 / 对齐阈值(世界坐标)
const SNAP_GRID: [number, number] = [20, 20];
const ALIGN_THRESHOLD = 6;

interface SendNodeSpec {
  type: NodeType;
  data: Record<string, any>;
}

function mediaItemsFromSendables(items: SendableMaterial[], kind: MediaKind): MediaItem[] {
  return items
    .map(sendableToMediaItem)
    .filter((item): item is MediaItem => !!item && item.kind === kind);
}

function cloneRecord(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object') return {};
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return { ...(value as Record<string, any>) };
  }
}

function portraitMasterDataFromSource(data: unknown): Record<string, any> | null {
  const cloned = cloneRecord(data);
  const hasConfig = cloned.portraitMetadata || cloned.portraitSelection || cloned.portraitSummary || cloned.portraitStats;
  if (!hasConfig) return null;
  [
    'status',
    'error',
    'taskId',
    'progress',
    'isRunning',
    'isPolling',
    'pollingTimer',
    'sentFromMaterialBridge',
    'sendBridgeSignature',
    'sendBridgeMode',
    'sendBridgeSourceCanvasId',
    'sendBridgeSourceNodeIds',
    'sendBridgeCreatedAt',
  ].forEach((key) => {
    delete cloned[key];
  });
  const promptText = String(cloned.prompt || cloned.outputText || cloned.text || '').trim();
  cloned.prompt = promptText;
  cloned.text = promptText;
  cloned.outputText = promptText;
  return cloned;
}

function buildSendNodeSpecs(materials: SendableMaterial[], mode: SendTargetMode): SendNodeSpec[] {
  const buckets = bucketSendableMaterials(materials);
  const specs: SendNodeSpec[] = [];
  const textValues = buckets.text.map((item) => (item.text || '').trim()).filter(Boolean);
  const mediaKinds: MediaKind[] = ['image', 'video', 'audio'];

  if (mode === 'portrait-master') {
    const seen = new Set<string>();
    for (const item of materials) {
      if (item.sourceType !== 'portrait-master' || !item.sourceNodeData) continue;
      const key = item.sourceNodeId || JSON.stringify(item.sourceNodeData.portraitMetadata || item.sourceNodeData.portraitSelection || {});
      if (seen.has(key)) continue;
      const data = portraitMasterDataFromSource(item.sourceNodeData);
      if (!data) continue;
      seen.add(key);
      specs.push({ type: 'portrait-master', data });
    }
    return specs;
  }

  if (mode === 'material-set') {
    for (const kind of ['image', 'video', 'audio', 'text'] as MaterialSetKind[]) {
      if (buckets[kind].length === 0) continue;
      specs.push({
        type: 'material-set',
        data: materialSetItemsToData(kind, buckets[kind]),
      });
    }
    return specs;
  }

  if (mode === 'output') {
    for (const kind of mediaKinds) {
      const items = mediaItemsFromSendables(buckets[kind], kind);
      if (items.length === 0) continue;
      specs.push({
        type: 'output',
        data: {
          ...createOutputDataFromItems(kind, items),
          sendSource: 'cross-canvas',
        },
      });
    }
    if (textValues.length > 0) {
      specs.push({
        type: 'output',
        data: {
          directOutputText: textValues.join('\n\n'),
          directTextSegments: textValues,
          textSegments: textValues,
          sendSource: 'cross-canvas',
        },
      });
    }
    return specs;
  }

  if (mode === 'split-upload') {
    for (const kind of mediaKinds) {
      const items = mediaItemsFromSendables(buckets[kind], kind);
      for (const item of items) {
        specs.push({
          type: 'upload',
          data: createUploadDataFromItems(kind, [item]),
        });
      }
    }
    textValues.forEach((text) => {
      specs.push({ type: 'text', data: { prompt: text, text } });
    });
    return specs;
  }

  for (const kind of mediaKinds) {
    const items = mediaItemsFromSendables(buckets[kind], kind);
    if (items.length === 0) continue;
    specs.push({
      type: 'upload',
      data: createUploadDataFromItems(kind, items),
    });
  }
  textValues.forEach((text) => {
    specs.push({ type: 'text', data: { prompt: text, text } });
  });
  return specs;
}

function basePositionForAppend(existingNodes: Node[]): { x: number; y: number } {
  const normalNodes = existingNodes.filter((node) => node.id !== BULK_PHANTOM_ID);
  if (normalNodes.length === 0) return { x: 80, y: 80 };
  const rects = normalNodes.map((node) => rectOf(node));
  const maxRight = Math.max(...rects.map((rect) => rect.x + rect.w));
  const minY = Math.min(...rects.map((rect) => rect.y));
  return { x: maxRight + 120, y: minY };
}

function materialNodesFromSpecs(
  specs: SendNodeSpec[],
  existingNodes: Node[],
  base: { x: number; y: number },
  bridge?: { signature: string; mode: SendTargetMode; sourceCanvasId?: string | null; sourceNodeIds?: string[] },
): Node[] {
  const stamp = Date.now();
  const desired = specs.map((spec, index) => {
    const size = defaultSizeOf(spec.type);
    return {
      x: base.x + (index % 2) * (size.w + 80),
      y: base.y + Math.floor(index / 2) * (size.h + 80),
      w: size.w,
      h: size.h,
    };
  });
  const offset = placeBatchNodes(desired, existingNodes, {
    source: 'placement:send-materials',
  });
  return specs.map((spec, index) => ({
    id: `${spec.type}-send-${stamp}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    type: spec.type,
    position: {
      x: desired[index].x + offset.dx,
      y: desired[index].y + offset.dy,
    },
    selected: true,
    data: {
      ...(INITIAL_DATA[spec.type] || {}),
      ...spec.data,
      sentFromMaterialBridge: true,
      sendBridgeSignature: bridge?.signature || '',
      sendBridgeMode: bridge?.mode,
      sendBridgeSourceCanvasId: bridge?.sourceCanvasId || undefined,
      sendBridgeSourceNodeIds: bridge?.sourceNodeIds || [],
      sendBridgeCreatedAt: stamp,
    },
  })) as Node[];
}

function placeInstantiatedNodeFragment(
  instance: InstantiatedSendNodeFragment,
  existingNodes: Node[],
): InstantiatedSendNodeFragment {
  if (instance.nodes.length === 0) return instance;
  const desiredRects = instance.nodes.map((node) => rectOf(node));
  const offset = placeBatchNodes(desiredRects, existingNodes, {
    source: 'placement:send-node-fragment',
  });
  if (offset.dx === 0 && offset.dy === 0) return instance;
  return {
    ...instance,
    nodes: instance.nodes.map((node) => ({
      ...node,
      position: {
        x: (node.position?.x ?? 0) + offset.dx,
        y: (node.position?.y ?? 0) + offset.dy,
      },
    })),
  };
}

function sourceNodeIdsFromMaterials(materials: SendableMaterial[]): string[] {
  const ids = new Set<string>();
  materials.forEach((item) => {
    if (typeof item.sourceNodeId === 'string' && item.sourceNodeId.trim()) {
      ids.add(item.sourceNodeId.trim());
    }
  });
  return [...ids].sort();
}

function removeDuplicateSendBridgeNodes(
  nodes: Node[],
  edges: Edge[],
  materials: SendableMaterial[],
  signature: string,
  sourceCanvasId?: string | null,
): { nodes: Node[]; edges: Edge[]; removed: number } {
  const materialKeys = new Set(
    materials
      .map((item) => sendableMaterialKey(item))
      .filter(Boolean),
  );
  const currentSourceNodeIds = new Set(sourceNodeIdsFromMaterials(materials));
  const normalizedSourceCanvasId = typeof sourceCanvasId === 'string' ? sourceCanvasId : '';
  const removeIds = new Set<string>();
  for (const node of nodes) {
    const data = node.data as any;
    if (!data?.sentFromMaterialBridge) continue;
    if (signature && data.sendBridgeSignature === signature) {
      removeIds.add(node.id);
      continue;
    }
    const nodeSourceCanvasId = typeof data.sendBridgeSourceCanvasId === 'string' ? data.sendBridgeSourceCanvasId : '';
    const nodeSourceIds: string[] = Array.isArray(data.sendBridgeSourceNodeIds)
      ? data.sendBridgeSourceNodeIds.filter(
          (value: unknown): value is string => typeof value === 'string' && Boolean(value.trim()),
        )
      : [];
    const sharesSourceNode =
      currentSourceNodeIds.size > 0 &&
      nodeSourceIds.some((nodeId) => currentSourceNodeIds.has(nodeId));
    const bridgeFromSameSourceCanvas =
      Boolean(normalizedSourceCanvasId) &&
      nodeSourceCanvasId === normalizedSourceCanvasId;
    if (sharesSourceNode || bridgeFromSameSourceCanvas) {
      removeIds.add(node.id);
      continue;
    }
    if (data.sendBridgeSignature) continue;
    const nodeKeys = collectSendableMaterialsFromNode(node)
      .map((item) => sendableMaterialKey(item))
      .filter(Boolean);
    if (nodeKeys.length > 0 && nodeKeys.every((key) => materialKeys.has(key))) {
      removeIds.add(node.id);
    }
  }
  if (removeIds.size === 0) return { nodes, edges, removed: 0 };
  return {
    nodes: nodes.filter((node) => !removeIds.has(node.id)),
    edges: edges.filter((edge) => !removeIds.has(edge.source) && !removeIds.has(edge.target)),
    removed: removeIds.size,
  };
}

function centerOfMaterialNodes(nodes: Node[]): { x: number; y: number } | null {
  if (nodes.length === 0) return null;
  const rects = nodes.map((node) => rectOf(node));
  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.w));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.h));
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

// 把所有节点类型都注册到对应组件(已实现的用业务组件,其余用 Placeholder)
const nodeTypes = NODE_REGISTRY.reduce<Record<string, any>>((acc, m) => {
  acc[m.type] = withNodeSerialBadge(SPECIFIC_NODES[m.type] || PlaceholderNode);
  return acc;
}, {});
// 节点组容器(不在 NODE_REGISTRY 中,作为独立的视觉容器节点类型)
nodeTypes.groupBox = withNodeSerialBadge(GroupBoxNode);
nodeTypes[GROUP_EXECUTION_MANAGER_NODE_TYPE] = withNodeSerialBadge(GroupExecutionManagerNode);

// SHIFT 批量移线 phantom 节点: 拖拽期间充当边的临时锐点,跟随鼠标移动
function BulkPhantomNode() {
  return (
    <>
      <Handle type="target" position={Position.Left} style={{ opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, border: 'none', background: 'transparent' }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, border: 'none', background: 'transparent' }} />
    </>
  );
}
nodeTypes.bulkPhantom = BulkPhantomNode;
const BULK_PHANTOM_ID = '__bulk_phantom__';

// 边类型: 默认边采用可点击断开的 DeletableEdge
const edgeTypes = {
  default: DeletableEdge,
  deletable: DeletableEdge,
};

export interface AddNodeOptions {
  atScreen?: { x: number; y: number };
  data?: Record<string, any>;
}

export type AddNodeFn = (type: NodeType, options?: AddNodeOptions) => void;

export interface InsertWorkflowOptions {
  atScreen?: { x: number; y: number };
  title?: string;
}

export type InsertWorkflowFn = (fragment: SendNodeFragment, options?: InsertWorkflowOptions) => void;

const MEDIA_EXTENSIONS: Record<MediaKind, string[]> = {
  image: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'],
  video: ['mp4', 'webm', 'mov', 'm4v', 'mkv'],
  audio: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'],
};

const INTERNAL_NODE_PASTE_DELAY_MS = 120;
const EXTERNAL_MEDIA_PASTE_DEDUPE_MS = 900;

function inferCanvasMediaKind(file: File): MediaKind | null {
  const mime = file.type || '';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  const ext = (file.name || '').split('.').pop()?.toLowerCase();
  if (!ext) return null;
  if (MEDIA_EXTENSIONS.image.includes(ext)) return 'image';
  if (MEDIA_EXTENSIONS.video.includes(ext)) return 'video';
  if (MEDIA_EXTENSIONS.audio.includes(ext)) return 'audio';
  return null;
}

function fallbackMediaName(file: File, kind: MediaKind, index: number): string {
  if (file.name) return file.name;
  const ext = kind === 'image' ? 'png' : kind === 'video' ? 'mp4' : 'wav';
  return `canvas-${kind}-${Date.now()}-${index + 1}.${ext}`;
}

async function uploadCanvasMediaFile(file: File, kind: MediaKind, index: number): Promise<MediaItem> {
  const fileName = fallbackMediaName(file, kind, index);
  const fd = new FormData();
  fd.append('file', file, fileName);
  const res = await fetch('/api/files/upload', { method: 'POST', body: fd });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `上传失败 HTTP ${res.status}`);
  }
  if (!json.success || !json.data?.url) {
    throw new Error(json.error || '上传失败:未返回 URL');
  }
  return {
    kind,
    url: json.data.url,
    name: fileName,
    size: file.size,
    mime: file.type,
  };
}

function collectCanvasMediaFiles(dataTransfer: DataTransfer | null | undefined): File[] {
  if (!dataTransfer) return [];
  const files: File[] = [];
  const seen = new Set<string>();
  const push = (file: File | null) => {
    if (!file || !inferCanvasMediaKind(file)) return;
    const key = canvasMediaFileKey(file);
    if (seen.has(key)) return;
    seen.add(key);
    files.push(file);
  };
  Array.from(dataTransfer.files || []).forEach(push);
  Array.from(dataTransfer.items || []).forEach((item) => {
    if (item.kind === 'file') push(item.getAsFile());
  });
  return files;
}

function canvasMediaFileKey(file: File): string {
  return `${file.name || 'clipboard-file'}|${file.size}|${file.type || 'application/octet-stream'}`;
}

function hasFileTransfer(dataTransfer: DataTransfer | null | undefined): boolean {
  return Array.from(dataTransfer?.types || []).includes('Files');
}

function findUploadNodeIdFromTarget(target: EventTarget | Element | null | undefined): string {
  if (typeof Element === 'undefined') return '';
  if (!(target instanceof Element)) return '';
  const el = target.closest('[data-upload-node-id]') as HTMLElement | null;
  return String(el?.dataset?.uploadNodeId || '').trim();
}

function chooseUploadReplacementKind(existingKind: any, buckets: Record<MediaKind, File[]>, firstKind: MediaKind | null): MediaKind | null {
  const current = (['image', 'video', 'audio'] as MediaKind[]).includes(existingKind) ? existingKind as MediaKind : null;
  if (current && buckets[current].length > 0) return current;
  return firstKind;
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  const tag = el?.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || !!el?.isContentEditable;
}

function isCanvasOverviewShortcutBlocked(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const el = target as HTMLElement;
  if (el === document.body || el === document.documentElement) return false;
  if (isTextEditingTarget(el)) return true;
  return !!el.closest(
    [
      'button',
      'a',
      '[role="button"]',
      '[data-canvas-floating-ui]',
      '.react-flow__node',
      '.t8-canvas-toolbar',
      '.t8-context-menu',
      '.t8-sidebar',
    ].join(','),
  );
}

function getReactFlowHandleInfo(target: EventTarget | null): {
  nodeId: string;
  handleType: 'source' | 'target';
  handleId: string | null;
} | null {
  if (!(target instanceof Element)) return null;
  const handleEl = target.closest('.react-flow__handle') as HTMLElement | null;
  if (!handleEl) return null;
  const nodeId =
    handleEl.getAttribute('data-nodeid') ||
    handleEl.closest('.react-flow__node')?.getAttribute('data-id') ||
    '';
  const rawType =
    handleEl.getAttribute('data-handletype') ||
    (handleEl.classList.contains('source') ? 'source' : handleEl.classList.contains('target') ? 'target' : '');
  if (!nodeId || (rawType !== 'source' && rawType !== 'target')) return null;
  return {
    nodeId,
    handleType: rawType,
    handleId: handleEl.getAttribute('data-handleid') || null,
  };
}

interface CanvasInnerProps {
  onAddNodeRef?: React.MutableRefObject<AddNodeFn | null>;
  onInsertWorkflowRef?: React.MutableRefObject<InsertWorkflowFn | null>;
  currentUser?: AuthUser | null;
}

function CanvasInner({ onAddNodeRef, onInsertWorkflowRef, currentUser }: CanvasInnerProps) {
  const { activeId, canvases, loadCanvases, setActive, createCanvas } = useCanvasStore();
  const { theme, style, templateId } = useThemeStore();
  const shortcuts = useShortcutStore((s) => s.shortcuts);
  const shortcutText = useCallback((actionId: string) => formatShortcutList(shortcuts[actionId]), [shortcuts]);
  const currentTemplate = useMemo(
    () => resolveThemeTemplate(templateId),
    [templateId],
  );
  const visualStyle = currentTemplate.visuals?.style || style;
  const isOp = visualStyle === 'op';
  const isNaruto = visualStyle === 'naruto';
  const isEva = visualStyle === 'eva';
  const isYyh = visualStyle === 'yyh';
  const isSlamdunk = visualStyle === 'slamdunk';
  const isSoccer = visualStyle === 'soccer-hero';
  const themeTokens = getTemplateMode(currentTemplate, theme).tokens;
  const { screenToFlowPosition, setCenter, getViewport, setViewport, fitView } = useReactFlow();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadedCanvasId, setLoadedCanvasId] = useState<string | null>(null);
  const nextNodeSerialIdRef = useRef(1);
  const allowEmptySaveCanvasIdsRef = useRef<Set<string>>(new Set());

  // 选中节点 / 剪贴板
  const [selectedCount, setSelectedCount] = useState(0);
  const clipboardRef = useRef<{ nodes: Node[]; edges: Edge[]; incomingEdges?: Edge[]; outgoingEdges?: Edge[] } | null>(null);
  const [clipboardCount, setClipboardCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastCanvasPointerRef = useRef<{ x: number; y: number } | null>(null);
  const internalPasteTimerRef = useRef<number | null>(null);
  const lastExternalMediaPasteRef = useRef<{ signature: string; at: number } | null>(null);

  // 拖线到空白处的候选节点菜单(connection picker)
  const [picker, setPicker] = useState<{
    fromNodeId: string;
    fromHandleType: 'source' | 'target';
    flowPos: { x: number; y: number };
    screenPos: { x: number; y: number };
  } | null>(null);
  const connectingFromRef = useRef<{
    nodeId: string;
    handleType: 'source' | 'target';
  } | null>(null);
  const isConnectionDraggingRef = useRef(false);
  const connectionPanModeRef = useRef(false);
  const connectionPanPointerRef = useRef<{ x: number; y: number } | null>(null);
  const [connectionPanModeActive, setConnectionPanModeActive] = useState(false);
  const altDragCloneRef = useRef<{
    placeholderIds: Map<string, string>; // origId -> placeholderId
  } | null>(null);
  const lockedNodeDragRef = useRef<{
    nodeId: string;
    position: { x: number; y: number };
    reason: 'locked-group' | 'locked-member';
    groupId?: string;
  } | null>(null);

  const setConnectionPanMode = useCallback((enabled: boolean) => {
    connectionPanModeRef.current = enabled;
    connectionPanPointerRef.current = null;
    setConnectionPanModeActive((current) => (current === enabled ? current : enabled));
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('connection-pan-mode', enabled);
    }
  }, []);

  const resetConnectionPanMode = useCallback(() => {
    isConnectionDraggingRef.current = false;
    setConnectionPanMode(false);
  }, [setConnectionPanMode]);

  // 跟踪最新 nodes/edges 供全局事件回调使用
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const {
    handleBulkReconnectConnectEnd,
    handleBulkReconnectConnectStart,
    hasPendingBulkReconnect,
  } = useCanvasBulkReconnect({
    bulkPhantomId: BULK_PHANTOM_ID,
    edges,
    edgesRef,
    nodesRef,
    screenToFlowPosition,
    setEdges,
    setNodes,
  });

  const assignActiveNodeSerials = useCallback((incomingNodes: Node[], existingNodes?: Node[]) => {
    const result = assignFreshNodeSerials(incomingNodes, existingNodes || nodesRef.current, nextNodeSerialIdRef.current);
    nextNodeSerialIdRef.current = result.nextNodeSerialId;
    return result.nodes;
  }, []);

  const markManualNodeDeletion = useCallback(
    (nodeIds: Iterable<string>, beforeNodes?: Node[]) => {
      if (!activeId) return;
      const idList = [...nodeIds].filter((id) => typeof id === 'string' && id.trim());
      if (idList.length === 0) return;
      markCanvasNodesDeleted(activeId, idList);
      const removeIds = new Set(idList);
      const baseNodes = beforeNodes || nodesRef.current;
      const remaining = baseNodes.filter((node) => node.id !== BULK_PHANTOM_ID && !removeIds.has(node.id));
      if (remaining.length === 0) {
        allowEmptySaveCanvasIdsRef.current.add(activeId);
      }
    },
    [activeId],
  );

  // 吸附 + 对齐辅助线
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [guides, setGuides] = useState<{ vertical: number[]; horizontal: number[] }>({
    vertical: [],
    horizontal: [],
  });

  // 历史栈
  const applySnapshot = useCallback((snap: { nodes: Node[]; edges: Edge[] }) => {
    setNodes(snap.nodes);
    setEdges(snap.edges);
  }, []);
  const { capture: histCapture, undo: histUndo, redo: histRedo, reset: histReset, canUndo, canRedo } =
    useCanvasHistory(applySnapshot);
  const captureTimer = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  // 节点/连线变更后,在拖拽结束 + 短暂防抖窗口内压栈一次
  const scheduleCapture = useCallback(
    (snap: { nodes: Node[]; edges: Edge[] }) => {
      if (isDraggingRef.current) return;
      if (captureTimer.current) window.clearTimeout(captureTimer.current);
      captureTimer.current = window.setTimeout(() => {
        histCapture(snap);
      }, 250);
    },
    [histCapture]
  );

  const isCanvasRevisionConflictError = useCallback((error: unknown) => {
    return error instanceof api.ApiError && error.status === 409 && error.payload?.error === 'CANVAS_REVISION_CONFLICT';
  }, []);

  const { pendingSendFocusRef } = useCanvasPersistence({
    activeId,
    nodes,
    edges,
    loaded,
    loadedCanvasId,
    bulkPhantomId: BULK_PHANTOM_ID,
    histReset,
    scheduleCapture,
    setNodes,
    setEdges,
    setLoaded,
    setLoadedCanvasId,
    nextNodeSerialIdRef,
    allowEmptySaveCanvasIdsRef,
    altDragCloneRef,
    setCenter,
    getViewport,
    isCanvasRevisionConflictError,
  });

  const {
    batchDone,
    batchTotal,
    handleCancelRun,
    handleRunAll,
    handleRunGroup,
    handleRunAllGroups,
    isRunning,
  } = useCanvasRuntime({
    getNodes: () => nodesRef.current,
    getEdges: () => edgesRef.current,
    executableNodeTypes: EXECUTABLE_NODE_TYPES,
  });
  const {
    handleSaveSendMaterialsToResource,
    handleSendMaterialsToCanvas,
    handleSendMaterialsToEagle,
    insertWorkflowFragment,
    openSendMaterials,
    saveWorkflowFragmentToResource,
    saveWorkflowFragmentToSharedResource,
    sendModal,
    setSendModal,
  } = useCanvasSendFlow({
    activeId,
    bulkPhantomId: BULK_PHANTOM_ID,
    screenToFlowPosition,
    getViewport,
    nodesRef,
    edgesRef,
    setNodes,
    setEdges,
    pendingSendFocusRef,
    assignActiveNodeSerials,
    loadCanvases,
    setActive,
    isCanvasRevisionConflictError,
    buildSendNodeSpecs,
    basePositionForAppend,
    materialNodesFromSpecs,
    placeInstantiatedNodeFragment,
    sourceNodeIdsFromMaterials,
    removeDuplicateSendBridgeNodes,
    centerOfMaterialNodes,
  });

  // 添加节点(供 Sidebar 调用) —— 默认落在当前视口中心
  // 可选 atScreen 传入屏幕坐标，节点会落在该点(用于右键画布空白区添加)
  // v1.2.10.5: 接入 placeSingleNode 防重叠解析器 ——
  //   期望落点冲突时按螺线 (右→下→左→上 step=80 maxTries=64) 自动避让,
  //   兜底走最右侧 + 写日志 + setCenter 飞镜。
  const addNode = useCallback(
    (type: NodeType, options?: AddNodeOptions) => {
      if (type === GROUP_EXECUTION_MANAGER_NODE_TYPE && nodes.some((node) => node.type === GROUP_EXECUTION_MANAGER_NODE_TYPE)) {
        logBus.info('画布中已经存在一个全局组执行管理器', '组执行');
        return;
      }
      const atScreen = options?.atScreen;
      const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      let cx: number;
      let cy: number;
      if (atScreen) {
        cx = atScreen.x;
        cy = atScreen.y;
      } else {
        // 以 ReactFlow 画布容器中心为默认插入点；拿不到则 fallback 到 window 中心
        const flowEl =
          document.querySelector('.react-flow') as HTMLElement | null;
        const rect = flowEl?.getBoundingClientRect();
        cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
        cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
      }
      const center = screenToFlowPosition({ x: cx, y: cy });
      // 期望落点: 右键 = 左上角对准鼠标; Sidebar = 节点视觉中心对准视口中心
      const sz = defaultSizeOf(type);
      const desiredX = atScreen ? center.x : center.x - sz.w / 2;
      const desiredY = atScreen ? center.y : center.y - sz.h / 2;
      // 防重叠: 用现有节点矩形求螺线无重叠位置
      const finalPos = placeSingleNode(desiredX, desiredY, type, nodes, {
        source: 'placement:add',
        onFallback: (p) => {
          const { zoom } = getViewport();
          setCenter(p.x, p.y, { zoom, duration: 400 });
        },
      });
      const newNode: Node = {
        id,
        type,
        position: { x: finalPos.x, y: finalPos.y },
        data: { ...(INITIAL_DATA[type] || {}), ...(options?.data || {}) },
      };
      if (type === GROUP_EXECUTION_MANAGER_NODE_TYPE) {
        newNode.data = {
          ...(newNode.data || {}),
          ...buildGroupExecutionManagerDataFromNodes([...nodes, newNode]),
        };
      }
      setNodes((prev) => [...prev, ...assignActiveNodeSerials([newNode], prev)]);
    },
    [screenToFlowPosition, nodes, getViewport, setCenter, assignActiveNodeSerials]
  );

  useEffect(() => {
    const managerNode = findGroupExecutionManagerNode(nodes);
    if (!managerNode) return;
    const managerData = buildGroupExecutionManagerDataFromNodes(nodes, managerNode);
    const current = managerNode.data as Record<string, any>;
    const same =
      JSON.stringify(current?.groupOrder || []) === JSON.stringify(managerData.groupOrder || []) &&
      JSON.stringify(current?.skippedGroupIds || []) === JSON.stringify(managerData.skippedGroupIds || []) &&
      JSON.stringify(current?.groups || []) === JSON.stringify(managerData.groups || []) &&
      Boolean(current?.enabled ?? true) === Boolean(managerData.enabled) &&
      Number(current?.executionCount ?? 1) === Number(managerData.executionCount) &&
      String(current?.title || '') === String(managerData.title || '') &&
      String(current?.note || '') === String(managerData.note || '');
    if (same) return;
    setNodes((prev) =>
      prev.map((node) =>
        node.id === managerNode.id
          ? { ...node, data: { ...(node.data as any), ...managerData } }
          : node,
      ),
    );
  }, [nodes, setNodes]);

  const createUploadNodesFromFiles = useCallback(
    async (rawFiles: File[], atScreen?: { x: number; y: number }) => {
      const seenFiles = new Set<string>();
      const dedupedFiles = rawFiles.filter((file) => {
        const kind = inferCanvasMediaKind(file);
        if (!kind) return true;
        const key = canvasMediaFileKey(file);
        if (seenFiles.has(key)) return false;
        seenFiles.add(key);
        return true;
      });
      const buckets: Record<MediaKind, File[]> = { image: [], video: [], audio: [] };
      let skipped = 0;
      dedupedFiles.forEach((file) => {
        const kind = inferCanvasMediaKind(file);
        if (!kind) {
          skipped += 1;
          return;
        }
        buckets[kind].push(file);
      });

      const kinds = (['image', 'video', 'audio'] as MediaKind[]).filter((kind) => buckets[kind].length > 0);
      if (kinds.length === 0) return false;

      const payloads: Array<{ kind: MediaKind; items: MediaItem[] }> = [];
      const failures: string[] = [];
      for (const kind of kinds) {
        const items: MediaItem[] = [];
        for (let i = 0; i < buckets[kind].length; i += 1) {
          const file = buckets[kind][i];
          try {
            items.push(await uploadCanvasMediaFile(file, kind, i));
          } catch (err: any) {
            failures.push(`${file.name || kind}: ${err?.message || '上传失败'}`);
          }
        }
        if (items.length > 0) payloads.push({ kind, items });
      }

      if (payloads.length === 0) {
        if (failures.length > 0) alert(`素材导入失败:\n${failures.slice(0, 5).join('\n')}`);
        return true;
      }

      const flowEl = document.querySelector('.react-flow') as HTMLElement | null;
      const rect = flowEl?.getBoundingClientRect();
      const screenPoint =
        atScreen ||
        lastCanvasPointerRef.current ||
        (rect
          ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
          : { x: window.innerWidth / 2, y: window.innerHeight / 2 });
      const base = screenToFlowPosition(screenPoint);
      const size = defaultSizeOf('upload');
      const desired = payloads.map((_, index) => ({
        x: base.x - size.w / 2 + (index % 3) * 300,
        y: base.y - size.h / 2 + Math.floor(index / 3) * 300,
        w: size.w,
        h: size.h,
      }));
      const offset = placeBatchNodes(desired, nodesRef.current, {
        source: 'placement:canvas-media-upload',
      });
      const stamp = Date.now();
      const newNodes = payloads.map((payload, index) => ({
        id: `upload-canvas-${payload.kind}-${stamp}-${index}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'upload',
        position: {
          x: desired[index].x + offset.dx,
          y: desired[index].y + offset.dy,
        },
        selected: true,
        data: createUploadDataFromItems(payload.kind, payload.items),
      })) as Node[];

      setNodes((prev) => [
        ...prev.map((n) => ({ ...n, selected: false })),
        ...assignActiveNodeSerials(newNodes, prev),
      ]);
      if (skipped > 0) {
        console.warn(`画布导入素材时跳过 ${skipped} 个不支持的文件`);
      }
      if (failures.length > 0) {
        alert(`部分素材上传失败:\n${failures.slice(0, 5).join('\n')}`);
      }
      return true;
    },
    [screenToFlowPosition, assignActiveNodeSerials]
  );

  const replaceUploadNodeFromFiles = useCallback(
    async (nodeId: string, rawFiles: File[]) => {
      const target = nodesRef.current.find((node) => node.id === nodeId && node.type === 'upload');
      if (!target) return false;

      const seenFiles = new Set<string>();
      const buckets: Record<MediaKind, File[]> = { image: [], video: [], audio: [] };
      let firstKind: MediaKind | null = null;
      let skipped = 0;
      rawFiles.forEach((file) => {
        const kind = inferCanvasMediaKind(file);
        if (!kind) {
          skipped += 1;
          return;
        }
        const key = canvasMediaFileKey(file);
        if (seenFiles.has(key)) return;
        seenFiles.add(key);
        if (!firstKind) firstKind = kind;
        buckets[kind].push(file);
      });

      const kind = chooseUploadReplacementKind((target.data as any)?.uploadType, buckets, firstKind);
      if (!kind) return false;
      const accepted = buckets[kind];
      if (accepted.length === 0) return false;
      const supportedCount = buckets.image.length + buckets.video.length + buckets.audio.length;
      const skippedDifferentKind = Math.max(0, supportedCount - accepted.length);

      const items: MediaItem[] = [];
      const failures: string[] = [];
      for (let i = 0; i < accepted.length; i += 1) {
        const file = accepted[i];
        try {
          items.push(await uploadCanvasMediaFile(file, kind, i));
        } catch (err: any) {
          failures.push(`${file.name || kind}: ${err?.message || '上传失败'}`);
        }
      }

      if (items.length === 0) {
        if (failures.length > 0) alert(`素材覆盖失败:\n${failures.slice(0, 5).join('\n')}`);
        return true;
      }

      const replacement = createUploadReplacementData(kind, items);
      setNodes((prev) =>
        prev.map((node) => {
          if (node.id !== nodeId) return { ...node, selected: false };
          return {
            ...node,
            selected: true,
            data: {
              ...(node.data || {}),
              ...replacement,
            },
          };
        })
      );
      const notices: string[] = [];
      if (skippedDifferentKind > 0 || skipped > 0) notices.push(`跳过 ${skippedDifferentKind + skipped} 个非${kind === 'image' ? '图像' : kind === 'video' ? '视频' : '音频'}素材`);
      if (failures.length > 0) notices.push(...failures.slice(0, 4));
      if (notices.length > 0) alert(`已覆盖上传素材节点，但有部分素材未使用:\n${notices.join('\n')}`);
      return true;
    },
    []
  );

  const getMaterialSetMergeCandidate = useCallback((ids: string[]): { kind: MaterialSetKind; items: MaterialSetItem[] } | null => {
    const selectedNodes = nodesRef.current
      .filter((node) => ids.includes(node.id) && node.type !== 'groupBox')
      .sort((a, b) => {
        const dy = (a.position?.y ?? 0) - (b.position?.y ?? 0);
        if (Math.abs(dy) > 24) return dy;
        return (a.position?.x ?? 0) - (b.position?.x ?? 0);
      });
    if (selectedNodes.length === 0) return null;

    const buckets: Record<MaterialSetKind, MaterialSetItem[]> = {
      text: [],
      image: [],
      video: [],
      audio: [],
    };
    for (const node of selectedNodes) {
      const nodeBuckets = collectMaterialSetBucketsFromData(node.data);
      for (const kind of ['text', 'image', 'video', 'audio'] as MaterialSetKind[]) {
        buckets[kind].push(...nodeBuckets[kind]);
      }
    }
    const kinds = nonEmptyMaterialSetKinds(buckets);
    if (kinds.length !== 1) return null;
    const kind = kinds[0];
    if (buckets[kind].length < 2) return null;
    return { kind, items: buckets[kind] };
  }, []);

  const handleMergeToMaterialSet = useCallback(
    (ids: string[], atScreen?: { x: number; y: number }) => {
      const candidate = getMaterialSetMergeCandidate(ids);
      if (!candidate) return;
      const flowEl = document.querySelector('.react-flow') as HTMLElement | null;
      const rect = flowEl?.getBoundingClientRect();
      const screenPoint =
        atScreen ||
        (rect
          ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
          : { x: window.innerWidth / 2, y: window.innerHeight / 2 });
      const base = screenToFlowPosition(screenPoint);
      const size = defaultSizeOf('material-set');
      const desiredX = base.x - size.w / 2;
      const desiredY = base.y - size.h / 2;
      const finalPos = placeSingleNode(desiredX, desiredY, 'material-set', nodesRef.current, {
        source: 'placement:merge-material-set',
      });
      const newNode: Node = {
        id: `material-set-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'material-set',
        position: finalPos,
        selected: true,
        data: materialSetItemsToData(candidate.kind, candidate.items),
      } as Node;
      setNodes((prev) => [
        ...prev.map((node) => ({ ...node, selected: false })),
        ...assignActiveNodeSerials([newNode], prev),
      ]);
    },
    [getMaterialSetMergeCandidate, screenToFlowPosition, assignActiveNodeSerials],
  );

  const getDownloadableItemsFromNodes = useCallback((ids: string[]): MediaItem[] => {
    const out: MediaItem[] = [];
    const seen = new Set<string>();
    const push = (item: MediaItem) => {
      const url = typeof item.url === 'string' ? item.url.trim() : '';
      if (!url || seen.has(url)) return;
      seen.add(url);
      out.push({
        ...item,
        url,
        name: item.name || fileNameFromUrl(url),
      });
    };

    for (const node of nodesRef.current) {
      if (!ids.includes(node.id) || node.type === 'groupBox') continue;
      for (const kind of ['image', 'video', 'audio'] as MediaKind[]) {
        getMediaItemsFromData(node.data, kind).forEach(push);
      }
      const buckets = collectMaterialSetBucketsFromData(node.data);
      for (const kind of ['image', 'video', 'audio'] as MediaKind[]) {
        buckets[kind].forEach((item) => {
          if (!item.url) return;
          push({
            kind,
            url: item.url,
            name: item.name,
            size: item.size,
            mime: item.mime,
          });
        });
      }
    }

    return out;
  }, []);

  const downloadMaterialItem = useCallback(async (item: MediaItem, index: number) => {
    const fallbackName = `${item.kind}-${index + 1}`;
    const fileName = item.name || fileNameFromUrl(item.url) || fallbackName;
    try {
      const res = await fetch(item.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    } catch {
      const a = document.createElement('a');
      a.href = item.url;
      a.download = fileName;
      a.target = '_blank';
      a.rel = 'noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }, []);

  const handleBatchDownloadSelected = useCallback(
    async (ids: string[]) => {
      const items = getDownloadableItemsFromNodes(ids);
      if (items.length === 0) {
        logBus.warn('所选节点没有可下载素材', '批量下载');
        return;
      }
      for (let i = 0; i < items.length; i += 1) {
        await downloadMaterialItem(items[i], i);
        await new Promise((resolve) => window.setTimeout(resolve, 80));
      }
      logBus.success(`已触发 ${items.length} 个素材下载`, '批量下载');
    },
    [downloadMaterialItem, getDownloadableItemsFromNodes],
  );

  const handleCanvasPointerMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    lastCanvasPointerRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onCanvasFileDragOver = useCallback((e: ReactDragEvent) => {
    if (!hasFileTransfer(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onCanvasFileDrop = useCallback(
    (e: ReactDragEvent) => {
      if (!hasFileTransfer(e.dataTransfer)) return;
      e.preventDefault();
      e.stopPropagation();
      const files = collectCanvasMediaFiles(e.dataTransfer);
      if (files.length === 0) return;
      void createUploadNodesFromFiles(files, { x: e.clientX, y: e.clientY });
    },
    [createUploadNodesFromFiles]
  );

  // ===== 复制 / 粘贴 / 删除 =====
  const handleCopy = useCallback(() => {
    const sel = nodes.filter((n) => n.selected);
    if (sel.length === 0) return;
    const ids = new Set(sel.map((n) => n.id));
    // 内部边: source/target 都在选中集合 —— 普通粘贴/快速复制会使用
    const selEdges = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    // 外部入边: target 在选中集合,source 不在 —— Ctrl+Shift+V 连边粘贴使用
    const incomingEdges = edges.filter((e) => !ids.has(e.source) && ids.has(e.target));
    // 外部出边: source 在选中集合,target 不在
    const outgoingEdges = edges.filter((e) => ids.has(e.source) && !ids.has(e.target));
    clipboardRef.current = {
      nodes: JSON.parse(JSON.stringify(sel)),
      edges: JSON.parse(JSON.stringify(selEdges)),
      incomingEdges: JSON.parse(JSON.stringify(incomingEdges)),
      outgoingEdges: JSON.parse(JSON.stringify(outgoingEdges)),
    };
    setClipboardCount(sel.length);
  }, [nodes, edges]);

  // 普通粘贴: 仅复制选中节点 + 其内部边(与原逻辑一致)
  // withLinks=true: Ctrl+Shift+V 额外复制原节点的外部入边/出边 —— 将新节点与原画布上还存在的邻居连接
  const handlePaste = useCallback((withLinks = false) => {
    const cb = clipboardRef.current as (typeof clipboardRef.current & {
      incomingEdges?: Edge[];
      outgoingEdges?: Edge[];
    }) | null;
    if (!cb || cb.nodes.length === 0) return;
    // 运行时字段黑名单(复制/粘贴时必须重置,避免新节点显示为进行中/携带旧 taskId)
    const RUNTIME_KEYS = [
      'status', 'taskId', 'progress', 'error',
      'isRunning', 'isPolling', 'pollingTimer',
    ];
    const sanitize = (data: any) => {
      const next: any = { ...(data || {}) };
      for (const k of RUNTIME_KEYS) delete next[k];
      next.status = 'idle';
      return next;
    };
    const idMap = new Map<string, string>();
    const stamp = Date.now();
    const newNodes = cb.nodes.map((n, idx) => {
      const newId = `${n.type}-${stamp}-${idx}-${Math.random().toString(36).slice(2, 5)}`;
      idMap.set(n.id, newId);
      return {
        ...n,
        id: newId,
        selected: true,
        position: {
          x: (n.position?.x ?? 0) + 40,
          y: (n.position?.y ?? 0) + 40,
        },
        data: sanitize(n.data),
      } as Node;
    });
    const assignedNewNodes = assignActiveNodeSerials(newNodes, nodes);
    // 内部边: source/target 都映射到新节点
    const newInternalEdges = cb.edges
      .map((e, idx) => {
        const s = idMap.get(e.source);
        const t = idMap.get(e.target);
        if (!s || !t) return null;
        return {
          ...e,
          id: `e-${stamp}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
          source: s,
          target: t,
        } as Edge;
      })
      .filter(Boolean) as Edge[];
    let extraEdges: Edge[] = [];
    if (withLinks) {
      // 外部入边: source 保留(原节点须仍在画布), target 映射为新节点
      const incoming = (cb.incomingEdges || [])
        .map((e, idx) => {
          const sourceStillExists = nodes.some((n) => n.id === e.source);
          const t = idMap.get(e.target);
          if (!sourceStillExists || !t) return null;
          return {
            ...e,
            id: `e-in-${stamp}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
            source: e.source,
            target: t,
          } as Edge;
        })
        .filter(Boolean) as Edge[];
      // 外部出边: source 映射为新节点, target 保留
      const outgoing = (cb.outgoingEdges || [])
        .map((e, idx) => {
          const targetStillExists = nodes.some((n) => n.id === e.target);
          const s = idMap.get(e.source);
          if (!targetStillExists || !s) return null;
          return {
            ...e,
            id: `e-out-${stamp}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
            source: s,
            target: e.target,
          } as Edge;
        })
        .filter(Boolean) as Edge[];
      extraEdges = [...incoming, ...outgoing];
    }
    // 取消其他节点的选中,新粘贴节点设为选中
    setNodes((prev) => [...prev.map((n) => ({ ...n, selected: false })), ...assignedNewNodes]);
    setEdges((prev) => [...prev, ...newInternalEdges, ...extraEdges]);
  }, [nodes, assignActiveNodeSerials]);

  const handleDuplicate = useCallback(() => {
    handleCopy();
    // 在 copy 完成后下一帧执行 paste(由于上面的 setClipboardCount 是异步)
    setTimeout(() => handlePaste(false), 0);
  }, [handleCopy, handlePaste]);

  const handleDeleteSelected = useCallback(() => {
    setNodes((prev) => {
      const removeIds = new Set(prev.filter((n) => n.selected).map((n) => n.id));
      if (removeIds.size === 0) return prev;
      markManualNodeDeletion(removeIds, prev);
      setEdges((eds) =>
        eds.filter((e) => !removeIds.has(e.source) && !removeIds.has(e.target) && !e.selected)
      );
      return prev.filter((n) => !removeIds.has(n.id));
    });
    setEdges((prev) => prev.filter((e) => !e.selected));
  }, [markManualNodeDeletion]);

  // ===== 导入 / 导出 =====
  const handleExport = useCallback(() => {
    const data = {
      schema: 't8-penguin-canvas-export',
      version: 2,
      exportedAt: new Date().toISOString(),
      canvas: { id: activeId || 'export' },
      nodes,
      edges,
      viewport: getViewport(),
      nextNodeSerialId: nextNodeSerialIdRef.current,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `canvas-${activeId || 'export'}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [nodes, edges, activeId, getViewport]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const txt = String(reader.result || '');
          const json = JSON.parse(txt);
          const source = json?.canvasData && typeof json.canvasData === 'object' ? json.canvasData : json;
          const importedNodes = Array.isArray(source.nodes) ? source.nodes : [];
          const importedEdges = Array.isArray(source.edges) ? source.edges : [];
          if (!confirm(`导入将替换当前画布(${importedNodes.length} 个节点 / ${importedEdges.length} 条连线),是否继续?`)) {
            return;
          }
          const migratedNodes = migrateImportedNodes(importedNodes);
          const normalized = normalizeCanvasNodeSerials(migratedNodes, source.nextNodeSerialId);
          nextNodeSerialIdRef.current = normalized.nextNodeSerialId;
          setNodes(normalized.nodes);
          setEdges(importedEdges);
        } catch (err) {
          alert('导入失败:JSON 解析错误');
          console.error(err);
        }
      };
      reader.readAsText(file);
      // 允许重复选同一文件
      e.target.value = '';
    },
    []
  );

  // ===== 应用模板 =====
  const handleApplyTemplate = useCallback((tpl: CanvasTemplate) => {
    const built = tpl.build();
    // 偏移现有 nodes 数量,避免重叠
    setNodes((prev) => [
      ...prev.map((n) => ({ ...n, selected: false })),
      ...assignActiveNodeSerials(built.nodes.map((n) => ({ ...n, selected: true })), prev),
    ]);
    setEdges((prev) => [...prev, ...built.edges]);
  }, [assignActiveNodeSerials]);

  // ===== ALT+拖动复制节点 =====
  // 思路: dragStart 时在原位插入占位克隆(临时ID),用户拖动过程中原位看起来有节点不动;
  // dragStop 时做 ID 互换: 占位克隆 → 恢复原始ID(保留连线), 被拖走的原节点 → 分配新ID(sanitize)
  // 最终效果: 原节点留在原位(保留连线和数据), 新复制节点在拖放位置
  const onNodeDragStart = useCallback(
    (e: any, node: Node) => {
      altDragCloneRef.current = null;
      lockedNodeDragRef.current = null;
      if (isGroupBoxNode(node)) {
        if (isGroupBoxLocked((node.data as any) || {})) {
          lockedNodeDragRef.current = {
            nodeId: node.id,
            position: { ...node.position },
            reason: 'locked-group',
          };
          logBus.info('当前分组已锁定，解锁后才能拖动', '分组锁定');
          return;
        }
      } else {
        const lockedGroup = findLockedGroupForNode(nodesRef.current, node.id);
        if (lockedGroup) {
          lockedNodeDragRef.current = {
            nodeId: node.id,
            position: { ...node.position },
            reason: 'locked-member',
            groupId: lockedGroup.id,
          };
          logBus.info('当前节点所在分组已锁定，解锁分组后才能拖动', '分组锁定');
          return;
        }
      }
      if (!e.altKey) return;
      // ALT 按下: 确定被拖动的节点集合
      const selected = nodes.filter((n) => n.selected);
      const targets = selected.length > 0 && selected.some((n) => n.id === node.id)
        ? selected
        : [node];
      // 在原位创建占位克隆(临时 ID, 同样外观 / 数据, 但不选中)
      const stamp = Date.now();
      const placeholderIds = new Map<string, string>();
      const placeholders: Node[] = [];
      targets.forEach((n, idx) => {
        const phId = `_alt-ph-${stamp}-${idx}-${Math.random().toString(36).slice(2, 5)}`;
        placeholderIds.set(n.id, phId);
        placeholders.push({
          ...n,
          id: phId,
          selected: false,
          position: { ...n.position },
          data: JSON.parse(JSON.stringify(n.data || {})),
        } as Node);
      });
      setNodes((prev) => [...prev, ...placeholders]);
      // 立即将连接原节点的边转移到占位克隆上,这样拖动过程中连线留在原位不动
      setEdges((prev) => prev.map((e2) => {
        let s = e2.source;
        let t = e2.target;
        const phS = placeholderIds.get(s);
        const phT = placeholderIds.get(t);
        if (!phS && !phT) return e2;
        return { ...e2, source: phS || s, target: phT || t };
      }));
      altDragCloneRef.current = { placeholderIds };
    },
    [nodes]
  );

  // ===== 节点组(GroupBox) =====
  // 拖动组节点时使用,记录上一帧位置以计算 delta 同步偏移成员节点
  // memberIds 在拖动开始时根据当前几何关系动态计算(不依赖创组时快照)
  const groupDragRef = useRef<{
    groupId: string;
    lastX: number;
    lastY: number;
    memberIds: string[];
  } | null>(null);

  // 创建节点组: 计算 bounding box, 生成 type='groupBox' 节点装进 nodes
  const handleCreateGroup = useCallback(
    (ids: string[]) => {
      // 排除 groupBox 自身(不允许嵌套组)
      const targets = nodes.filter((n) => ids.includes(n.id) && n.type !== 'groupBox');
      if (targets.length < 1) {
        alert('请先选中要打组的节点');
        return;
      }
      const PAD = 30;
      const HEADER = 40;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of targets) {
        const w = (n as any).width || (n as any).measured?.width || 200;
        const h = (n as any).height || (n as any).measured?.height || 100;
        const x = n.position.x;
        const y = n.position.y;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x + w > maxX) maxX = x + w;
        if (y + h > maxY) maxY = y + h;
      }
      const groupX = minX - PAD;
      const groupY = minY - PAD - HEADER;
      const groupW = (maxX - minX) + PAD * 2;
      const groupH = (maxY - minY) + PAD * 2 + HEADER;
      const newId = `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      // 随机选一个颜色
      const color = GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)];
      const groupNode: Node = {
        id: newId,
        type: 'groupBox',
        position: { x: groupX, y: groupY },
        data: {
          name: DEFAULT_GROUP_NAME,
          color,
          memberIds: targets.map((n) => n.id),
          width: groupW,
          height: groupH,
          locked: true,
        },
        // 置于普通节点之下(负 1000 避免选中时 zIndex 被括号调高)
        zIndex: -1000,
        draggable: false,
        selectable: true,
        deletable: true,
        // 可连接: 右侧 source handle 能把「组内所有节点的聚合输出」传给组外
        connectable: true,
      } as Node;
      // 插入到最前面,确保渲染顺序在底(配合 zIndex 负值)
      setNodes((prev) => [
        ...assignActiveNodeSerials([groupNode], prev),
        ...prev.map((n) => ({ ...n, selected: false })),
      ]);
    },
    [nodes, assignActiveNodeSerials]
  );

  // 监听 GroupBox 的执行请求 / 删除请求
  const executeReq = useGroupBusStore((s) => s.executeReq);
  const deleteReq = useGroupBusStore((s) => s.deleteReq);
  const runAllReq = useGroupBusStore((s) => s.runAllReq);
  const clearExecuteReq = useGroupBusStore((s) => s.clearExecute);
  const clearDeleteReq = useGroupBusStore((s) => s.clearDelete);
  const clearRunAllReq = useGroupBusStore((s) => s.clearRunAll);

  useEffect(() => {
    if (!executeReq) return;
    handleRunGroup(executeReq.memberIds);
    clearExecuteReq();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executeReq?.ts]);

  useEffect(() => {
    if (!runAllReq) return;
    void handleRunAllGroups();
    clearRunAllReq();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runAllReq?.ts]);

  useEffect(() => {
    if (!deleteReq) return;
    setNodes((prev) => {
      if (prev.some((n) => n.id === deleteReq.groupId)) {
        markManualNodeDeletion([deleteReq.groupId], prev);
      }
      return prev.filter((n) => n.id !== deleteReq.groupId);
    });
    clearDeleteReq();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteReq?.ts]);

  const handleAlignSelection = useCallback((action: NodeAlignAction, ids?: string[]) => {
    const targetIds = (ids && ids.length > 0)
      ? ids
      : nodesRef.current.filter((node) => node.selected).map((node) => node.id);
    if (targetIds.length === 0) {
      logBus.warn('请先选择要对齐的节点', '对齐');
      return;
    }
    const result = applyNodeAlignment(nodesRef.current, targetIds, action, {
      grid: SNAP_GRID,
      gridGap: 48,
      alignGap: 32,
    });
    if (!result.changed) {
      logBus.info('选区已经足够整齐，未移动节点', '对齐');
      return;
    }
    setGuides({ vertical: [], horizontal: [] });
    setNodes(result.nodes);
    logBus.success(`已整理 ${result.movedIds.length} 个节点`, '对齐');
  }, []);

  // ===== 智能对齐辅助线 =====
  const onNodeDrag = useCallback(
    (_e: any, node: Node) => {
      const lockedDrag = lockedNodeDragRef.current;
      if (lockedDrag && lockedDrag.nodeId === node.id) {
        setNodes((prev) =>
          prev.map((candidate) =>
            candidate.id === node.id
              ? { ...candidate, position: { ...lockedDrag.position } }
              : candidate
          )
        );
        return;
      }
      // 拖动 GroupBox 节点: 联动所有成员节点同步偏移
      if (isGroupBoxNode(node)) {
        const ref = groupDragRef.current;
        if (!ref || ref.groupId !== node.id) {
          const liveMembers = getGroupBoxLiveMemberIds(nodes, node);
          groupDragRef.current = {
            groupId: node.id,
            lastX: node.position.x,
            lastY: node.position.y,
            memberIds: liveMembers,
          };
          return;
        }
        const dx = node.position.x - ref.lastX;
        const dy = node.position.y - ref.lastY;
        if (dx === 0 && dy === 0) return;
        ref.lastX = node.position.x;
        ref.lastY = node.position.y;
        if (ref.memberIds.length === 0) return;
        const idSet = new Set(ref.memberIds);
        setNodes((prev) =>
          prev.map((n) =>
            idSet.has(n.id)
              ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
              : n
          )
        );
        return;
      }
      if (!snapEnabled) return;
      const w = (node as any).width || (node as any).measured?.width || 200;
      const h = (node as any).height || (node as any).measured?.height || 100;
      const tx = node.position.x;
      const ty = node.position.y;
      const targets = { L: tx, C: tx + w / 2, R: tx + w, T: ty, M: ty + h / 2, B: ty + h };
      const vGuides = new Set<number>();
      const hGuides = new Set<number>();
      let snapDX: number | null = null;
      let snapDY: number | null = null;
      let bestVDiff = ALIGN_THRESHOLD;
      let bestHDiff = ALIGN_THRESHOLD;
      for (const other of nodes) {
        if (other.id === node.id) continue;
        const ow = (other as any).width || (other as any).measured?.width || 200;
        const oh = (other as any).height || (other as any).measured?.height || 100;
        const ox = other.position.x;
        const oy = other.position.y;
        const oVals = { L: ox, C: ox + ow / 2, R: ox + ow, T: oy, M: oy + oh / 2, B: oy + oh };
        // 垂直辅助线(列对齐): L/C/R 对 L/C/R
        for (const tk of ['L', 'C', 'R'] as const) {
          for (const ok of ['L', 'C', 'R'] as const) {
            const diff = Math.abs(targets[tk] - oVals[ok]);
            if (diff < ALIGN_THRESHOLD) {
              vGuides.add(oVals[ok]);
              if (diff < bestVDiff) {
                bestVDiff = diff;
                snapDX = oVals[ok] - targets[tk];
              }
            }
          }
        }
        // 水平辅助线(行对齐): T/M/B 对 T/M/B
        for (const tk of ['T', 'M', 'B'] as const) {
          for (const ok of ['T', 'M', 'B'] as const) {
            const diff = Math.abs(targets[tk] - oVals[ok]);
            if (diff < ALIGN_THRESHOLD) {
              hGuides.add(oVals[ok]);
              if (diff < bestHDiff) {
                bestHDiff = diff;
                snapDY = oVals[ok] - targets[tk];
              }
            }
          }
        }
      }
      setGuides({ vertical: Array.from(vGuides), horizontal: Array.from(hGuides) });
      // 弱吸附:调整当前拖拽节点位置
      if (snapDX !== null || snapDY !== null) {
        setNodes((prev) =>
          prev.map((n) =>
            n.id === node.id
              ? {
                  ...n,
                  position: {
                    x: tx + (snapDX ?? 0),
                    y: ty + (snapDY ?? 0),
                  },
                }
              : n
          )
        );
      }
    },
    [nodes, snapEnabled]
  );

  const onNodeDragStop = useCallback((_e: any, node: Node) => {
    setGuides({ vertical: [], horizontal: [] });
    lockedNodeDragRef.current = null;

    // ===== ALT+拖动结束: ID 互换 =====
    // 占位克隆(临时ID,在原位) → 恢复为原始ID(边自动留在原位)
    // 原节点(原始ID,已拖到新位置) → 分配新ID + sanitize(变成干净副本)
    if (altDragCloneRef.current) {
      const { placeholderIds } = altDragCloneRef.current;
      altDragCloneRef.current = null;
      const origIds = new Set(placeholderIds.keys());
      // phId → origId 反查表
      const phToOrig = new Map<string, string>();
      placeholderIds.forEach((phId, origId) => phToOrig.set(phId, origId));
      // 运行时字段黑名单
      const RUNTIME_KEYS = ['status', 'taskId', 'progress', 'error', 'isRunning', 'isPolling', 'pollingTimer'];
      const sanitize = (data: any) => {
        const next: any = { ...(data || {}) };
        for (const k of RUNTIME_KEYS) delete next[k];
        next.status = 'idle';
        return next;
      };
      const stamp = Date.now();
      const newIdMap = new Map<string, string>(); // origId -> newCopyId

      setNodes((prev) => {
        const copyDrafts: Node[] = [];
        const copyIds = new Set<string>();
        const mapped = prev.map((n) => {
          // 占位克隆 → 恢复原始ID
          const restoreId = phToOrig.get(n.id);
          if (restoreId) {
            return { ...n, id: restoreId };
          }
          // 被拖走的原节点 → 新ID + sanitize
          if (origIds.has(n.id)) {
            const newId = `${n.type}-${stamp}-${newIdMap.size}-${Math.random().toString(36).slice(2, 5)}`;
            newIdMap.set(n.id, newId);
            const copyNode = { ...n, id: newId, selected: true, data: sanitize(n.data) } as Node;
            copyDrafts.push(copyNode);
            copyIds.add(newId);
            return copyNode;
          }
          return n;
        });
        if (copyDrafts.length === 0) return mapped;
        const baseNodes = mapped.filter((n) => !copyIds.has(n.id));
        const assignedCopies = assignActiveNodeSerials(copyDrafts, baseNodes);
        const assignedById = new Map(assignedCopies.map((copy) => [copy.id, copy]));
        return mapped.map((n) => assignedById.get(n.id) || n);
      });

      // 边处理: dragStart 时边已从 origId 转移到 phId,现在需恢复为 origId + 复制内部边给新节点
      setEdges((prev) => {
        // 1. phId → origId 恢复
        const restored = prev.map((e2) => {
          const origS = phToOrig.get(e2.source);
          const origT = phToOrig.get(e2.target);
          if (!origS && !origT) return e2;
          return { ...e2, source: origS || e2.source, target: origT || e2.target };
        });
        // 2. 复制内部边(原节点之间的边 → 新节点之间)
        const cloneEdges = restored
          .filter((e2) => origIds.has(e2.source) && origIds.has(e2.target))
          .map((e2, idx) => {
            const s = newIdMap.get(e2.source);
            const t = newIdMap.get(e2.target);
            if (!s || !t) return null;
            return { ...e2, id: `e-alt-${stamp}-${idx}-${Math.random().toString(36).slice(2, 5)}`, source: s, target: t } as Edge;
          })
          .filter(Boolean) as Edge[];
        return cloneEdges.length > 0 ? [...restored, ...cloneEdges] : restored;
      });
      groupDragRef.current = null;
      return;
    }

    // 拖动组结束: 将最新的几何成员同步到 data.memberIds(供GroupBoxNode显示节点数/执行使用)
    if (isGroupBoxNode(node) && groupDragRef.current?.groupId === node.id) {
      const latestIds = groupDragRef.current.memberIds;
      setNodes((prev) =>
        prev.map((n) =>
          n.id === node.id
            ? { ...n, data: { ...((n.data as any) || {}), memberIds: latestIds } }
            : n
        )
      );
    }
  
    // 标记被用户手动拖动过的自动外挂 OutputNode (id 以 'output-auto-' 开头),
    // 后续「网格重排」useEffect 会检测 data.userMoved 跳过这些节点, 保留用户位置。
    // 多选拖动场景: xyflow 只传主拖 node, 本函数连同所有 selected 且带该前缀的节点都打上标记。
    setNodes((prev) => {
      const selectedAutoOutputIds = new Set<string>();
      for (const n of prev) {
        if (n.selected && typeof n.id === 'string' && n.id.startsWith('output-auto-')) {
          selectedAutoOutputIds.add(n.id);
        }
      }
      if (typeof node?.id === 'string' && node.id.startsWith('output-auto-')) {
        selectedAutoOutputIds.add(node.id);
      }
      if (selectedAutoOutputIds.size === 0) return prev;
      return prev.map((n) =>
        selectedAutoOutputIds.has(n.id)
          ? { ...n, data: { ...((n.data as any) || {}), userMoved: true } }
          : n
      );
    });
  
    groupDragRef.current = null;
  }, []);

  const {
    closeContextMenu,
    closePaneMenu,
    contextMenu,
    onCanvasContextMenuCapture,
    onNodeContextMenu,
    onPaneContextMenu,
    onSelectionChange,
    onSelectionContextMenu,
    onSelectionEnd,
    paneMenu,
  } = useCanvasSelectionMenus({
    bulkPhantomId: BULK_PHANTOM_ID,
    nodesRef,
    setNodes,
  });

  // 暴露 addNode 给父组件
  useEffect(() => {
    if (onAddNodeRef) {
      onAddNodeRef.current = addNode;
    }
    return () => {
      if (onAddNodeRef) onAddNodeRef.current = null;
    };
  }, [onAddNodeRef, addNode]);

  useEffect(() => {
    if (onInsertWorkflowRef) {
      onInsertWorkflowRef.current = insertWorkflowFragment;
    }
    return () => {
      if (onInsertWorkflowRef) onInsertWorkflowRef.current = null;
    };
  }, [onInsertWorkflowRef, insertWorkflowFragment]);

  // xyflow 事件
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const removedIds = changes
        .filter((c) => c.type === 'remove' && typeof (c as any).id === 'string')
        .map((c) => (c as any).id as string);
      if (removedIds.length > 0) {
        markManualNodeDeletion(removedIds, nodesRef.current);
      }
      // 检测拖拽状态,避免拖拽中频繁压栈
      for (const c of changes) {
        if (c.type === 'position') {
          if ((c as any).dragging === true) {
            isDraggingRef.current = true;
          } else if ((c as any).dragging === false) {
            isDraggingRef.current = false;
          }
        }
      }
      setNodes((nds) => {
        const next = applyNodeChanges(changes, nds);
        // 同步选中数(用 next 计算更准确)
        const selCount = next.reduce((acc, n) => acc + (n.selected ? 1 : 0), 0);
        setSelectedCount(selCount);
        return next;
      });
    },
    [markManualNodeDeletion]
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(
    (params: Connection) => {
      resetConnectionPanMode();
      // 批量移线过程中禁止普通连接逻辑(不然会多一条重复边)
      if (hasPendingBulkReconnect()) return;
      const curNodes = nodesRef.current;
      const curEdges = edgesRef.current;
      // 连接有效性校验(防止绕过 isValidConnection 的底层调用)
      const src = curNodes.find((n) => n.id === params.source);
      let tgt = curNodes.find((n) => n.id === params.target);
      if (!isConnectionValid(src, tgt)) return;

      // ⚡ 组容器连出去重: 如果 source 是 groupBox, 并且组内成员已经独立连到同一个下游 target,
      // 则自动断开那些「成员→target」的重复边, 只保留 group→target
      // (避免同一源头重复传输 + 防止潜在循环依赖)
      if (src && src.type === 'groupBox' && tgt && params.target) {
        const memberIds: string[] = Array.isArray((src.data as any)?.memberIds)
          ? ((src.data as any).memberIds as string[])
          : [];
        if (memberIds.length > 0) {
          const memberSet = new Set(memberIds);
          const dupEdges = curEdges.filter(
            (e) => memberSet.has(e.source) && e.target === params.target,
          );
          if (dupEdges.length > 0) {
            const dupIds = new Set(dupEdges.map((e) => e.id));
            setEdges((eds) => eds.filter((e) => !dupIds.has(e.id)));
          }
        }
      }

      // ⚡ 输出素材节点单输入约束:若目标是 output 且已有连入,
      // 自动派生一个新的 output 节点并把本次连接转向它。
      if (tgt && tgt.type === 'output') {
        const targetHasConn = curEdges.some((e) => e.target === tgt!.id);
        if (targetHasConn) {
          const newId = `output-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          // v1.2.10.5-hotfix3: 使用 placeSingleNode 防重叠（之前硬编码 +360 会重叠）
          const _tgtW = (tgt as any).measured?.width || 320;
          const _desX = (tgt.position?.x ?? 0) + _tgtW + 40;
          const _desY = tgt.position?.y ?? 0;
          const _finalPos = placeSingleNode(_desX, _desY, 'output', curNodes, { source: 'placement:onConnect-dup-output' });
          const newNode: Node = {
            id: newId,
            type: 'output',
            position: { x: _finalPos.x, y: _finalPos.y },
            data: { ...(INITIAL_DATA['output'] || {}) },
          };
          setNodes((prev) => [...prev, ...assignActiveNodeSerials([newNode], prev)]);
          // 后续边连到新节点
          tgt = newNode;
          params = { ...params, target: newId };
        }
      }

      // 根据上游输出类型染色连线
      const outs = src ? getNodeOutputs(src) : [];
      const ins = tgt ? getNodeInputs(tgt) : [];
      const matched = outs.find((o) => ins.includes(o) || o === 'any' || ins.includes('any'));
      const color = matched && matched !== 'any' ? PORT_COLOR[matched] : undefined;
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            ...(color ? { style: { stroke: color, strokeWidth: 2 } } : {}),
            data: { portType: matched ?? 'any' },
          },
          eds
        )
      );
    },
    [resetConnectionPanMode, assignActiveNodeSerials]
  );

  // ReactFlow 拖线连接时的实时校验(在连线处于“预览”阶段就拦截不兼容连接)
  const onIsValidConnection = useCallback(
    (params: Connection | Edge) => {
      const curNodes = nodesRef.current;
      const src = curNodes.find((n) => n.id === (params as Connection).source);
      const tgt = curNodes.find((n) => n.id === (params as Connection).target);
      return isConnectionValid(src, tgt);
    },
    []
  );

  // ===== 拖线到空白处 → 弹出候选节点菜单 =====
  const onConnectStart = useCallback(
    (_e: any, params: { nodeId: string | null; handleType: 'source' | 'target' | null }) => {
      if (!params.nodeId || !params.handleType) return;
      connectingFromRef.current = { nodeId: params.nodeId, handleType: params.handleType };
      isConnectionDraggingRef.current = true;
      setConnectionPanMode(false);

      const evt = _e as MouseEvent;
      handleBulkReconnectConnectStart(evt, params);
    },
    [handleBulkReconnectConnectStart, setConnectionPanMode]
  );

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const from = connectingFromRef.current;
      const target = event.target as HTMLElement | null;
      const droppedOnHandle = getReactFlowHandleInfo(target);
      if (connectionPanModeRef.current && from && !droppedOnHandle && !hasPendingBulkReconnect()) {
        // Space 导航模式下，松开鼠标只是结束本次拖动画布；保留起点，
        // 用户可以继续平移画布，随后点击目标接口完成连接。
        connectionPanPointerRef.current = null;
        return;
      }
      connectingFromRef.current = null;
      resetConnectionPanMode();

      if (handleBulkReconnectConnectEnd(event)) return;

      // ===== 普通拖线逻辑 =====
      if (!from) return;
      // 终点是否落在 Handle / 节点 / 连线上:任何一项命中都交给 ReactFlow 默认连接逻辑处理,不弹出候选菜单
      // 仅当鼠标释放在“空白画布”(pane / background 本体或其隔层子)时才弹菜单
      // 例外: 拖到 GroupBox(节点组)的内部空白区域也应该被视作“空白” → 弹菜单
      if (!target) return;
      const onHandle = !!target.closest('.react-flow__handle');
      const nodeEl = target.closest('.react-flow__node') as HTMLElement | null;
      const onEdge = !!target.closest('.react-flow__edge');
      // 判断是否落在真实节点上 (排除 groupBox 类型: groupBox 本身应被当作“区域容器” 而非可连接节点)
      let onNode = false;
      if (nodeEl) {
        const hitId = nodeEl.getAttribute('data-id');
        const hitNode = hitId ? nodes.find((n) => n.id === hitId) : null;
        // groupBox 节点 不作为“节点”处理 → 允许弹出候选菜单
        if (hitNode && hitNode.type !== 'groupBox') onNode = true;
      }
      // 如果落在 Handle/真实节点/连线 上,让 ReactFlow 自己处理(已连 / 不连),则不弹菜单
      if (onHandle || onNode || onEdge) return;
      // 获取坐标
      const clientX =
        (event as MouseEvent).clientX ?? (event as TouchEvent).changedTouches?.[0]?.clientX ?? 0;
      const clientY =
        (event as MouseEvent).clientY ?? (event as TouchEvent).changedTouches?.[0]?.clientY ?? 0;
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
      setPicker({
        fromNodeId: from.nodeId,
        fromHandleType: from.handleType,
        flowPos,
        screenPos: { x: clientX, y: clientY },
      });
    },
    [handleBulkReconnectConnectEnd, hasPendingBulkReconnect, resetConnectionPanMode, screenToFlowPosition, nodes]
  );

  // 拉线时按 Space 进入“连线导航”模式，适合远距离连线。
  // 鼠标可松开；起点会保留到点击目标接口、再次按 Space 取消，或窗口失焦。
  const { connectionPanShortcutLabel } = useCanvasConnectionPanMode({
    shortcuts,
    isConnectionDraggingRef,
    connectionPanModeRef,
    connectingFromRef,
    connectionPanPointerRef,
    onConnect,
    getViewport,
    setViewport,
    setConnectionPanMode,
    resetConnectionPanMode,
    isTextEditingTarget,
    getReactFlowHandleInfo,
  });

  const { focusNodeBySerialId, handleViewportHotkeys } = useCanvasViewportHotkeys({
    activeId,
    loaded,
    loadedCanvasId,
    nodes,
    nodesRef,
    selectedCount,
    bulkPhantomId: BULK_PHANTOM_ID,
    shortcuts,
    screenToFlowPosition,
    getViewport,
    setCenter,
    fitView,
    isShortcutBlocked: isCanvasOverviewShortcutBlocked,
  });

  // 计算候选节点列表(根据起始节点输出/输入类型过滤)
  const pickerCandidates = useMemo<Array<NodeMeta & { matchedTypes: PortType[] }>>(() => {
    if (!picker) return [];
    const fromNode = nodes.find((n) => n.id === picker.fromNodeId);
    if (!fromNode) return [];
    // 从 source handle 拉出: 源节点输出 → 候选节点需要有能收这些输出的输入
    // 从 target handle 拉出: 源节点输入 → 候选节点需要有能被其接受的输出
    const isFromSource = picker.fromHandleType === 'source';
    const fromOuts = isFromSource ? getNodeOutputs(fromNode) : [];
    const fromIns = !isFromSource ? getNodeInputs(fromNode) : [];

    return NODE_REGISTRY.flatMap((meta) => {
      // 隐藏节点不作为候选项出现(仅从主动添加入口中移除,不影响已存在节点连边)
      if (meta.hidden) return [];
      // 不推荐带动态输出的 upload 作为候选 source⚡但允许它作为 target(upload 本身不受输入,实际最后会被过滤)
      const ports = NODE_PORTS[meta.type];
      if (!ports) return [];
      let matched: PortType[] = [];
      if (isFromSource) {
        // 需要 meta.inputs 与 fromOuts 有交集
        if (!arePortsCompatible(fromOuts, ports.inputs)) return [];
        matched = fromOuts.filter((t) => ports.inputs.includes(t) || ports.inputs.includes('any') || t === 'any');
      } else {
        // 拖出 target handle⚡需要 meta.outputs 与 fromIns 有交集
        // upload 节点 outputs 动态为 [],在此考虑 image/video/audio 均可作为潜在输出源
        const candidateOuts = meta.type === 'upload' ? (['image', 'video', 'audio'] as PortType[]) : ports.outputs;
        if (!arePortsCompatible(candidateOuts, fromIns)) return [];
        matched = candidateOuts.filter((t) => fromIns.includes(t) || fromIns.includes('any') || t === 'any');
      }
      return [{ ...meta, matchedTypes: matched }];
    }).sort((a, b) => {
      // 中继节点(relay)永远置顶,作为最常用的透传/分发节点入口
      if (a.type === 'relay' && b.type !== 'relay') return -1;
      if (b.type === 'relay' && a.type !== 'relay') return 1;
      return 0;
    });
  }, [picker, nodes]);

  // 点击候选项→ 在拖落位置创建节点并自动连线
  const handlePickCandidate = useCallback(
    (meta: NodeMeta) => {
      if (!picker) return;
      const id = `${meta.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newNode: Node = {
        id,
        type: meta.type,
        position: picker.flowPos,
        data: { ...(INITIAL_DATA[meta.type] || {}) },
      };
      const [nodeWithSerial] = assignActiveNodeSerials([newNode], nodes);
      setNodes((prev) => [...prev, nodeWithSerial]);

      // 创建连线:根据 source/target 方向
      const isFromSource = picker.fromHandleType === 'source';
      const params: Connection = isFromSource
        ? { source: picker.fromNodeId, target: id, sourceHandle: null, targetHandle: null }
        : { source: id, target: picker.fromNodeId, sourceHandle: null, targetHandle: null };

      // 染色(使用 nodes + 新节点计算)
      const fromNode = nodes.find((n) => n.id === picker.fromNodeId);
      const tempNewNode = nodeWithSerial || newNode;
      const src = isFromSource ? fromNode : tempNewNode;
      const tgt = isFromSource ? tempNewNode : fromNode;
      const outs = src ? getNodeOutputs(src) : [];
      const ins = tgt ? getNodeInputs(tgt) : [];
      const matched = outs.find((o) => ins.includes(o) || o === 'any' || ins.includes('any'));
      const color = matched && matched !== 'any' ? PORT_COLOR[matched] : undefined;

      setEdges((eds) =>
        addEdge(
          {
            ...params,
            ...(color ? { style: { stroke: color, strokeWidth: 2 } } : {}),
            data: { portType: matched ?? 'any' },
          },
          eds
        )
      );
      setPicker(null);
    },
    [picker, nodes, assignActiveNodeSerials]
  );

  const handleConnectPickerToNodeId = useCallback(() => {
    if (!picker) return;
    const raw = window.prompt(
      picker.fromHandleType === 'source'
        ? '输入要连接到的 NodeID'
        : '输入要作为来源的 NodeID',
    );
    if (raw === null) return;
    const result = resolveConnectionByNodeSerialId({
      nodes: nodesRef.current,
      edges: edgesRef.current,
      fromNodeId: picker.fromNodeId,
      fromHandleType: picker.fromHandleType,
      nodeSerialInput: raw,
    });
    if (!result.ok) {
      logBus.warn(result.message, '发送到ID');
      return;
    }
    onConnect(result.connection);
    setPicker(null);
    const serialId = parseNodeSerialInput(raw);
    logBus.success(`已连接 NodeID #${serialId}`, '发送到ID');
  }, [onConnect, picker]);

  // ===== 自动登记生成库 =====
  // 生成库是短期产物池，和长期资源库分离；节点一旦出现新的图片/视频/音频 URL，就静默登记。
  const generationLibraryRegisteredRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!loaded || !activeId) return;
    const pending: Array<api.AddGenerationLibraryItemPayload> = [];
    for (const node of nodes) {
      const type = String(node.type || '');
      if (!GENERATION_LIBRARY_NODE_TYPES.has(type)) continue;
      const data = (node.data || {}) as Record<string, any>;
      if (data.__loopAccumulate) continue;
      for (const kind of ['image', 'video', 'audio'] as const) {
        for (const item of getMediaItemsFromData(data, kind)) {
          if (!item.url || !item.url.startsWith('/files/output/')) continue;
          const key = `${activeId}:${node.id}:${kind}:${item.url}`;
          if (generationLibraryRegisteredRef.current.has(key)) continue;
          generationLibraryRegisteredRef.current.add(key);
          pending.push({
            kind,
            url: item.url,
            title: item.name || fileNameFromUrl(item.url),
            mime: item.mime,
            size: item.size,
            sourceNodeId: node.id,
            sourceCanvasId: activeId,
            taskId: typeof data.taskId === 'string' ? data.taskId : undefined,
            providerId: typeof data.providerId === 'string' ? data.providerId : undefined,
            modelId: typeof data.providerModel === 'string' ? data.providerModel : typeof data.model === 'string' ? data.model : undefined,
          });
        }
      }
    }
    if (pending.length === 0) return;
    void Promise.all(pending.map((item) => api.addGenerationLibraryItem(item))).then(() => {
      window.dispatchEvent(new CustomEvent('penguin:generation-library-changed'));
    }).catch((error) => {
      logBus.warn(error?.message || '生成库登记失败', '生成库');
    });
  }, [activeId, loaded, nodes]);

  // ===== 自动创建输出素材节点 =====
  // 生成类节点 (image/video/audio/seedance/llm/runninghub 等) 输出字段有值后,
  // 自动创建对应数量的 OutputNode 并连线。
  // 防循环: 以 nodeId -> sig(输出项列表哈希) 记忆已处理状态,
  // 同 sig 不重复创建; 且跳过本身就是 OutputNode 的节点避免链式爆炸.
  const autoOutputProcessedRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    if (!loaded) return;
    // v1.2.8.2: 'pick-from-set' 是中转节点 (从合集取一个供下游), 不应被自动挂 OutputNode
    // v1.2.9.9: 'loop' 也加入 — 循环器自身不产出最终结果 (累积已由下游 EXEC→OutputNode 链路接管),
    //          autoOutput 若给 LoopNode 自动建 OutputNode 会让用户看到 “循环器自己生了 N 个素材” 的错误体验。
    // PoseMaster 自己负责写入单张/合集 OutputNode；通用 autoOutput 再处理会把批量合集拆出重复单体。
    const SKIP_TYPES = new Set(['output', 'groupBox', 'bulkPhantom', 'upload', 'material-set', 'pick-from-set', 'loop', 'pose-master']);

    const toAddNodes: Node[] = [];
    const toAddEdges: Edge[] = [];
    const toRemoveNodeIds = new Set<string>();
    const toRemoveEdgeIds = new Set<string>();
    const newSigPatches: Array<[string, string]> = [];
    // v1.2.10.5-hotfix: 同一次 effect 内多个源节点补建的 OutputNode 之间互不可见 (nodes 快照不包含本轮刚 push 的节点),
    // 会导致多源场景下新 OutputNode 之间重叠。累积到 pendingPlacedNodes, 每次避让合并进 existing。
    const pendingPlacedNodes: Node[] = [];

    for (const n of nodes) {
      const t = n.type as string;
      if (!t || SKIP_TYPES.has(t)) continue;
      const d = (n.data as any) || {};
      // v1.2.9.10: 正在被 LoopNode 累积跑路的 EXEC 节点 (带 __loopAccumulate 标记) 跳过,
      //          避免 autoOutput 把下游的 OutputNode 升级为 pickKind+pickIndex (会误将累积全集切为单项)。
      //          OutputNode 侧的 v1.2.9.10 修复 (hasAnyDirectAccumulated 跳过 pickKind) 是主双保险,
      //          本处跳过是避免不必要的 store write 和数据污染。
      if (d.__loopAccumulate) continue;
      // v1.2.10.5-hotfix2: 跟過源节点尚未被 DOM 测量时跳过，下一轮 nodes 更新（带上 measured）会重新触发 effect。
      // 避免用不准确的字典尺寸计算 baseX 导致 desired position 落在源节点可视范围内。
      if (!(n as any).measured?.width) continue;
      // v1.2.8.2: 循环器仅在完成后才让 autoOutput 处理, 避免运行中注入 items[i] 时被误认为
      // “已生产产物” 并创建个空的 OutputNode。在 status='success' 时 d.imageUrls/videoUrls/audioUrls
      // 数组才是最终聚合产物, 交给 autoOutput 判并拆为 N 个 OutputNode (每行 3 个网格)。
      if (t === 'loop' && d?.status !== 'success') continue;

      // === v1.2.8.3: FramePair 双端口专属路径 ===
      // 不走通用 imageUrls 聚合 (FramePair 已不再写 imageUrl/imageUrls), 按 first/last
      // 各创建一个带 sourceHandle 的 OutputNode, useUpstreamMaterials 按 handle 正确过滤到对应帧。
      if (t === 'frame-pair') {
        const first = typeof d.firstFrameUrl === 'string' ? d.firstFrameUrl : '';
        const last = typeof d.lastFrameUrl === 'string' ? d.lastFrameUrl : '';
        if (!first || !last) continue;
        const sig = `frame-pair:${first}|${last}`;
        if (autoOutputProcessedRef.current.get(n.id) === sig) continue;
        // 已被连接的 sourceHandle 集合
        const usedHandles = new Set<string | null>();
        for (const e of edges) {
          if (e.source !== n.id) continue;
          usedHandles.add((e as any).sourceHandle ?? null);
        }
        // null/默认 handle 也能充当任意一边（兼容旧连接）——只要这边有一个 OutputNode 进来, 就不重复补
        const _srcRectFP = rectOf(n);
        const baseX = (n.position?.x ?? 0) + _srcRectFP.w + 80;
        const need: Array<'first' | 'last'> = [];
        if (!usedHandles.has('first') && !usedHandles.has(null)) need.push('first');
        if (!usedHandles.has('last')) need.push('last');
        // 若 null 已占位, 仅备份 'last' 偶尔多补一个 (使用者手动拖一根默认就应默认 first)
        newSigPatches.push([n.id, sig]);
        if (need.length === 0) continue; // v1.2.10.5-hotfix3: 无需创建则跳过，避免无用的 placeBatchNodes 调用 + 诊断噪音
        // v1.2.10.5: 整组防重叠 —— 先算期望单列矩形, 再求公共偏移
        const _szFP = defaultSizeOf('output');
        // v1.2.10.7: baseY 对齐源节点垂直中心（handle 位置），避免输出偏上
        const _groupHFP = (need.length - 1) * 360 + _szFP.h;
        const baseY = (n.position?.y ?? 0) + _srcRectFP.h / 2 - _groupHFP / 2;
        const _desiredFP: PlacementRect[] = need.map((_, i) => ({
          x: baseX, y: baseY + i * 360, w: _szFP.w, h: _szFP.h,
        }));
        const _offFP = placeBatchNodes(_desiredFP, [...nodes, ...pendingPlacedNodes], { source: 'placement:auto-frame-pair', gap: 0 });
        for (let i = 0; i < need.length; i++) {
          const h = need[i];
          const newId = `output-auto-${n.id}-${Date.now()}-${h}-${Math.random().toString(36).slice(2, 6)}`;
          const _newNode: Node = {
            id: newId,
            type: 'output',
            position: { x: baseX + _offFP.dx, y: baseY + i * 360 + _offFP.dy },
            data: {}, // 不带 pickKind/pickIndex, 让 useUpstreamMaterials 按 sourceHandle 过滤
            selected: false,
          } as Node;
          toAddNodes.push(_newNode);
          pendingPlacedNodes.push(_newNode);
          toAddEdges.push({
            id: `e-auto-${newId}`,
            source: n.id,
            target: newId,
            sourceHandle: h,
            type: 'deletable',
          } as Edge);
        }
        continue;
      }

      // === v1.2.9.14: Suno (audio) 双轨专属路径 ===
      // AudioNode (type='audio') 双输出口 audio-0 (主轨 audioUrl) + audio-1 (副轨 audioUrl_1),
      // 与 FramePair 同模式: 按轨创建带 sourceHandle 的 OutputNode, 不走通用 pickKind/pickIndex 路径,
      // useUpstreamMaterials / OutputNode collected 会按 handle 过滤到对应轨 (循环中各轨独立累积 N 首，不会集中到出口 1)。
      if (t === 'audio') {
        const a0 = typeof d.audioUrl === 'string' ? d.audioUrl : '';
        const a1 = typeof d.audioUrl_1 === 'string' ? d.audioUrl_1 : '';
        if (!a0 && !a1) continue;
        const sig = `suno:${a0}|${a1}`;
        if (autoOutputProcessedRef.current.get(n.id) === sig) continue;
        const usedHandles = new Set<string | null>();
        for (const e of edges) {
          if (e.source !== n.id) continue;
          usedHandles.add((e as any).sourceHandle ?? null);
        }
        const _srcRectSU = rectOf(n);
        const baseX = (n.position?.x ?? 0) + _srcRectSU.w + 80;
        const need: Array<'audio-0' | 'audio-1'> = [];
        // null 默认占位则 audio-0 不重复创建（老连接兼容）
        if (a0 && !usedHandles.has('audio-0') && !usedHandles.has(null)) need.push('audio-0');
        if (a1 && !usedHandles.has('audio-1')) need.push('audio-1');
        if (need.length === 0) { newSigPatches.push([n.id, sig]); continue; }
        newSigPatches.push([n.id, sig]);
        // v1.2.10.5: 整组防重叠
        const _szSU = defaultSizeOf('output');
        // v1.2.10.7: baseY 对齐源节点垂直中心（handle 位置），避免输出偏上
        const _groupHSU = (need.length - 1) * 360 + _szSU.h;
        const baseY = (n.position?.y ?? 0) + _srcRectSU.h / 2 - _groupHSU / 2;
        const _desiredSU: PlacementRect[] = need.map((_, i) => ({
          x: baseX, y: baseY + i * 360, w: _szSU.w, h: _szSU.h,
        }));
        const _offSU = placeBatchNodes(_desiredSU, [...nodes, ...pendingPlacedNodes], { source: 'placement:auto-suno', gap: 0 });
        for (let i = 0; i < need.length; i++) {
          const h = need[i];
          const newId = `output-auto-${n.id}-${Date.now()}-${h}-${Math.random().toString(36).slice(2, 6)}`;
          const _newNode: Node = {
            id: newId,
            type: 'output',
            position: { x: baseX + _offSU.dx, y: baseY + i * 360 + _offSU.dy },
            data: {}, // 不带 pickKind/pickIndex。由 useUpstreamMaterials/OutputNode collected 按 sourceHandle 滤
            selected: false,
          } as Node;
          toAddNodes.push(_newNode);
          pendingPlacedNodes.push(_newNode);
          toAddEdges.push({
            id: `e-auto-${newId}`,
            source: n.id,
            target: newId,
            sourceHandle: h,
            type: 'deletable',
          } as Edge);
        }
        continue;
      }

      // 提取输出项 (去重 + 过滤 + 同类型内序号)
      const seen = new Set<string>();
      const imgs: string[] = [];
      const vids: string[] = [];
      const auds: string[] = [];
      const pushImg = (u: any) => {
        if (typeof u !== 'string' || !u || seen.has(u)) return;
        seen.add(u);
        imgs.push(u);
      };
      const pushVid = (u: any) => {
        if (typeof u !== 'string' || !u || seen.has(u)) return;
        seen.add(u);
        vids.push(u);
      };
      const pushAud = (u: any) => {
        if (typeof u !== 'string' || !u || seen.has(u)) return;
        seen.add(u);
        auds.push(u);
      };
      pushImg(d.imageUrl);
      if (Array.isArray(d.imageUrls)) d.imageUrls.forEach(pushImg);
      // d.urls 是通用产物数组（RH 使用），可能同时含图/视频/音频。
      // 按扩展名分流，避免 mp4 url 被当 image 加入 imgs 后下游 OutputNode 误用 pickKind='image' 过滤。
      if (Array.isArray(d.urls)) {
        const isVidExt = (u: string) => /\.(mp4|webm|mov|m4v|mkv)(\?.*)?$/i.test(u);
        const isAudExt = (u: string) => /\.(mp3|wav|ogg|m4a|flac|aac)(\?.*)?$/i.test(u);
        d.urls.forEach((u: any) => {
          if (typeof u !== 'string' || !u) return;
          if (isVidExt(u)) pushVid(u);
          else if (isAudExt(u)) pushAud(u);
          else pushImg(u);
        });
      }
      if (Array.isArray(d.generatedImages)) d.generatedImages.forEach(pushImg);
      pushVid(d.videoUrl);
      // v1.2.8.2: 支持 videoUrls 数组 (LoopNode 聚合多个视频产物)
      if (Array.isArray(d.videoUrls)) d.videoUrls.forEach(pushVid);
      pushAud(d.audioUrl);
      // Suno / AudioNode 双轨输出口: audioUrl=轨1, audioUrl_1=轨2
      // 不取 audioUrl_1 会导致 autoOutput 只创建 1 个 OutputNode
      pushAud(d.audioUrl_1);
      // v1.2.8.2: 支持 audioUrls 数组 (LoopNode 聚合多个音频产物)
      if (Array.isArray(d.audioUrls)) d.audioUrls.forEach(pushAud);
      // 合成 items: 靠 kindIndex 让下游 OutputNode 能准确拾取对应索引的那一项
      const items: Array<{ kind: 'image' | 'video' | 'audio'; url: string; kindIndex: number }> = [
        ...imgs.map((url, i) => ({ kind: 'image' as const, url, kindIndex: i })),
        ...vids.map((url, i) => ({ kind: 'video' as const, url, kindIndex: i })),
        ...auds.map((url, i) => ({ kind: 'audio' as const, url, kindIndex: i })),
      ];
      if (items.length === 0) continue;

      const sig = items.map((x) => `${x.kind}:${x.url}`).join('|');
      const lastSig = autoOutputProcessedRef.current.get(n.id);
      if (lastSig === sig) continue;

      // 收集当前下游 OutputNode（手动 + 自动）。
      // 生成节点的多产物默认收纳到同一个集合 OutputNode，由 OutputNode 内部自适应网格展示。
      const downstreamOutputs: Array<{
        id: string;
        pickKind?: string;
        pickIndex?: number;
        incomingFromMe: number;
        auto: boolean;
        removable: boolean;
      }> = [];
      for (const e of edges) {
        if (e.source !== n.id) continue;
        const t = nodes.find((x) => x.id === e.target);
        if (!t || t.type !== 'output') continue;
        const td: any = t.data || {};
        // 限仅封闭: 如果该 OutputNode 还连了别的上游, 不能随便修改它的 pickKind
        const incomingFromMe = edges.filter((x) => x.target === t.id && x.source === n.id).length;
        const totalIncoming = edges.filter((x) => x.target === t.id).length;
        const hasOutgoing = edges.some((x) => x.source === t.id);
        const auto = t.id.startsWith('output-auto-') && e.id.startsWith('e-auto-');
        const removable = auto && totalIncoming === 1 && !hasOutgoing && td.userMoved !== true;
        if (totalIncoming > 1) {
          // 多上游合并节点 → 不动 data, 但计数占位
          downstreamOutputs.push({ id: t.id, pickKind: td.pickKind, pickIndex: td.pickIndex, incomingFromMe, auto, removable: false });
          continue;
        }
        downstreamOutputs.push({ id: t.id, pickKind: td.pickKind, pickIndex: td.pickIndex, incomingFromMe, auto, removable });
      }

      const itemKey = (it: { kind: string; kindIndex: number }) => `${it.kind}:${it.kindIndex}`;
      const validItemKeys = new Set(items.map(itemKey));
      const activeDownstreamOutputs = downstreamOutputs.filter((o) => {
        if (
          o.removable &&
          o.pickKind &&
          typeof o.pickIndex === 'number' &&
          !validItemKeys.has(`${o.pickKind}:${o.pickIndex}`)
        ) {
          toRemoveNodeIds.add(o.id);
          for (const edge of edges) {
            if (edge.source === o.id || edge.target === o.id) toRemoveEdgeIds.add(edge.id);
          }
          return false;
        }
        return true;
      });

      if (activeDownstreamOutputs.length !== downstreamOutputs.length) {
        console.warn('[autoOutput] 清理过期自动输出节点', downstreamOutputs.length - activeDownstreamOutputs.length);
      }

      newSigPatches.push([n.id, sig]);

      const existingCollectionOutput = activeDownstreamOutputs.find((o) => !o.pickKind) || activeDownstreamOutputs[0];
      if (existingCollectionOutput) {
        setNodes((prev) =>
          prev.map((nd) => {
            if (nd.id !== existingCollectionOutput.id) return nd;
            const nextData = { ...(nd.data as any), groupOutputMode: 'collection' };
            delete nextData.pickKind;
            delete nextData.pickIndex;
            return { ...nd, data: nextData };
          })
        );
        continue;
      }

      const _srcRectGen = rectOf(n);
      const baseX = (n.position?.x ?? 0) + _srcRectGen.w + 80;

      // v1.2.10.5: 集合输出节点防重叠 —— 只补建一个自适应 OutputNode。
      const _szGen = defaultSizeOf('output');
      const baseY = (n.position?.y ?? 0) + _srcRectGen.h / 2 - _szGen.h / 2;
      const _desiredGen: PlacementRect[] = [{ x: baseX, y: baseY, w: _szGen.w, h: _szGen.h }];
      const _offGen = placeBatchNodes(_desiredGen, [...nodes, ...pendingPlacedNodes], { source: 'placement:auto-output', gap: 0 });

      const newId = `output-auto-${n.id}-${Date.now()}-collection-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      const _newNodeGen: Node = {
        id: newId,
        type: 'output',
        position: { x: baseX + _offGen.dx, y: baseY + _offGen.dy },
        data: { groupOutputMode: 'collection' },
        selected: false,
      } as Node;
      toAddNodes.push(_newNodeGen);
      pendingPlacedNodes.push(_newNodeGen);
      toAddEdges.push({
        id: `e-auto-${newId}`,
        source: n.id,
        target: newId,
        type: 'deletable',
      } as Edge);
    }

    // 先写 ref 避免下次 useEffect 重进入重复创建
    for (const [id, sig] of newSigPatches) autoOutputProcessedRef.current.set(id, sig);
    if (toRemoveNodeIds.size > 0 || toAddNodes.length > 0) {
      if (toAddNodes.length > 0) {
        console.warn('[autoOutput] 创建', toAddNodes.length, '个节点, pending累积:', pendingPlacedNodes.length,
        '\n  positions:', toAddNodes.map(n => `${n.id.slice(0,20)}.. (${Math.round(n.position.x)},${Math.round(n.position.y)})`));
      }
      setNodes((prev) => [
        ...prev.filter((node) => !toRemoveNodeIds.has(node.id)),
        ...assignActiveNodeSerials(toAddNodes, prev.filter((node) => !toRemoveNodeIds.has(node.id))),
      ]);
    }
    if (toRemoveEdgeIds.size > 0 || toAddEdges.length > 0) {
      setEdges((prev) => [
        ...prev.filter((edge) => !toRemoveEdgeIds.has(edge.id)),
        ...toAddEdges,
      ]);
    }
  }, [nodes, edges, loaded, assignActiveNodeSerials]);

  // ===== 自动外挂 OutputNode 的网格重排 =====
  // 创建时使用了固定占位坐标 (350x360), 但节点实际宽高取决于
  // 里面的图片/视频 measured 尺寸, 会造成节点互相遮挡。
  // 本 useEffect 以 e-auto- 开头的 edge 定位出同一上游下的所有自动 OutputNode,
  // 按 pickIndex 排序, 取各列 max(width)、各行 max(height) 作为列宽/行高,
  // 重新计算 position 使节点沿边对齐且互不遮挡。
  // 只动 id 以 'output-auto-' 开头的节点, 避免影响手动创建的 OutputNode。
  const REORDER_GAP = 30;
  const REORDER_COLS = 3;
  useEffect(() => {
    if (!loaded) return;
    // 按 source 分组收集自动外挂的 OutputNode
    const groups = new Map<string, Node[]>();
    for (const e of edges) {
      if (!e.id.startsWith('e-auto-')) continue;
      const target = nodes.find((n) => n.id === e.target);
      if (!target || target.type !== 'output') continue;
      if (!target.id.startsWith('output-auto-')) continue;
      let g = groups.get(e.source);
      if (!g) {
        g = [];
        groups.set(e.source, g);
      }
      g.push(target);
    }
    if (groups.size === 0) return;

    const updates = new Map<string, { x: number; y: number }>();
    for (const [srcId, list] of groups) {
      const src = nodes.find((n) => n.id === srcId);
      if (!src) continue;
      // 按 pickIndex 排序, 保证顺序与上游输出一致
      list.sort((a, b) => {
        const ai = (a.data as any)?.pickIndex ?? 0;
        const bi = (b.data as any)?.pickIndex ?? 0;
        return ai - bi;
      });
      // measured 优先, 未渲染出来前回退到占位尺寸
      const dims = list.map((n) => ({
        w: (n as any).measured?.width || (n as any).width || 320,
        h: (n as any).measured?.height || (n as any).height || 360,
      }));
      const rowsCount = Math.ceil(list.length / REORDER_COLS);
      const colMaxW = new Array(REORDER_COLS).fill(0);
      const rowMaxH = new Array(rowsCount).fill(0);
      list.forEach((_, i) => {
        const c = i % REORDER_COLS;
        const r = Math.floor(i / REORDER_COLS);
        if (dims[i].w > colMaxW[c]) colMaxW[c] = dims[i].w;
        if (dims[i].h > rowMaxH[r]) rowMaxH[r] = dims[i].h;
      });
      // 累加出各列 / 各行 的起点偏移
      const colX = new Array(REORDER_COLS).fill(0);
      for (let c = 1; c < REORDER_COLS; c++) {
        colX[c] = colX[c - 1] + colMaxW[c - 1] + REORDER_GAP;
      }
      const rowY = new Array(rowsCount).fill(0);
      for (let r = 1; r < rowsCount; r++) {
        rowY[r] = rowY[r - 1] + rowMaxH[r - 1] + REORDER_GAP;
      }
      const srcW = (src as any).measured?.width || (src as any).width || 320;
      const srcH = (src as any).measured?.height || (src as any).height || 360;
      // v1.2.10.5-hotfix4: reorder 只负责内部网格对齐，不做碰撞避让（避让是 autoOutput 的职责）。
      // 用第一个节点的当前位置作为锚点，保留 autoOutput 算好的偏移，避免无限循环。
      const naturalBaseX = (src.position?.x ?? 0) + srcW + 80;
      // v1.2.10.7: naturalBaseY 对齐源节点垂直中心
      const _totalGridH = rowY[rowsCount - 1] + rowMaxH[rowsCount - 1];
      const naturalBaseY = (src.position?.y ?? 0) + srcH / 2 - _totalGridH / 2;
      const firstNode = list[0];
      const baseX = firstNode.position?.x ?? naturalBaseX;
      const baseY = firstNode.position?.y ?? naturalBaseY;
      // 内部网格布局：直接用 baseX + colX/rowY 对齐，不做外部碰撞检测（避免无限循环）
      list.forEach((n, i) => {
        const c = i % REORDER_COLS;
        const r = Math.floor(i / REORDER_COLS);
        const newX = baseX + colX[c];
        const newY = baseY + rowY[r];
        const cx = n.position?.x ?? 0;
        const cy = n.position?.y ?? 0;
        // 用户手动拖动过的节点 (data.userMoved=true) 跳过, 保留位置
        if ((n.data as any)?.userMoved === true) return;
        // 误差大于 1px 才修正, 避免微量抖动触发无限重渲染
        if (Math.abs(cx - newX) > 1 || Math.abs(cy - newY) > 1) {
          updates.set(n.id, { x: newX, y: newY });
        }
      });
    }
    if (updates.size > 0) {
      setNodes((prev) =>
        prev.map((n) => {
          const p = updates.get(n.id);
          return p ? { ...n, position: p } : n;
        })
      );
    }
  }, [nodes, edges, loaded]);

  // ===== 外部素材粘贴: Ctrl+V 图像/视频/音频直接生成上传素材节点 =====
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!activeId || isTextEditingTarget(e.target)) return;
      if (document.querySelector('.img-edit-overlay')) return;
      const files = collectCanvasMediaFiles(e.clipboardData);
      if (files.length === 0) return;
      const pointerTarget = lastCanvasPointerRef.current
        ? document.elementFromPoint(lastCanvasPointerRef.current.x, lastCanvasPointerRef.current.y)
        : null;
      const uploadTargetNodeId =
        findUploadNodeIdFromTarget(e.target) ||
        findUploadNodeIdFromTarget(pointerTarget);
      if (internalPasteTimerRef.current) {
        window.clearTimeout(internalPasteTimerRef.current);
        internalPasteTimerRef.current = null;
      }
      const signature = files
        .map(canvasMediaFileKey)
        .join('||');
      const actionSignature = `${uploadTargetNodeId || 'new-upload-node'}::${signature}`;
      const now = Date.now();
      const last = lastExternalMediaPasteRef.current;
      e.preventDefault();
      e.stopPropagation();
      if (last?.signature === actionSignature && now - last.at < EXTERNAL_MEDIA_PASTE_DEDUPE_MS) return;
      lastExternalMediaPasteRef.current = { signature: actionSignature, at: now };
      if (uploadTargetNodeId) {
        void replaceUploadNodeFromFiles(uploadTargetNodeId, files);
        return;
      }
      void createUploadNodesFromFiles(files);
    };
    window.addEventListener('paste', onPaste, true);
    return () => window.removeEventListener('paste', onPaste, true);
  }, [activeId, createUploadNodesFromFiles, replaceUploadNodeFromFiles]);

  // ===== 全局快捷键 =====
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 当焦点在表单元素中时不拦截
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const isEditing =
        tag === 'input' ||
        tag === 'textarea' ||
        (e.target as HTMLElement | null)?.isContentEditable;
      // Undo / Redo 全局拦截(即使在输入框,Ctrl+Z 也属于画布,但更友好的是输入框内不抢占)
      if (matchesAnyShortcut(shortcuts['canvas.undo'], e)) {
        if (isEditing) return;
        e.preventDefault();
        histUndo();
        return;
      }
      if (matchesAnyShortcut(shortcuts['canvas.redo'], e)) {
        if (isEditing) return;
        e.preventDefault();
        histRedo();
        return;
      }
      if (isEditing) return;
      if (matchesAnyShortcut(shortcuts['canvas.copy'], e)) {
        e.preventDefault();
        handleCopy();
      } else if (matchesAnyShortcut(shortcuts['canvas.paste-links'], e)) {
        // Ctrl+Shift+V: 连边粘贴 — 新节点与原画布邻居保持连接
        e.preventDefault();
        handlePaste(true);
      } else if (matchesAnyShortcut(shortcuts['canvas.paste'], e)) {
        if (!clipboardRef.current?.nodes?.length) return;
        e.preventDefault();
        if (internalPasteTimerRef.current) window.clearTimeout(internalPasteTimerRef.current);
        internalPasteTimerRef.current = window.setTimeout(() => {
          internalPasteTimerRef.current = null;
          const lastExternalPaste = lastExternalMediaPasteRef.current;
          if (lastExternalPaste && Date.now() - lastExternalPaste.at < EXTERNAL_MEDIA_PASTE_DEDUPE_MS) return;
          handlePaste(false);
        }, INTERNAL_NODE_PASTE_DELAY_MS);
      } else if (matchesAnyShortcut(shortcuts['canvas.duplicate'], e)) {
        e.preventDefault();
        handleDuplicate();
      } else if (matchesAnyShortcut(shortcuts['canvas.group'], e)) {
        // Ctrl+G: 快捷打组 (默认浏览器会拦截为「查找下一个」，必须 preventDefault)
        e.preventDefault();
        const selIds = nodes
          .filter((n) => n.selected && n.type !== 'groupBox')
          .map((n) => n.id);
        if (selIds.length >= 1) handleCreateGroup(selIds);
      } else if (handleViewportHotkeys(e)) {
        return;
      } else if (matchesAnyShortcut(shortcuts['canvas.delete'], e)) {
        // xyflow 内置 Backspace 删除,但在节点未选中时仍可能删除连线;
        // 我们手动处理仅删除选中,避免输入边缘情况
        if (selectedCount > 0) {
          e.preventDefault();
          handleDeleteSelected();
        }
      } else if (matchesAnyShortcut(shortcuts['canvas.select-all'], e)) {
        e.preventDefault();
        setNodes((prev) => prev.map((n) => ({ ...n, selected: true })));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (internalPasteTimerRef.current) {
        window.clearTimeout(internalPasteTimerRef.current);
        internalPasteTimerRef.current = null;
      }
    };
  }, [handleViewportHotkeys, histUndo, histRedo, handleCopy, handlePaste, handleDuplicate, handleDeleteSelected, handleCreateGroup, nodes, selectedCount, shortcuts]);

  // 全局滚轮拦截 —— 自动给所有节点内的 input / textarea / select / contenteditable
  // 挂上 wheel.stopPropagation()，让用户在文本框内可用鼠标滚轮滚动文字而不触发画布缩放。
  // 通过 MutationObserver 自动覆盖未来动态新增的节点（如右键添加 / 模板插入等）。
  useEffect(() => {
    const root = (document.querySelector('.react-flow') as HTMLElement | null) || document.body;
    const dispose = installGlobalWheelBlockObserver(root);
    return dispose;
  }, []);

  // ReactFlow 会在 pointerdown capture 阶段启动节点选中/拖拽。
  // 节点内按钮（尤其运行按钮）必须先挡住 down 事件，否则未选中节点的首次点击可能只激活节点。
  useEffect(() => {
    const isNodeButtonDown = (event: PointerEvent | MouseEvent) => {
      if (event.button !== 0) return false;
      if ('isPrimary' in event && event.isPrimary === false) return false;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) return false;
      const button = target.closest('button, [role="button"]') as HTMLElement | null;
      if (!button) return false;
      if (button.closest('[data-node-action-bar]')) return false;
      return !!button.closest('.react-flow__node, [data-node-action-bar]');
    };

    const stopNodeButtonDown = (event: PointerEvent | MouseEvent) => {
      if (!isNodeButtonDown(event)) return;
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    document.addEventListener('pointerdown', stopNodeButtonDown, true);
    document.addEventListener('mousedown', stopNodeButtonDown, true);
    return () => {
      document.removeEventListener('pointerdown', stopNodeButtonDown, true);
      document.removeEventListener('mousedown', stopNodeButtonDown, true);
    };
  }, []);

  const isDark = theme === 'dark';
  const isPixel = style === 'pixel';
  const guideColor = themeTokens.edgeSelected;
  const edgeStroke = themeTokens.edge;
  const dotColor = themeTokens.gridDot;
  const bgColor = themeTokens.canvasBg;

  const memoNodeTypes = useMemo(() => nodeTypes, []);
  const memoEdgeTypes = useMemo(() => edgeTypes, []);

  // ⚠️ 以下几个在 ReactFlow 的 fieldsToTrack 列表中, 必须稳定引用,
  // 否则每次父组件 render 都会让 StoreUpdater 重复 store.setState 反复触发订阅者,
  // 在某些节点拓扑下会退化为 Maximum update depth exceeded。
  const memoSelectionKeyCode = useMemo(() => ['Control', 'Meta'] as string[], []);
  const memoMultiSelectionKeyCode = useMemo(
    () => ['Control', 'Meta', 'Shift'] as string[],
    []
  );
  const memoProOptions = useMemo(() => ({ hideAttribution: true }), []);
  const memoDefaultEdgeOptions = useMemo(
    () => ({
      style: { stroke: edgeStroke, strokeWidth: isPixel ? 2.5 : 2 },
      animated: false,
    }),
    [edgeStroke, isPixel]
  );

  if (!activeId) {
    return (
      <EmptyCanvasSplash
        visualStyle={visualStyle}
        background={`linear-gradient(180deg, rgba(8, 11, 20, 0.96), rgba(9, 12, 20, 0.98)), ${bgColor}`}
        textColor={themeTokens.textMuted}
        onCreate={() => createCanvas(`星图画布 ${canvases.length + 1}`)}
      />
    );
  }

  return (
    <div
      className={`t8-canvas-shell flex-1 relative${connectionPanModeActive ? ' connection-pan-mode-active' : ''}`}
      data-theme-visual={visualStyle}
      style={{ background: bgColor }}
      onContextMenuCapture={onCanvasContextMenuCapture}
      onMouseMove={handleCanvasPointerMove}
    >
      <CanvasToolbar
        canUndo={canUndo}
        canRedo={canRedo}
        selectedCount={selectedCount}
        clipboardCount={clipboardCount}
        onUndo={histUndo}
        onRedo={histRedo}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onDelete={handleDeleteSelected}
        onExport={handleExport}
        onImport={handleImportClick}
        onApplyTemplate={handleApplyTemplate}
        onFindNodeById={focusNodeBySerialId}
        onRunAll={handleRunAll}
        onCancelRun={handleCancelRun}
        isRunning={isRunning}
        batchTotal={batchTotal}
        batchDone={batchDone}
        snapEnabled={snapEnabled}
        onToggleSnap={() => setSnapEnabled((v) => !v)}
        onAlignSelection={handleAlignSelection}
      />
      <TerminalPanel />
      <CanvasOverlayLayer
        connectionPanModeActive={connectionPanModeActive}
        connectionPanShortcutLabel={connectionPanShortcutLabel}
        onCutEdges={(edgeIds) => {
          const idsToCut = new Set(edgeIds);
          setEdges((prev) => prev.filter((edge) => !idsToCut.has(edge.id)));
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportFile}
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={memoNodeTypes}
        edgeTypes={memoEdgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        isValidConnection={onIsValidConnection}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onSelectionContextMenu={onSelectionContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onDragOver={onCanvasFileDragOver}
        onDrop={onCanvasFileDrop}
        onSelectionChange={onSelectionChange}
        onSelectionEnd={onSelectionEnd}
        selectionKeyCode={memoSelectionKeyCode}
        multiSelectionKeyCode={memoMultiSelectionKeyCode}
        selectionMode={SelectionMode.Partial}
        snapToGrid={snapEnabled}
        snapGrid={SNAP_GRID}
        elevateNodesOnSelect={false}
        fitView
        minZoom={CANVAS_MIN_ZOOM}
        maxZoom={CANVAS_MAX_ZOOM}
        proOptions={memoProOptions}
        defaultEdgeOptions={memoDefaultEdgeOptions}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={isPixel ? 1.6 : 1.2}
          color={dotColor}
        />
        <CanvasFlowOverlays
          guides={guides}
          guideColor={guideColor}
          isPixel={isPixel}
          isOp={isOp}
          isNaruto={isNaruto}
          isEva={isEva}
          isYyh={isYyh}
          isSlamdunk={isSlamdunk}
          isSoccer={isSoccer}
          isDark={isDark}
          themeTokens={themeTokens}
          getViewport={getViewport}
          setCenter={setCenter}
          edgeNodeColor={isOp ? themeTokens.secondary : isNaruto ? themeTokens.accent : isEva ? themeTokens.danger : isYyh ? themeTokens.success : isSlamdunk ? themeTokens.accent : isSoccer ? themeTokens.accent : isDark ? '#a1a1aa' : '#52525b'}
        >
          <NodeActionBar />
        </CanvasFlowOverlays>
      </ReactFlow>

      {/* 跨节点素材拖拽浮层 (Ctrl + 鼠标左键 从素材缩略图拖出) */}
      <MaterialDragOverlay />

      {/* 拖线到空白处弹出的候选节点菜单 */}
      {picker && (
        <>
          {/* 遮罩层:点击空白关闭 (fixed 覆盖整个视口,确保点击空白区域可关闭) */}
          <div
            data-canvas-floating-ui="picker-backdrop"
            className="fixed inset-0 z-30"
            onClick={() => setPicker(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setPicker(null);
            }}
          />
          <div
            data-canvas-floating-ui="picker-menu"
            className="fixed z-40 overflow-hidden t8-context-menu t8-context-menu--picker"
            style={{
              // 使用 fixed + clientX/clientY (视口坐标) 让菜单精确跟随鼠标释放位置
              left: Math.min(picker.screenPos.x, window.innerWidth - 280),
              top: Math.min(picker.screenPos.y, window.innerHeight - 360),
              width: 260,
              maxHeight: 360,
            }}
          >
            <div
              className="t8-context-menu__header"
            >
              <span>
                {picker.fromHandleType === 'source' ? '连接到…' : '从…输入'}
              </span>
              <span className="text-[10px] font-normal opacity-60">
                {pickerCandidates.length} 个候选
              </span>
            </div>
            <button
              type="button"
              className="t8-context-menu__item t8-context-menu__item--candidate"
              onClick={handleConnectPickerToNodeId}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  background: isPixel ? '#1A1410' : themeTokens.accent,
                  boxShadow: isPixel ? '0 0 0 1.5px #1A1410' : `0 0 0 2px ${themeTokens.accent}33`,
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium truncate">发送到ID</div>
                <div
                  className="text-[10px] truncate"
                  style={{
                    color: isPixel ? '#7a6f5e' : isDark ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.45)',
                  }}
                >
                  输入已有节点编号并自动连线
                </div>
              </div>
              <div className="text-[10px] opacity-60 flex-shrink-0">#</div>
            </button>
            <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
              {pickerCandidates.length === 0 && (
                <div className="t8-context-menu__empty">
                  没有可连接的节点
                </div>
              )}
              {pickerCandidates.map((cand) => {
                const primary = cand.matchedTypes[0] ?? 'any';
                const dotColor = PORT_COLOR[primary];
                return (
                  <button
                    key={cand.type}
                    onClick={() => handlePickCandidate(cand)}
                    className="t8-context-menu__item t8-context-menu__item--candidate"
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background: dotColor,
                        boxShadow: isPixel ? '0 0 0 1.5px #1A1410' : `0 0 0 2px ${dotColor}33`,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium truncate">{cand.label}</div>
                      <div
                        className="text-[10px] truncate"
                        style={{
                          color: isPixel ? '#7a6f5e' : isDark ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.45)',
                        }}
                      >
                        {cand.description}
                      </div>
                    </div>
                    <div
                      className="flex gap-1 flex-shrink-0"
                      title={cand.matchedTypes.map((t) => PORT_LABEL[t]).join(' / ')}
                    >
                      {cand.matchedTypes.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="text-[9px] px-1.5 py-0.5 rounded"
                          style={{
                            background: PORT_COLOR[t] + '33',
                            color: isPixel ? '#1A1410' : PORT_COLOR[t],
                            border: isPixel ? `1.5px solid #1A1410` : `1px solid ${PORT_COLOR[t]}66`,
                          }}
                        >
                          {PORT_LABEL[t]}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      <SendMaterialsModal
        open={!!sendModal}
        materials={sendModal?.materials || []}
        nodeFragment={sendModal?.nodeFragment}
        sourceLabel={sendModal?.sourceLabel || '素材'}
        defaultMode={sendModal?.defaultMode || 'auto'}
        canvases={canvases}
        activeCanvasId={activeId}
        onClose={() => setSendModal(null)}
        onSendToCanvas={handleSendMaterialsToCanvas}
        onSaveToResource={handleSaveSendMaterialsToResource}
        onSendToEagle={handleSendMaterialsToEagle}
      />

      <CanvasAssistant nodes={nodes} edges={edges} activeCanvasId={activeId} />

      {/* 右键菜单(框选 右键 或 节点右键) */}
      {contextMenu && (() => {
        const ids = contextMenu.ids;
        const selNodes = nodes.filter((n) => ids.includes(n.id));
        const exeCount = selNodes.filter((n) => n.type && EXECUTABLE_NODE_TYPES.has(n.type)).length;
        const mergeCandidate = getMaterialSetMergeCandidate(ids);
        const materialSetNode = ids.length === 1 ? nodes.find((n) => n.id === ids[0] && n.type === 'material-set') : null;
        const materialSetKind = isMaterialSetKind((materialSetNode?.data as any)?.materialSetKind)
          ? ((materialSetNode?.data as any).materialSetKind as MaterialSetKind)
          : null;
        const materialSetItems = materialSetKind
          ? normalizeMaterialSetItems((materialSetNode?.data as any)?.materialSetItems, materialSetKind)
          : [];
        const downloadableCount = getDownloadableItemsFromNodes(ids).length;
        const sendableCount = collectSendableMaterialsFromNodes(selNodes, activeId).length;
        const nodeFragmentPreview = buildSendNodeFragment(selNodes, edges, activeId);
        const sendNodeCount = nodeFragmentPreview.nodes.length;
        const sendEdgeCount = nodeFragmentPreview.edges.length;
        const canSendSelection = sendNodeCount > 0 || sendableCount > 0;
        const sendMenuSummary =
          sendEdgeCount > 0
            ? `${sendNodeCount}节点/${sendEdgeCount}线`
            : sendableCount > 0
              ? `${sendableCount}素材`
              : `${sendNodeCount}节点`;
        const menuItemCls = 't8-context-menu__item';
        const alignMiniBtnCls = 't8-context-menu__item justify-center text-[11px] !px-2 !py-1.5';
        const alignButton = (
          action: NodeAlignAction,
          label: string,
          Icon: ComponentType<{ size?: number }>,
          minCount = 2,
        ) => {
          const disabled = ids.length < minCount;
          return (
            <button
              key={action}
              className={alignMiniBtnCls}
              disabled={disabled}
              title={disabled ? `至少选择 ${minCount} 个节点` : label}
              onClick={() => {
                closeContextMenu();
                handleAlignSelection(action, ids);
              }}
            >
              <Icon size={12} />
              <span>{label}</span>
            </button>
          );
        };
        return (
          <>
            {/* 遮罩层 */}
            <div
              data-canvas-floating-ui="node-menu-backdrop"
              className="fixed inset-0 z-30"
              onClick={closeContextMenu}
              onContextMenu={(e) => {
                e.preventDefault();
                closeContextMenu();
              }}
            />
            <div
              data-canvas-floating-ui="node-menu"
              className="fixed z-40 overflow-hidden t8-context-menu t8-context-menu--selection"
              style={{
                left: Math.min(contextMenu.x, window.innerWidth - 220),
                top: Math.min(contextMenu.y, window.innerHeight - 220),
                width: 200,
              }}
            >
              <div
                className="t8-context-menu__header"
              >
                <span>已选 {ids.length} 个节点</span>
                <span className="text-[10px] font-normal opacity-60">
                  可执行 {exeCount}
                </span>
              </div>
              <div className="px-2 py-2">
                <div className="mb-1 flex items-center gap-1 text-[10px] font-bold opacity-65">
                  <LayoutGrid size={11} />
                  <span>对齐 / 整理</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {alignButton('align-left', '左', AlignStartVertical)}
                  {alignButton('align-center-x', '水平中', AlignCenterVertical)}
                  {alignButton('align-right', '右', AlignEndVertical)}
                  {alignButton('align-top', '上', AlignStartHorizontal)}
                  {alignButton('align-center-y', '垂直中', AlignCenterHorizontal)}
                  {alignButton('align-bottom', '下', AlignEndHorizontal)}
                </div>
                <div className="mt-1 grid grid-cols-2 gap-1">
                  {alignButton('distribute-x', '水平等距', AlignHorizontalSpaceBetween, 3)}
                  {alignButton('distribute-y', '垂直等距', AlignVerticalSpaceBetween, 3)}
                  {alignButton('snap-grid', '吸附网格', Magnet, 1)}
                  {alignButton('arrange-grid', '整理网格', Grid3x3, 2)}
                </div>
              </div>
              <button
                className={menuItemCls}
                disabled={isRunning || exeCount === 0}
                onClick={() => {
                  closeContextMenu();
                  handleRunGroup(ids);
                }}
              >
                <Play size={13} fill="currentColor" />
                <span>组执行 ({exeCount})</span>
              </button>
              <button
                className={menuItemCls}
                disabled={ids.filter((i) => {
                  const n = nodes.find((x) => x.id === i);
                  return n && n.type !== 'groupBox';
                }).length === 0}
                onClick={() => {
                  closeContextMenu();
                  handleCreateGroup(ids);
                }}
              >
                <FolderPlus size={13} />
                <span>打组 ({shortcutText('canvas.group')})</span>
              </button>
              <button
                className={menuItemCls}
                disabled={!mergeCandidate}
                title={mergeCandidate ? `合并为${PORT_LABEL[mergeCandidate.kind]}素材集` : '请选择多个同类型素材'}
                onClick={() => {
                  closeContextMenu();
                  handleMergeToMaterialSet(ids, { x: contextMenu.x, y: contextMenu.y });
                }}
              >
                <PackagePlus size={13} />
                <span>
                  合并到素材集
                  {mergeCandidate ? ` (${mergeCandidate.items.length})` : ''}
                </span>
              </button>
              {materialSetNode && (
                <button
                  className={menuItemCls}
                  disabled={!materialSetKind || materialSetItems.length === 0}
                  title={materialSetKind && materialSetItems.length > 0 ? '把整个素材集保存到资源库' : '请右键一个非空素材集节点'}
                  onClick={() => {
                    closeContextMenu();
                    if (!materialSetKind || materialSetItems.length === 0) return;
                    window.dispatchEvent(new CustomEvent('penguin:open-material-set-resource-menu', {
                      detail: {
                        x: contextMenu.x,
                        y: contextMenu.y,
                        sourceNodeId: materialSetNode.id,
                        title: `${PORT_LABEL[materialSetKind]}素材集`,
                        materialSetKind,
                        materialSetItems,
                      },
                    }));
                  }}
                >
                  <Library size={13} />
                  <span>保存素材集到资源库</span>
                </button>
              )}
              <button
                className={menuItemCls}
                disabled={sendNodeCount === 0}
                title={sendNodeCount > 0 ? '保存选中节点与内部连线为资源库工作流' : '请选择至少 1 个节点'}
                onClick={() => {
                  closeContextMenu();
                  void saveWorkflowFragmentToResource(
                    nodeFragmentPreview,
                    sendEdgeCount > 0 ? `${sendNodeCount}节点${sendEdgeCount}线工作流` : `${sendNodeCount}节点工作流`,
                  );
                }}
              >
                <Workflow size={13} />
                <span>保存工作流到资源库</span>
              </button>
              {currentUser?.role === 'admin' && (
                <button
                  className={menuItemCls}
                  disabled={sendNodeCount === 0}
                  title={sendNodeCount > 0 ? '把当前工作流保存到公共资源库' : '请选择至少 1 个节点'}
                  onClick={() => {
                    closeContextMenu();
                    void saveWorkflowFragmentToSharedResource(
                      nodeFragmentPreview,
                      sendEdgeCount > 0 ? `${sendNodeCount}节点${sendEdgeCount}线公共工作流` : `${sendNodeCount}节点公共工作流`,
                    );
                  }}
                >
                  <Library size={13} />
                  <span>保存工作流到公共库</span>
                </button>
              )}
              <button
                className={menuItemCls}
                disabled={!canSendSelection}
                title={
                  canSendSelection
                    ? `发送选中节点片段到其他画布；其中 ${sendableCount} 个素材仍可保存到资源库或 Eagle`
                    : '所选内容没有可发送节点或素材'
                }
                onClick={() => {
                  closeContextMenu();
                  openSendMaterials(ids, { x: contextMenu.x, y: contextMenu.y });
                }}
              >
                <SendIcon size={13} />
                <span>发送到... ({sendMenuSummary})</span>
              </button>
              <button
                className={`${menuItemCls} t8-context-menu__item--assistant`}
                disabled={!canSendSelection}
                title={canSendSelection ? "把当前选中节点、工作流和素材挂到 AI 助手对话框" : "所选内容没有可发送上下文"}
                onClick={() => {
                  closeContextMenu();
                  const assistantAttachments = [];
                  if (sendNodeCount > 0) {
                    assistantAttachments.push({
                      id: `workflow-${activeId || 'canvas'}-${ids.join('-')}`,
                      kind: 'workflow',
                      title: sendEdgeCount > 0 ? `选中工作流 (${sendNodeCount} 节点 / ${sendEdgeCount} 连线)` : `选中节点片段 (${sendNodeCount} 节点)`,
                      summary: sendEdgeCount > 0 ? `${sendNodeCount} 节点 / ${sendEdgeCount} 连线` : `${sendNodeCount} 节点`,
                      payload: {
                        canvasId: activeId,
                        nodes: nodeFragmentPreview.nodes,
                        edges: nodeFragmentPreview.edges,
                      },
                    });
                  }
                  collectSendableMaterialsFromNodes(selNodes, activeId).slice(0, 8).forEach((item, index) => {
                    assistantAttachments.push({
                      id: `selection-material-${index}-${item.id || item.url || item.name || item.kind}`,
                      kind: item.kind,
                      title: item.name || item.kind,
                      summary: item.url || item.text || '',
                      payload: {
                        kind: item.kind,
                        url: item.url,
                        text: item.text,
                        sourceNodeId: item.sourceNodeId,
                        sourceCanvasId: item.sourceCanvasId,
                      },
                    });
                  });
                  if (assistantAttachments.length === 0) return;
                  window.dispatchEvent(
                    new CustomEvent('penguin:append-assistant-context', {
                      detail: {
                        open: true,
                        attachments: assistantAttachments,
                      },
                    }),
                  );
                }}
              >
                <Bot size={13} />
                <span>发送到 AI 助手</span>
              </button>
              <button
                className={menuItemCls}
                disabled={downloadableCount === 0}
                title={downloadableCount > 0 ? `下载所选节点中的 ${downloadableCount} 个素材` : '所选节点没有可下载素材'}
                onClick={() => {
                  closeContextMenu();
                  void handleBatchDownloadSelected(ids);
                }}
              >
                <Download size={13} />
                <span>批量下载 ({downloadableCount})</span>
              </button>
              <button
                className={menuItemCls}
                onClick={() => {
                  closeContextMenu();
                  handleCopy();
                }}
              >
                <Copy size={13} />
                <span>复制 ({shortcutText('canvas.copy')})</span>
              </button>
              <button
                className={menuItemCls}
                onClick={() => {
                  closeContextMenu();
                  handleDuplicate();
                }}
              >
                <CopyPlus size={13} />
                <span>快速复制 ({shortcutText('canvas.duplicate')})</span>
              </button>
              <button
                className={`${menuItemCls} t8-context-menu__item--danger`}
                onClick={() => {
                  closeContextMenu();
                  handleDeleteSelected();
                }}
              >
                <Trash2 size={13} />
                <span>删除 ({shortcutText('canvas.delete')})</span>
              </button>
            </div>
          </>
        );
      })()}

      {/* 画布空白区右键菜单: 快速添加节点 */}
      {paneMenu && (() => {
        const QUICK_NODES = NODE_REGISTRY.filter(
          (n) => n.category === 'input' || n.category === 'core'
        );
        const COLOR_HEX: Record<string, string> = {
          sky: '#7dd3fc', amber: '#fcd34d', rose: '#fda4af', fuchsia: '#f0abfc',
          violet: '#c4b5fd', emerald: '#6ee7b7', cyan: '#67e8f9', indigo: '#a5b4fc',
          orange: '#fdba74', pink: '#f9a8d4', slate: '#cbd5e1', teal: '#5eead4',
        };
        const itemCls = 't8-context-menu__item';
        return (
          <>
            {/* 遮罩层 */}
            <div
              data-canvas-floating-ui="pane-menu-backdrop"
              className="fixed inset-0 z-30"
              onClick={closePaneMenu}
              onContextMenu={(e) => {
                e.preventDefault();
                closePaneMenu();
              }}
            />
            <div
              data-canvas-floating-ui="pane-menu"
              className="fixed z-40 overflow-hidden t8-context-menu t8-context-menu--quick-add"
              style={{
                left: Math.min(paneMenu.x, window.innerWidth - 220),
                top: Math.min(paneMenu.y, window.innerHeight - 360),
                width: 200,
              }}
            >
              <div className="t8-context-menu__header">
                快速添加节点
              </div>
              {QUICK_NODES.map((meta) => {
                const color = COLOR_HEX[meta.color] || COLOR_HEX.slate;
                return (
                  <button
                    key={meta.type}
                    className={itemCls}
                    onClick={() => {
                      const at = { x: paneMenu.x, y: paneMenu.y };
                      closePaneMenu();
                      addNode(meta.type as NodeType, { atScreen: at });
                    }}
                  >
                    <span
                      className="t8-context-menu__node-icon"
                      style={{ '--t8-menu-icon-color': color } as CSSProperties}
                    >
                      {(() => {
                        const Icon = (LucideIcons as any)[meta.icon] || LucideIcons.Box;
                        return <Icon size={13} />;
                      })()}
                    </span>
                    <span className="flex-1 truncate">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        );
      })()}
    </div>
  );
}

interface CanvasProps {
  onAddNodeRef?: React.MutableRefObject<AddNodeFn | null>;
  onInsertWorkflowRef?: React.MutableRefObject<InsertWorkflowFn | null>;
  currentUser?: AuthUser | null;
}

export default function Canvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
