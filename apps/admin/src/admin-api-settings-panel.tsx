import { useEffect, useState } from "react";
import { KeyRound, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { api } from "./admin-api-client";
import { ConfirmActionDialog } from "./admin-confirm-action-dialog";
import { ManualModelDialog } from "./admin-manual-model-dialog";
import { ModelPicker } from "./admin-model-picker";
import { ModelSection } from "./admin-model-editor";
import { ModelScopeLoraPanel } from "./admin-lora-panel";
import { RunningHubPanel } from "./admin-runninghub-panel";
import { appendAdminAssistantContext } from "./admin-assistant-events";
import type {
  Capability,
  AssistantAnalysisRequest,
  AssistantAnalysisResult,
  AssistantChatAttachment,
  ConfirmAction,
  FetchModelsResult,
  ModelRecord,
  ProviderProtocol,
  ProviderRecord,
} from "./admin-types";

const jsonHeaders = { "content-type": "application/json" };

/* ── helpers ──────────────────────────────────────────────────────────── */

function providerDraft(provider?: ProviderRecord) {
  return {
    id: provider?.id || "",
    name: provider?.name || "",
    baseUrl: provider?.baseUrl || "",
    protocol: (provider?.protocol || "openai") as ProviderProtocol,
    rhApps: provider?.rhApps || [],
    rhWorkflows: provider?.rhWorkflows || [],
    msLoras: provider?.msLoras || [],
    note: provider?.note || "",
  };
}

function isRunningHubProvider(p: ReturnType<typeof providerDraft>) {
  return p.id === "runninghub" || p.protocol === "runninghub";
}

function isModelScopeProvider(p: ReturnType<typeof providerDraft>) {
  return (
    p.id === "modelscope" ||
    /modelscope/i.test(p.name) ||
    /modelscope/i.test(p.baseUrl)
  );
}

function inferProviderProtocol(p: ReturnType<typeof providerDraft>) {
  if (/grsai|grsai\.dakka\.com\.cn/i.test(`${p.id}\n${p.name}\n${p.baseUrl}`)) return "grsai_draw" as ProviderProtocol;
  if (/runninghub/i.test(`${p.id}\n${p.name}\n${p.baseUrl}`)) return "runninghub" as ProviderProtocol;
  if (/modelscope/i.test(`${p.id}\n${p.name}\n${p.baseUrl}`)) return "custom" as ProviderProtocol;
  if (/gemini/i.test(`${p.id}\n${p.name}\n${p.baseUrl}`)) return "gemini" as ProviderProtocol;
  if (/apimart/i.test(`${p.id}\n${p.name}\n${p.baseUrl}`)) return "apimart" as ProviderProtocol;
  return p.protocol;
}

function buildProviderAssistantAttachments(
  draft: ReturnType<typeof providerDraft>,
  selectedModels: ModelRecord[],
  fetched: FetchModelsResult | null,
): AssistantChatAttachment[] {
  const attachments: AssistantChatAttachment[] = [
    {
      id: `provider-draft-${draft.id || "new"}`,
      kind: "provider",
      title: draft.name || "当前 Provider 草稿",
      summary: draft.baseUrl || "未填写 Base URL",
      payload: {
        id: draft.id,
        baseUrl: draft.baseUrl,
        protocol: draft.protocol,
        note: draft.note,
        enabled: true,
      },
    },
  ];
  selectedModels.slice(0, 4).forEach((model) => {
    attachments.push({
      id: `provider-model-${model.id}`,
      kind: "model",
      title: model.displayName || model.modelId,
      summary: `${model.capability} / ${model.modelId}`,
      payload: {
        id: model.id,
        modelId: model.modelId,
        capability: model.capability,
        protocol: model.protocolOverride,
        inputProfile: model.inputProfile,
        enabled: model.enabled,
      },
    });
  });
  if (fetched) {
    attachments.push({
      id: `provider-fetch-${draft.id || "new"}`,
      kind: "audit",
      title: "最近模型拉取结果",
      summary: fetched.message || `${fetched.total || fetched.modelCount || 0} 个模型`,
      payload: {
        status: fetched.ok ? "success" : "warning",
        total: fetched.total || fetched.modelCount || 0,
        chatModels: fetched.chatModels?.slice(0, 6),
        imageModels: fetched.imageModels?.slice(0, 6),
        videoModels: fetched.videoModels?.slice(0, 6),
      },
    });
  }
  return attachments;
}

function assistantValue(value: unknown, fallback = "未建议") {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function assistantAdvancedValue(result: AssistantAnalysisResult | null, key: string) {
  return assistantValue(result?.drafts?.model?.advancedConfig?.[key], "未建议");
}

function assistantAdvancedJsonValue(result: AssistantAnalysisResult | null, key: string) {
  const value = result?.drafts?.model?.advancedConfig?.[key];
  if (!value || typeof value !== "object") return "未建议";
  return JSON.stringify(value, null, 2);
}

function formatAssistantRawOutput(value: unknown) {
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return "";
    if (text === "[object Object]") return JSON.stringify({ raw: value }, null, 2);
    return text;
  }
  if (value == null) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function defaultInputProfileForCapability(capability: Capability) {
  if (capability === "audio") return "prompt,audio_reference";
  if (capability === "image" || capability === "video") return "prompt,image_reference";
  return "prompt";
}

function defaultInputCapabilitiesForCapability(capability: Capability, capabilityTags: string[] = []) {
  if (capability === "audio") return { prompt: true, audioReference: capabilityTags.includes("voice_clone") };
  if (capability === "video") return { prompt: true, imageReference: true, multiImage: false, firstFrame: false, lastFrame: false };
  if (capability === "image") return { prompt: true, imageReference: true, multiImage: false, firstFrame: false, lastFrame: false };
  return {
    prompt: true,
    imageReference: capabilityTags.includes("image_understanding"),
    videoReference: capabilityTags.includes("video_understanding"),
    audioReference: capabilityTags.includes("audio_understanding"),
    multiImage: false,
    firstFrame: false,
    lastFrame: false,
  };
}

function safeAssistantSchemaText(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "{}";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return "{}";
  }
}

function parseAssistantDocUrls(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item, index, list) => /^https?:\/\//i.test(item) && list.indexOf(item) === index);
}

