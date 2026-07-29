import { useMemo, useState } from "react";
import { ArrowRightLeft, CheckSquare, RefreshCcw, ShieldAlert } from "lucide-react";
import { api } from "./admin-api-client";
import { AdminTable, StatusPill } from "./admin-common-components";
import {
  AdminConfigurationContext,
  AdminConfigurationLayout,
  AdminConfigurationWorkbench,
} from "./admin-configuration-workbench";
import type {
  ConfirmAction,
  EnvironmentSyncApplyResponse,
  EnvironmentSyncDecision,
  EnvironmentSyncDiffState,
  EnvironmentSyncPreviewResponse,
  EnvironmentSyncPreviewRow,
  EnvironmentSyncTarget,
} from "./admin-types";
import { ConfirmActionDialog } from "./admin-confirm-action-dialog";

const jsonHeaders = { "content-type": "application/json" };

type RowSelectionState = Record<string, { selected: boolean; decision: EnvironmentSyncDecision }>;

function rowKey(row: EnvironmentSyncPreviewRow) {
  return `${row.kind}:${row.naturalKey || row.id}`;
}

function toneForState(state: EnvironmentSyncDiffState) {
  if (state === "conflict") return "warning" as const;
  if (state === "identical") return "muted" as const;
  return "success" as const;
}

function labelForState(state: EnvironmentSyncDiffState) {
  if (state === "missing_in_target") return "右侧缺少";
  if (state === "missing_in_source") return "左侧缺少";
  if (state === "conflict") return "两边内容不一致";
  return "两边一致";
}

function summaryText(summary: Record<string, unknown>) {
  return Object.entries(summary)
    .filter(([, value]) => value !== "" && value !== undefined && value !== null)
    .map(([key, value]) => `${key}: ${typeof value === "boolean" ? (value ? "是" : "否") : String(value)}`)
    .join("\n");
}

function environmentLabel(environment: EnvironmentSyncTarget) {
  return environment === "gray" ? "灰度环境" : "正式环境";
}

function providerModelSummaryText(row: EnvironmentSyncPreviewRow) {
  if (!row.providerModelSummary) return "";
  const summary = row.providerModelSummary;
  return [
    `模型总数：左侧 ${summary.sourceCount} / 右侧 ${summary.targetCount}`,
    `仅左侧：${summary.sourceOnlyCount}`,
    `配置不同：${summary.conflictCount}`,
    `完全一致：${summary.identicalCount}`,
    `仅右侧：${summary.targetOnlyCount}`,
  ].join("\n");
}

function providerSideSummary(row: EnvironmentSyncPreviewRow, side: "source" | "target") {
  const base = side === "source" ? row.sourceSummary : row.targetSummary;
  const lines = [summaryText(base)];
  if (row.providerModelSummary) {
    const modelLine = side === "source"
      ? `模型数: ${row.providerModelSummary.sourceCount}`
      : `模型数: ${row.providerModelSummary.targetCount}`;
    lines.push(modelLine);
  }
  return lines.filter(Boolean).join("\n");
}

