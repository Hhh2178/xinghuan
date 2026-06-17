export type EnvironmentSyncTarget = "gray" | "production";
export type EnvironmentSyncObjectKind = "user" | "provider";
export type EnvironmentSyncDiffState = "missing_in_target" | "missing_in_source" | "conflict" | "identical";
export type EnvironmentSyncDecision = "skip" | "use_source" | "keep_target";

export interface EnvironmentSyncProviderModelSummary {
  sourceCount: number;
  targetCount: number;
  identicalCount: number;
  conflictCount: number;
  sourceOnlyCount: number;
  targetOnlyCount: number;
}

export interface EnvironmentSyncPreviewRow {
  id: string;
  kind: EnvironmentSyncObjectKind;
  displayName: string;
  naturalKey: string;
  state: EnvironmentSyncDiffState;
  sourceSummary: Record<string, unknown>;
  targetSummary: Record<string, unknown>;
  providerModelSummary?: EnvironmentSyncProviderModelSummary;
  defaultDecision: EnvironmentSyncDecision;
}

export interface EnvironmentSyncPreviewResponse {
  sourceEnvironment: EnvironmentSyncTarget;
  targetEnvironment: EnvironmentSyncTarget;
  generatedAt: number;
  users: EnvironmentSyncPreviewRow[];
  providers: EnvironmentSyncPreviewRow[];
}

export interface EnvironmentSyncApplyItem {
  id: string;
  kind: EnvironmentSyncObjectKind;
  decision: EnvironmentSyncDecision;
  selected: boolean;
}

export interface EnvironmentSyncApplyRequest {
  sourceEnvironment: EnvironmentSyncTarget;
  targetEnvironment: EnvironmentSyncTarget;
  items: EnvironmentSyncApplyItem[];
}

export interface EnvironmentSyncApplyResultRow {
  id: string;
  kind: EnvironmentSyncObjectKind;
  decision: EnvironmentSyncDecision;
  status: "applied" | "skipped" | "failed";
  message?: string;
}

export interface EnvironmentSyncApplyResponse {
  sourceEnvironment: EnvironmentSyncTarget;
  targetEnvironment: EnvironmentSyncTarget;
  executedAt: number;
  results: EnvironmentSyncApplyResultRow[];
}
