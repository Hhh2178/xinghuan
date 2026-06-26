import type { AdminUsageSummary } from "./admin-types";

function percentage(value: number, total: number) {
  if (!total) return "0.0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function summarizeTop(rows: Array<{ label: string; total: number }>) {
  return rows.slice(0, 5);
}

export function AdminUsageDashboard({ usageSummary }: { usageSummary: AdminUsageSummary | null }) {
  if (!usageSummary) {
    return null;
  }

  const total = usageSummary.totals.successful;
  if (!total) {
    return (
      <section className="usage-dashboard usage-dashboard--empty">
        <header className="usage-dashboard__header">
          <div>
            <p>成功用量驾驶舱</p>
            <h2>当前筛选范围内没有成功任务</h2>
          </div>
          <span>
            {new Date(usageSummary.range.from).toLocaleString()} - {new Date(usageSummary.range.to).toLocaleString()}
          </span>
        </header>
      </section>
    );
  }

  const capabilityRows = [
    { label: "图像", total: usageSummary.totals.image },
    { label: "视频", total: usageSummary.totals.video },
    { label: "RH AI 应用", total: usageSummary.totals.runninghubApp },
    { label: "RH 工作流", total: usageSummary.totals.runninghubWorkflow },
    { label: "LLM", total: usageSummary.totals.llm },
    { label: "音频", total: usageSummary.totals.audio },
  ];

  const topGroups = summarizeTop(usageSummary.groups.map((item) => ({ label: item.groupName, total: item.total })));
  const topUsers = summarizeTop(usageSummary.users.map((item) => ({ label: item.email, total: item.total })));
  const topModels = usageSummary.models.slice(0, 8);
  const topRunningHubEntries = usageSummary.runningHubEntries.slice(0, 8);

  return (
    <section className="usage-dashboard">
      <header className="usage-dashboard__header">
        <div>
          <p>成功用量驾驶舱</p>
          <h2>按成功任务汇总组、账号、模型与 RH 条目</h2>
        </div>
        <span>
          {new Date(usageSummary.range.from).toLocaleString()} - {new Date(usageSummary.range.to).toLocaleString()}
        </span>
      </header>

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
      </div>

      <div className="usage-dashboard-grid">
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

        <article className="usage-panel">
          <header>
            <h3>分组能量条</h3>
            <span>Top Groups</span>
          </header>
          <div className="usage-list">
            {topGroups.map((item) => (
              <div key={item.label} className="usage-list-row">
                <strong>{item.label}</strong>
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
            <h3>账号排行榜</h3>
            <span>Top Accounts</span>
          </header>
          <div className="usage-list">
            {topUsers.map((item) => (
              <div key={item.label} className="usage-list-row">
                <strong>{item.label}</strong>
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
                <small>图 {item.image} / 视 {item.video} / RH App {item.runninghubApp} / RH Flow {item.runninghubWorkflow} / LLM {item.llm}</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="usage-dashboard-grid usage-dashboard-grid--tables">
        <article className="usage-panel">
          <header>
            <h3>模型矩阵</h3>
            <span>Model Matrix</span>
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
                {topModels.map((item) => (
                  <tr key={`${item.capability}-${item.providerId}-${item.modelRecordId}`}>
                    <td>{item.capability}</td>
                    <td>{item.providerName}</td>
                    <td>{item.displayName}</td>
                    <td>{item.modelId}</td>
                    <td>{item.total}</td>
                    <td>{item.topGroupName || "-"}</td>
                    <td>{item.topUserEmail || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="usage-panel">
          <header>
            <h3>RH 条目矩阵</h3>
            <span>RH Entry Matrix</span>
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
                {topRunningHubEntries.map((item) => (
                  <tr key={`${item.kind}-${item.catalogId}`}>
                    <td>{item.kind === "app" ? "AI 应用" : "工作流"}</td>
                    <td>{item.providerName}</td>
                    <td>{item.title}</td>
                    <td>{item.catalogId}</td>
                    <td>{item.runTargetId || "-"}</td>
                    <td>{item.total}</td>
                    <td>{item.topGroupName || "-"}</td>
                    <td>{item.topUserEmail || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}
