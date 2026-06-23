import type {
  AdvancedProviderProtocol,
  ApiSettings,
  CloudUploadProvider,
  CloudUploadTargetConfig,
} from '../types/canvas';

export type KeyField =
  | 'zhenzhenApiKey'
  | 'rhApiKey'
  | 'llmApiKey'
  | 'gptImageApiKey'
  | 'nanoBananaApiKey'
  | 'mjApiKey'
  | 'veoApiKey'
  | 'grokApiKey'
  | 'seedanceApiKey'
  | 'sunoApiKey';

export interface KeySpec {
  field: KeyField;
  label: string;
  desc: string;
  bullet: string;
}

export const COMMON_KEYS: KeySpec[] = [
  { field: 'zhenzhenApiKey', label: '贞贞工坊 API Key', desc: '· 通用后备 · 用于图像/视频/音频生成', bullet: 'bg-amber-400' },
  { field: 'rhApiKey', label: 'RunningHub API Key', desc: '· RunningHub 节点与 RH 钱包应用节点共用', bullet: 'bg-cyan-400' },
  { field: 'llmApiKey', label: 'LLM 独立 API Key', desc: '· 额度隔离 · 用于 LLM/Vision', bullet: 'bg-emerald-400' },
];

export const CLASSIFIED_KEYS: KeySpec[] = [
  { field: 'gptImageApiKey', label: 'gpt-image 系列', desc: 'GPT2 / gpt-image-1 等图像任务专用', bullet: 'bg-pink-400' },
  { field: 'nanoBananaApiKey', label: 'nano-banana 系列', desc: 'nano-banana / nano-banana-pro 专用', bullet: 'bg-yellow-400' },
  { field: 'mjApiKey', label: 'mj 系列', desc: 'Midjourney (turbo/fast/relax) 专用', bullet: 'bg-purple-400' },
  { field: 'veoApiKey', label: 'veo / sora 系列', desc: 'Veo / Veo3.1 / Sora2 视频专用', bullet: 'bg-blue-400' },
  { field: 'grokApiKey', label: 'grok 系列', desc: 'Grok Image / Grok Imagine Video 专用', bullet: 'bg-orange-400' },
  { field: 'seedanceApiKey', label: 'seedance 系列', desc: 'Seedance 视频专用', bullet: 'bg-teal-400' },
  { field: 'sunoApiKey', label: 'suno 系列', desc: 'Suno 音乐专用', bullet: 'bg-rose-400' },
];

export const ALL_FIELDS: KeyField[] = [
  ...COMMON_KEYS.map((k) => k.field),
  ...CLASSIFIED_KEYS.map((k) => k.field),
];

export const PATH_FIELDS = [
  'fileSavePath',
  'canvasAutoSavePath',
  'resourceLibraryPath',
  'themeTemplatePath',
  'eagleApiBase',
] as const;

export const SETTINGS_BACKUP_SCHEMA = 't8-penguin-canvas-settings';
export const SETTINGS_BACKUP_VERSION = 1;

export const ADVANCED_PROVIDER_LABELS: Record<AdvancedProviderProtocol, string> = {
  'openai-compatible': 'OpenAI 兼容',
  modelscope: 'ModelScope',
  volcengine: '火山引擎',
  comfyui: '本地 ComfyUI',
  'jimeng-cli': '即梦 CLI',
};

