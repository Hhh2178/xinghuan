import type { PermissionSubject } from "@xinghuan/shared";
import { isDeepStrictEqual } from "node:util";

const MANAGED_BY = "first-wave";

export interface PermissionSubjectRepository {
  listSubjects: () => Promise<PermissionSubject[]>;
  upsertSubject: (subject: PermissionSubject) => Promise<PermissionSubject>;
}

export interface FirstWavePermissionSources {
  resourceCategories: Array<{ id: string; kind: string; name: string }>;
  resourceItems: Array<{ id: string; kind: string; title: string; categoryId?: string }>;
  runningHubItems: Array<{ catalogId: string; kind: "app" | "workflow"; title: string; enabled: boolean }>;
  nodeTypes: Array<{ type: string; label: string; category: string }>;
  providerModels: Array<{ id: string; displayName: string; capability: string; enabled: boolean }>;
}

export interface PermissionSubjectReconciliationReport {
  registered: number;
  unchanged: number;
  retired: number;
  restricted: number;
}

export function resourceCategorySubjectKey(id: string) {
  return `resource.category/${id}`;
}

export function resourceItemSubjectKey(id: string) {
  return `resource.item/${id}`;
}

export function runningHubAppSubjectKey(catalogId: string) {
  return `runninghub.app/${catalogId}`;
}

export function runningHubWorkflowSubjectKey(catalogId: string) {
  return `runninghub.workflow/${catalogId}`;
}

export function canvasNodeSubjectKey(type: string) {
  return `canvas.node/${type}`;
}

export function providerModelSubjectKey(modelId: string) {
  return `provider.model/${modelId}`;
}

export function createPermissionSubjectRegistrar(deps: PermissionSubjectRepository & { now?: () => number }) {
  return { reconcileFirstWavePermissionSubjects };

  async function reconcileFirstWavePermissionSubjects(
    sources: FirstWavePermissionSources,
  ): Promise<PermissionSubjectReconciliationReport> {
    const current = await deps.listSubjects();
    const currentByKey = new Map(current.map((item) => [item.subjectKey, item]));
    const desired = firstWaveSubjects(sources);
    let registered = 0;
    let unchanged = 0;
    let restricted = 0;

    for (const next of desired) {
      const existing = currentByKey.get(next.subjectKey);
      const merged = existing ? mergeExistingSubject(existing, next) : next;
      if (subjectsEqual(existing, merged)) {
        unchanged += 1;
        continue;
      }
      await deps.upsertSubject(merged);
      registered += 1;
      if (!existing && merged.exposureState === "restricted") restricted += 1;
    }

    const desiredKeys = new Set(desired.map((item) => item.subjectKey));
    let retired = 0;
    for (const existing of current) {
      if (!isFirstWaveManaged(existing) || desiredKeys.has(existing.subjectKey) || existing.exposureState === "retired") continue;
      await deps.upsertSubject({ ...existing, exposureState: "retired", revision: existing.revision + 1 });
      retired += 1;
    }

    return { registered, unchanged, retired, restricted };
  }
}