/* ── component ────────────────────────────────────────────────────────── */

export function ApiSettingsPanel({
  providers,
  models,
  refresh,
}: {
  providers: ProviderRecord[];
  models: ModelRecord[];
  refresh: () => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState(providers[0]?.id || "");
  const selected =
    providers.find((p) => p.id === selectedId) || providers[0];
  const selectedModels = models.filter(
    (m) => m.providerId === selected?.id,
  );
  const [draft, setDraft] = useState(providerDraft(selected));
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState(
    "已保存，模型列表会立即同步到画布。",
  );
  const [busy, setBusy] = useState(false);
  const [fetched, setFetched] = useState<FetchModelsResult | null>(null);
  const [fetchMessage, setFetchMessage] = useState(
    "点击拉取后，会在这里显示上游返回结果。",
  );
  const [fetchTone, setFetchTone] = useState<
    "muted" | "loading" | "success" | "warning"
  >("muted");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingConfirmAction, setPendingConfirmAction] =
    useState<ConfirmAction | null>(null);
  const [manualModelCapability, setManualModelCapability] =
    useState<Capability | null>(null);
  const [assistantDocUrls, setAssistantDocUrls] = useState("");
  const [assistantSampleRequest, setAssistantSampleRequest] = useState("");
  const [assistantSampleResponse, setAssistantSampleResponse] = useState("");
  const [assistantAsyncTemplate, setAssistantAsyncTemplate] = useState("auto");
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assistantResult, setAssistantResult] =
    useState<AssistantAnalysisResult | null>(null);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const assistantRawOutput = formatAssistantRawOutput((assistantResult as { rawAssistant?: unknown } | null)?.rawAssistant);

  useEffect(() => {
    if (!selectedId && providers[0]) setSelectedId(providers[0].id);
  }, [providers, selectedId]);

  useEffect(() => {
    setDraft(providerDraft(selected));
    setApiKey("");
    setFetched(null);
    setFetchMessage("点击拉取后，会在这里显示上游返回结果。");
    setFetchTone("muted");
    setPickerOpen(false);
    setPendingConfirmAction(null);
    setManualModelCapability(null);
    setAssistantDocUrls("");
    setAssistantSampleRequest("");
    setAssistantSampleResponse("");
    setAssistantAsyncTemplate("auto");
    setAssistantPrompt("");
    setAssistantResult(null);
  }, [selected?.id]);

  useEffect(() => {
    const inferred = inferProviderProtocol(draft);
    if (inferred !== draft.protocol) {
      setDraft((current) => ({ ...current, protocol: inferred }));
    }
  }, [draft.baseUrl, draft.id, draft.name]);

  function buildAssistantAnalysisPayload(): AssistantAnalysisRequest {
    const docUrls = parseAssistantDocUrls(assistantDocUrls);
    return {
      providerName: draft.name,
      baseUrl: draft.baseUrl,
      protocolHint: draft.protocol,
      modelId: selectedModels[0]?.modelId || "",
      docUrl: docUrls[0] || "",
      docUrls,
      sampleRequest: assistantSampleRequest,
      sampleResponse: assistantSampleResponse,
      asyncTemplate: assistantAsyncTemplate,
      notes: assistantPrompt,
    };
  }

  async function run<T>(action: () => Promise<T>, message: string) {
    setBusy(true);
    setStatus(message);
    try {
      const result = await action();
      await refresh();
      return result;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveProvider() {
    const payload = {
      ...draft,
      apiKey: apiKey || undefined,
      enabled: true,
    };
    const saved = await run(
      () =>
        selected
          ? api<ProviderRecord>(
              `/api/admin/providers/${selected.id}`,
              {
                method: "PATCH",
                headers: jsonHeaders,
                body: JSON.stringify(payload),
              },
            )
          : api<ProviderRecord>("/api/admin/providers", {
              method: "POST",
              headers: jsonHeaders,
              body: JSON.stringify(payload),
            }),
      "正在保存 Provider...",
    );
    if (saved) {
      setSelectedId(saved.id);
      setApiKey("");
      setStatus("Provider 已保存。");
    }
  }

  async function addProvider() {
    const now = Date.now();
    const created = await run(
      () =>
        api<ProviderRecord>("/api/admin/providers", {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            id: `custom-api-${now}`,
            name: "API",
            baseUrl: "",
            protocol: "openai",
            enabled: true,
          }),
        }),
      "正在新增平台...",
    );
    if (created) setSelectedId(created.id);
  }

  function requestDeleteProvider() {
    if (!selected) return;
    const provider = selected;
    setPendingConfirmAction({
      title: "删除 Provider",
      message: `确认删除 ${provider.name}？`,
      detail:
        "该 Provider 下的模型会一并删除，画布节点将不能再选择这些模型。此操作不可自动恢复。",
      confirmLabel: "删除 Provider",
      tone: "danger",
      onConfirm: async () => {
        await run(
          () =>
            api(`/api/admin/providers/${provider.id}`, {
              method: "DELETE",
            }),
          "正在删除 Provider...",
        );
        setSelectedId(
          providers.find((p) => p.id !== provider.id)?.id || "",
        );
      },
    });
  }

  async function probeProvider() {
    const payload = { ...draft, apiKey: apiKey || undefined };
    const result = await run(
      () =>
        selected
          ? api<FetchModelsResult>(
              `/api/admin/providers/${selected.id}/probe`,
              {
                method: "POST",
                headers: jsonHeaders,
                body: JSON.stringify(payload),
              },
            )
          : api<FetchModelsResult>("/api/admin/providers/probe", {
              method: "POST",
              headers: jsonHeaders,
              body: JSON.stringify(payload),
            }),
      "正在验证地址...",
    );
    if (result) {
      setFetched(result);
      setStatus(
        result.message || (result.ok ? "验证通过。" : "验证失败。"),
      );
    }
  }

  async function fetchModels() {
    const payload = { ...draft, apiKey: apiKey || undefined };
    setBusy(true);
    setStatus("正在从上游拉取模型...");
    setFetchMessage("正在从上游拉取模型...");
    setFetchTone("loading");
    setPickerOpen(false);
    try {
      const result = selected
        ? await api<FetchModelsResult>(
            `/api/admin/providers/${selected.id}/fetch-models`,
            {
              method: "POST",
              headers: jsonHeaders,
              body: JSON.stringify(payload),
            },
          )
        : await api<FetchModelsResult>(
            "/api/admin/providers/fetch-models",
            {
              method: "POST",
              headers: jsonHeaders,
              body: JSON.stringify(payload),
            },
          );
      await refresh();
      setFetched(result);
      const count = result.total || result.modelCount || 0;
      setPickerOpen(Boolean(result.ok && count > 0));
      const message =
        result.ok && count > 0
          ? `已拉取 ${count} 个模型，选择后再导入。`
          : result.message || "没有从上游拉取到模型。";
      setStatus(message);
      setFetchMessage(message);
      setFetchTone(result.ok && count > 0 ? "success" : "warning");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      setStatus(message);
      setFetchMessage(message);
      setFetchTone("warning");
    } finally {
      setBusy(false);
    }
  }

  async function analyzeProviderWithAssistant() {
    setAssistantBusy(true);
    setStatus("正在分析服务商配置...");
    try {
      const payload = buildAssistantAnalysisPayload();
      const result = await api<AssistantAnalysisResult>(
        "/api/admin/assistant/analyze-provider",
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify(payload),
        },
      );
      setAssistantResult(result);
      setStatus(result.summary || "已生成配置草案，请确认后应用。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setAssistantBusy(false);
    }
  }

  async function upsertAssistantModelDraft(result: AssistantAnalysisResult) {
    const modelDraft = result.drafts?.model;
    if (!selected || !modelDraft) return;
    const capability = (modelDraft.capability || "video") as Capability;
    const existingModel =
      selectedModels.find((model) => model.modelId === modelDraft.modelId) ||
      selectedModels.find((model) => model.capability === capability);
    const payload = {
      providerId: selected.id,
      modelId: modelDraft.modelId || existingModel?.modelId || `${selected.id}-${capability}`,
      displayName:
        modelDraft.displayName ||
        modelDraft.modelId ||
        existingModel?.displayName ||
        `${selected.name || selected.id} ${capability}`,
      capability,
      enabled: existingModel?.enabled ?? true,
      inputProfile: modelDraft.inputProfile || existingModel?.inputProfile || "prompt",
      inputCapabilities: modelDraft.inputCapabilities || existingModel?.inputCapabilities || {},
      parameterSchema: safeAssistantSchemaText(modelDraft.parameterSchema),
      advancedConfig: modelDraft.advancedConfig || existingModel?.advancedConfig || {},
      protocolOverride: existingModel?.protocolOverride || "",
    };
    if (existingModel) {
      await api(`/api/admin/models/${existingModel.id}`, {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify(payload),
      });
      return;
    }
    await api("/api/admin/models", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        id: `${selected.id}-${capability}-${payload.modelId}`,
        ...payload,
      }),
    });
  }

  async function applyAssistantProviderDraft() {
    if (!assistantResult) return;
    const providerDraft = assistantResult.drafts?.provider || {};
    const assistantModelDraft = assistantResult.drafts?.model;
    setDraft((current) => ({
      ...current,
      name:
        typeof providerDraft.name === "string" && providerDraft.name
          ? providerDraft.name
          : current.name,
      baseUrl:
        typeof providerDraft.baseUrl === "string" && providerDraft.baseUrl
          ? providerDraft.baseUrl
          : current.baseUrl,
      protocol:
        typeof providerDraft.protocol === "string" && providerDraft.protocol
          ? (providerDraft.protocol as ProviderProtocol)
          : current.protocol,
      note:
        typeof providerDraft.note === "string" && providerDraft.note
          ? providerDraft.note
          : current.note,
    }));
    setBusy(true);
    setStatus("正在把 AI 草案同步到 Provider 与模型表单...");
    try {
      if (assistantModelDraft) {
        await upsertAssistantModelDraft(assistantResult);
      }
      await refresh();
      setStatus("AI 草案已应用到表单，仍需点击保存；保存后请继续执行验证地址、拉取模型和模型测试。");
      if (!assistantPrompt && assistantResult.checklist?.length) {
        setAssistantPrompt(assistantResult.checklist.join("\n"));
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  function sendDraftToAssistant() {
    const payload = buildAssistantAnalysisPayload();
    appendAdminAssistantContext({
      open: true,
      message: [
        `请帮我分析并完善这个 Provider 配置草稿。`,
        draft.baseUrl ? `当前地址：${draft.baseUrl}` : "当前地址还未填写。",
        `目标协议倾向：${draft.protocol}`,
        payload.docUrls?.length ? `参考文档：\n${payload.docUrls.join("\n")}` : "",
        payload.sampleRequest?.trim() ? `请求样例：\n${payload.sampleRequest.trim()}` : "",
        payload.sampleResponse?.trim() ? `响应样例：\n${payload.sampleResponse.trim()}` : "",
        payload.asyncTemplate && payload.asyncTemplate !== "auto" ? `期望异步模板：${payload.asyncTemplate}` : "",
        assistantPrompt.trim() ? `补充要求：${assistantPrompt.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      attachments: buildProviderAssistantAttachments(draft, selectedModels, fetched),
    });
    setStatus("已把当前 Provider 草稿与模型上下文发送到右侧 AI 助手。");
  }

  async function updateModel(
    model: ModelRecord,
    patch: Partial<ModelRecord>,
  ) {
    await run(
      () =>
        api(`/api/admin/models/${model.id}`, {
          method: "PATCH",
          headers: jsonHeaders,
          body: JSON.stringify(patch),
        }),
      "正在更新模型...",
    );
  }

  function requestDeleteModel(model: ModelRecord) {
    setPendingConfirmAction({
      title: "删除模型",
      message: `确认删除 ${model.displayName || model.modelId}？`,
      detail:
        "删除后，画布通用节点不会再显示该模型。已经保存的历史任务记录不会被删除。",
      confirmLabel: "删除模型",
      tone: "danger",
      onConfirm: async () => {
        await run(
          () =>
            api(`/api/admin/models/${model.id}`, {
              method: "DELETE",
            }),
          "正在删除模型...",
        );
      },
    });
  }

  async function testModel(model: ModelRecord, kind: string, autoApply = false) {
    await run(
      () =>
        api(`/api/admin/models/${model.id}/test`, {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({ kind, autoApply }),
        }),
      autoApply ? "正在测试并修正模型标签..." : "正在测试模型连通性...",
    );
  }

  function requestAddManualModel(capability: Capability) {
    if (!selected) return;
    setManualModelCapability(capability);
  }

  async function addManualModel(
    capability: Capability,
    modelId: string,
  ) {
    if (!selected) return;
    await run(
      () =>
        api("/api/admin/models", {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            id: `${selected.id}-${capability}-${modelId}`,
            providerId: selected.id,
            modelId,
            displayName: modelId,
            capability,
            enabled: true,
            inputProfile: defaultInputProfileForCapability(capability),
            inputCapabilities: defaultInputCapabilitiesForCapability(capability),
            parameterSchema: "{}",
          }),
        }),
      "正在新增模型...",
    );
    setManualModelCapability(null);
  }

  const rhVisible = selected ? isRunningHubProvider(draft) : false;
  const msVisible = selected ? isModelScopeProvider(draft) : false;

  return (
    <section className="api-settings-page">
      <div className="api-settings-head">
        <div className="api-settings-head-copy">
          <span className="api-settings-kicker">平台与模型目录</span>
          <h2>统一管理接入能力</h2>
          <p>
            管理平台地址、模型列表和 Key。Key
            写入后端加密保存，页面不会回显完整内容。
          </p>
        </div>
        <span className={busy ? "api-settings-status busy" : "api-settings-status"}>
          {busy ? "处理中..." : status}
        </span>
      </div>

      <div className="api-settings-layout">
        <aside className="provider-rail">
          <div className="rail-title">平台列表</div>
          <div className="provider-list">
            {providers.map((provider) => (
              <button
                key={provider.id}
                type="button"
                className={
                  provider.id === selected?.id
                    ? "provider-item active"
                    : "provider-item"
                }
                onClick={() => setSelectedId(provider.id)}
              >
                <span className="provider-grip">::</span>
                <span className="provider-key">
                  <KeyRound aria-hidden="true" />
                </span>
                <span className="provider-copy">
                  <strong>{provider.name}</strong>
                  <small>{provider.baseUrl || "未配置地址"}</small>
                </span>
                <em>{provider.protocol || "openai"}</em>
              </button>
            ))}
          </div>
          <div className="provider-rail-footer">
            <button
              type="button"
              className="ghost-action"
              onClick={addProvider}
            >
              <Plus aria-hidden="true" /> 新增平台
            </button>
          </div>
        </aside>

        <div className="api-settings-content">
          <div className="api-card">
            <div className="provider-form-head">
              <strong>{selected?.name || "新增平台"}</strong>
              {selected ? (
                <button
                  type="button"
                  className="icon-soft danger"
                  onClick={requestDeleteProvider}
                >
                  <Trash2 aria-hidden="true" /> 删除
                </button>
              ) : null}
            </div>
            <div className="provider-form-grid">
              <label>
                平台 ID
                <input
                  value={draft.id}
                  onChange={(e) =>
                    setDraft({ ...draft, id: e.target.value })
                  }
                  disabled={!!selected}
                />
              </label>
              <label>
                显示名称
                <input
                  value={draft.name}
                  onChange={(e) =>
                    setDraft({ ...draft, name: e.target.value })
                  }
                />
              </label>
              <label>
                Base URL
                <input
                  value={draft.baseUrl}
                  onChange={(e) =>
                    setDraft({ ...draft, baseUrl: e.target.value })
                  }
                  placeholder="https://api.example.com/v1"
                />
              </label>
              <label>
                协议
                <select
                  value={draft.protocol}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      protocol: e.target.value as ProviderProtocol,
                    })
                  }
                >
                  <option value="openai">OpenAI 兼容</option>
                  <option value="gemini">Gemini</option>
                  <option value="grsai_draw">GRSAI Draw</option>
                  <option value="runninghub">RunningHub</option>
                  <option value="volcengine">火山方舟</option>
                  <option value="apimart">APIMart</option>
                  <option value="custom">自定义</option>
                </select>
              </label>
              <label>
                API Key
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    selected?.hasApiKey
                      ? `已保存 (${selected.apiKeyPreview})`
                      : "输入 API Key"
                  }
                />
              </label>
              <label>
                接入判断
                <input
                  value={
                    assistantResult
                      ? `${assistantResult.protocol} / ${assistantResult.recommendedLayer}${assistantResult.asyncTask ? " / async" : ""}`
                      : draft.protocol === "grsai_draw"
                        ? "grsai_draw / adapter / async"
                        : "待 AI 或管理员确认"
                  }
                  readOnly
                />
              </label>
              <label>
                备注
                <input
                  value={draft.note}
                  onChange={(e) =>
                    setDraft({ ...draft, note: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="provider-form-actions">
              <button
                type="button"
                className="primary-action"
                onClick={saveProvider}
                disabled={busy}
              >
                <Save aria-hidden="true" /> 保存
              </button>
              <button
                type="button"
                className="ghost-action"
                onClick={probeProvider}
                disabled={busy}
              >
                <RefreshCw aria-hidden="true" /> 验证地址
              </button>
              <button
                type="button"
                className="ghost-action"
                onClick={fetchModels}
                disabled={busy}
              >
                <RefreshCw aria-hidden="true" /> 拉取模型
              </button>
            </div>
          </div>

          <div className={`api-card fetch-result fetch-${fetchTone}`}>
            <div className="fetch-result-head">
              <strong>拉取结果</strong>
              {fetched ? (
                <span>
                  {fetched.ok ? "成功" : "失败"} ·{" "}
                  {fetched.total || fetched.modelCount || 0} 个模型
                </span>
              ) : null}
            </div>
            <p>{fetchMessage}</p>
          </div>

          <div className="api-card api-assistant-card">
            <div className="fetch-result-head">
              <strong>AI 协助配置</strong>
              <span>先生成草案，再进入真实验证</span>
            </div>
            <div className="assistant-analysis-grid">
              <label className="assistant-analysis-field assistant-analysis-field--span">
                <span>文档链接</span>
                <textarea
                  value={assistantDocUrls}
                  onChange={(event) => setAssistantDocUrls(event.target.value)}
                  placeholder={"https://agnes-ai.com/doc/agnes-20-flash\nhttps://agnes-ai.com/doc/quick-start"}
                />
                <small>支持多个链接，每行一个。建议同时提供模型页、API 调用页、Quick Start 和错误码页。</small>
              </label>
              <label className="assistant-analysis-field">
                <span>请求样例</span>
                <textarea
                  value={assistantSampleRequest}
                  onChange={(event) => setAssistantSampleRequest(event.target.value)}
                  placeholder='POST /v1/videos {"model":"agnes-video-v2.0","prompt":"..."}'
                />
                <small>尽量贴完整请求体、路径、字段名和鉴权方式。</small>
              </label>
              <label className="assistant-analysis-field">
                <span>响应样例</span>
                <textarea
                  value={assistantSampleResponse}
                  onChange={(event) => setAssistantSampleResponse(event.target.value)}
                  placeholder='{"task_id":"xxx","status":"processing","video_url":""}'
                />
                <small>优先贴创建任务响应、轮询响应和最终结果响应。</small>
              </label>
              <label className="assistant-analysis-field">
                <span>异步模板</span>
                <select
                  value={assistantAsyncTemplate}
                  onChange={(event) => setAssistantAsyncTemplate(event.target.value)}
                >
                  <option value="auto">自动判断</option>
                  <option value="sync_inline_result">同步直返结果</option>
                  <option value="async_task_poll_result">提交后轮询结果</option>
                  <option value="async_task_poll_then_final_lookup">轮询后再二段查最终资源</option>
                  <option value="adapter_manual_model_catalog">特殊适配 / 手动模型目录</option>
                </select>
                <small>如果你已经明确知道链路类型，可以在这里提前约束 AI 分析方向。</small>
              </label>
              <label className="assistant-analysis-field assistant-analysis-field--span">
                <span>补充说明</span>
                <textarea
                  value={assistantPrompt}
                  onChange={(event) => setAssistantPrompt(event.target.value)}
                  placeholder="补充你对字段映射、模型能力、首帧尾帧、轮询路径、失败现象的判断"
                />
                <small>这里适合放你的要求、异常现象和管理员判断，不建议再把文档链接混在这里。</small>
              </label>
            </div>
            {parseAssistantDocUrls(assistantDocUrls).length ? (
              <div className="assistant-analysis-chip-row">
                {parseAssistantDocUrls(assistantDocUrls).map((url) => (
                  <span key={url} className="assistant-analysis-chip">{url}</span>
                ))}
              </div>
            ) : null}
            <div className="provider-form-actions">
              <button
                type="button"
                className="ghost-action"
                onClick={sendDraftToAssistant}
                disabled={busy}
              >
                发到右侧助手
              </button>
              <button
                type="button"
                className="ghost-action"
                onClick={analyzeProviderWithAssistant}
                disabled={busy || assistantBusy}
              >
                {assistantBusy ? "分析中..." : "分析配置"}
              </button>
              <button
                type="button"
                className="primary-action"
                onClick={applyAssistantProviderDraft}
                disabled={!assistantResult || assistantBusy}
              >
                应用到表单
              </button>
            </div>
            {assistantResult ? (
              <div className="assistant-draft-preview">
                  <section className="assistant-draft-section assistant-draft-section--summary">
                    <span>{assistantResult.mode === "hermes" ? "Hermes 分析" : "本地分析"}</span>
                    <p>{assistantResult.summary}</p>
                  </section>
                <div className="assistant-draft-grid">
                  {assistantResult.docFetch?.items?.length ? (
                    <section className="assistant-draft-section assistant-draft-section--span">
                      <strong>文档抓取结果</strong>
                      <dl>
                        {assistantResult.docFetch.items.map((item) => (
                          <div key={item.url}>
                            <dt>{item.url}</dt>
                            <dd>
                              {item.ok ? `HTTP ${item.status || "-"} · 已抓取片段` : item.error || `HTTP ${item.status || "-"}`}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  ) : null}
                  <section className="assistant-draft-section">
                    <strong>接入模板</strong>
                    <dl>
                      <div>
                        <dt>模板</dt>
                        <dd>{assistantResult.chainTemplate || "未标记"}</dd>
                      </div>
                      <div>
                        <dt>版本</dt>
                        <dd>{assistantResult.chainTemplateVersion || "video-provider-template/v1"}</dd>
                      </div>
                    </dl>
                  </section>
                  <section className="assistant-draft-section">
                    <strong>Provider 草案</strong>
                    <dl>
                      <div>
                        <dt>协议</dt>
                        <dd>{assistantResult.drafts.provider.protocol || assistantResult.protocol}</dd>
                      </div>
                      <div>
                        <dt>地址</dt>
                        <dd>{assistantResult.drafts.provider.baseUrl || "保持当前表单"}</dd>
                      </div>
                      <div>
                        <dt>备注</dt>
                        <dd>{assistantResult.drafts.provider.note || "未建议"}</dd>
                      </div>
                    </dl>
                  </section>
                  <section className="assistant-draft-section">
                    <strong>模型草案</strong>
                    <dl>
                      <div>
                        <dt>模型</dt>
                        <dd>{assistantResult.drafts.model.modelId || selectedModels[0]?.modelId || "未建议"}</dd>
                      </div>
                      <div>
                        <dt>能力</dt>
                        <dd>{assistantResult.drafts.model.capability || "video"}</dd>
                      </div>
                      <div>
                        <dt>输入</dt>
                        <dd>{assistantResult.drafts.model.inputProfile || "prompt"}</dd>
                      </div>
                    </dl>
                  </section>
                  <section className="assistant-draft-section assistant-draft-section--span">
                    <strong>异步任务配置</strong>
                    <dl>
                      <div>
                        <dt>任务 ID</dt>
                        <dd>{assistantAdvancedValue(assistantResult, "taskIdPath")}</dd>
                      </div>
                      <div>
                        <dt>状态路径</dt>
                        <dd>{assistantAdvancedValue(assistantResult, "taskStatusPath")}</dd>
                      </div>
                      <div>
                        <dt>异步模式</dt>
                        <dd>{assistantAdvancedValue(assistantResult, "mode") || "async_video_task"}</dd>
                      </div>
                      <div>
                        <dt>提交路径</dt>
                        <dd>{assistantAdvancedValue(assistantResult, "submitPath")}</dd>
                      </div>
                      <div>
                        <dt>轮询路径</dt>
                        <dd>{assistantAdvancedValue(assistantResult, "pollPathTemplate")}</dd>
                      </div>
                      <div>
                        <dt>结果视频</dt>
                        <dd>{assistantAdvancedValue(assistantResult, "resultVideoPath")}</dd>
                      </div>
                      <div>
                        <dt>最终资源 ID</dt>
                        <dd>{assistantAdvancedValue(assistantResult, "finalResultTaskIdPath")}</dd>
                      </div>
                      <div>
                        <dt>最终查询路径</dt>
                        <dd>{assistantAdvancedValue(assistantResult, "finalResultPathTemplate")}</dd>
                      </div>
                      <div>
                        <dt>最终视频路径</dt>
                        <dd>{assistantAdvancedValue(assistantResult, "finalResultVideoPath")}</dd>
                      </div>
                      <div>
                        <dt>请求映射</dt>
                        <dd>
                          <pre>{assistantAdvancedJsonValue(assistantResult, "requestMapping")}</pre>
                        </dd>
                      </div>
                      <div>
                        <dt>类型转换</dt>
                        <dd>
                          <pre>{assistantAdvancedJsonValue(assistantResult, "requestValueTypes")}</pre>
                        </dd>
                      </div>
                      <div>
                        <dt>固定参数</dt>
                        <dd>
                          <pre>{assistantAdvancedJsonValue(assistantResult, "fixedBody")}</pre>
                        </dd>
                      </div>
                    </dl>
                  </section>
                </div>
                {assistantResult.risks?.length ? (
                  <section className="assistant-draft-section">
                    <strong>风险</strong>
                    <ul>
                      {assistantResult.risks.slice(0, 4).map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </section>
                ) : null}
                {assistantResult.checklist?.length ? (
                  <section className="assistant-draft-section">
                    <strong>检查清单</strong>
                    <ul>
                      {assistantResult.checklist.slice(0, 6).map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </section>
                ) : null}
                {assistantResult.rawAssistant ? (
                  <details className="assistant-draft-raw">
                    <summary>查看原始输出</summary>
                    <pre>{assistantRawOutput}</pre>
                  </details>
                ) : null}
                <small>当前区域产出的是配置草案，不等于真实连通测试；应用后请继续执行验证地址、拉取模型和模型测试。</small>
              </div>
            ) : null}
          </div>

          {rhVisible ? (
            <RunningHubPanel
              title="RunningHub 应用"
              entries={draft.rhApps}
              onChange={(apps) =>
                setDraft({ ...draft, rhApps: apps })
              }
            />
          ) : null}
          {rhVisible ? (
            <RunningHubPanel
              title="RunningHub 工作流"
              entries={draft.rhWorkflows}
              onChange={(workflows) =>
                setDraft({ ...draft, rhWorkflows: workflows })
              }
            />
          ) : null}
          {msVisible ? (
            <ModelScopeLoraPanel
              loras={draft.msLoras}
              imageModels={fetched?.imageModels || []}
              onChange={(loras) =>
                setDraft({ ...draft, msLoras: loras })
              }
            />
          ) : null}

          {(["image", "video", "audio", "chat"] as Capability[]).map((cap) => (
            <ModelSection
              key={cap}
              capability={cap}
              models={selectedModels.filter((m) => m.capability === cap)}
              onAdd={() => requestAddManualModel(cap)}
              onUpdate={updateModel}
              onDelete={requestDeleteModel}
              onTest={testModel}
            />
          ))}
        </div>
      </div>

      {pickerOpen && fetched ? (
        <ModelPicker
          fetched={fetched}
          existing={selectedModels}
          providerId={selected?.id || ""}
          onClose={() => setPickerOpen(false)}
          onImport={async (items) => {
            for (const item of items) {
              await run(
                () =>
                  api("/api/admin/models", {
                    method: "POST",
                    headers: jsonHeaders,
                    body: JSON.stringify({
                      id: `${selected?.id}-${item.capability}-${item.modelId}`,
                      providerId: selected?.id,
                      modelId: item.modelId,
                      displayName: item.displayName,
                      capability: item.capability,
                      capabilityTags: item.capabilityTags || [],
                      enabled: true,
                      inputProfile: defaultInputProfileForCapability(item.capability),
                      inputCapabilities: defaultInputCapabilitiesForCapability(item.capability, item.capabilityTags || []),
                      parameterSchema: "{}",
                    }),
                  }),
                `正在导入 ${item.modelId}...`,
              );
            }
            setPickerOpen(false);
          }}
        />
      ) : null}

      {manualModelCapability !== null && selected ? (
        <ManualModelDialog
          capability={manualModelCapability}
          providerName={selected.name}
          busy={busy}
          onCancel={() => setManualModelCapability(null)}
          onSubmit={(modelId) => addManualModel(manualModelCapability, modelId)}
        />
      ) : null}

      {pendingConfirmAction ? (
        <ConfirmActionDialog
          action={pendingConfirmAction}
          busy={busy}
          onCancel={() => setPendingConfirmAction(null)}
          onConfirm={async () => {
            await pendingConfirmAction.onConfirm();
            setPendingConfirmAction(null);
          }}
        />
      ) : null}
    </section>
  );
}
