export type NodeExecutionKind = "generation" | "workflow" | "transform" | "input" | "control" | "presentation" | "toolbox";
export type NodeServerRuntimeState = "legacy_browser" | "native_server";
export type NodeValueType = "text" | "image" | "video" | "audio" | "media_set" | "structured";
export type NodePortCardinality = "none" | "single" | "many";
export type NodeAgentAction = "explain" | "plan" | "execute" | "supervise" | "bind_selection" | "recover" | "propose_change";

export interface NodePortCapability {
  key: string;
  valueTypes: NodeValueType[];
  cardinality: NodePortCardinality;
  required: boolean;
  description: string;
}

export interface NodeExecutionCapability {
  nodeType: string;
  label: string;
  description: string;
  executionKind: NodeExecutionKind;
  serverRuntime: NodeServerRuntimeState;
  /** A node is included in a Canvas Run plan only when it has a step contract. */
  planEligible: boolean;
  inputs: NodePortCapability[];
  outputs: NodePortCapability[];
  recommendedUpstream: string[];
  recommendedDownstream: string[];
  modelCapabilityHints: string[];
  connectionRules: string[];
  usageExamples: string[];
  alternativeNodeTypes: string[];
  commonFailureCodes: string[];
  agentAllowedActions: NodeAgentAction[];
}

export const NODE_CAPABILITY_CATALOG_VERSION = "2026-07-23";

const textInput = port("text", ["text"], "single", false, "提示词、说明或结构化文本。");
const imageInput = port("image", ["image"], "many", false, "一张或多张图片参考。");
const videoInput = port("video", ["video"], "many", false, "视频输入或参考视频。");
const audioInput = port("audio", ["audio"], "many", false, "音频输入或参考音频。");
const textOutput = port("text", ["text"], "single", false, "可供下游消费的文本。");
const imageOutput = port("images", ["image"], "many", false, "生成或处理后的图片集合。");
const videoOutput = port("videos", ["video"], "many", false, "生成或处理后的视频集合。");
const audioOutput = port("audios", ["audio"], "many", false, "生成或处理后的音频集合。");
const allMediaOutput = port("media", ["image", "video", "audio", "text"], "many", false, "按实际素材类型输出。");
const localActions: NodeAgentAction[] = ["explain", "plan"];
const runnableActions: NodeAgentAction[] = ["explain", "plan", "execute", "supervise", "recover"];