function firstWaveSubjects(sources: FirstWavePermissionSources): PermissionSubject[] {
  const parents = [
    parentSubject("resource/*", "resource", "root", "resource-root", "公共资源"),
    parentSubject("resource.category/*", "resource", "category-family", "resource-category-family", "公共资源分类", "resource/*"),
    parentSubject("resource.item/*", "resource", "item-family", "resource-item-family", "公共资源素材", "resource/*"),
    parentSubject("runninghub.app/*", "runninghub", "app-family", "runninghub-app-family", "RunningHub AI 应用"),
    parentSubject("runninghub.workflow/*", "runninghub", "workflow-family", "runninghub-workflow-family", "RunningHub 工作流"),
    parentSubject("canvas.node/*", "canvas", "node-family", "canvas-node-family", "画布节点"),
    parentSubject("provider.model/*", "provider", "model-family", "provider-model-family", "服务商模型"),
  ];
  const categories = sources.resourceCategories.map((item) => managedSubject({
    subjectKey: resourceCategorySubjectKey(item.id),
    domain: "resource",
    subjectType: "category",
    parentKeys: ["resource.category/*", "resource/*"],
    sourceId: `category:${item.id}`,
    displayName: item.name,
    metadata: { kind: item.kind },
  }, "published"));
  const items = sources.resourceItems.map((item) => managedSubject({
    subjectKey: resourceItemSubjectKey(item.id),
    domain: "resource",
    subjectType: "item",
    parentKeys: item.categoryId ? [resourceCategorySubjectKey(item.categoryId), "resource.category/*", "resource/*"] : ["resource.item/*", "resource/*"],
    sourceId: `item:${item.id}`,
    displayName: item.title,
    metadata: { kind: item.kind, categoryId: item.categoryId || "" },
  }, "published"));
  const runningHub = sources.runningHubItems.map((item) => managedSubject({
    subjectKey: item.kind === "app" ? runningHubAppSubjectKey(item.catalogId) : runningHubWorkflowSubjectKey(item.catalogId),
    domain: "runninghub",
    subjectType: item.kind,
    parentKeys: [item.kind === "app" ? "runninghub.app/*" : "runninghub.workflow/*"],
    sourceId: `${item.kind}:${item.catalogId}`,
    displayName: item.title,
    metadata: { enabled: item.enabled },
  }, "published"));
  const nodes = sources.nodeTypes.map((item) => managedSubject({
    subjectKey: canvasNodeSubjectKey(item.type),
    domain: "canvas",
    subjectType: "node",
    parentKeys: ["canvas.node/*"],
    sourceId: `node:${item.type}`,
    displayName: item.label,
    metadata: { category: item.category },
  }, "published"));
  const models = sources.providerModels.map((item) => managedSubject({
    subjectKey: providerModelSubjectKey(item.id),
    domain: "provider",
    subjectType: "model",
    parentKeys: ["provider.model/*"],
    sourceId: `model:${item.id}`,
    displayName: item.displayName,
    metadata: { capability: item.capability, enabled: item.enabled },
  }, item.enabled ? "published" : "restricted"));
  return [...parents, ...categories, ...items, ...runningHub, ...nodes, ...models];
}

function parentSubject(
  subjectKey: string,
  domain: string,
  subjectType: string,
  sourceId: string,
  displayName: string,
  parentKey?: string,
) {
  return managedSubject({ subjectKey, domain, subjectType, parentKeys: parentKey ? [parentKey] : [], sourceId, displayName, metadata: { parent: true } }, "published");
}

function managedSubject(
  input: Omit<PermissionSubject, "exposureState" | "revision">,
  exposureState: PermissionSubject["exposureState"] = "restricted",
): PermissionSubject {
  return {
    ...input,
    exposureState,
    metadata: { ...input.metadata, managedBy: MANAGED_BY },
    revision: 1,
  };
}

function mergeExistingSubject(existing: PermissionSubject, source: PermissionSubject): PermissionSubject {
  // Directory entries must stay editable by scoped rules. Provider models are
  // the only entries whose global visibility follows their enabled state.
  const exposureState = source.domain === "provider" && source.subjectType === "model"
    ? source.exposureState
    : source.exposureState;
  const sourceChanged = existing.domain !== source.domain || existing.subjectType !== source.subjectType || existing.sourceId !== source.sourceId ||
    existing.displayName !== source.displayName || existing.exposureState !== exposureState ||
    !sameStrings(existing.parentKeys, source.parentKeys) || !sameMetadata(existing.metadata, source.metadata);
  return {
    ...source,
    exposureState,
    revision: sourceChanged ? existing.revision + 1 : existing.revision,
  };
}

function isFirstWaveManaged(subject: PermissionSubject) {
  return subject.metadata.managedBy === MANAGED_BY;
}

function subjectsEqual(left: PermissionSubject | undefined, right: PermissionSubject) {
  return Boolean(left) && left!.subjectKey === right.subjectKey && left!.domain === right.domain && left!.subjectType === right.subjectType &&
    left!.sourceId === right.sourceId && left!.exposureState === right.exposureState && left!.displayName === right.displayName && left!.revision === right.revision &&
    sameStrings(left!.parentKeys, right.parentKeys) && sameMetadata(left!.metadata, right.metadata);
}

function sameStrings(left: string[], right: string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function sameMetadata(left: Record<string, unknown>, right: Record<string, unknown>) {
  return isDeepStrictEqual(left, right);
}
