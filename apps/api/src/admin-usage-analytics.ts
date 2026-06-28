import type { RhCatalogItem } from "@xinghuan/shared";

export type UsageCapability =
  | "image"
  | "video"
  | "runninghub_app"
  | "runninghub_workflow"
  | "llm"
  | "audio"
  | "unknown";

export interface AdminUsageTaskRecord {
  id: string;
  status: string;
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerRemark?: string;
  ownerGroupId?: string;
  ownerGroupName?: string;
  ownerDeleted?: boolean;
  providerId?: string;
  providerName?: string;
  modelId?: string;
  modelRecordId?: string;
  modelDisplayName?: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  createdAt: number;
}

export interface AdminUsageSummaryFilters {
  from: number;
  to: number;
  groupId?: string;
  userId?: string;
  capability?: UsageCapability;
  providerId?: string;
  modelId?: string;
  rhCatalogId?: string;
}

export interface AdminUsageSummary {
  range: { from: number; to: number };
  totals: {
    successful: number;
    image: number;
    video: number;
    runninghubApp: number;
    runninghubWorkflow: number;
    llm: number;
    audio: number;
    unknown: number;
  };
  groups: UsageGroupRow[];
  users: UsageUserRow[];
  models: UsageModelRow[];
  runningHubEntries: UsageRunningHubEntryRow[];
  daily: UsageDailyRow[];
  selectedUser?: UsageSelectedUserSummary;
}

export interface UsageGroupRow {
  groupId: string;
  groupName: string;
  memberCount: number;
  total: number;
  image: number;
  video: number;
  runninghubApp: number;
  runninghubWorkflow: number;
  llm: number;
  audio: number;
  topModelName?: string;
  topRunningHubEntryTitle?: string;
}

export interface UsageUserRow {
  userId: string;
  email: string;
  name: string;
  remark?: string;
  groupId?: string;
  groupName?: string;
  ownerDeleted?: boolean;
  total: number;
  image: number;
  video: number;
  runninghubApp: number;
  runninghubWorkflow: number;
  llm: number;
  audio: number;
  topModelName?: string;
  topRunningHubEntryTitle?: string;
}

export interface UsageModelRow {
  capability: "image" | "video" | "llm" | "audio";
  providerId: string;
  providerName: string;
  modelRecordId: string;
  modelId: string;
  displayName: string;
  total: number;
  topGroupName?: string;
  topUserEmail?: string;
}

export interface UsageRunningHubEntryRow {
  kind: "app" | "workflow";
  providerId: string;
  providerName: string;
  catalogId: string;
  title: string;
  runTargetId: string;
  total: number;
  topGroupName?: string;
  topUserEmail?: string;
}

export interface UsageDailyRow {
  day: string;
  image: number;
  video: number;
  runninghubApp: number;
  runninghubWorkflow: number;
  llm: number;
  audio: number;
  total: number;
}

export interface UsageSelectedUserModelRow {
  capability: "image" | "video" | "llm" | "audio";
  providerId: string;
  providerName: string;
  modelRecordId: string;
  modelId: string;
  displayName: string;
  total: number;
  lastUsedAt?: number;
}

export interface UsageSelectedUserRunningHubRow {
  kind: "app" | "workflow";
  providerId: string;
  providerName: string;
  catalogId: string;
  title: string;
  runTargetId: string;
  total: number;
  lastUsedAt?: number;
}

export interface UsageSelectedUserSummary {
  userId: string;
  email: string;
  name: string;
  remark?: string;
  groupId?: string;
  groupName?: string;
  ownerDeleted?: boolean;
  successful: number;
  lastSucceededAt?: number;
  modelBreakdown: UsageSelectedUserModelRow[];
  runningHubBreakdown: UsageSelectedUserRunningHubRow[];
}

export interface RunningHubUsageCatalogResolver {
  byCatalogId(catalogId: string): RhCatalogItem | null;
  byTarget(providerId: string, kind: "app" | "workflow", runTargetId: string): RhCatalogItem | null;
}

interface UsagePreparedTask extends AdminUsageTaskRecord {
  capability: UsageCapability;
  groupId: string;
  groupName: string;
  userId: string;
  email: string;
  name: string;
  remark?: string;
  rhEntry?: {
    kind: "app" | "workflow";
    providerId: string;
    providerName: string;
    catalogId: string;
    title: string;
    runTargetId: string;
  };
  modelEntry?: {
    capability: "image" | "video" | "llm" | "audio";
    providerId: string;
    providerName: string;
    modelRecordId: string;
    modelId: string;
    displayName: string;
  };
}

