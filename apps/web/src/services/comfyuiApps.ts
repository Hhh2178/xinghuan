import type { AdvancedProviderConfig, ComfyuiRunOutput } from '../types/canvas';
import {
  type ComfyAppDefinition,
} from '../utils/comfyuiApps';

export interface RunComfyuiAppOptions {
  provider?: AdvancedProviderConfig | null;
  app?: ComfyAppDefinition | null;
  sharedWorkflowId?: string;
  instanceId?: string;
  inputs?: {
    texts?: string[];
    images?: string[];
    videos?: string[];
    audios?: string[];
  };
  userParams?: Record<string, any>;
}

export interface RunComfyuiAppResult {
  imageUrls: string[];
  remoteImageUrls?: string[];
  videoUrls?: string[];
  audioUrls?: string[];
  text?: string;
  outputs?: ComfyuiRunOutput[];
  taskId?: string;
  instanceId?: string;
  instanceName?: string;
  raw?: any;
}

export async function runComfyuiApp(options: RunComfyuiAppOptions): Promise<RunComfyuiAppResult> {
  const { provider } = options;
  const inputs = options.inputs || {};
  const userParams = options.userParams || {};
  const workflowId = String(options.sharedWorkflowId || options.app?.id || '').trim();
  if (!workflowId) {
    throw new Error('COMFYUI_WORKFLOW_ID_REQUIRED');
  }
  let response: Response;
  try {
    response = await fetch(`/api/comfyui/apps/${encodeURIComponent(workflowId)}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        instanceId: options.instanceId || provider?.id?.replace(/^comfyui-instance-/, '') || undefined,
        userParams,
        inputs,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/fetch failed/i.test(message)) {
      throw new Error('画布后端请求 ComfyUI 运行接口失败，请检查当前灰度后端是否在线。');
    }
    throw error;
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }
  const result = payload.data || {};

  return {
    imageUrls: result.imageUrls || [],
    remoteImageUrls: result.remoteImageUrls,
    taskId: result.taskId,
    raw: result.raw,
    videoUrls: result.videoUrls,
    audioUrls: result.audioUrls,
    text: result.text || '',
    outputs: Array.isArray(result.outputs) ? result.outputs : [],
    instanceId: result.instanceId,
    instanceName: result.instanceName,
  };
}
