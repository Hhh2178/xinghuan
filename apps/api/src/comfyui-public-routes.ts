import type { IncomingMessage, ServerResponse } from "node:http";
import { readComfyuiRegistry } from "./comfyui-workflow-registry.js";

interface ComfyuiPublicRouteDeps {
  sendT8: (response: ServerResponse, payload: unknown, statusCode?: number, headers?: Record<string, string>) => void;
  adminDir: string;
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
      workflows: state.sharedWorkflows,
    });
    return true;
  }

  return false;
}
