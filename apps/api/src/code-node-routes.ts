import type { IncomingMessage, ServerResponse } from "node:http";
import { executeCodeNode } from "./code-node-runtime.js";

export async function handleCodeNodeRoutes(input: {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  currentUser: { id: string } | null;
  deps: {
    readJsonBody: <T>(request: IncomingMessage) => Promise<T>;
    sendT8: (response: ServerResponse, payload: unknown, statusCode?: number) => void;
    assertCanExecute: (user: { id: string }) => Promise<void>;
  };
}) {
  const { request, response, url, currentUser, deps } = input;
  if (url.pathname !== "/api/code-node/execute") return false;
  if (request.method !== "POST") return false;
  if (!currentUser) {
    deps.sendT8(response, { error: "AUTH_REQUIRED" }, 401);
    return true;
  }
  await deps.assertCanExecute(currentUser);
  const body = await deps.readJsonBody<{ code?: string; input?: unknown }>(request);
  const result = await executeCodeNode({ code: String(body.code || ""), input: body.input });
  deps.sendT8(response, result);
  return true;
}