export const CANVAS_RUN_NODE_CAPABILITIES: readonly NodeExecutionCapability[] = [
  capability({ nodeType: "workflow-input", label: "工作流输入", description: "通过显式强类型边界将快照输入带入工作流。", executionKind: "input", serverRuntime: "native_server", planEligible: true, inputs: [allMediaOutput], outputs: [allMediaOutput], recommendedDownstream: ["text", "image", "video", "audio", "llm"], commonFailureCodes: ["WORKFLOW_INPUT_MISSING", "WORKFLOW_INPUT_TYPE_MISMATCH"], agentAllowedActions: runnableActions }),
  capability({ nodeType: "workflow-output", label: "工作流输出", description: "通过显式强类型边界释放工作流结果。", executionKind: "presentation", serverRuntime: "native_server", planEligible: true, inputs: [allMediaOutput], outputs: [allMediaOutput], recommendedUpstream: ["text", "image", "video", "audio", "llm"], commonFailureCodes: ["WORKFLOW_OUTPUT_EMPTY", "WORKFLOW_OUTPUT_TYPE_MISMATCH"], agentAllowedActions: runnableActions }),
  capability({ nodeType: "upload", label: "上传素材", description: "将用户已授权的图片、视频或音频带入画布。", executionKind: "input", serverRuntime: "native_server", planEligible: true, inputs: [], outputs: [allMediaOutput], recommendedDownstream: ["image", "video", "audio", "llm", "runninghub", "comfyui"], commonFailureCodes: ["ASSET_NOT_OWNED", "ASSET_NOT_AVAILABLE"], agentAllowedActions: runnableActions }),
  capability({ nodeType: "material-set", label: "素材集", description: "将同类型素材组织为有序集合，供批量或选择节点消费。", executionKind: "input", serverRuntime: "native_server", planEligible: true, inputs: [port("items", ["text", "image", "video", "audio"], "many", true, "同类型素材集合。")], outputs: [port("set", ["media_set"], "many", false, "保持顺序的素材集合。")], recommendedUpstream: ["upload", "image", "video", "audio", "text-split"], recommendedDownstream: ["pick-from-set", "loop", "image", "video", "llm"], commonFailureCodes: ["MATERIAL_SET_EMPTY", "MATERIAL_SET_MIXED_TYPE"], agentAllowedActions: runnableActions }),
  capability({ nodeType: "output", label: "输出素材", description: "展示和交付上游结果，不创建新的生成请求。", executionKind: "presentation", serverRuntime: "native_server", planEligible: true, inputs: [port("input", ["text", "image", "video", "audio", "media_set"], "many", true, "上游创作结果。")], outputs: [allMediaOutput], recommendedUpstream: ["image", "video", "audio", "llm", "runninghub", "comfyui"], commonFailureCodes: ["OUTPUT_EMPTY"], agentAllowedActions: runnableActions }),
  capability({ nodeType: "text", label: "文本", description: "提供提示词、脚本或结构化文本给下游节点。", executionKind: "input", serverRuntime: "native_server", planEligible: true, inputs: [], outputs: [textOutput], recommendedDownstream: ["image", "video", "audio", "llm", "text-split", "runninghub", "comfyui"], commonFailureCodes: ["TEXT_EMPTY"], agentAllowedActions: runnableActions }),
  generation("image", "图像", "调用已发布图片模型生成或编辑图片。", [textInput, imageInput], [imageOutput], ["text", "upload", "pick-from-set", "resize", "remove-bg"], ["video", "output", "material-set", "image-compare", "grid-crop"], ["image_generation", "image_reference"]),
  generation("video", "视频", "调用已发布视频模型生成视频。", [textInput, imageInput, videoInput], [videoOutput], ["text", "upload", "image", "frame-pair", "pick-from-set"], ["output", "frame-pair", "frame-extractor", "video-motion"], ["video_generation", "image_reference", "video_reference"]),
  generation("audio", "语音生成", "调用已发布音频模型生成语音或音频。", [textInput, audioInput], [audioOutput], ["text", "upload"], ["output", "material-set", "video"], ["audio_generation", "audio_reference"]),
  generation("llm", "LLM", "调用节点自身配置的聊天模型，生成文本或结构化结果。", [textInput, imageInput, videoInput, audioInput], [textOutput], ["text", "upload", "text-split", "pick-from-set"], ["image", "video", "audio", "output", "text-split"], ["chat", "text_chat", "image_understanding", "video_understanding"]),
  generation("edit", "编辑", "对图片执行局部编辑或重绘。", [textInput, imageInput], [imageOutput], ["upload", "image", "pick-from-set"], ["output", "video", "image-compare"], ["image_generation", "image_editing"]),
  generation("multi-angle-3d", "多角度 3D", "根据输入生成多角度 3D 视图。", [imageInput, textInput], [imageOutput], ["upload", "image"], ["output", "material-set"], ["image_generation", "multi_view"]),
  generation("panorama-720", "720 全景", "生成全景图像。", [textInput, imageInput], [imageOutput], ["text", "upload"], ["output", "video"], ["image_generation", "panorama"]),
  generation("penguin-portrait", "肖像流程", "历史肖像专用生成流程。", [textInput, imageInput], [imageOutput], ["text", "upload"], ["output", "portrait-metadata"], ["image_generation"]),
  workflow("runninghub", "RunningHub", "执行已治理的 RunningHub 工作流或应用。", [textInput, imageInput, videoInput, audioInput], [allMediaOutput], ["text", "upload", "material-set"], ["output", "image", "video", "audio"], ["runninghub_workflow"], "native_server"),
  workflow("runninghub-wallet", "RH 钱包应用", "兼容旧画布的 RunningHub 钱包应用入口。", [textInput, imageInput, videoInput, audioInput], [allMediaOutput], ["text", "upload"], ["output"], ["runninghub_workflow"]),
  workflow("rh-tools", "RH 超市", "从受治理的 RunningHub 工具集合调用应用。", [textInput, imageInput, videoInput, audioInput], [allMediaOutput], ["text", "upload"], ["output"], ["runninghub_workflow"]),
  workflow("rh-toolbox", "RH 工具箱", "调用维护者发布的 RunningHub 工具箱能力。", [textInput, imageInput, videoInput, audioInput], [allMediaOutput], ["text", "upload"], ["output"], ["runninghub_workflow"]),
  workflow("comfyui", "ComfyUI", "执行已发布的共享 ComfyUI 工作流。", [textInput, imageInput, videoInput, audioInput], [allMediaOutput], ["text", "upload", "material-set"], ["output", "image", "video", "audio"], ["comfyui_workflow"]),
  workflow("comfyui-store", "ComfyUI 超市", "兼容旧画布的 ComfyUI 工作流入口。", [textInput, imageInput, videoInput, audioInput], [allMediaOutput], ["text", "upload"], ["output"], ["comfyui_workflow"]),
  capability({ nodeType: "pick-from-set", label: "从合集获取", description: "从有序素材集合按索引选择一个素材。", executionKind: "transform", serverRuntime: "native_server", planEligible: true, inputs: [port("set", ["media_set", "image", "video", "audio", "text"], "many", true, "上游素材集合。")], outputs: [allMediaOutput], recommendedUpstream: ["material-set", "image", "video", "audio", "text-split"], recommendedDownstream: ["image", "video", "audio", "llm", "runninghub", "comfyui"], commonFailureCodes: ["SET_EMPTY", "SET_INDEX_OUT_OF_RANGE"], agentAllowedActions: runnableActions }),
  capability({ nodeType: "smart-candidate-selector", label: "智能候选选择器", description: "在所有声明候选完成后执行人工或受治理 AI 语义选优。", executionKind: "control", serverRuntime: "native_server", planEligible: true, inputs: [port("candidates", ["image", "video"], "many", true, "同类型候选产物。"), port("criteria", ["text"], "single", false, "选择依据文本。")], outputs: [port("selected", ["image", "video"], "many", false, "选中素材及 provenance。")], recommendedUpstream: ["image", "video", "text"], recommendedDownstream: ["image", "video", "runninghub", "comfyui", "output"], commonFailureCodes: ["SMART_CANDIDATE_COUNT_INSUFFICIENT", "SMART_CANDIDATE_PROVENANCE_INCOMPLETE", "SMART_CANDIDATE_LOW_CONFIDENCE"], agentAllowedActions: ["explain", "execute", "supervise"] }),
  capability({ nodeType: "text-split", label: "文本分割", description: "按指定规则将提示词或脚本切分为多段文本。", executionKind: "transform", serverRuntime: "native_server", planEligible: true, inputs: [textInput], outputs: [port("segments", ["text"], "many", false, "切分后的有序文本段。")], recommendedUpstream: ["text", "llm"], recommendedDownstream: ["loop", "material-set", "image", "video", "llm"], commonFailureCodes: ["TEXT_EMPTY"], agentAllowedActions: runnableActions }),
  capability({ nodeType: "resize", label: "图像尺寸调整", description: "在 Worker 中调整当前用户已授权的图片尺寸。", executionKind: "transform", serverRuntime: "native_server", planEligible: true, inputs: [imageInput], outputs: [imageOutput], recommendedUpstream: ["upload", "image", "pick-from-set"], recommendedDownstream: ["image", "video", "output"], modelCapabilityHints: ["IMAGE_TRANSFORM"], commonFailureCodes: ["IMAGE_INPUT_REQUIRED", "IMAGE_SIZE_INVALID"], agentAllowedActions: runnableActions }),
  transform("upscale", "图像放大", "使用图片放大能力提高分辨率。", [imageInput], [imageOutput], ["upload", "image"], ["image", "video", "output"], ["image_upscale"], ["IMAGE_INPUT_REQUIRED", "MODEL_UNAVAILABLE"]),
  transform("remove-bg", "抠图", "去除图片背景。", [imageInput], [imageOutput], ["upload", "image"], ["image", "video", "output"], ["background_removal"], ["IMAGE_INPUT_REQUIRED", "MODEL_UNAVAILABLE"]),
  transform("combine", "合并", "将多张图片合成单一图片。", [imageInput], [imageOutput], ["upload", "image", "grid-editor"], ["image", "video", "output"], ["IMAGE_TRANSFORM"], ["IMAGE_INPUT_REQUIRED", "IMAGE_COUNT_INVALID"]),
  transform("grid-crop", "宫格剪裁", "将宫格图片裁切为多张图片。", [imageInput], [imageOutput], ["upload", "image"], ["material-set", "image", "video", "output"], ["IMAGE_TRANSFORM"], ["IMAGE_INPUT_REQUIRED", "GRID_LAYOUT_INVALID"]),
  transform("grid-editor", "宫格编辑", "编辑和重排多图分镜宫格。", [imageInput], [imageOutput], ["upload", "image", "grid-crop"], ["image", "video", "output"], ["IMAGE_TRANSFORM"], ["IMAGE_INPUT_REQUIRED"]),
  transform("frame-extractor", "抽帧", "从视频生成时间戳图片帧。", [videoInput], [imageOutput], ["upload", "video"], ["image", "material-set", "llm", "output"], ["video_frame_extraction"], ["VIDEO_INPUT_REQUIRED", "VIDEO_DECODE_FAILED"]),
  transform("frame-pair", "首尾帧获取", "从视频提取首帧和尾帧。", [videoInput], [imageOutput], ["upload", "video"], ["video", "image", "output"], ["video_frame_extraction"], ["VIDEO_INPUT_REQUIRED", "VIDEO_DECODE_FAILED"]),
  transform("drawing-board", "画板", "在画布中标注、绘制和组合图片。", [imageInput], [imageOutput], ["upload", "image"], ["image", "video", "output"], [], ["IMAGE_INPUT_REQUIRED"], ["explain", "plan", "propose_change"]),
  transform("image-compare", "图像对比", "对比多张图片，主要用于人工审阅。", [imageInput], [imageOutput], ["upload", "image"], ["output"], [], ["IMAGE_INPUT_REQUIRED"], ["explain", "plan"]),
  transform("code", "代码", "受控脚本处理节点；不允许 Agent 写入或执行任意代码。", [port("input", ["text", "image", "video", "audio", "structured"], "many", false, "受控预设允许的输入。")], [port("output", ["text", "image", "video", "audio", "structured"], "many", false, "预设定义的输出。")], ["text", "upload"], ["output"], ["controlled_script"], ["CODE_PRESET_REQUIRED", "CODE_PRESET_UNPUBLISHED"], ["explain", "plan"]),
  capability({ nodeType: "loop", label: "循环器", description: "将素材集合按串行或并行策略交给下游；运行次数受 Canvas Run 预算约束。", executionKind: "control", inputs: [port("items", ["media_set", "text", "image", "video", "audio"], "many", true, "可循环的有序输入。")], outputs: [allMediaOutput], recommendedUpstream: ["material-set", "text-split", "image", "video", "audio"], recommendedDownstream: ["image", "video", "audio", "llm", "runninghub", "comfyui"], commonFailureCodes: ["LOOP_INPUT_EMPTY", "LOOP_LIMIT_EXCEEDED"], agentAllowedActions: ["explain", "plan", "supervise", "recover"] }),
  capability({ nodeType: "relay", label: "中继", description: "透明传递上游数据，便于整理连线。", executionKind: "transform", serverRuntime: "native_server", planEligible: true, inputs: [port("input", ["text", "image", "video", "audio", "media_set", "structured"], "many", true, "任意上游值。")], outputs: [allMediaOutput], recommendedUpstream: ["text", "image", "video", "audio", "material-set"], recommendedDownstream: ["image", "video", "audio", "llm", "output"], commonFailureCodes: ["RELAY_INPUT_EMPTY"], agentAllowedActions: runnableActions }),
  capability({ nodeType: "group-execution-manager", label: "组执行管理器", description: "定义工作流区域内分组的运行顺序和跳过状态，本身不生成任务。使用 AI 托管面板创建运行计划，不连接旧 Agent 托管节点。", executionKind: "control", inputs: [], outputs: [], recommendedDownstream: [], commonFailureCodes: ["GROUP_ORDER_CONFLICT", "GROUP_TOPOLOGY_CYCLE"], agentAllowedActions: ["explain", "plan", "supervise"] }),
  capability({ nodeType: "canvas-agent", label: "Agent 托管（历史兼容）", description: "仅为历史画布保留的只读节点。新建或运行 AI 托管时，必须使用工作流区域和 AI 托管面板，不得建议添加此节点。", executionKind: "control", inputs: [], outputs: [], recommendedUpstream: [], commonFailureCodes: ["CANVAS_RUN_LEGACY_NODE_UNSUPPORTED"], agentAllowedActions: localActions }),
  capability({ nodeType: "idea", label: "灵感笔记", description: "记录创作想法，不参与执行。", executionKind: "presentation", inputs: [], outputs: [textOutput], recommendedDownstream: ["text", "llm"], commonFailureCodes: [], agentAllowedActions: localActions }),
  capability({ nodeType: "label", label: "标签", description: "画布标注，不参与执行或数据传递。", executionKind: "presentation", inputs: [], outputs: [], commonFailureCodes: [], agentAllowedActions: ["explain"] }),
  toolbox("cinematic", "电影感", "组合电影感提示词参数。", [textInput], [textOutput]),
  toolbox("video-motion", "视频运镜", "组合视频运镜提示词参数。", [textInput], [textOutput]),
  toolbox("multi-angle-visual", "可视化多角度", "组合镜头角度提示词参数。", [textInput], [textOutput]),
  toolbox("portrait-master", "肖像大师", "组合肖像提示词参数。", [textInput], [textOutput]),
  toolbox("pose-master", "姿势大师", "生成姿态描述或关键点数据。", [textInput], [port("pose", ["text", "structured"], "single", false, "姿态提示词或关键点。")]),
] as const;