function safeText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function plainObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {} as Record<string, unknown>;
  return value as Record<string, unknown>;
}

function capabilityToSummaryKey(capability: UsageCapability) {
  if (capability === "runninghub_app") return "runninghubApp";
  if (capability === "runninghub_workflow") return "runninghubWorkflow";
  return capability;
}

function incrementUsageCounters(
  row: {
    image: number;
    video: number;
    runninghubApp: number;
    runninghubWorkflow: number;
    llm: number;
    audio: number;
  },
  capability: UsageCapability,
) {
  const summaryKey = capabilityToSummaryKey(capability);
  if (summaryKey === "image") row.image += 1;
  else if (summaryKey === "video") row.video += 1;
  else if (summaryKey === "runninghubApp") row.runninghubApp += 1;
  else if (summaryKey === "runninghubWorkflow") row.runninghubWorkflow += 1;
  else if (summaryKey === "llm") row.llm += 1;
  else if (summaryKey === "audio") row.audio += 1;
}

export function classifyUsageTask(task: Pick<AdminUsageTaskRecord, "providerId" | "payload" | "result">): UsageCapability {
  const payload = plainObject(task.payload);
  const result = plainObject(task.result);
  const raw = plainObject(result.raw);
  const protocol = safeText(payload.protocol || result.protocol || result.adapter).toLowerCase();
  const capability = safeText(payload.taskCapability || result.capability || raw.capability).toLowerCase();
  const targetType = safeText(payload.targetType || result.rhTargetType).toLowerCase();
  if (protocol === "runninghub" || safeText(task.providerId).toLowerCase() === "runninghub") {
    return targetType === "app" ? "runninghub_app" : "runninghub_workflow";
  }
  if (capability === "image") return "image";
  if (capability === "video") return "video";
  if (capability === "chat" || capability === "llm" || capability === "text_chat") return "llm";
  if (capability === "audio") return "audio";
  return "unknown";
}

