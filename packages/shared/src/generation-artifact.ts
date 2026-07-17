export const GENERATION_ARTIFACT_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export type GenerationArtifactKind = "image" | "video" | "audio";

export type GenerationArtifactStatus =
  | "active"
  | "promoted"
  | "expired"
  | "missing"
  | "deleted";

export interface GenerationArtifact {
  id: string;
  kind: GenerationArtifactKind;
  status: GenerationArtifactStatus;
  title: string;
  storageKey: string;
  url: string;
  fileUrl: string;
  sourceUrl?: string;
  mime?: string;
  size?: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  sourceNodeId?: string;
  sourceCanvasId?: string;
  taskId?: string;
  providerId?: string;
  modelId?: string;
  promotedAssetId?: string;
  metadata?: Record<string, unknown>;
}

export interface RegisterGenerationArtifactInput {
  id?: string;
  kind: GenerationArtifactKind;
  title: string;
  storageKey: string;
  fileUrl: string;
  sourceUrl?: string;
  mime?: string;
  size?: number;
  createdAt?: number;
  expiresAt?: number;
  sourceNodeId?: string;
  sourceCanvasId?: string;
  taskId?: string;
  providerId?: string;
  modelId?: string;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}

export function buildTaskGenerationArtifactId(input: {
  taskId: string;
  kind: GenerationArtifactKind;
  index: number;
}) {
  return `gen-${safeIdPart(input.taskId)}-${input.kind}-${Math.max(0, Math.trunc(input.index)) + 1}`;
}

export function buildGenerationArtifactDedupeKey(input: {
  taskId?: string;
  kind: GenerationArtifactKind;
  storageKey: string;
}) {
  const taskPart = String(input.taskId || "legacy").trim() || "legacy";
  return `${taskPart}:${input.kind}:${String(input.storageKey || "").trim()}`;
}

export function generationArtifactStorageKey(fileUrl: string) {
  const value = String(fileUrl || "").trim();
  if (value.startsWith("/files/output/")) return decodeURIComponent(value.slice("/files/output/".length));
  if (value.startsWith("/output/")) return decodeURIComponent(value.slice("/output/".length));
  return value;
}

export function isVisibleGenerationArtifactStatus(status: GenerationArtifactStatus) {
  return status === "active" || status === "promoted";
}

export function normalizeGenerationArtifactKind(value: unknown): GenerationArtifactKind | "" {
  const kind = String(value || "").trim().toLowerCase();
  return kind === "image" || kind === "video" || kind === "audio" ? kind : "";
}

function safeIdPart(value: unknown) {
  return String(value || "task")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "task";
}

