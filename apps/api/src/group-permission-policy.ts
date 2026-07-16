import type { RhCatalogItem } from "@xinghuan/shared";

export interface GroupPermissionDenyLists {
  sharedResourceCategoryIds: string[];
  sharedResourceItemIds: string[];
  runningHubAppCatalogIds: string[];
  runningHubWorkflowCatalogIds: string[];
  nodeTypes: string[];
}

export interface GroupPermissionPolicy {
  groupId: string;
  updatedAt: number;
  updatedBy?: string;
  deny: GroupPermissionDenyLists;
}

export interface PermissionedUserLike {
  id: string;
  role: "admin" | "member";
  groupId?: string;
}

export interface SharedResourceLike {
  id: string;
  categoryId?: string;
}

export interface NodeCapabilityDefinition {
  id: string;
  label: string;
  group: string;
  description?: string;
}

const DEFAULT_GROUP_ID = "ungrouped";

function safeText(value: unknown, fallback = "") {
  const text = typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
  const normalized = text.trim();
  return normalized || fallback;
}

function uniqueStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => safeText(item)).filter(Boolean))];
}

export function emptyGroupPermissionDeny(): GroupPermissionDenyLists {
  return {
    sharedResourceCategoryIds: [],
    sharedResourceItemIds: [],
    runningHubAppCatalogIds: [],
    runningHubWorkflowCatalogIds: [],
    nodeTypes: [],
  };
}

export function normalizeGroupPermissionPolicy(value: unknown): GroupPermissionPolicy {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const deny = row.deny && typeof row.deny === "object" ? (row.deny as Record<string, unknown>) : {};
  return {
    groupId: safeText(row.groupId, DEFAULT_GROUP_ID),
    updatedAt: Number.isFinite(Number(row.updatedAt)) && Number(row.updatedAt) > 0 ? Number(row.updatedAt) : Date.now(),
    updatedBy: safeText(row.updatedBy) || undefined,
    deny: {
      sharedResourceCategoryIds: uniqueStringArray(deny.sharedResourceCategoryIds),
      sharedResourceItemIds: uniqueStringArray(deny.sharedResourceItemIds),
      runningHubAppCatalogIds: uniqueStringArray(deny.runningHubAppCatalogIds),
      runningHubWorkflowCatalogIds: uniqueStringArray(deny.runningHubWorkflowCatalogIds),
      nodeTypes: uniqueStringArray(deny.nodeTypes),
    },
  };
}

export function normalizeGroupPermissionPolicies(value: unknown): GroupPermissionPolicy[] {
  return Array.isArray(value)
    ? value.map((item) => normalizeGroupPermissionPolicy(item)).filter((item, index, list) => list.findIndex((entry) => entry.groupId === item.groupId) === index)
    : [];
}

export function effectiveGroupIdForUser(user: PermissionedUserLike | null | undefined) {
  if (!user) return DEFAULT_GROUP_ID;
  return safeText(user.groupId, DEFAULT_GROUP_ID);
}

export function policyForUser(
  user: PermissionedUserLike | null | undefined,
  policies: GroupPermissionPolicy[],
) {
  if (!user) return null;
  if (user.role === "admin") return null;
  const groupId = effectiveGroupIdForUser(user);
  return policies.find((item) => item.groupId === groupId) || {
    groupId,
    updatedAt: 0,
    updatedBy: undefined,
    deny: emptyGroupPermissionDeny(),
  };
}

export function canUseSharedResource(
  policy: GroupPermissionPolicy | null | undefined,
  item: SharedResourceLike,
) {
  if (!policy) return true;
  if (policy.deny.sharedResourceItemIds.includes("*")) return false;
  if (policy.deny.sharedResourceCategoryIds.includes("*")) return false;
  if (policy.deny.sharedResourceItemIds.includes(item.id)) return false;
  if (item.categoryId && policy.deny.sharedResourceCategoryIds.includes(item.categoryId)) return false;
  return true;
}

export function filterSharedResourceItemsForUser<T extends SharedResourceLike>(
  items: T[],
  user: PermissionedUserLike | null | undefined,
  policies: GroupPermissionPolicy[],
) {
  const policy = policyForUser(user, policies);
  if (!policy) return items;
  if (policy.deny.sharedResourceItemIds.includes("*") || policy.deny.sharedResourceCategoryIds.includes("*")) return [];
  return items.filter((item) => canUseSharedResource(policy, item));
}

export function canUseRunningHubCatalogItem(
  policy: GroupPermissionPolicy | null | undefined,
  item: Pick<RhCatalogItem, "kind" | "catalogId">,
) {
  if (!policy) return true;
  if (item.kind === "app" && policy.deny.runningHubAppCatalogIds.includes("*")) return false;
  if (item.kind !== "app" && policy.deny.runningHubWorkflowCatalogIds.includes("*")) return false;
  if (item.kind === "app") {
    return !policy.deny.runningHubAppCatalogIds.includes(item.catalogId);
  }
  return !policy.deny.runningHubWorkflowCatalogIds.includes(item.catalogId);
}

export function filterRunningHubCatalogForUser<T extends Pick<RhCatalogItem, "kind" | "catalogId">>(
  items: T[],
  user: PermissionedUserLike | null | undefined,
  policies: GroupPermissionPolicy[],
) {
  const policy = policyForUser(user, policies);
  if (!policy) return items;
  if (
    policy.deny.runningHubAppCatalogIds.includes("*") &&
    policy.deny.runningHubWorkflowCatalogIds.includes("*")
  ) return [];
  return items.filter((item) => canUseRunningHubCatalogItem(policy, item));
}

export function canUseNodeType(policy: GroupPermissionPolicy | null | undefined, nodeType: string) {
  if (!policy) return true;
  if (policy.deny.nodeTypes.includes("*")) return false;
  return !policy.deny.nodeTypes.includes(safeText(nodeType));
}

export function buildEffectivePermissions(
  user: PermissionedUserLike | null | undefined,
  policies: GroupPermissionPolicy[],
) {
  const groupId = effectiveGroupIdForUser(user);
  const isAdmin = user?.role === "admin";
  return {
    groupId,
    isAdmin,
    deny: isAdmin ? emptyGroupPermissionDeny() : (policyForUser(user, policies)?.deny || emptyGroupPermissionDeny()),
  };
}

export const DEFAULT_NODE_CAPABILITIES: NodeCapabilityDefinition[] = [
  { id: "image", label: "图像生成", group: "generation", description: "图片生成节点与对应提交能力" },
  { id: "video", label: "视频生成", group: "generation", description: "视频生成节点与对应提交能力" },
  { id: "audio", label: "音频生成", group: "generation", description: "音频生成节点与对应提交能力" },
  { id: "runninghub", label: "RunningHub", group: "integration", description: "RunningHub 应用与工作流节点" },
  { id: "rh-tools", label: "RH Tools", group: "integration", description: "RunningHub 辅助工具能力" },
  { id: "resource-library", label: "资源库", group: "resource", description: "资源库插入与资源使用能力" },
];

export function serializePolicyDeny(deny: GroupPermissionDenyLists) {
  return {
    sharedResourceCategoryIds: [...deny.sharedResourceCategoryIds],
    sharedResourceItemIds: [...deny.sharedResourceItemIds],
    runningHubAppCatalogIds: [...deny.runningHubAppCatalogIds],
    runningHubWorkflowCatalogIds: [...deny.runningHubWorkflowCatalogIds],
    nodeTypes: [...deny.nodeTypes],
  };
}