function dayKey(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function resolveRunningHubEntry(task: AdminUsageTaskRecord, capability: UsageCapability, resolver: RunningHubUsageCatalogResolver) {
  if (capability !== "runninghub_app" && capability !== "runninghub_workflow") return undefined;
  const payload = plainObject(task.payload);
  const result = plainObject(task.result);
  const kind = capability === "runninghub_app" ? "app" : "workflow";
  const providerId = safeText(task.providerId || payload.providerId || result.providerId, "runninghub");
  const providerName = safeText(task.providerName || result.providerName || payload.providerName, providerId || "RunningHub");
  const directCatalogId = safeText(payload.rhCatalogId || result.rhCatalogId);
  const directTitle = safeText(payload.rhCatalogTitle || result.rhCatalogTitle);
  const directKind = safeText(payload.rhCatalogKind || result.rhCatalogKind).toLowerCase() === "app" ? "app" : "workflow";
  const runTargetId = safeText(payload.runTargetId || result.rhRunTargetId || (kind === "app" ? payload.webappId || result.webappId : payload.workflowId || result.workflowId));
  const directCatalogItem = directCatalogId ? resolver.byCatalogId(directCatalogId) : null;
  if (directCatalogId) {
    return {
      kind: directKind as "app" | "workflow",
      providerId,
      providerName: directCatalogItem?.providerName || providerName,
      catalogId: directCatalogId,
      title: directTitle || directCatalogItem?.title || "未知 RH 条目",
      runTargetId: runTargetId || directCatalogItem?.runTargetId || "",
    };
  }
  const fallbackItem = runTargetId ? resolver.byTarget(providerId, kind, runTargetId) : null;
  if (fallbackItem) {
    return {
      kind: kind as "app" | "workflow",
      providerId: fallbackItem.providerId,
      providerName: fallbackItem.providerName,
      catalogId: fallbackItem.catalogId,
      title: fallbackItem.title,
      runTargetId: fallbackItem.runTargetId,
    };
  }
  return {
    kind: kind as "app" | "workflow",
    providerId,
    providerName,
    catalogId: `${providerId}:${kind}:${runTargetId || task.id}`,
    title: directTitle || "未知 RH 条目",
    runTargetId,
  };
}

function resolveModelEntry(task: AdminUsageTaskRecord, capability: UsageCapability) {
  if (!["image", "video", "llm", "audio"].includes(capability)) return undefined;
  const payload = plainObject(task.payload);
  const result = plainObject(task.result);
  const raw = plainObject(result.raw);
  const providerId = safeText(task.providerId || payload.providerId || raw.providerId);
  const providerName = safeText(task.providerName || result.providerName || payload.providerName, providerId || "未知 Provider");
  const modelRecordId = safeText(task.modelRecordId || task.modelId || payload.modelRecordId || raw.modelRecordId);
  const modelId = safeText(task.modelId || raw.modelId || result.modelId || payload.providerModel || payload.model, modelRecordId || "unknown-model");
  const displayName = safeText(task.modelDisplayName || result.modelDisplayName || payload.modelDisplayName, modelId || modelRecordId || "未知模型");
  return {
    capability: capability as "image" | "video" | "llm" | "audio",
    providerId: providerId || "unknown-provider",
    providerName,
    modelRecordId: modelRecordId || modelId || "unknown-model-record",
    modelId: modelId || modelRecordId || "unknown-model",
    displayName,
  };
}

function topEntryName(counter: Map<string, number>) {
  let topName = "";
  let topValue = -1;
  for (const [name, value] of counter.entries()) {
    if (value > topValue) {
      topValue = value;
      topName = name;
    }
  }
  return topName || undefined;
}

function buildSelectedUserSummary(input: {
  userId: string;
  identityTask?: UsagePreparedTask;
  tasks: UsagePreparedTask[];
}): UsageSelectedUserSummary | undefined {
  const identityTask = input.identityTask || input.tasks[0];
  if (!identityTask) return undefined;

  const modelMap = new Map<string, UsageSelectedUserModelRow>();
  const rhMap = new Map<string, UsageSelectedUserRunningHubRow>();

  for (const task of input.tasks) {
    if (task.modelEntry) {
      const key = [task.modelEntry.capability, task.modelEntry.providerId, task.modelEntry.modelRecordId].join("::");
      const existing = modelMap.get(key) || {
        ...task.modelEntry,
        total: 0,
        lastUsedAt: undefined,
      };
      existing.total += 1;
      existing.lastUsedAt = Math.max(existing.lastUsedAt || 0, task.createdAt);
      modelMap.set(key, existing);
    }

    if (task.rhEntry) {
      const key = [task.rhEntry.kind, task.rhEntry.providerId, task.rhEntry.catalogId].join("::");
      const existing = rhMap.get(key) || {
        ...task.rhEntry,
        total: 0,
        lastUsedAt: undefined,
      };
      existing.total += 1;
      existing.lastUsedAt = Math.max(existing.lastUsedAt || 0, task.createdAt);
      rhMap.set(key, existing);
    }
  }

  const modelBreakdown = [...modelMap.values()].sort(
    (a, b) => b.total - a.total || (b.lastUsedAt || 0) - (a.lastUsedAt || 0) || a.displayName.localeCompare(b.displayName, "zh-CN"),
  );
  const runningHubBreakdown = [...rhMap.values()].sort(
    (a, b) => b.total - a.total || (b.lastUsedAt || 0) - (a.lastUsedAt || 0) || a.title.localeCompare(b.title, "zh-CN"),
  );

  return {
    userId: input.userId,
    email: identityTask.email,
    name: identityTask.name,
    remark: identityTask.remark,
    groupId: identityTask.groupId,
    groupName: identityTask.groupName,
    ownerDeleted: Boolean(identityTask.ownerDeleted),
    successful: input.tasks.length,
    lastSucceededAt: input.tasks.length ? Math.max(...input.tasks.map((task) => task.createdAt)) : undefined,
    modelBreakdown,
    runningHubBreakdown,
  };
}

export function buildAdminUsageSummary(input: {
  tasks: AdminUsageTaskRecord[];
  filters: AdminUsageSummaryFilters;
  groupMemberCounts: Map<string, number>;
  runningHubResolver: RunningHubUsageCatalogResolver;
}): AdminUsageSummary {
  const successfulInRange: UsagePreparedTask[] = input.tasks
    .filter((task) => task.status === "succeeded")
    .filter((task) => task.createdAt >= input.filters.from && task.createdAt <= input.filters.to)
    .map((task) => {
      const capability = classifyUsageTask(task);
      const groupId = safeText(task.ownerGroupId, "ungrouped");
      const groupName = safeText(task.ownerGroupName, groupId === "ungrouped" ? "未分组" : groupId);
      const userId = safeText(task.ownerId, "deleted-owner");
      const email = safeText(task.ownerEmail, task.ownerDeleted ? `已删除账号 ${userId}` : "未知账号");
      const name = safeText(task.ownerName, task.ownerDeleted ? "已删除账号" : email);
      return {
        ...task,
        capability,
        groupId,
        groupName,
        userId,
        email,
        name,
        remark: safeText(task.ownerRemark) || undefined,
        rhEntry: resolveRunningHubEntry(task, capability, input.runningHubResolver),
        modelEntry: resolveModelEntry(task, capability),
      };
    })
    .filter((task) => (input.filters.groupId ? task.groupId === input.filters.groupId : true));

  const prepared: UsagePreparedTask[] = successfulInRange
    .filter((task) => (input.filters.capability ? task.capability === input.filters.capability : true))
    .filter((task) => (input.filters.providerId ? safeText(task.providerId) === input.filters.providerId : true))
    .filter((task) => (input.filters.modelId ? task.modelEntry?.modelRecordId === input.filters.modelId || task.modelEntry?.modelId === input.filters.modelId : true))
    .filter((task) => (input.filters.rhCatalogId ? task.rhEntry?.catalogId === input.filters.rhCatalogId : true));

  const selectedUserIdentityTask = input.filters.userId
    ? successfulInRange.find((task) => task.userId === input.filters.userId)
    : undefined;
  const selectedUserTasks = input.filters.userId
    ? prepared.filter((task) => task.userId === input.filters.userId)
    : [];
  const selectedUser = input.filters.userId
    ? buildSelectedUserSummary({
      userId: input.filters.userId,
      identityTask: selectedUserIdentityTask,
      tasks: selectedUserTasks,
    })
    : undefined;

  const totals = {
    successful: prepared.length,
    image: 0,
    video: 0,
    runninghubApp: 0,
    runninghubWorkflow: 0,
    llm: 0,
    audio: 0,
    unknown: 0,
  };

  const groupMap = new Map<string, UsageGroupRow>();
  const userMap = new Map<string, UsageUserRow>();
  const modelMap = new Map<string, UsageModelRow & { _groupHits: Map<string, number>; _userHits: Map<string, number> }>();
  const rhMap = new Map<string, UsageRunningHubEntryRow & { _groupHits: Map<string, number>; _userHits: Map<string, number> }>();
  const dailyMap = new Map<string, UsageDailyRow>();
  const groupModelCounters = new Map<string, Map<string, number>>();
  const groupRhCounters = new Map<string, Map<string, number>>();
  const userModelCounters = new Map<string, Map<string, number>>();
  const userRhCounters = new Map<string, Map<string, number>>();

  for (const task of prepared) {
    const summaryKey = capabilityToSummaryKey(task.capability);
    totals[summaryKey] += 1;

    const groupRow = groupMap.get(task.groupId) || {
      groupId: task.groupId,
      groupName: task.groupName,
      memberCount: input.groupMemberCounts.get(task.groupId) || 0,
      total: 0,
      image: 0,
      video: 0,
      runninghubApp: 0,
      runninghubWorkflow: 0,
      llm: 0,
      audio: 0,
    };
    groupRow.total += 1;
    incrementUsageCounters(groupRow, task.capability);
    groupMap.set(task.groupId, groupRow);

    const userRow = userMap.get(task.userId) || {
      userId: task.userId,
      email: task.email,
      name: task.name,
      remark: task.remark,
      groupId: task.groupId,
      groupName: task.groupName,
      ownerDeleted: Boolean(task.ownerDeleted),
      total: 0,
      image: 0,
      video: 0,
      runninghubApp: 0,
      runninghubWorkflow: 0,
      llm: 0,
      audio: 0,
    };
    userRow.total += 1;
    incrementUsageCounters(userRow, task.capability);
    userMap.set(task.userId, userRow);

    const dailyKey = dayKey(task.createdAt);
    const dailyRow = dailyMap.get(dailyKey) || {
      day: dailyKey,
      image: 0,
      video: 0,
      runninghubApp: 0,
      runninghubWorkflow: 0,
      llm: 0,
      audio: 0,
      total: 0,
    };
    incrementUsageCounters(dailyRow, task.capability);
    dailyRow.total += 1;
    dailyMap.set(dailyKey, dailyRow);

    if (task.modelEntry) {
      const modelKey = [task.modelEntry.capability, task.modelEntry.providerId, task.modelEntry.modelRecordId].join("::");
      const existing = modelMap.get(modelKey) || {
        ...task.modelEntry,
        total: 0,
        _groupHits: new Map<string, number>(),
        _userHits: new Map<string, number>(),
      };
      existing.total += 1;
      existing._groupHits.set(task.groupName, (existing._groupHits.get(task.groupName) || 0) + 1);
      existing._userHits.set(task.email, (existing._userHits.get(task.email) || 0) + 1);
      modelMap.set(modelKey, existing);

      const groupCounter = groupModelCounters.get(task.groupId) || new Map<string, number>();
      groupCounter.set(task.modelEntry.displayName, (groupCounter.get(task.modelEntry.displayName) || 0) + 1);
      groupModelCounters.set(task.groupId, groupCounter);

      const userCounter = userModelCounters.get(task.userId) || new Map<string, number>();
      userCounter.set(task.modelEntry.displayName, (userCounter.get(task.modelEntry.displayName) || 0) + 1);
      userModelCounters.set(task.userId, userCounter);
    }

    if (task.rhEntry) {
      const rhKey = [task.rhEntry.kind, task.rhEntry.providerId, task.rhEntry.catalogId].join("::");
      const existing = rhMap.get(rhKey) || {
        ...task.rhEntry,
        total: 0,
        _groupHits: new Map<string, number>(),
        _userHits: new Map<string, number>(),
      };
      existing.total += 1;
      existing._groupHits.set(task.groupName, (existing._groupHits.get(task.groupName) || 0) + 1);
      existing._userHits.set(task.email, (existing._userHits.get(task.email) || 0) + 1);
      rhMap.set(rhKey, existing);

      const groupCounter = groupRhCounters.get(task.groupId) || new Map<string, number>();
      groupCounter.set(task.rhEntry.title, (groupCounter.get(task.rhEntry.title) || 0) + 1);
      groupRhCounters.set(task.groupId, groupCounter);

      const userCounter = userRhCounters.get(task.userId) || new Map<string, number>();
      userCounter.set(task.rhEntry.title, (userCounter.get(task.rhEntry.title) || 0) + 1);
      userRhCounters.set(task.userId, userCounter);
    }
  }

  const groups = [...groupMap.values()]
    .map((row) => ({
      ...row,
      topModelName: topEntryName(groupModelCounters.get(row.groupId) || new Map<string, number>()),
      topRunningHubEntryTitle: topEntryName(groupRhCounters.get(row.groupId) || new Map<string, number>()),
    }))
    .sort((a, b) => b.total - a.total || a.groupName.localeCompare(b.groupName, "zh-CN"));

  const users = [...userMap.values()]
    .map((row) => ({
      ...row,
      topModelName: topEntryName(userModelCounters.get(row.userId) || new Map<string, number>()),
      topRunningHubEntryTitle: topEntryName(userRhCounters.get(row.userId) || new Map<string, number>()),
    }))
    .sort((a, b) => b.total - a.total || a.email.localeCompare(b.email, "zh-CN"));

  const models = [...modelMap.values()]
    .map(({ _groupHits, _userHits, ...row }) => ({
      ...row,
      topGroupName: topEntryName(_groupHits),
      topUserEmail: topEntryName(_userHits),
    }))
    .sort((a, b) => b.total - a.total || a.displayName.localeCompare(b.displayName, "zh-CN"));

  const runningHubEntries = [...rhMap.values()]
    .map(({ _groupHits, _userHits, ...row }) => ({
      ...row,
      topGroupName: topEntryName(_groupHits),
      topUserEmail: topEntryName(_userHits),
    }))
    .sort((a, b) => b.total - a.total || a.title.localeCompare(b.title, "zh-CN"));

  const daily = [...dailyMap.values()].sort((a, b) => a.day.localeCompare(b.day, "zh-CN"));

  return {
    range: {
      from: input.filters.from,
      to: input.filters.to,
    },
    totals,
    groups,
    users,
    models,
    runningHubEntries,
    daily,
    selectedUser,
  };
}