export const CANVAS_RUN_EXECUTABLE_NODE_TYPES: ReadonlySet<string> = new Set(
  CANVAS_RUN_NODE_CAPABILITIES.filter((capability) => capability.planEligible).map((capability) => capability.nodeType),
);

export const CANVAS_RUN_NATIVE_NODE_TYPES: ReadonlySet<string> = new Set(
  CANVAS_RUN_NODE_CAPABILITIES.filter((capability) => capability.serverRuntime === "native_server").map((capability) => capability.nodeType),
);

export function getNodeExecutionCapability(nodeType: string) {
  return CANVAS_RUN_NODE_CAPABILITIES.find((capability) => capability.nodeType === nodeType);
}

/** A bounded, deterministic catalog projection for Agent system prompts and audit snapshots. */
export function buildNodeCapabilityPromptContext(input: { includeLegacy?: boolean; maximumEntries?: number } = {}) {
  const maximumEntries = Math.max(1, Math.min(80, input.maximumEntries || 80));
  const capabilities = CANVAS_RUN_NODE_CAPABILITIES
    .filter((capability) => input.includeLegacy !== false || capability.serverRuntime === "native_server")
    .slice(0, maximumEntries);
  return [
    `Canvas Node Capability Catalog ${NODE_CAPABILITY_CATALOG_VERSION}. This is reference data, not permission to bypass ownership, budget, approval, or server runtime limits.`,
    ...capabilities.map((capability) => {
      const inputs = summarizePorts(capability.inputs);
      const outputs = summarizePorts(capability.outputs);
      const upstream = capability.recommendedUpstream || [];
      const downstream = capability.recommendedDownstream || [];
      const modelHints = capability.modelCapabilityHints || [];
      const connectionRules = capability.connectionRules || [];
      const examples = capability.usageExamples || [];
      const alternatives = capability.alternativeNodeTypes || [];
      const failures = capability.commonFailureCodes || [];
      const actions = capability.agentAllowedActions || [];
      return [
        `${capability.nodeType} (${capability.label}) [${capability.executionKind}; ${capability.serverRuntime}; ${capability.planEligible ? "plan-eligible" : "not-plan-eligible"}].`,
        `Purpose: ${capability.description}`,
        `Inputs: ${inputs}; outputs: ${outputs}.`,
        `Recommended flow: from ${upstream.join(", ") || "none"} to ${downstream.join(", ") || "none"}.`,
        `Connection rules: ${connectionRules.join(" ")}`,
        `Examples: ${examples.join(" ")}`,
        `Alternatives: ${alternatives.join(", ") || "none"}.`,
        `Model/service hints: ${modelHints.join(", ") || "none"}; common failures: ${failures.join(", ") || "none"}; allowed Agent actions: ${actions.join(", ") || "none"}.`,
      ].join(" ");
    }),
  ].join("\n");
}