export function AdminEnvironmentSyncPanel({
  onBusyChange,
  onError,
}: {
  onBusyChange: (busy: boolean) => void;
  onError: (message: string) => void;
}) {
  const [sourceEnvironment, setSourceEnvironment] = useState<EnvironmentSyncTarget>("gray");
  const [targetEnvironment, setTargetEnvironment] = useState<EnvironmentSyncTarget>("production");
  const [activeSection, setActiveSection] = useState<"users" | "providers">("users");
  const [preview, setPreview] = useState<EnvironmentSyncPreviewResponse | null>(null);
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [result, setResult] = useState<EnvironmentSyncApplyResponse | null>(null);
  const [status, setStatus] = useState("先选择左侧和右侧环境，再点击“先查看差异”。");
  const [pendingConfirmAction, setPendingConfirmAction] = useState<ConfirmAction | null>(null);

  const users = preview?.users || [];
  const providers = preview?.providers || [];
  const sectionRows = activeSection === "users" ? users : providers;
  const sectionLabel = activeSection === "users" ? "账号" : "服务商（含模型）";
  const allRows = useMemo(() => [...users, ...providers], [users, providers]);

  const selectedRows = useMemo(
    () =>
      allRows.filter((row) => {
        const current = selection[rowKey(row)];
        return current?.selected;
      }),
    [allRows, selection],
  );

  const selectedSectionRows = useMemo(
    () =>
      sectionRows.filter((row) => {
        const current = selection[rowKey(row)];
        return current?.selected;
      }),
    [sectionRows, selection],
  );

  async function run<T>(message: string, action: () => Promise<T>) {
    onBusyChange(true);
    onError("");
    setStatus(message);
    try {
      const next = await action();
      return next;
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      onError(messageText);
      setStatus(messageText);
      return null;
    } finally {
      onBusyChange(false);
    }
  }

  function resetForPreview(nextPreview: EnvironmentSyncPreviewResponse) {
    const nextSelection: RowSelectionState = {};
    for (const row of [...nextPreview.users, ...nextPreview.providers]) {
      nextSelection[rowKey(row)] = {
        selected: row.state !== "identical",
        decision: row.defaultDecision,
      };
    }
    setSelection(nextSelection);
    setPreview(nextPreview);
    setResult(null);
  }

  async function loadPreview() {
    const nextPreview = await run("正在比较左侧和右侧环境的数据差异...", () =>
      api<EnvironmentSyncPreviewResponse>("/api/admin/environment-sync/preview", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ sourceEnvironment, targetEnvironment }),
      }),
    );
    if (nextPreview) {
      resetForPreview(nextPreview);
      setStatus("差异已经列出。勾选要同步的账号或服务商后，再点击“确认同步”。");
    }
  }

  async function applySelection() {
    if (selectedRows.length === 0) {
      onError("请先选择至少一项再确认同步。");
      return;
    }
    const items = selectedRows.map((row) => {
      const current = selection[rowKey(row)];
      return {
        id: row.id,
        kind: row.kind,
        selected: true,
        decision: current?.decision || row.defaultDecision,
      };
    });
    const applied = await run("正在把左侧环境数据同步到右侧环境...", () =>
      api<EnvironmentSyncApplyResponse>("/api/admin/environment-sync/apply", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ sourceEnvironment, targetEnvironment, items }),
      }),
    );
    if (applied) {
      setResult(applied);
      setStatus("同步已执行完成，最新差异已重新刷新。");
      await loadPreview();
    }
  }

  function requestApply() {
    const conflictCount = selectedRows.filter((row) => row.state === "conflict").length;
    const providerCount = selectedRows.filter((row) => row.kind === "provider").length;
    const modelCount = selectedRows
      .filter((row) => row.kind === "provider")
      .reduce((total, row) => total + (row.providerModelSummary?.sourceCount || 0), 0);
    setPendingConfirmAction({
      title: "确认同步",
      message: `确认把${environmentLabel(sourceEnvironment)}的数据同步到${environmentLabel(targetEnvironment)}吗？`,
      detail: `已选择 ${selectedRows.filter((row) => row.kind === "user").length} 个账号、${providerCount} 个服务商（共 ${modelCount} 个关联模型），其中 ${conflictCount} 项为两边内容不一致。执行后会写入审计日志。`,
      confirmLabel: "确认同步",
      tone: "warning",
      onConfirm: applySelection,
    });
  }

  function updateRow(row: EnvironmentSyncPreviewRow, patch: Partial<{ selected: boolean; decision: EnvironmentSyncDecision }>) {
    const key = rowKey(row);
    setSelection((current) => ({
      ...current,
      [key]: {
        selected: patch.selected ?? current[key]?.selected ?? false,
        decision: patch.decision ?? current[key]?.decision ?? row.defaultDecision,
      },
    }));
  }

  function setAll(kind: "user" | "provider", selected: boolean) {
    const rows = kind === "user" ? preview?.users || [] : preview?.providers || [];
    setSelection((current) => {
      const next = { ...current };
      for (const row of rows) {
        next[rowKey(row)] = {
          selected,
          decision: current[rowKey(row)]?.decision ?? row.defaultDecision,
        };
      }
      return next;
    });
  }

  return (
    <AdminConfigurationWorkbench label="环境同步配置" className="panel-stack environment-sync-page">
      <AdminConfigurationContext
        eyebrow="环境差异"
        title={`${environmentLabel(sourceEnvironment)} -> ${environmentLabel(targetEnvironment)}`}
        description={`${selectedRows.length} 项已选 · ${selectedRows.filter((row) => row.state === "conflict").length} 项冲突`}
        status={{
          label: result ? "同步已执行" : preview ? "差异已预览" : "等待预览",
          tone: result ? "success" : selectedRows.some((row) => row.state === "conflict") ? "warning" : "muted",
        }}
        actions={<div className="environment-sync-band__metrics">
            <span>{users.length} 个账号差异项</span>
            <span>{providers.length} 个服务商差异项</span>
            <span>{selectedRows.length} 项已选</span>
          </div>}
      />

      <div className="environment-sync-toolbar">
        <div className="environment-sync-toolbar__group">
          <label>
            从哪里复制
            <select value={sourceEnvironment} onChange={(event) => setSourceEnvironment(event.target.value as EnvironmentSyncTarget)}>
              <option value="gray">灰度环境</option>
              <option value="production">正式环境</option>
            </select>
          </label>
          <label>
            同步到哪里
            <select value={targetEnvironment} onChange={(event) => setTargetEnvironment(event.target.value as EnvironmentSyncTarget)}>
              <option value="gray" disabled={sourceEnvironment === "gray"}>灰度环境</option>
              <option value="production">正式环境</option>
            </select>
          </label>
        </div>
        <div className="environment-sync-toolbar__group environment-sync-toolbar__group--actions">
          <button type="button" onClick={() => {
            setSourceEnvironment(targetEnvironment);
            setTargetEnvironment(sourceEnvironment);
          }}>
            <ArrowRightLeft aria-hidden="true" />
            左右互换
          </button>
          <button type="button" onClick={() => void loadPreview()}>
            <RefreshCcw aria-hidden="true" />
            先查看差异
          </button>
          <button type="button" disabled={!selectedRows.length} onClick={requestApply}>
            <CheckSquare aria-hidden="true" />
            确认同步
          </button>
        </div>
        <div className="environment-sync-toolbar__metrics">
          <span>{environmentLabel(sourceEnvironment)} -&gt; {environmentLabel(targetEnvironment)}</span>
          <span>{selectedRows.length} 项已选</span>
          <span>{selectedRows.filter((row) => row.state === "conflict").length} 项冲突</span>
        </div>
      </div>

      <AdminConfigurationLayout
        className="environment-sync-workspace"
        rail={<div className="environment-sync-rail">
          <section className="form-panel environment-sync-summary">
            <header>
              <ShieldAlert aria-hidden="true" />
              <h2>本次操作摘要</h2>
            </header>
            <div className="environment-sync-summary__stack">
              <div>
                <strong>当前进度</strong>
                <p>{status}</p>
              </div>
              <div>
                <strong>同步方向</strong>
                <p>{environmentLabel(sourceEnvironment)} -&gt; {environmentLabel(targetEnvironment)}</p>
              </div>
              <div>
                <strong>已勾选项</strong>
                <p>{selectedRows.length}</p>
              </div>
              <div>
                <strong>当前分区已选</strong>
                <p>{selectedSectionRows.length}</p>
              </div>
            </div>
          </section>

          <section className="form-panel environment-sync-summary">
            <header>
              <ArrowRightLeft aria-hidden="true" />
              <h2>分区操作</h2>
            </header>
            <div className="environment-sync-bulk-actions environment-sync-bulk-actions--stack">
              <button type="button" onClick={() => setAll(activeSection === "users" ? "user" : "provider", true)}>
                全选{sectionLabel}
              </button>
              <button type="button" onClick={() => setAll(activeSection === "users" ? "user" : "provider", false)}>
                清空{sectionLabel}
              </button>
            </div>
          </section>
        </div>}
      >

        <section className="environment-sync-table-area">
          <div className="environment-sync-section-tabs" role="tablist" aria-label="环境同步分区">
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === "users"}
              className={activeSection === "users" ? "active" : ""}
              onClick={() => setActiveSection("users")}
            >
              账号
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === "providers"}
              className={activeSection === "providers" ? "active" : ""}
              onClick={() => setActiveSection("providers")}
            >
              服务商（含模型）
            </button>
          </div>

          {!preview ? (
            <section className="data-panel environment-sync-empty">
              <header><h2>差异列表</h2></header>
              <div className="table-wrap"><p>还没有差异结果。请选择左侧和右侧环境后点击“先查看差异”。</p></div>
            </section>
          ) : (
            <div className="environment-sync-table-scroll">
              {activeSection === "users" ? (
                <AdminTable title="账号">
                  <thead>
                    <tr>
                      <th>选择</th>
                      <th>账号</th>
                      <th>状态</th>
                      <th>左侧环境</th>
                      <th>右侧环境</th>
                      <th>决策</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="environment-sync-bulk-row">
                      <td colSpan={6}>
                        <div className="environment-sync-bulk-actions">
                          <button type="button" onClick={() => setAll("user", true)}>全选账号</button>
                          <button type="button" onClick={() => setAll("user", false)}>清空账号</button>
                        </div>
                      </td>
                    </tr>
                    {users.map((row) => {
                      const current = selection[rowKey(row)];
                      return (
                        <tr key={rowKey(row)}>
                          <td>
                            <input
                              type="checkbox"
                              checked={Boolean(current?.selected)}
                              onChange={(event) => updateRow(row, { selected: event.target.checked })}
                            />
                          </td>
                          <td>
                            <div className="environment-sync-identity">
                              <strong>{row.displayName}</strong>
                              <span>{row.naturalKey}</span>
                            </div>
                          </td>
                          <td><StatusPill tone={toneForState(row.state)}>{labelForState(row.state)}</StatusPill></td>
                          <td><pre>{summaryText(row.sourceSummary) || "-"}</pre></td>
                          <td><pre>{summaryText(row.targetSummary) || "-"}</pre></td>
                          <td>
                            <select
                              value={current?.decision || row.defaultDecision}
                              onChange={(event) => updateRow(row, { decision: event.target.value as EnvironmentSyncDecision })}
                            >
                              <option value="skip">跳过</option>
                              <option value="use_source">以左侧环境为准</option>
                              <option value="keep_target">保留右侧当前数据</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </AdminTable>
              ) : (
                <AdminTable title="服务商（含模型）">
                  <thead>
                    <tr>
                      <th>选择</th>
                      <th>服务商</th>
                      <th>状态</th>
                      <th>左侧环境</th>
                      <th>右侧环境</th>
                      <th>决策</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="environment-sync-bulk-row">
                      <td colSpan={6}>
                        <div className="environment-sync-bulk-actions">
                          <button type="button" onClick={() => setAll("provider", true)}>全选服务商</button>
                          <button type="button" onClick={() => setAll("provider", false)}>清空服务商</button>
                        </div>
                      </td>
                    </tr>
                    {providers.map((row) => {
                      const current = selection[rowKey(row)];
                      return (
                        <tr key={rowKey(row)}>
                          <td>
                            <input
                              type="checkbox"
                              checked={Boolean(current?.selected)}
                              onChange={(event) => updateRow(row, { selected: event.target.checked })}
                            />
                          </td>
                          <td>
                            <div className="environment-sync-identity">
                              <strong>{row.displayName}</strong>
                              <span>{row.naturalKey}</span>
                              {row.providerModelSummary ? <small>{providerModelSummaryText(row)}</small> : null}
                            </div>
                          </td>
                          <td><StatusPill tone={toneForState(row.state)}>{labelForState(row.state)}</StatusPill></td>
                          <td><pre>{providerSideSummary(row, "source") || "-"}</pre></td>
                          <td><pre>{providerSideSummary(row, "target") || "-"}</pre></td>
                          <td>
                            <select
                              value={current?.decision || row.defaultDecision}
                              onChange={(event) => updateRow(row, { decision: event.target.value as EnvironmentSyncDecision })}
                            >
                              <option value="skip">跳过</option>
                              <option value="use_source">以左侧环境为准</option>
                              <option value="keep_target">保留右侧当前数据</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </AdminTable>
              )}

              {result ? (
                <AdminTable title="同步结果">
                  <thead>
                    <tr>
                      <th>对象</th>
                      <th>决策</th>
                      <th>结果</th>
                      <th>说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map((row) => (
                      <tr key={`${row.kind}:${row.id}:${row.decision}`}>
                        <td>{row.kind}:{row.id}</td>
                        <td>{row.decision}</td>
                        <td>{row.status}</td>
                        <td>{row.message || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </AdminTable>
              ) : null}
            </div>
          )}
        </section>
      </AdminConfigurationLayout>

      {pendingConfirmAction ? (
        <ConfirmActionDialog
          action={pendingConfirmAction}
          busy={false}
          onCancel={() => setPendingConfirmAction(null)}
          onConfirm={async () => {
            await pendingConfirmAction.onConfirm();
            setPendingConfirmAction(null);
          }}
        />
      ) : null}
    </AdminConfigurationWorkbench>
  );
}
