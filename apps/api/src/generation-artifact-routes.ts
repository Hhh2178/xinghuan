import { createReadStream } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { basename } from "node:path";
import { pipeline } from "node:stream/promises";
import { normalizeGenerationArtifactKind } from "@xinghuan/shared";
import { GenerationArtifactLifecycleError } from "./generation-artifact-lifecycle.js";

export async function handleGenerationArtifactRoutes(deps: {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  ownerId: string;
  lifecycle: {
    list: (ownerId: string, filters?: { kind?: any; q?: string }) => Promise<any[]>;
    registerLegacy: (ownerId: string, payload: Record<string, unknown>) => Promise<any>;
    resolveContent: (ownerId: string, id: string) => Promise<{ artifact: any; absolutePath: string; size: number }>;
    deleteOwned: (ownerId: string, id: string) => Promise<any>;
    promoteOwned: (ownerId: string, id: string) => Promise<any>;
  };
  materialAccessService: {
    buildGenerationLibraryAccessDescriptor: (input: { request: IncomingMessage; item: any }) => object;
  };
  readJsonBody: <T = Record<string, unknown>>(request: IncomingMessage) => Promise<T>;
  sendT8: (response: ServerResponse, data: unknown) => void;
  toHttpError: (error: GenerationArtifactLifecycleError) => Error;
}) {
  const { request, response, url, ownerId, lifecycle } = deps;

  const contentMatch = url.pathname.match(/^\/api\/materials\/generation-library\/([^/]+)\/content$/);
  if (contentMatch && request.method === "GET") {
    try {
      const { artifact, absolutePath, size } = await lifecycle.resolveContent(ownerId, decodeURIComponent(contentMatch[1]));
      const disposition = url.searchParams.get("disposition") === "attachment" ? "attachment" : "inline";
      response.statusCode = 200;
      response.setHeader("content-type", artifact.mime || "application/octet-stream");
      response.setHeader("content-length", String(size));
      response.setHeader("cache-control", "private, max-age=300");
      if (disposition === "attachment") {
        const filename = String(artifact.title || basename(absolutePath)).replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "_") || "material";
        response.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
      }
      await pipeline(createReadStream(absolutePath), response);
      return true;
    } catch (error) {
      if (error instanceof GenerationArtifactLifecycleError) throw deps.toHttpError(error);
      throw error;
    }
  }

  if (url.pathname === "/api/generation-library/items") {
    try {
      if (request.method === "GET") {
        const kind = normalizeGenerationArtifactKind(url.searchParams.get("kind"));
        const q = String(url.searchParams.get("q") || "").trim();
        const items = await lifecycle.list(ownerId, { kind, q });
        deps.sendT8(response, items.map((item) => ({
          ...item,
          ...deps.materialAccessService.buildGenerationLibraryAccessDescriptor({ request, item }),
        })));
        return true;
      }
      if (request.method === "POST") {
        deps.sendT8(response, await lifecycle.registerLegacy(ownerId, await deps.readJsonBody(request)));
        return true;
      }
    } catch (error) {
      if (error instanceof GenerationArtifactLifecycleError) throw deps.toHttpError(error);
      throw error;
    }
  }

  const promoteMatch = url.pathname.match(/^\/api\/generation-library\/items\/([^/]+)\/promote$/);
  if (promoteMatch && request.method === "POST") {
    try {
      deps.sendT8(response, await lifecycle.promoteOwned(ownerId, decodeURIComponent(promoteMatch[1])));
      return true;
    } catch (error) {
      if (error instanceof GenerationArtifactLifecycleError) throw deps.toHttpError(error);
      throw error;
    }
  }

  const itemMatch = url.pathname.match(/^\/api\/generation-library\/items\/([^/]+)$/);
  if (itemMatch && request.method === "DELETE") {
    try {
      await lifecycle.deleteOwned(ownerId, decodeURIComponent(itemMatch[1]));
      deps.sendT8(response, null);
      return true;
    } catch (error) {
      if (error instanceof GenerationArtifactLifecycleError) throw deps.toHttpError(error);
      throw error;
    }
  }

  return false;
}