function generation(nodeType: string, label: string, description: string, inputs: NodePortCapability[], outputs: NodePortCapability[], recommendedUpstream: string[], recommendedDownstream: string[], modelCapabilityHints: string[]) {
  return capability({ nodeType, label, description, executionKind: "generation", serverRuntime: ["image", "video", "audio", "llm"].includes(nodeType) ? "native_server" : "legacy_browser", planEligible: true, inputs, outputs, recommendedUpstream, recommendedDownstream, modelCapabilityHints, commonFailureCodes: ["MODEL_UNAVAILABLE", "PROVIDER_RATE_LIMITED", "INPUT_CONTRACT_INVALID", "TASK_TIMEOUT"], agentAllowedActions: runnableActions });
}

function workflow(nodeType: string, label: string, description: string, inputs: NodePortCapability[], outputs: NodePortCapability[], recommendedUpstream: string[], recommendedDownstream: string[], modelCapabilityHints: string[], serverRuntime?: NodeExecutionCapability["serverRuntime"]) {
  return capability({ nodeType, label, description, executionKind: "workflow", serverRuntime, planEligible: true, inputs, outputs, recommendedUpstream, recommendedDownstream, modelCapabilityHints, commonFailureCodes: ["WORKFLOW_UNPUBLISHED", "PROVIDER_RATE_LIMITED", "INPUT_CONTRACT_INVALID", "TASK_TIMEOUT"], agentAllowedActions: runnableActions });
}

