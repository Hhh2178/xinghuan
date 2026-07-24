import type { ReactNode } from "react";
import type {
  RunningHubAdminItem,
  RunningHubAdminItemCreatePayload,
  RunningHubAdminItemUpdatePayload,
  RunningHubAnalyzeDraft,
  RunningHubAnalyzeDraftSection,
  RunningHubKeyPoolItem,
} from "./admin-types";

export type RunningHubWorkspaceTab = "workflow" | "app";
export type RunningHubKeyPoolDraftItem = RunningHubKeyPoolItem & { apiKey?: string };

export function countSchemaProperties(parameterSchema: string | undefined) {
  if (!parameterSchema?.trim()) return 0;
  try {
    const parsed = JSON.parse(parameterSchema) as { properties?: Record<string, unknown> };
    return parsed.properties && typeof parsed.properties === "object" ? Object.keys(parsed.properties).length : 0;
  } catch {
    return 0;
  }
}

export function buildCreateTitle(kind: RunningHubWorkspaceTab) {
  return kind === "workflow" ? "新建工作流" : "新建 AI 应用";
}

export function readMeaningfulDraftText(value: unknown) {
  if (typeof value !== "string") return undefined;
  return value.trim() ? value : undefined;
}

export function createEmptyRunningHubKeyPoolDraftItem(): RunningHubKeyPoolDraftItem {
  const now = Date.now();
  return {
    id: `rh-key-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    note: "",
    apiKey: "",
    apiKeyPreview: "",
    maxConcurrency: 1,
    enabled: true,
    isDefault: false,
    standardModelApi: false,
    currentInFlight: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function summarizeRunningHubKeyPoolDraft(items: RunningHubKeyPoolDraftItem[]) {
  const enabledItems = items.filter((item) => item.enabled);
  const defaultItem = items.find((item) => item.isDefault);
  return {
    enabledCount: enabledItems.length,
    totalConcurrency: enabledItems.reduce((sum, item) => sum + Math.max(1, Number(item.maxConcurrency) || 1), 0),
    defaultLabel: defaultItem?.note?.trim() || defaultItem?.apiKeyPreview || "",
  };
}

export function normalizeDefaultRunningHubKeyPoolDraft(items: RunningHubKeyPoolDraftItem[], preferredKeyId = "") {
  const targetId = preferredKeyId || items.find((item) => item.isDefault)?.id || items[0]?.id || "";
  return items.map((item) => ({
    ...item,
    isDefault: Boolean(targetId) && item.id === targetId,
  }));
}

export function buildCreatePayloadFromDraft(
  providerId: string,
  kind: RunningHubWorkspaceTab,
  section?: RunningHubAnalyzeDraftSection | null,
): RunningHubAdminItemCreatePayload {
  const payload: RunningHubAdminItemCreatePayload = {
    providerId,
    kind,
    title: buildCreateTitle(kind),
  };
  if (!section) return payload;
  if (section.key === "base") {
    payload.title = readMeaningfulDraftText(section.payload.title) ?? payload.title;
    payload.note = readMeaningfulDraftText(section.payload.note) ?? payload.note;
    payload.pageId = readMeaningfulDraftText(section.payload.pageId) ?? payload.pageId;
    payload.runTargetId = readMeaningfulDraftText(section.payload.runTargetId) ?? payload.runTargetId;
    payload.taskCapability = ["image", "video", "audio", "chat"].includes(String(section.payload.taskCapability))
      ? section.payload.taskCapability as RunningHubAdminItemCreatePayload["taskCapability"]
      : payload.taskCapability;
  } else if (section.key === "inputs") {
    payload.fields = Array.isArray(section.payload.fields) ? section.payload.fields as RunningHubAdminItemCreatePayload["fields"] : [];
  } else if (section.key === "params") {
    payload.parameterSchema = JSON.stringify(section.payload, null, 2);
  } else if (section.key === "outputs") {
    payload.outputSchema = Array.isArray(section.payload.outputs) ? section.payload.outputs as RunningHubAdminItemCreatePayload["outputSchema"] : [];
  } else if (section.key === "execution") {
    payload.executionRules = section.payload as unknown as RunningHubAdminItemCreatePayload["executionRules"];
  }
  return payload;
}

export function mergeDraftSectionsToCreatePayload(
  providerId: string,
  kind: RunningHubWorkspaceTab,
  sections: RunningHubAnalyzeDraftSection[],
) {
  return sections.reduce<RunningHubAdminItemCreatePayload>(
    (acc, section) => ({ ...acc, ...buildCreatePayloadFromDraft(providerId, kind, section) }),
    { providerId, kind, title: buildCreateTitle(kind) },
  );
}

export function buildUpdatePayloadFromDraft(
  selectedItem: RunningHubAdminItem,
  targetKind: RunningHubWorkspaceTab,
  section?: RunningHubAnalyzeDraftSection | null,
): RunningHubAdminItemUpdatePayload {
  const payload: RunningHubAdminItemUpdatePayload = {
    kind: targetKind,
  };
  if (!section) return payload;
  if (section.key === "base") {
    const nextRunTargetId = readMeaningfulDraftText(section.payload.runTargetId)
      ?? selectedItem.runTargetId
      ?? selectedItem.appId
      ?? selectedItem.workflowId
      ?? selectedItem.pageId
      ?? selectedItem.id;
    payload.title = readMeaningfulDraftText(section.payload.title) ?? selectedItem.title;
    payload.note = readMeaningfulDraftText(section.payload.note) ?? selectedItem.note;
    payload.pageId = readMeaningfulDraftText(section.payload.pageId) ?? selectedItem.pageId;
    payload.runTargetId = nextRunTargetId;
    payload.appId = targetKind === "app" ? nextRunTargetId : "";
    payload.workflowId = targetKind === "workflow" ? nextRunTargetId : "";
    payload.taskCapability = ["image", "video", "audio", "chat"].includes(String(section.payload.taskCapability))
      ? section.payload.taskCapability as RunningHubAdminItemUpdatePayload["taskCapability"]
      : selectedItem.taskCapability;
  } else if (section.key === "inputs") {
    payload.fields = Array.isArray(section.payload.fields) ? section.payload.fields as RunningHubAdminItemUpdatePayload["fields"] : [];
  } else if (section.key === "params") {
    payload.parameterSchema = JSON.stringify(section.payload, null, 2);
  } else if (section.key === "outputs") {
    payload.outputSchema = Array.isArray(section.payload.outputs) ? section.payload.outputs as RunningHubAdminItemUpdatePayload["outputSchema"] : [];
  } else if (section.key === "execution") {
    payload.executionRules = section.payload as unknown as RunningHubAdminItemUpdatePayload["executionRules"];
  }
  return payload;
}

export function mergeDraftSectionsToUpdatePayload(
  selectedItem: RunningHubAdminItem,
  targetKind: RunningHubWorkspaceTab,
  sections: RunningHubAnalyzeDraftSection[],
) {
  return sections.reduce<RunningHubAdminItemUpdatePayload>(
    (acc, section) => ({ ...acc, ...buildUpdatePayloadFromDraft(selectedItem, targetKind, section) }),
    {},
  );
}

export function renderAnalyzeSectionPreview(section: RunningHubAnalyzeDraftSection): ReactNode {
  if (section.key === "base") {
    const capability = typeof section.payload.taskCapability === "string" ? section.payload.taskCapability : "未识别";
    return (
      <div className="admin-runninghub-analyze-card__grid">
        <div>
          <strong>标题</strong>
          <span>{typeof section.payload.title === "string" ? section.payload.title : "未填写"}</span>
        </div>
        <div>
          <strong>任务能力</strong>
          <span>{capability}</span>
        </div>
        <div>
          <strong>页面 ID</strong>
          <span>{typeof section.payload.pageId === "string" ? section.payload.pageId : "未填写"}</span>
        </div>
        <div>
          <strong>运行目标 ID</strong>
          <span>{typeof section.payload.runTargetId === "string" ? section.payload.runTargetId : "未填写"}</span>
        </div>
        <div className="admin-runninghub-analyze-card__full">
          <strong>备注</strong>
          <span>{typeof section.payload.note === "string" && section.payload.note.trim() ? section.payload.note : "未补充备注"}</span>
        </div>
      </div>
    );
  }
  if (section.key === "inputs") {
    const fields = Array.isArray(section.payload.fields) ? section.payload.fields as Array<Record<string, unknown>> : [];
    return (
      <div className="admin-runninghub-analyze-card__stack">
        {fields.length ? fields.map((field, index) => (
          <div key={`${String(field.nodeId || "")}:${String(field.fieldName || "")}:${index}`} className="admin-runninghub-analyze-card__list-row">
            <div>
              <strong>{String(field.label || field.fieldName || "未命名输入槽")}</strong>
              <span>{String(field.description || "未补充说明")}</span>
            </div>
            <div className="admin-runninghub-analyze-card__chips">
              <em>{String(field.valueType || field.fieldType || "string")}</em>
              <em>{field.required ? "必填" : "可选"}</em>
              <em>{String(field.nodeId || "node")}</em>
            </div>
          </div>
        )) : <div className="admin-runninghub-editor__empty-note">当前没有识别到输入槽。</div>}
      </div>
    );
  }
  if (section.key === "outputs") {
    const outputs = Array.isArray(section.payload.outputs) ? section.payload.outputs as Array<Record<string, unknown>> : [];
    return (
      <div className="admin-runninghub-analyze-card__stack">
        {outputs.length ? outputs.map((output, index) => (
          <div key={`${String(output.key || "")}:${index}`} className="admin-runninghub-analyze-card__list-row">
            <div>
              <strong>{String(output.label || output.key || "未命名输出")}</strong>
              <span>{String(output.path || "data")}</span>
            </div>
            <div className="admin-runninghub-analyze-card__chips">
              <em>{String(output.kind || "image")}</em>
              <em>{output.multiple ? "多结果" : "单结果"}</em>
            </div>
          </div>
        )) : <div className="admin-runninghub-editor__empty-note">当前没有识别到输出定义。</div>}
      </div>
    );
  }
  if (section.key === "execution") {
    return (
      <div className="admin-runninghub-analyze-card__grid">
        <div>
          <strong>提交方式</strong>
          <span>{String(section.payload.submitMode || "direct")}</span>
        </div>
        <div>
          <strong>目标类型</strong>
          <span>{String(section.payload.targetType || "workflow")}</span>
        </div>
        <div className="admin-runninghub-analyze-card__full">
          <strong>接口路径</strong>
          <span>{String(section.payload.endpoint || "") || "未填写"}</span>
        </div>
        <div>
          <strong>结果路径</strong>
          <span>{String(section.payload.resultPath || "data")}</span>
        </div>
        <div>
          <strong>错误路径</strong>
          <span>{String(section.payload.errorPath || "message")}</span>
        </div>
        <div>
          <strong>轮询策略</strong>
          <span>{String(section.payload.pollingStrategy || "none")}</span>
        </div>
      </div>
    );
  }
  return <pre>{JSON.stringify(section.payload, null, 2)}</pre>;
}

export function summarizeAnalyzeDraftDrift(
  selectedItem: RunningHubAdminItem | null,
  draft: RunningHubAnalyzeDraft | null,
  targetKind: RunningHubWorkspaceTab,
) {
  if (!selectedItem || !draft) return [];
  const drift: string[] = [];
  if (selectedItem.kind !== targetKind) {
    drift.push(`当前条目类型是 ${selectedItem.kind === "app" ? "AI 应用" : "工作流"}，草案目标类型是 ${targetKind === "app" ? "AI 应用" : "工作流"}。`);
  }
  const baseSection = draft.sections.find((section) => section.key === "base");
  const inputSection = draft.sections.find((section) => section.key === "inputs");
  const outputSection = draft.sections.find((section) => section.key === "outputs");
  const executionSection = draft.sections.find((section) => section.key === "execution");
  const draftRunTargetId = typeof baseSection?.payload.runTargetId === "string" ? baseSection.payload.runTargetId.trim() : "";
  const currentRunTargetId = String(selectedItem.runTargetId || selectedItem.appId || selectedItem.workflowId || "").trim();
  if (draftRunTargetId && currentRunTargetId && draftRunTargetId !== currentRunTargetId) {
    drift.push(`草案运行目标 ID 为 ${draftRunTargetId}，当前条目为 ${currentRunTargetId}。`);
  }
  const draftFieldCount = Array.isArray(inputSection?.payload.fields) ? inputSection.payload.fields.length : 0;
  const currentFieldCount = Array.isArray(selectedItem.fields) ? selectedItem.fields.length : 0;
  if (draftFieldCount !== currentFieldCount) {
    drift.push(`草案输入槽 ${draftFieldCount} 个，当前条目输入槽 ${currentFieldCount} 个。`);
  }
  const draftOutputCount = Array.isArray(outputSection?.payload.outputs) ? outputSection.payload.outputs.length : 0;
  const currentOutputCount = Array.isArray(selectedItem.outputSchema) ? selectedItem.outputSchema.length : 0;
  if (draftOutputCount !== currentOutputCount) {
    drift.push(`草案输出定义 ${draftOutputCount} 个，当前条目输出定义 ${currentOutputCount} 个。`);
  }
  const draftExecutionEndpoint = typeof executionSection?.payload.endpoint === "string" ? executionSection.payload.endpoint.trim() : "";
  const currentExecutionEndpoint = String(selectedItem.executionRules?.endpoint || "").trim();
  if (draftExecutionEndpoint && currentExecutionEndpoint && draftExecutionEndpoint !== currentExecutionEndpoint) {
    drift.push(`草案执行 endpoint 为 ${draftExecutionEndpoint}，当前条目为 ${currentExecutionEndpoint}。`);
  }
  return drift;
}
