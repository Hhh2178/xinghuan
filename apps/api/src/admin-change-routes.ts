import type { ServerResponse, IncomingMessage } from "node:http";
import type { AdminChangeDomain, AdminChangeRepository } from "./admin-change-repository.js";

type CurrentUser = { id: string; email: string; name: string; role: "admin" | "member" };

const domains = new Set<AdminChangeDomain>(["shell", "providers", "models", "directory", "permissions", "runninghub", "comfyui", "shared-resources", "tasks", "content", "analytics", "system"]);

export async function handleAdminChangeRoutes(input: {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  adminUser: CurrentUser;
  readJsonBody: <T>(request: IncomingMessage) => Promise<T>;
  sendT8: (response: ServerResponse, payload: unknown, status?: number, headers?: Record<string, string>) => void;
  repository: AdminChangeRepository;
}) {
  const { request, response, url, adminUser, repository } = input;
  if (url.pathname === "/api/admin/changes/touch" && request.method === "POST") {
    const body = await input.readJsonBody<{ domains?: unknown }>(request);
    const next = Array.isArray(body.domains) ? body.domains.filter((value): value is AdminChangeDomain => typeof value === "string" && domains.has(value as AdminChangeDomain)) : [];
    await repository.touch(next, adminUser.id);
    input.sendT8(response, { touched: next });
    return true;
  }
  if (url.pathname === "/api/admin/changes/snapshot" && request.method === "GET") {
    input.sendT8(response, await repository.snapshot());
    return true;
  }
  if (url.pathname === "/api/admin/changes/stream" && request.method === "GET") {
    response.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", connection: "keep-alive", "x-accel-buffering": "no" });
    let closed = false;
    const send = async () => {
      if (closed) return;
      const snapshot = await repository.snapshot();
      response.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
    };
    await send();
    const timer = setInterval(() => void send(), 2000);
    request.on("close", () => { closed = true; clearInterval(timer); });
    return true;
  }
  return false;
}