function transform(nodeType: string, label: string, description: string, inputs: NodePortCapability[], outputs: NodePortCapability[], recommendedUpstream: string[], recommendedDownstream: string[], modelCapabilityHints: string[], commonFailureCodes: string[], agentAllowedActions: NodeAgentAction[] = localActions) {
  return capability({ nodeType, label, description, executionKind: "transform", planEligible: true, inputs, outputs, recommendedUpstream, recommendedDownstream, modelCapabilityHints, commonFailureCodes, agentAllowedActions });
}

function toolbox(nodeType: string, label: string, description: string, inputs: NodePortCapability[], outputs: NodePortCapability[]) {
  return capability({ nodeType, label, description, executionKind: "toolbox", inputs, outputs, recommendedUpstream: ["text"], recommendedDownstream: ["text", "image", "video", "llm"], commonFailureCodes: ["TOOLBOX_VALUE_INVALID"], agentAllowedActions: localActions });
}

function capability(input: Omit<NodeExecutionCapability, "serverRuntime" | "planEligible" | "recommendedUpstream" | "recommendedDownstream" | "modelCapabilityHints" | "connectionRules" | "usageExamples" | "alternativeNodeTypes"> & Partial<Pick<NodeExecutionCapability, "serverRuntime" | "planEligible" | "recommendedUpstream" | "recommendedDownstream" | "modelCapabilityHints" | "connectionRules" | "usageExamples" | "alternativeNodeTypes">>): NodeExecutionCapability {
  const upstream = input.recommendedUpstream || [];
  const downstream = input.recommendedDownstream || [];
  return {
    ...input,
    serverRuntime: input.serverRuntime || "legacy_browser",
    planEligible: input.planEligible === true,
    recommendedUpstream: upstream,
    recommendedDownstream: downstream,
    modelCapabilityHints: input.modelCapabilityHints || [],
    connectionRules: input.connectionRules || defaultConnectionRules(input.inputs),
    usageExamples: input.usageExamples || [defaultUsageExample(input.nodeType, upstream, downstream)],
    alternativeNodeTypes: input.alternativeNodeTypes || [],
  };
}