export const ADVANCED_PROVIDER_GUIDES: Record<AdvancedProviderProtocol, {
  subtitle: string;
  description: string;
  nodeScopes: string[];
  connectionHint: string;
  modelHint: string;
  baseUrlPlaceholder?: string;
  keyLabel?: string;
}> = {
  'openai-compatible': {
    subtitle: '接入兼容 OpenAI 格式的图像 / 视频 / LLM 服务',
    description: '适合接入你自己的中转站、One API、New API 或其他兼容 /v1/chat/completions、/v1/images/generations、/v1/videos/generations 的服务。',
    nodeScopes: ['图像节点', '视频节点', 'LLM 节点'],
    connectionHint: 'Base URL 填到 /v1 这一层，例如 https://api.example.com/v1；Key 留空会保留后端已保存的密钥。',
    modelHint: '每行一个模型名。只填你确实要在节点里选择的模型，空白时会使用内置兜底示例。',
    baseUrlPlaceholder: 'https://api.example.com/v1',
    keyLabel: 'API Key / Token',
  },
  modelscope: {
    subtitle: '接入 ModelScope 的异步图像任务与兼容聊天接口',
    description: '适合把 ModelScope 上的图像模型加入图像节点，也可以给 LLM 节点填入可用的聊天模型。',
    nodeScopes: ['图像节点', 'LLM 节点'],
    connectionHint: 'Base URL 通常使用 ModelScope API 地址；Token 填 ModelScope 访问令牌。',
    modelHint: '图像模型建议填写 ModelScope 模型 ID，例如 owner/model-name；聊天模型按平台实际模型名填写。',
    baseUrlPlaceholder: 'https://api-inference.modelscope.cn/v1',
    keyLabel: 'ModelScope Token',
  },
  volcengine: {
    subtitle: '接入火山方舟 / Seedream / Seedance',
    description: '适合用火山引擎做 Seedream 图像、Seedance 视频或方舟聊天模型。只在节点里选择高级来源时才会走这里。',
    nodeScopes: ['图像节点', '视频节点', 'LLM 节点'],
    connectionHint: 'Base URL 填火山方舟 API 地址；常规生成使用 API Key，素材上传能力可补充 AK/SK。',
    modelHint: '图像、视频、聊天模型分别按火山控制台里的模型接入点填写，每行一个。',
    baseUrlPlaceholder: 'https://ark.cn-beijing.volces.com/api/v3',
    keyLabel: '火山 API Key',
  },
  comfyui: {
    subtitle: '接入本机 ComfyUI 工作流',
    description: '适合把本机 ComfyUI 的 API Workflow 接到图像节点。为安全起见这里只允许本机地址。',
    nodeScopes: ['图像节点'],
    connectionHint: '实例地址填本机 ComfyUI，例如 http://127.0.0.1:8188。多个实例可一行一个。',
    modelHint: '图像节点里选择的是工作流 ID/名称，不需要填写模型列表。',
    baseUrlPlaceholder: 'http://127.0.0.1:8188',
  },
  'jimeng-cli': {
    subtitle: '通过本地 dreamina / 即梦 CLI 调用图像和视频',
    description: '适合已经在本机配置好即梦 CLI 的用户。它不走 API Key，而是调用本地命令并轮询任务结果。',
    nodeScopes: ['图像节点', '视频节点', 'SD2.0 节点'],
    connectionHint: '填写 dreamina 可执行文件路径；如果 CLI 装在 WSL 里，再打开 WSL 并填写发行版名称。',
    modelHint: '模型名按 CLI 支持的命令参数填写，例如 seedance2.0fast_vip。每行一个。',
  },
};

export const MODELSCOPE_TOKEN_URLS = {
  cn: 'https://www.modelscope.cn/my/access/token',
  intl: 'https://www.modelscope.ai/my/access/token',
} as const;

export const JIMENG_CLI_INSTALL_COMMAND = 'curl -s https://jimeng.jianying.com/cli | bash';

export const CLOUD_UPLOAD_LABELS: Record<CloudUploadProvider, string> = {
  'tencent-cos': '腾讯云 COS',
  'aliyun-oss': '阿里云 OSS',
  'baidu-netdisk': '百度网盘',
  'quark-netdisk': '夸克网盘',
};

export const CLOUD_UPLOAD_GUIDES: Record<CloudUploadProvider, {
  subtitle: string;
  description: string;
  status: string;
}> = {
  'tencent-cos': {
    subtitle: '适合把生成素材归档到腾讯云对象存储，支持真实上传。',
    description: '填写 Bucket、Region、SecretId 和 SecretKey；公共域名可选，留空时返回 COS 默认对象 URL。',
    status: '已支持上传',
  },
  'aliyun-oss': {
    subtitle: '适合把生成素材归档到阿里云对象存储，支持真实上传。',
    description: '填写 Bucket、Endpoint、AccessKeyId 和 AccessKeySecret；公共域名可选，留空时返回 OSS 默认对象 URL。',
    status: '已支持上传',
  },
  'baidu-netdisk': {
    subtitle: '保留百度网盘配置位，等待稳定 OAuth / PCS 上传方案接入。',
    description: '后续会优先接入正式授权流程，避免让用户手填不稳定 Cookie 或抓包字段。',
    status: '规划中',
  },
  'quark-netdisk': {
    subtitle: '保留夸克网盘配置位，等待稳定 CLI / 授权方案接入。',
    description: '后续若接入外部 CLI，会在这里填写命令路径并统一走同一个右键上传入口。',
    status: '实验位',
  },
};

