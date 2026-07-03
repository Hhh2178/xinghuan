import type { IncomingMessage, ServerResponse } from "node:http";
import {
  buildComfyuiExecutionPrompt,
  buildComfyuiViewAssetUrl,
  canRunComfyuiWorkflowOnInstance,
  collectComfyuiNamedOutputs,
  extractComfyuiResultAssets,
  normalizeComfyuiExecutionMediaInputs,
  normalizeComfyuiUserParams,
  selectComfyuiExecutionInstance,
  submitComfyuiPrompt,
  uploadComfyuiImageInput,
  waitForComfyuiHistory,
} from "./comfyui-execution.js";
import { readComfyuiRegistry } from "./comfyui-workflow-registry.js";
import { readJsonBody } from "./http-session-utils.js";
import { safeText } from "./api-sanitizers.js";

interface ComfyuiPublicRouteDeps {
  sendT8: (response: ServerResponse, payload: unknown, statusCode?: number, headers?: Record<string, string>) => void;
  adminDir: string;
  normalizeReferenceUrl: (value: string) => string;
  saveRemoteImageToOutput: (sourceUrl: string) => Promise<{ url: string }>;
  saveRemoteVideoToOutput: (sourceUrl: string) => Promise<{ url: string }>;
  saveRemoteAudioToOutput: (sourceUrl: string) => Promise<{ url: string }>;
}

function sendComfyuiPublicError(response: ServerResponse, statusCode: number, error: string) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify({ success: false, error }));
}

export async function handleComfyuiPublicRoutes(input: {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  deps: ComfyuiPublicRouteDeps;
}) {
  const { request, response, url, deps } = input;

  if (url.pathname === "/api/comfyui/apps" && request.method === "GET") {
    const state = await readComfyuiRegistry(deps.adminDir);
    deps.sendT8(response, {
      revision: state.revision,
      updatedAt: state.updatedAt,
      instances: state.instances,
      workflows: state.sharedWorkflows.map((workflow) => ({
        ...workflow,
        instanceBindings: Array.isArray(workflow.instanceBindings) ? workflow.instanceBindings : [],
      })),
    });
    return true;
  }

  const runMatch = url.pathname.match(/^\/api\/comfyui\/apps\/([^/]+)\/run$/);
  if (runMatch && request.method === "POST") {
    const workflowRef = decodeURIComponent(runMatch[1]);
    const state = await readComfyuiRegistry(deps.adminDir);
    const workflow = state.sharedWorkflows.find((item) => item.id === workflowRef || item.sharedWorkflowId === workflowRef);
    if (!workflow) {
      sendComfyuiPublicError(response, 404, "COMFYUI_WORKFLOW_NOT_FOUND");
      return true;
    }

    const body = await readJsonBody<{
      instanceId?: string;
      userParams?: unknown;
      inputs?: unknown;
    }>(request);
    const requestedInstanceId = safeText(body.instanceId);
    const allowedBindings = Array.isArray(workflow.instanceBindings) && workflow.instanceBindings.length
      ? workflow.instanceBindings.filter((item) => item.enabled !== false)
      : [{ instanceId: workflow.instanceId, enabled: true }];
    if (requestedInstanceId && !allowedBindings.some((item) => item.instanceId === requestedInstanceId)) {
      sendComfyuiPublicError(response, 409, "COMFYUI_INSTANCE_NOT_ALLOWED");
      return true;
    }
    const instance = selectComfyuiExecutionInstance({
      state,
      workflow,
      requestedInstanceId,
    });
    if (!canRunComfyuiWorkflowOnInstance(instance)) {
      sendComfyuiPublicError(response, 409, "COMFYUI_INSTANCE_UNAVAILABLE");
      return true;
    }

    const normalizedInputs = normalizeComfyuiExecutionMediaInputs(body.inputs);
    const preparedInputs = {
      ...normalizedInputs,
      images: normalizedInputs.images?.length
        ? await Promise.all(
            normalizedInputs.images.map((item) => uploadComfyuiImageInput(instance.baseUrl, deps.normalizeReferenceUrl(item))),
          )
        : [],
      videos: normalizedInputs.videos?.map((item) => deps.normalizeReferenceUrl(item)) || [],
      audios: normalizedInputs.audios?.map((item) => deps.normalizeReferenceUrl(item)) || [],
    };

    const prompt = buildComfyuiExecutionPrompt({
      workflowJson: workflow.workflowJson,
      inputSchema: workflow.inputSchema,
      defaultValues: workflow.defaultValues,
      userParams: normalizeComfyuiUserParams(body.userParams),
      mediaInputs: preparedInputs,
    });
    const promptId = await submitComfyuiPrompt(instance.baseUrl, prompt);
    const historyEntry = await waitForComfyuiHistory(instance.baseUrl, promptId);
    const assets = extractComfyuiResultAssets(historyEntry);

    const imageUrls = await Promise.all(
      assets.images.map(async (asset) => (await deps.saveRemoteImageToOutput(buildComfyuiViewAssetUrl(instance.baseUrl, asset))).url),
    );
    const videoUrls = await Promise.all(
      assets.videos.map(async (asset) => (await deps.saveRemoteVideoToOutput(buildComfyuiViewAssetUrl(instance.baseUrl, asset))).url),
    );
    const audioUrls = await Promise.all(
      assets.audios.map(async (asset) => (await deps.saveRemoteAudioToOutput(buildComfyuiViewAssetUrl(instance.baseUrl, asset))).url),
    );
    const text = assets.texts.join("\n").trim();
    const outputs = collectComfyuiNamedOutputs({
      outputSchema: workflow.outputSchema,
      imageUrls,
      videoUrls,
      audioUrls,
      text,
    });

    deps.sendT8(response, {
      workflowId: workflow.id,
      sharedWorkflowId: workflow.sharedWorkflowId || workflow.id,
      instanceId: instance.id,
      instanceName: instance.name,
      promptId,
      outputs,
      imageUrls,
      videoUrls,
      audioUrls,
      text,
      raw: {
        promptId,
        outputCount: {
          images: imageUrls.length,
          videos: videoUrls.length,
          audios: audioUrls.length,
          texts: assets.texts.length,
        },
      },
    });
    return true;
  }

  return false;
}
