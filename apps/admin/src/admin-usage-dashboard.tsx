import type {
  AdminUsageSummary,
  AdminUser,
  AdminUserGroup,
  ProviderRecord,
  UsageCapability,
  UsageSelectedUserModelRow,
  UsageSelectedUserRunningHubRow,
  UsageSelectedUserSummary,
} from "./admin-types";
import { buildUsageAccountRanking } from "./admin-usage-account-ranking";
import { buildUsageGroupRanking } from "./admin-usage-group-ranking";

function percentage(value: number, total: number) {
  if (!total) return "0.0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString() : "-";
}

function summarizeTop(rows: Array<{ label: string; total: number }>) {
  return rows.slice(0, 5);
}

function capabilityLabel(capability: UsageCapability | UsageSelectedUserModelRow["capability"]) {
  if (capability === "image") return "图像";
  if (capability === "video") return "视频";
  if (capability === "runninghub_app") return "RH AI 应用";
  if (capability === "runninghub_workflow") return "RH 工作流";
  if (capability === "llm") return "LLM";
  if (capability === "audio") return "音频";
  return "未知";
}

function runningHubKindLabel(kind: UsageSelectedUserRunningHubRow["kind"]) {
  return kind === "app" ? "AI 应用" : "工作流";
}

function topGroupInsight(summary: AdminUsageSummary) {
  const item = summary.groups[0];
  if (!item) return "暂无分组成功记录";
  return `${item.groupName} ${item.total} 次`;
}

function topModelInsight(summary: AdminUsageSummary) {
  const item = summary.models[0];
  if (!item) return "暂无模型成功记录";
  return `${item.displayName} ${item.total} 次`;
}

function topRhInsight(summary: AdminUsageSummary) {
  const item = summary.runningHubEntries[0];
  if (!item) return "暂无 RH 成功记录";
  return `${item.title} ${item.total} 次`;
}

function buildFallbackSelectedUserSummary(
  selectedUsageUserId: string,
  users: AdminUser[],
  usageSummary: AdminUsageSummary | null,
): UsageSelectedUserSummary | undefined {
  if (!selectedUsageUserId) return undefined;
  const directoryUser = users.find((item) => item.id === selectedUsageUserId);
  const rankedUser = usageSummary?.users.find((item) => item.userId === selectedUsageUserId);
  if (!directoryUser && !rankedUser) return undefined;
  return {
    userId: selectedUsageUserId,
    email: directoryUser?.email || rankedUser?.email || "未知账号",
    name: directoryUser?.name || rankedUser?.name || directoryUser?.email || rankedUser?.email || "未知账号",
    remark: directoryUser?.remark || rankedUser?.remark,
    groupId: directoryUser?.groupId || rankedUser?.groupId,
    groupName: directoryUser?.groupName || rankedUser?.groupName,
    ownerDeleted: rankedUser?.ownerDeleted,
    successful: 0,
    lastSucceededAt: undefined,
    modelBreakdown: [],
    runningHubBreakdown: [],
  };
}