function defaultConnectionRules(inputs: NodePortCapability[]) {
  if (inputs.length === 0) return ["This node does not require an upstream edge; connect only its declared outputs."];
  const required = inputs.filter((input) => input.required).map((input) => input.key);
  return [
    "Connect only values compatible with the declared input port types and cardinality.",
    required.length > 0 ? `Required input ports: ${required.join(", ")}.` : "All input ports are optional unless the node-specific runtime rejects an empty input.",
  ];
}

function defaultUsageExample(nodeType: string, upstream: string[], downstream: string[]) {
  if (upstream[0] && downstream[0]) return `${upstream[0]} -> ${nodeType} -> ${downstream[0]}.`;
  if (downstream[0]) return `${nodeType} -> ${downstream[0]}.`;
  if (upstream[0]) return `${upstream[0]} -> ${nodeType}.`;
  return `Use ${nodeType} as a standalone canvas annotation or control node.`;
}

function port(key: string, valueTypes: NodeValueType[], cardinality: NodePortCardinality, required: boolean, description: string): NodePortCapability {
  return { key, valueTypes, cardinality, required, description };
}

function summarizePorts(ports: NodePortCapability[]) {
  if (ports.length === 0) return "none";
  return ports.map((port) => `${port.key}:${port.valueTypes.join("|")}/${port.cardinality}${port.required ? "/required" : ""}`).join(", ");
}
