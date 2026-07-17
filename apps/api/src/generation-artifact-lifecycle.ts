import type { GenerationArtifactKind, RegisterGenerationArtifactInput } from "@xinghuan/shared";
import { generationArtifactStorageKey, normalizeGenerationArtifactKind } from "@xinghuan/shared";
import type { ArtifactStore } from "./artifact-store.js";

export class GenerationArtifactLifecycleError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export function createGenerationArtifactLifecycle(deps: {
  repository: {
    listOwned: (ownerId: string, filters?: { kind?: GenerationArtifactKind | ""; q?: string }) => Promise<unknown[]>;
    findOwned: (ownerId: string, id: string) => Promise<any | null>;
    registerOwned: (ownerId: string, input: RegisterGenerationArtifactInput) => Promise<any>;
    deleteOwned: (ownerId: string, id: string) => Promise<{ artifact: any; deleteBinary: boolean } | null>;
    promoteOwned: (ownerId: string, id: string) => Promise<any | null>;
  };
  artifactStore: ArtifactStore;
  createId: () => string;
  now?: () => number;
}) {
  const now = deps.now ?? (() => Date.now());

  function list(ownerId: string, filters: { kind?: GenerationArtifactKind | ""; q?: string } = {}) {
    return deps.repository.listOwned(ownerId, filters);
  }

  async function registerLegacy(ownerId: string, payload: Record<string, unknown>) {
    const kind = normalizeGenerationArtifactKind(payload.kind);
    const fileUrl = text(payload.fileUrl || payload.url);
    if (!kind || !fileUrl) throw new GenerationArtifactLifecycleError(400, "GENERATION_ARTIFACT_KIND_OR_URL_REQUIRED");
    if (!fileUrl.startsWith("/files/output/") && !fileUrl.startsWith("/output/")) {
      throw new GenerationArtifactLifecycleError(400, "GENERATION_ARTIFACT_LOCAL_OUTPUT_REQUIRED");
    }
    return deps.repository.registerOwned(ownerId, {
      id: deps.createId(),
      kind,
      title: text(payload.title, generationArtifactStorageKey(fileUrl)),
      storageKey: generationArtifactStorageKey(fileUrl),
      fileUrl,
      sourceUrl: text(payload.sourceUrl || payload.url, fileUrl),
      mime: text(payload.mime),
      size: Number(payload.size) || 0,
      sourceNodeId: text(payload.sourceNodeId),
      sourceCanvasId: text(payload.sourceCanvasId),
      taskId: text(payload.taskId),
      providerId: text(payload.providerId),
      modelId: text(payload.modelId),
      metadata: { registrationSource: "legacy-api" },
    });
  }

  async function findAccessible(ownerId: string, id: string) {
    const artifact = await deps.repository.findOwned(ownerId, id);
    if (!artifact) throw new GenerationArtifactLifecycleError(404, "MATERIAL_NOT_FOUND");
    if (artifact.status === "deleted" || artifact.status === "missing") {
      throw new GenerationArtifactLifecycleError(404, "MATERIAL_NOT_FOUND");
    }
    if (artifact.status === "expired" || Number(artifact.expiresAt) <= now()) {
      throw new GenerationArtifactLifecycleError(410, "MATERIAL_EXPIRED");
    }
    return artifact;
  }

  async function resolveContent(ownerId: string, id: string) {
    const artifact = await findAccessible(ownerId, id);
    const filename = generationArtifactStorageKey(artifact.fileUrl);
    if (!filename || /[\\/]/.test(filename) || filename.includes("..")) {
      throw new GenerationArtifactLifecycleError(403, "MATERIAL_ACCESS_DENIED");
    }
    const stored = await deps.artifactStore.resolveOwned(ownerId, filename);
    if (!stored) throw new GenerationArtifactLifecycleError(404, "MATERIAL_NOT_FOUND");
    return { artifact, ...stored };
  }

  async function deleteOwned(ownerId: string, id: string) {
    const result = await deps.repository.deleteOwned(ownerId, id);
    if (!result) throw new GenerationArtifactLifecycleError(404, "MATERIAL_NOT_FOUND");
    if (result.deleteBinary) {
      const filename = generationArtifactStorageKey(result.artifact.fileUrl);
      if (filename) await deps.artifactStore.deleteOwned(ownerId, filename);
    }
    return result.artifact;
  }

  async function promoteOwned(ownerId: string, id: string) {
    await findAccessible(ownerId, id);
    const result = await deps.repository.promoteOwned(ownerId, id);
    if (!result) throw new GenerationArtifactLifecycleError(404, "MATERIAL_NOT_FOUND");
    return result;
  }

  return { list, registerLegacy, findAccessible, resolveContent, deleteOwned, promoteOwned };
}

function text(value: unknown, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}
