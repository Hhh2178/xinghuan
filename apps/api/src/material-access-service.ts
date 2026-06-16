import { basename, join } from "node:path";
import type { IncomingMessage } from "node:http";
import type { MaterialAccessDescriptor, ResolvedMaterialAccess } from "./material-access-types.js";

interface GenerationLibraryMaterialShape {
  id: string;
  fileUrl?: string;
  url?: string;
  mime?: string;
  size?: number;
  expiresAt: number;
  title: string;
}

interface MaterialAccessUser {
  id: string;
}

export function createMaterialAccessService(deps: {
  safeText: (value: unknown, fallback?: string) => string;
  inferMime: (filename: string) => string;
  requestPublicOrigin: (request: IncomingMessage) => string;
  userDataDirs: <T extends MaterialAccessUser>(user: T) => { outputDir: string };
}) {
  function buildDownloadFilename(fileUrl: string, title: string) {
    const raw = deps.safeText(title, basename(fileUrl));
    return raw.replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "_") || "material";
  }

  function buildGenerationLibraryAccessDescriptor(input: {
    request: IncomingMessage;
    item: GenerationLibraryMaterialShape;
  }): MaterialAccessDescriptor {
    const fileUrl = deps.safeText(input.item.fileUrl || input.item.url);
    const filename = buildDownloadFilename(fileUrl, input.item.title);
    const base = deps.requestPublicOrigin(input.request) || "";
    const path = `/api/materials/generation-library/${encodeURIComponent(input.item.id)}/content`;
    const previewUrl = `${base}${path}?disposition=inline`;
    const downloadUrl = `${base}${path}?disposition=attachment`;
    return {
      source: "generation-library",
      materialId: input.item.id,
      filename,
      mime: deps.safeText(input.item.mime, deps.inferMime(filename)),
      size: Number(input.item.size) || 0,
      previewUrl,
      downloadUrl,
      openUrl: previewUrl,
      canDownload: true,
      isExpired: input.item.expiresAt <= Date.now(),
    };
  }

  function resolveGenerationLibraryMaterial(input: {
    item: GenerationLibraryMaterialShape;
    user: MaterialAccessUser;
  }): ResolvedMaterialAccess {
    const fileUrl = deps.safeText(input.item.fileUrl || input.item.url);
    if (!fileUrl.startsWith("/files/output/")) throw new Error("MATERIAL_ACCESS_UNSUPPORTED_URL");
    const fileSegment = decodeURIComponent(fileUrl.slice("/files/output/".length));
    if (!fileSegment || /[\\/]/.test(fileSegment) || fileSegment.includes("..")) {
      throw new Error("MATERIAL_ACCESS_INVALID_PATH");
    }
    const filename = buildDownloadFilename(fileUrl, input.item.title);
    return {
      source: "generation-library",
      materialId: input.item.id,
      filename,
      mime: deps.safeText(input.item.mime, deps.inferMime(filename)),
      size: Number(input.item.size) || 0,
      absolutePath: join(deps.userDataDirs(input.user).outputDir, fileSegment),
      isExpired: input.item.expiresAt <= Date.now(),
    };
  }

  return {
    buildGenerationLibraryAccessDescriptor,
    resolveGenerationLibraryMaterial,
  };
}