export function AdminUsageDashboard({
  usageSummary,
  usageSummaryLoading,
  usageSummaryError,
  usageFilters,
  selectedUsageUserId,
  users,
  userGroups,
  providers,
  onUsageFiltersChange,
  onSelectedUsageUserIdChange,
}: {
  usageSummary: AdminUsageSummary | null;
  usageSummaryLoading: boolean;
  usageSummaryError: string;
  usageFilters: {
    range: "today" | "7d" | "30d";
    groupId: string;
    capability: "" | UsageCapability;
    providerId: string;
  };
  selectedUsageUserId: string;
  users: AdminUser[];
  userGroups: AdminUserGroup[];
  providers: ProviderRecord[];
  onUsageFiltersChange: (next: {
    range: "today" | "7d" | "30d";
    groupId: string;
    capability: "" | UsageCapability;
    providerId: string;
  }) => void;
  onSelectedUsageUserIdChange: (value: string) => void;
}) {
  const selectedUser =
    usageSummary?.selectedUser || buildFallbackSelectedUserSummary(selectedUsageUserId, users, usageSummary);

  const accountOptions = new Map<
    string,
    {
      userId: string;
      email: string;
      name: string;
      groupName?: string;
    }
  >();

  for (const item of usageSummary?.users || []) {
    accountOptions.set(item.userId, {
      userId: item.userId,
      email: item.email,
      name: item.name,
      groupName: item.groupName,
    });
  }

  for (const item of users) {
    if (!accountOptions.has(item.id)) {
      accountOptions.set(item.id, {
        userId: item.id,
        email: item.email,
        name: item.name,
        groupName: item.groupName,
      });
    }
  }

  if (selectedUser && !accountOptions.has(selectedUser.userId)) {
    accountOptions.set(selectedUser.userId, {
      userId: selectedUser.userId,
      email: selectedUser.email,
      name: selectedUser.name,
      groupName: selectedUser.groupName,
    });
  }

  const selectableAccounts = [...accountOptions.values()].sort(
    (a, b) => a.email.localeCompare(b.email, "zh-CN") || a.name.localeCompare(b.name, "zh-CN"),
  );

  const total = usageSummary?.totals.successful ?? 0;
  const capabilityRows = usageSummary
    ? [
      { label: "图像", total: usageSummary.totals.image },
      { label: "视频", total: usageSummary.totals.video },
      { label: "RH AI 应用", total: usageSummary.totals.runninghubApp },
      { label: "RH 工作流", total: usageSummary.totals.runninghubWorkflow },
      { label: "LLM", total: usageSummary.totals.llm },
      { label: "音频", total: usageSummary.totals.audio },
    ]
    : [];
  const groupRanking = buildUsageGroupRanking(usageSummary?.groups || [], userGroups, users, usageFilters.groupId);
  const accountRanking = buildUsageAccountRanking(usageSummary?.users || [], users, usageFilters.groupId);
  const topUsers = accountRanking.slice(0, 5).map((item) => ({ label: item.email, total: item.total }));

  return (
    <section className="usage-dashboard usage-dashboard--starlight">
      <header className="usage-dashboard__header">
        <div>
          <p>成功用量驾驶舱</p>
          <h2>先选账号查看明细，同时保留模型与 RH 条目的全局总使用次数</h2>
        </div>
        <span>
          {usageSummary
            ? `${new Date(usageSummary.range.from).toLocaleString()} - ${new Date(usageSummary.range.to).toLocaleString()}`
            : "等待统计返回"}
        </span>
      </header>

      <article className="usage-panel usage-panel--filters">
        <header>
          <h3>筛选与下钻</h3>
          <span>{usageSummaryLoading ? "统计刷新中..." : "Usage Filters"}</span>
        </header>
        <div className="usage-filter-grid">
          <label className="usage-filter-field">
            <span>时间范围</span>
            <select
              value={usageFilters.range}
              onChange={(event) =>
                onUsageFiltersChange({
                  ...usageFilters,
                  range: event.target.value as "today" | "7d" | "30d",
                })}
            >
              <option value="today">今天</option>
              <option value="7d">7 天</option>
              <option value="30d">30 天</option>
            </select>
          </label>
          <label className="usage-filter-field">
            <span>用户组</span>
            <select
              value={usageFilters.groupId}
              onChange={(event) =>
                onUsageFiltersChange({
                  ...usageFilters,
                  groupId: event.target.value,
                })}
            >
              <option value="">全部分组</option>
              {userGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
          <label className="usage-filter-field">
            <span>能力类型</span>
            <select
              value={usageFilters.capability}
              onChange={(event) =>
                onUsageFiltersChange({
                  ...usageFilters,
                  capability: event.target.value as "" | UsageCapability,
                })}
            >
              <option value="">全部能力</option>
              <option value="image">图像</option>
              <option value="video">视频</option>
              <option value="runninghub_app">RH AI 应用</option>
              <option value="runninghub_workflow">RH 工作流</option>
              <option value="llm">LLM</option>
              <option value="audio">音频</option>
            </select>
          </label>
          <label className="usage-filter-field">
            <span>Provider</span>
            <select
              value={usageFilters.providerId}
              onChange={(event) =>
                onUsageFiltersChange({
                  ...usageFilters,
                  providerId: event.target.value,
                })}
            >
              <option value="">全部 Provider</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </label>
          <label className="usage-filter-field usage-filter-field--wide">
            <span>选择账号查看明细</span>
            <select
              value={selectedUsageUserId}
              onChange={(event) => onSelectedUsageUserIdChange(event.target.value)}
            >
              <option value="">请选择账号</option>
              {selectableAccounts.map((item) => (
                <option key={item.userId} value={item.userId}>
                  {item.email}{item.groupName ? ` · ${item.groupName}` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        {usageSummaryError ? <p className="usage-inline-error">{usageSummaryError}</p> : null}
      </article>

      {!selectedUser ? (
        <article className="usage-panel usage-panel--empty-state">
          <header>
            <h3>账号下钻</h3>
            <span>Account Drilldown</span>
          </header>
          <p>请选择账号查看模型与 RH 条目使用明细</p>
        </article>
      ) : (
        <div className="usage-dashboard-grid usage-dashboard-grid--tables">
          <article className="usage-panel usage-panel--selected-user">
            <header>
              <h3>账号下钻</h3>
              <span>Selected Account</span>
            </header>
            <div className="usage-selected-user-grid">
              <div className="usage-selected-user-card">
                <span>账号</span>
                <strong title={selectedUser.email}>{selectedUser.email}</strong>
                <small title={selectedUser.name}>{selectedUser.name}</small>
              </div>
              <div className="usage-selected-user-card">
                <span>所属组</span>
                <strong title={selectedUser.groupName || "未分组"}>{selectedUser.groupName || "未分组"}</strong>
                <small>{selectedUser.remark || "无备注"}</small>
              </div>
              <div className="usage-selected-user-card">
                <span>当前筛选成功数</span>
                <strong>{selectedUser.successful}</strong>
                <small>{selectedUser.ownerDeleted ? "历史已删除账号" : "仍在账号目录中"}</small>
              </div>
              <div className="usage-selected-user-card">
                <span>最近成功时间</span>
                <strong>{formatTime(selectedUser.lastSucceededAt)}</strong>
                <small>{selectedUser.successful ? "仅统计 succeeded" : "当前筛选下暂无成功记录"}</small>
              </div>
            </div>
          </article>

          <article className="usage-panel">
            <header>
              <h3>账号模型使用明细</h3>
              <span>Model Usage by Account</span>
            </header>
            <div className="usage-table-wrap">
              <table className="usage-table">
                <thead>
                  <tr>
                    <th>能力</th>
                    <th>Provider</th>
                    <th>模型名称</th>
                    <th>模型 ID</th>
                    <th>使用次数</th>
                    <th>最近使用</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedUser.modelBreakdown.length ? (
                    selectedUser.modelBreakdown.map((item) => (
                      <tr key={`${item.capability}-${item.providerId}-${item.modelRecordId}`}>
                        <td>{capabilityLabel(item.capability)}</td>
                        <td title={item.providerName}>{item.providerName}</td>
                        <td title={item.displayName}>{item.displayName}</td>
                        <td title={item.modelId}>{item.modelId}</td>
                        <td>{item.total}</td>
                        <td>{formatTime(item.lastUsedAt)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>当前筛选下，该账号没有模型成功记录</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="usage-panel">
            <header>
              <h3>账号 RH 条目使用明细</h3>
              <span>RunningHub Usage by Account</span>
            </header>
            <div className="usage-table-wrap">
              <table className="usage-table">
                <thead>
                  <tr>
                    <th>类型</th>
                    <th>Provider</th>
                    <th>条目名称</th>
                    <th>Catalog ID</th>
                    <th>RunTarget</th>
                    <th>使用次数</th>
                    <th>最近使用</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedUser.runningHubBreakdown.length ? (
                    selectedUser.runningHubBreakdown.map((item) => (
                      <tr key={`${item.kind}-${item.providerId}-${item.catalogId}`}>
                        <td>{runningHubKindLabel(item.kind)}</td>
                        <td title={item.providerName}>{item.providerName}</td>
                        <td title={item.title}>{item.title}</td>
                        <td title={item.catalogId}>{item.catalogId}</td>
                        <td title={item.runTargetId || "-"}>{item.runTargetId || "-"}</td>
                        <td>{item.total}</td>
                        <td>{formatTime(item.lastUsedAt)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7}>当前筛选下，该账号没有 RH 成功记录</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      )}

      {!usageSummary ? (
        <article className="usage-panel usage-panel--empty-state">
          <header>
            <h3>全局总览</h3>
            <span>Global Summary</span>
          </header>
          <p>{usageSummaryLoading ? "正在加载成功用量统计..." : "尚未返回统计结果"}</p>
        </article>
      ) : !total ? (
        <article className="usage-panel usage-panel--empty-state">
          <header>
            <h3>全局总览</h3>
            <span>Global Summary</span>
          </header>
          <p>当前筛选范围内没有成功任务</p>
        </article>
      ) : (
        <>
          <div className="usage-governance-strip">
            <div>
              <span>最活跃分组</span>
              <strong>{topGroupInsight(usageSummary)}</strong>
            </div>
            <div>
              <span>最高频模型</span>
              <strong>{topModelInsight(usageSummary)}</strong>
            </div>
            <div>
              <span>最高频 RH 条目</span>
              <strong>{topRhInsight(usageSummary)}</strong>
            </div>
            <div>
              <span>统计口径</span>
              <strong>仅统计 succeeded</strong>
            </div>
          </div>

          <div className="usage-kpi-grid">
            <article className="usage-kpi-card">
              <span>成功总数</span>
              <strong>{usageSummary.totals.successful}</strong>
              <small>仅统计 succeeded</small>
            </article>
            <article className="usage-kpi-card">
              <span>图像模型调用</span>
              <strong>{usageSummary.totals.image}</strong>
              <small>{percentage(usageSummary.totals.image, total)}</small>
            </article>
            <article className="usage-kpi-card">
              <span>视频模型调用</span>
              <strong>{usageSummary.totals.video}</strong>
              <small>{percentage(usageSummary.totals.video, total)}</small>
            </article>
            <article className="usage-kpi-card">
              <span>RH AI 应用</span>
              <strong>{usageSummary.totals.runninghubApp}</strong>
              <small>{percentage(usageSummary.totals.runninghubApp, total)}</small>
            </article>
            <article className="usage-kpi-card">
              <span>RH 工作流</span>
              <strong>{usageSummary.totals.runninghubWorkflow}</strong>
              <small>{percentage(usageSummary.totals.runninghubWorkflow, total)}</small>
            </article>
            <article className="usage-kpi-card">
              <span>LLM 调用</span>
              <strong>{usageSummary.totals.llm}</strong>
              <small>{percentage(usageSummary.totals.llm, total)}</small>
            </article>
            <article className="usage-kpi-card">
              <span>音频调用</span>
              <strong>{usageSummary.totals.audio}</strong>
              <small>{percentage(usageSummary.totals.audio, total)}</small>
            </article>
          </div>

          <div className="usage-dashboard-grid">
            <article className="usage-panel usage-panel--overview">
              <header>
                <h3>治理提示</h3>
                <span>Governance Focus</span>
              </header>
              <div className="usage-overview-grid">
                <div>
                  <span>Top 分组</span>
                  <strong>{topGroupInsight(usageSummary)}</strong>
                </div>
                <div>
                  <span>Top 账号</span>
                  <strong>{topUsers[0] ? `${topUsers[0].label} ${topUsers[0].total} 次` : "暂无账号记录"}</strong>
                </div>
                <div>
                  <span>Top 模型</span>
                  <strong>{topModelInsight(usageSummary)}</strong>
                </div>
                <div>
                  <span>Top RH 条目</span>
                  <strong>{topRhInsight(usageSummary)}</strong>
                </div>
              </div>
            </article>

            <article className="usage-panel">
              <header>
                <h3>能力占比环</h3>
                <span>Capability Ring</span>
              </header>
              <div className="usage-ring-list">
                {capabilityRows.map((item) => (
                  <div key={item.label} className="usage-ring-row">
                    <div>
                      <strong>{item.label}</strong>
                      <span>{item.total}</span>
                    </div>
                    <div className="usage-bar">
                      <i style={{ width: percentage(item.total, total) }} />
                    </div>
                    <small>{percentage(item.total, total)}</small>
                  </div>
                ))}
              </div>
            </article>

            <article className="usage-panel usage-panel--group-ranking">
              <header>
                <h3>分组能量条</h3>
                <span>Top Groups</span>
              </header>
              <div className="usage-list usage-list--group-ranking" aria-label="全部分组使用次数排行榜">
                {groupRanking.map((item) => (
                  <div key={item.groupId} className="usage-list-row">
                    <strong title={item.groupName}>{item.groupName}</strong>
                    <div className="usage-bar">
                      <i style={{ width: percentage(item.total, total) }} />
                    </div>
                    <span>{item.total}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="usage-panel usage-panel--account-ranking">
              <header>
                <h3>账号排行榜</h3>
                <span>Top Accounts</span>
              </header>
              <div className="usage-list usage-list--account-ranking" aria-label="全部账号使用次数排行榜">
                {accountRanking.map((item) => (
                  <div key={item.userId} className="usage-list-row">
                    <strong title={item.email}>{item.email}</strong>
                    <div className="usage-bar">
                      <i style={{ width: percentage(item.total, total) }} />
                    </div>
                    <span>{item.total}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="usage-panel">
              <header>
                <h3>每日趋势</h3>
                <span>Daily Trend</span>
              </header>
              <div className="usage-trend-list">
                {usageSummary.daily.slice(-10).map((item) => (
                  <div key={item.day} className="usage-trend-row">
                    <strong>{item.day}</strong>
                    <span>总 {item.total}</span>
                    <small>图 {item.image} / 视 {item.video} / RH App {item.runninghubApp} / RH Flow {item.runninghubWorkflow} / LLM {item.llm} / 音 {item.audio}</small>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="usage-dashboard-grid usage-dashboard-grid--tables">
            <article className="usage-panel">
              <header>
                <h3>模型总使用次数</h3>
                <span>Global Model Totals</span>
              </header>
              <div className="usage-table-wrap">
                <table className="usage-table">
                  <thead>
                    <tr>
                      <th>能力</th>
                      <th>Provider</th>
                      <th>模型</th>
                      <th>模型 ID</th>
                      <th>成功数</th>
                      <th>Top 组</th>
                      <th>Top 账号</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageSummary.models.map((item) => (
                      <tr key={`${item.capability}-${item.providerId}-${item.modelRecordId}`}>
                        <td>{capabilityLabel(item.capability)}</td>
                        <td title={item.providerName}>{item.providerName}</td>
                        <td title={item.displayName}>{item.displayName}</td>
                        <td title={item.modelId}>{item.modelId}</td>
                        <td>{item.total}</td>
                        <td title={item.topGroupName || "-"}>{item.topGroupName || "-"}</td>
                        <td title={item.topUserEmail || "-"}>{item.topUserEmail || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="usage-panel">
              <header>
                <h3>RH 条目总使用次数</h3>
                <span>Global RunningHub Totals</span>
              </header>
              <div className="usage-table-wrap">
                <table className="usage-table">
                  <thead>
                    <tr>
                      <th>类型</th>
                      <th>Provider</th>
                      <th>条目</th>
                      <th>Catalog ID</th>
                      <th>RunTarget</th>
                      <th>成功数</th>
                      <th>Top 组</th>
                      <th>Top 账号</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageSummary.runningHubEntries.map((item) => (
                      <tr key={`${item.kind}-${item.providerId}-${item.catalogId}`}>
                        <td>{runningHubKindLabel(item.kind)}</td>
                        <td title={item.providerName}>{item.providerName}</td>
                        <td title={item.title}>{item.title}</td>
                        <td title={item.catalogId}>{item.catalogId}</td>
                        <td title={item.runTargetId || "-"}>{item.runTargetId || "-"}</td>
                        <td>{item.total}</td>
                        <td title={item.topGroupName || "-"}>{item.topGroupName || "-"}</td>
                        <td title={item.topUserEmail || "-"}>{item.topUserEmail || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        </>
      )}
    </section>
  );
}