export function summarizeCloudUploadForm(targets: CloudUploadTargetConfig[]) {
  const normalized = Array.isArray(targets) ? targets : [];
  const configuredCount = normalized.filter((target) => {
    if (target.provider === 'tencent-cos') {
      return !!(target.tencentCos?.bucket && target.tencentCos?.region && (target.tencentCos?.secretId || target.tencentCos?.hasSecretId) && (target.tencentCos?.secretKey || target.tencentCos?.hasSecretKey));
    }
    if (target.provider === 'aliyun-oss') {
      return !!(target.aliyunOss?.bucket && target.aliyunOss?.endpoint && (target.aliyunOss?.accessKeyId || target.aliyunOss?.hasAccessKeyId) && (target.aliyunOss?.accessKeySecret || target.aliyunOss?.hasAccessKeySecret));
    }
    if (target.provider === 'baidu-netdisk') {
      return !!(target.baiduNetdisk?.accessToken || target.baiduNetdisk?.hasAccessToken || target.baiduNetdisk?.refreshToken || target.baiduNetdisk?.hasRefreshToken);
    }
    if (target.provider === 'quark-netdisk') {
      return !!(target.quarkNetdisk?.commandPath || target.quarkNetdisk?.cookie || target.quarkNetdisk?.hasCookie);
    }
    return false;
  }).length;
  const defaultTarget = normalized.find((target) => target.isDefault) || normalized.find((target) => target.enabled) || null;
  return {
    totalCount: normalized.length,
    enabledCount: normalized.filter((target) => target.enabled).length,
    configuredCount,
    defaultLabel: defaultTarget?.label || '',
  };
}

export function tryParseJsonObject(raw: string): Record<string, any> | null {
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isMaskedKeyValue(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return /^\*{2,}/.test(value.trim());
}

export function normalizeImportedSettings(raw: unknown): Partial<ApiSettings> {
  const source = raw && typeof raw === 'object' && 'settings' in raw
    ? (raw as any).settings
    : raw;
  if (!source || typeof source !== 'object') {
    throw new Error('设置备份格式不正确');
  }
  const next: Partial<ApiSettings> = {};
  for (const field of ALL_FIELDS) {
    const value = (source as any)[field];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed || isMaskedKeyValue(trimmed)) continue;
    (next as any)[field] = trimmed;
  }
  for (const field of PATH_FIELDS) {
    const value = (source as any)[field];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    (next as any)[field] = trimmed;
  }
  if ((source as any).preferences && typeof (source as any).preferences === 'object') {
    next.preferences = { ...(source as any).preferences };
  }
  if (Array.isArray((source as any).advancedProviders)) {
    next.advancedProviders = (source as any).advancedProviders;
  }
  if (Array.isArray((source as any).cloudUploadTargets)) {
    next.cloudUploadTargets = (source as any).cloudUploadTargets;
  }
  return next;
}

export function buildSettingsBackupPayload(args: {
  raw: ApiSettings | null;
  editable: Partial<ApiSettings>;
  now?: Date;
  fixedZhenzhenBaseUrl: string;
  runningHubBaseUrl: string;
}) {
  const {
    raw,
    editable,
    now = new Date(),
    fixedZhenzhenBaseUrl,
    runningHubBaseUrl,
  } = args;

  const exportSettings = {
    ...(raw || {}),
    ...Object.fromEntries(
      Object.entries(editable).filter(([, value]) => typeof value === 'string' && value.trim()),
    ),
    zhenzhenBaseUrl: fixedZhenzhenBaseUrl,
    llmBaseUrl: fixedZhenzhenBaseUrl,
    rhBaseUrl: runningHubBaseUrl,
  };

  return {
    schema: SETTINGS_BACKUP_SCHEMA,
    version: SETTINGS_BACKUP_VERSION,
    exportedAt: now.toISOString(),
    containsSecrets: true,
    note: '此文件包含明文 API Key，请勿上传到 GitHub 或公开分享。',
    settings: exportSettings,
  };
}

export const emptyMap = (): Record<KeyField, string> => ({
  zhenzhenApiKey: '', rhApiKey: '', llmApiKey: '',
  gptImageApiKey: '', nanoBananaApiKey: '', mjApiKey: '', veoApiKey: '',
  grokApiKey: '', seedanceApiKey: '', sunoApiKey: '',
});

export const emptyShow = (): Record<KeyField, boolean> => ({
  zhenzhenApiKey: false, rhApiKey: false, llmApiKey: false,
  gptImageApiKey: false, nanoBananaApiKey: false, mjApiKey: false, veoApiKey: false,
  grokApiKey: false, seedanceApiKey: false, sunoApiKey: false,
});
