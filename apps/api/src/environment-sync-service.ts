import type {
  EnvironmentSyncApplyItem,
  EnvironmentSyncApplyResponse,
  EnvironmentSyncApplyResultRow,
  EnvironmentSyncDecision,
  EnvironmentSyncDiffState,
  EnvironmentSyncObjectKind,
  EnvironmentSyncPreviewResponse,
  EnvironmentSyncPreviewRow,
  EnvironmentSyncProviderModelSummary,
  EnvironmentSyncTarget,
} from "@xinghuan/shared";

type EnvironmentSyncModelCapability = "chat" | "image" | "video" | "audio";

export interface EnvironmentSyncUserRecord {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
  disabled: boolean;
  passwordHash: string;
  passwordCipher?: string;
  createdAt: number;
  updatedAt: number;
}

export interface EnvironmentSyncProviderRecord {
  id: string;
  name: string;
  baseUrl: string;
  protocol: string;
  enabled: boolean;
  apiKey?: string;
  apiKeyPreview?: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface EnvironmentSyncModelRecord {
  id: string;
  providerId: string;
  providerName: string;
  modelId: string;
  displayName: string;
  capability: EnvironmentSyncModelCapability;
  enabled: boolean;
  executionMode?: string;
  inputProfile: string;
  inputCapabilities?: Record<string, unknown>;
  capabilityTags?: string[];
  testState?: unknown;
  parameterSchema: string;
  advancedConfig?: Record<string, unknown>;
  protocolOverride?: string;
  createdAt: number;
  updatedAt: number;
}

export interface EnvironmentSyncSnapshot {
  environment: EnvironmentSyncTarget;
  users: EnvironmentSyncUserRecord[];
  providers: EnvironmentSyncProviderRecord[];
  models: EnvironmentSyncModelRecord[];
}

interface EnvironmentSyncRecordBundle {
  users: EnvironmentSyncUserRecord[];
  providers: EnvironmentSyncProviderRecord[];
  models: EnvironmentSyncModelRecord[];
}

export interface EnvironmentSyncWriteRequest extends EnvironmentSyncRecordBundle {
  sourceEnvironment: EnvironmentSyncTarget;
  targetEnvironment: EnvironmentSyncTarget;
  actorEmail?: string;
}

interface ComparisonRow {
  row: EnvironmentSyncPreviewRow;
  kind: EnvironmentSyncObjectKind;
  sourceUser?: EnvironmentSyncUserRecord;
  targetUser?: EnvironmentSyncUserRecord;
  sourceProvider?: EnvironmentSyncProviderRecord;
  targetProvider?: EnvironmentSyncProviderRecord;
  sourceModels: EnvironmentSyncModelRecord[];
  targetModels: EnvironmentSyncModelRecord[];
}

interface EnvironmentSyncServiceDependencies {
  currentEnvironment: "local" | EnvironmentSyncTarget;
  now?: () => number;
  readLocalSnapshot: (environment: EnvironmentSyncTarget) => Promise<EnvironmentSyncSnapshot>;
  readRemoteSnapshot: (environment: EnvironmentSyncTarget) => Promise<EnvironmentSyncSnapshot>;
  applyLocalSnapshot: (request: EnvironmentSyncWriteRequest) => Promise<EnvironmentSyncApplyResultRow[]>;
  applyRemoteSnapshot: (
    environment: EnvironmentSyncTarget,
    request: EnvironmentSyncWriteRequest,
  ) => Promise<EnvironmentSyncApplyResultRow[]>;
}

export function createEnvironmentSyncService(deps: EnvironmentSyncServiceDependencies) {
  async function previewEnvironmentSync(input: {
    sourceEnvironment: EnvironmentSyncTarget;
    targetEnvironment: EnvironmentSyncTarget;
  }): Promise<EnvironmentSyncPreviewResponse> {
    assertDifferentEnvironments(input.sourceEnvironment, input.targetEnvironment);
    const [sourceSnapshot, targetSnapshot] = await Promise.all([
      readSnapshot(input.sourceEnvironment),
      readSnapshot(input.targetEnvironment),
    ]);
    const comparison = buildComparison(sourceSnapshot, targetSnapshot);
    return {
      sourceEnvironment: input.sourceEnvironment,
      targetEnvironment: input.targetEnvironment,
      generatedAt: now(),
      users: comparison.users,
      providers: comparison.providers,
    };
  }

  async function applyEnvironmentSync(input: {
    sourceEnvironment: EnvironmentSyncTarget;
    targetEnvironment: EnvironmentSyncTarget;
    items: EnvironmentSyncApplyItem[];
    actorEmail?: string;
  }): Promise<EnvironmentSyncApplyResponse> {
    assertDifferentEnvironments(input.sourceEnvironment, input.targetEnvironment);
    const selectedItems = Array.isArray(input.items) ? input.items.filter((item) => item?.selected) : [];
    if (selectedItems.length === 0) throw new Error("至少选择一项后才能执行同步");

    const [sourceSnapshot, targetSnapshot] = await Promise.all([
      readSnapshot(input.sourceEnvironment),
      readSnapshot(input.targetEnvironment),
    ]);
    const comparison = buildComparison(sourceSnapshot, targetSnapshot);
    const plans: Array<{
      item: EnvironmentSyncApplyItem;
      comparisonRow?: ComparisonRow;
    }> = selectedItems.map((item) => ({
      item,
      comparisonRow: comparison.byId.get(`${item.kind}:${item.id}`),
    }));

    const immediateResults: EnvironmentSyncApplyResultRow[] = [];
    const writableUsers: EnvironmentSyncUserRecord[] = [];
    const writableProviders: EnvironmentSyncProviderRecord[] = [];
    const writableModels: EnvironmentSyncModelRecord[] = [];

    for (const plan of plans) {
      const row = plan.comparisonRow;
      if (!row) {
        immediateResults.push({
          id: plan.item.id,
          kind: plan.item.kind,
          decision: plan.item.decision,
          status: "failed",
          message: "同步项已过期，请重新查看差异后再确认同步",
        });
        continue;
      }
      if (plan.item.decision === "skip") {
        immediateResults.push({
          id: plan.item.id,
          kind: plan.item.kind,
          decision: plan.item.decision,
          status: "skipped",
          message: "已按选择跳过",
        });
        continue;
      }
      if (plan.item.decision === "keep_target") {
        immediateResults.push({
          id: plan.item.id,
          kind: plan.item.kind,
          decision: plan.item.decision,
          status: "skipped",
          message: "已保留右侧当前数据",
        });
        continue;
      }
      if (row.row.state === "missing_in_source") {
        immediateResults.push({
          id: plan.item.id,
          kind: plan.item.kind,
          decision: plan.item.decision,
          status: "failed",
          message: "左侧环境不存在该对象，当前版本不会执行删除",
        });
        continue;
      }
      if (row.row.state === "conflict" && plan.item.decision !== "use_source" && plan.item.decision !== "keep_target") {
        immediateResults.push({
          id: plan.item.id,
          kind: plan.item.kind,
          decision: plan.item.decision,
          status: "failed",
          message: "两边内容不一致的项必须明确选择以左侧环境为准或保留右侧当前数据",
        });
        continue;
      }
      if (row.kind === "user") {
        if (!row.sourceUser) {
          immediateResults.push({
            id: plan.item.id,
            kind: plan.item.kind,
            decision: plan.item.decision,
            status: "failed",
            message: "左侧环境账号数据缺失",
          });
          continue;
        }
        writableUsers.push(row.sourceUser);
        continue;
      }
      if (!row.sourceProvider) {
        immediateResults.push({
          id: plan.item.id,
          kind: plan.item.kind,
          decision: plan.item.decision,
          status: "failed",
          message: "左侧环境服务商数据缺失",
        });
        continue;
      }
      writableProviders.push(row.sourceProvider);
      writableModels.push(...row.sourceModels);
    }

    let appliedResults: EnvironmentSyncApplyResultRow[] = [];
    if (writableUsers.length > 0 || writableProviders.length > 0) {
      const request: EnvironmentSyncWriteRequest = {
        sourceEnvironment: input.sourceEnvironment,
        targetEnvironment: input.targetEnvironment,
        actorEmail: input.actorEmail,
        users: dedupeUsers(writableUsers),
        providers: dedupeProviders(writableProviders),
        models: dedupeModels(writableModels),
      };
      appliedResults = await writeSnapshot(input.targetEnvironment, request);
    }

    return {
      sourceEnvironment: input.sourceEnvironment,
      targetEnvironment: input.targetEnvironment,
      executedAt: now(),
      results: [...immediateResults, ...appliedResults],
    };
  }

  async function readSnapshot(environment: EnvironmentSyncTarget) {
    if (deps.currentEnvironment === environment) {
      return deps.readLocalSnapshot(environment);
    }
    return deps.readRemoteSnapshot(environment);
  }

  async function writeSnapshot(environment: EnvironmentSyncTarget, request: EnvironmentSyncWriteRequest) {
    if (deps.currentEnvironment === environment) {
      return deps.applyLocalSnapshot(request);
    }
    return deps.applyRemoteSnapshot(environment, request);
  }

  return {
    previewEnvironmentSync,
    applyEnvironmentSync,
  };

  function now() {
    return deps.now ? deps.now() : Date.now();
  }
}

function assertDifferentEnvironments(sourceEnvironment: EnvironmentSyncTarget, targetEnvironment: EnvironmentSyncTarget) {
  if (sourceEnvironment === targetEnvironment) {
    throw new Error("左侧环境和右侧环境不能相同");
  }
}

function buildComparison(sourceSnapshot: EnvironmentSyncSnapshot, targetSnapshot: EnvironmentSyncSnapshot) {
  const users: EnvironmentSyncPreviewRow[] = [];
  const providers: EnvironmentSyncPreviewRow[] = [];
  const byId = new Map<string, ComparisonRow>();

  const sourceProviderModels = buildProviderModelBuckets(sourceSnapshot.models);
  const targetProviderModels = buildProviderModelBuckets(targetSnapshot.models);

  const userKeys = new Set([
    ...sourceSnapshot.users.map(userNaturalKey),
    ...targetSnapshot.users.map(userNaturalKey),
  ]);
  for (const key of userKeys) {
    const sourceUser = sourceSnapshot.users.find((item) => userNaturalKey(item) === key);
    const targetUser = targetSnapshot.users.find((item) => userNaturalKey(item) === key);
    const row = createUserRow(sourceUser, targetUser);
    users.push(row.row);
    byId.set(`user:${row.row.id}`, row);
  }

  const providerKeys = new Set([
    ...sourceSnapshot.providers.map(providerNaturalKey),
    ...targetSnapshot.providers.map(providerNaturalKey),
  ]);
  for (const key of providerKeys) {
    const sourceProvider = sourceSnapshot.providers.find((item) => providerNaturalKey(item) === key);
    const targetProvider = targetSnapshot.providers.find((item) => providerNaturalKey(item) === key);
    const sourceModels = sourceProviderModels.get(key) || [];
    const targetModels = targetProviderModels.get(key) || [];
    const row = createProviderRow(sourceProvider, targetProvider, sourceModels, targetModels);
    providers.push(row.row);
    byId.set(`provider:${row.row.id}`, row);
  }

  return { users, providers, byId };
}

function createUserRow(
  sourceUser?: EnvironmentSyncUserRecord,
  targetUser?: EnvironmentSyncUserRecord,
): ComparisonRow {
  const state = diffStateFor(
    sourceUser,
    targetUser,
    sourceUser ? userComparableSignature(sourceUser) : "",
    targetUser ? userComparableSignature(targetUser) : "",
  );
  const row: EnvironmentSyncPreviewRow = {
    id: sourceUser?.id || targetUser?.id || "",
    kind: "user",
    displayName: sourceUser?.name || targetUser?.name || sourceUser?.email || targetUser?.email || "账号",
    naturalKey: sourceUser?.email || targetUser?.email || "",
    state,
    sourceSummary: sourceUser ? userSummary(sourceUser) : {},
    targetSummary: targetUser ? userSummary(targetUser) : {},
    defaultDecision: defaultDecisionFor(state),
  };
  return { row, kind: "user", sourceUser, targetUser, sourceModels: [], targetModels: [] };
}

function createProviderRow(
  sourceProvider: EnvironmentSyncProviderRecord | undefined,
  targetProvider: EnvironmentSyncProviderRecord | undefined,
  sourceModels: EnvironmentSyncModelRecord[],
  targetModels: EnvironmentSyncModelRecord[],
): ComparisonRow {
  const providerModelSummary = summarizeProviderModels(sourceModels, targetModels);
  const state = diffStateFor(
    sourceProvider,
    targetProvider,
    providerBundleSignature(sourceProvider, sourceModels),
    providerBundleSignature(targetProvider, targetModels),
  );
  const modelKey = sourceProvider
    ? providerNaturalKey(sourceProvider)
    : targetProvider
      ? providerNaturalKey(targetProvider)
      : "";
  const row: EnvironmentSyncPreviewRow = {
    id: sourceProvider?.id || targetProvider?.id || modelKey,
    kind: "provider",
    displayName: sourceProvider?.name || targetProvider?.name || "服务商",
    naturalKey: modelKey,
    state,
    sourceSummary: sourceProvider ? providerSummary(sourceProvider, providerModelSummary.sourceCount) : {},
    targetSummary: targetProvider ? providerSummary(targetProvider, providerModelSummary.targetCount) : {},
    providerModelSummary,
    defaultDecision: defaultDecisionFor(state),
  };
  return { row, kind: "provider", sourceProvider, targetProvider, sourceModels, targetModels };
}

function diffStateFor<T>(
  sourceRecord: T | undefined,
  targetRecord: T | undefined,
  sourceSignature: string,
  targetSignature: string,
): EnvironmentSyncDiffState {
  if (sourceRecord && !targetRecord) return "missing_in_target";
  if (!sourceRecord && targetRecord) return "missing_in_source";
  if (!sourceRecord && !targetRecord) return "identical";
  return sourceSignature === targetSignature ? "identical" : "conflict";
}

function defaultDecisionFor(state: EnvironmentSyncDiffState): EnvironmentSyncDecision {
  if (state === "missing_in_target") return "use_source";
  if (state === "identical") return "skip";
  return "keep_target";
}

function userNaturalKey(user: EnvironmentSyncUserRecord) {
  return String(user.email || "").trim().toLowerCase();
}

function providerNaturalKey(provider: EnvironmentSyncProviderRecord) {
  return providerNaturalKeyFromName(provider.name) || String(provider.id || "").trim().toLowerCase();
}

function providerNaturalKeyFromName(name: string) {
  return String(name || "").trim().toLowerCase();
}

function modelNaturalKey(model: EnvironmentSyncModelRecord) {
  return [
    providerNaturalKeyFromName(model.providerName),
    String(model.capability || "").trim().toLowerCase(),
    String(model.modelId || "").trim().toLowerCase(),
  ].join("::");
}

function userComparableSignature(user: EnvironmentSyncUserRecord) {
  return JSON.stringify({
    email: user.email,
    name: user.name,
    role: user.role,
    disabled: Boolean(user.disabled),
    passwordHash: user.passwordHash,
    passwordCipher: user.passwordCipher || "",
  });
}

function providerComparableSignature(provider: EnvironmentSyncProviderRecord) {
  return JSON.stringify({
    name: provider.name,
    baseUrl: provider.baseUrl,
    protocol: provider.protocol,
    enabled: Boolean(provider.enabled),
    apiKey: provider.apiKey || "",
    apiKeyPreview: provider.apiKeyPreview || "",
    note: provider.note || "",
  });
}

function providerBundleSignature(
  provider: EnvironmentSyncProviderRecord | undefined,
  providerModels: EnvironmentSyncModelRecord[],
) {
  if (!provider) return "";
  return JSON.stringify({
    provider: JSON.parse(providerComparableSignature(provider)),
    providerModels: providerModels
      .map((model) => comparableModelRecord(model))
      .sort((left, right) => modelNaturalKey(left).localeCompare(modelNaturalKey(right))),
  });
}

function comparableModelRecord(model: EnvironmentSyncModelRecord): EnvironmentSyncModelRecord {
  return {
    ...model,
    providerName: String(model.providerName || "").trim(),
    modelId: String(model.modelId || "").trim(),
    displayName: String(model.displayName || "").trim(),
    capability: model.capability,
    enabled: Boolean(model.enabled),
    executionMode: String(model.executionMode || "").trim(),
    inputProfile: String(model.inputProfile || "").trim(),
    inputCapabilities: cloneComparableObject(model.inputCapabilities),
    capabilityTags: [...new Set(Array.isArray(model.capabilityTags) ? model.capabilityTags.map((item) => String(item).trim()).filter(Boolean) : [])].sort(),
    testState: cloneComparableObject(model.testState),
    parameterSchema: String(model.parameterSchema || "{}").trim() || "{}",
    advancedConfig: cloneComparableObject(model.advancedConfig),
    protocolOverride: String(model.protocolOverride || "").trim(),
  };
}

function cloneComparableObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function buildProviderModelBuckets(models: EnvironmentSyncModelRecord[]) {
  const buckets = new Map<string, EnvironmentSyncModelRecord[]>();
  for (const model of models) {
    const key = providerNaturalKeyFromName(model.providerName);
    if (!key) continue;
    const list = buckets.get(key) || [];
    list.push(model);
    buckets.set(key, list);
  }
  return buckets;
}

function summarizeProviderModels(
  sourceModels: EnvironmentSyncModelRecord[],
  targetModels: EnvironmentSyncModelRecord[],
): EnvironmentSyncProviderModelSummary {
  let identicalCount = 0;
  let conflictCount = 0;
  let sourceOnlyCount = 0;
  let targetOnlyCount = 0;

  const sourceMap = new Map(sourceModels.map((model) => [modelNaturalKey(model), comparableModelRecord(model)]));
  const targetMap = new Map(targetModels.map((model) => [modelNaturalKey(model), comparableModelRecord(model)]));
  const keys = new Set([...sourceMap.keys(), ...targetMap.keys()]);

  for (const key of keys) {
    const source = sourceMap.get(key);
    const target = targetMap.get(key);
    if (source && !target) {
      sourceOnlyCount += 1;
      continue;
    }
    if (!source && target) {
      targetOnlyCount += 1;
      continue;
    }
    if (JSON.stringify(source) === JSON.stringify(target)) {
      identicalCount += 1;
    } else {
      conflictCount += 1;
    }
  }

  return {
    sourceCount: sourceModels.length,
    targetCount: targetModels.length,
    identicalCount,
    conflictCount,
    sourceOnlyCount,
    targetOnlyCount,
  };
}

function userSummary(user: EnvironmentSyncUserRecord) {
  return {
    email: user.email,
    name: user.name,
    role: user.role,
    disabled: Boolean(user.disabled),
    hasPassword: Boolean(user.passwordHash || user.passwordCipher),
  };
}

function providerSummary(provider: EnvironmentSyncProviderRecord, modelCount: number) {
  return {
    name: provider.name,
    baseUrl: provider.baseUrl,
    protocol: provider.protocol,
    enabled: Boolean(provider.enabled),
    hasApiKey: Boolean(provider.apiKey),
    apiKeyPreview: provider.apiKeyPreview || "",
    note: provider.note || "",
    modelCount,
  };
}

function dedupeUsers(users: EnvironmentSyncUserRecord[]) {
  const seen = new Set<string>();
  return users.filter((user) => {
    const key = userNaturalKey(user);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeProviders(providers: EnvironmentSyncProviderRecord[]) {
  const seen = new Set<string>();
  return providers.filter((provider) => {
    const key = providerNaturalKey(provider);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeModels(models: EnvironmentSyncModelRecord[]) {
  const seen = new Set<string>();
  return models.filter((model) => {
    const key = modelNaturalKey(model);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
