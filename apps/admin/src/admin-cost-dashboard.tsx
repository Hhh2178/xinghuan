import { useEffect, useMemo, useState } from "react";

import { adminCostApi } from "./admin-api-client";
import { AdminDataContext, AdminDataWorkbench } from "./admin-data-workbench";
import type { AdminCostRankingRow, AdminCostSummary, AdminUser, AdminUserGroup, ModelRecord, ProviderRecord } from "./admin-types";

type Range = "today" | "7d" | "30d";

export function AdminCostDashboard({ users, userGroups, providers, models }: {
  users: AdminUser[];
  userGroups: AdminUserGroup[];
  providers: ProviderRecord[];
  models: ModelRecord[];
}) {
  const [range, setRange] = useState<Range>("30d");
  const [groupId, setGroupId] = useState("");
  const [userId, setUserId] = useState("");
  const [providerId, setProviderId] = useState("");
  const [modelId, setModelId] = useState("");
  const [summary, setSummary] = useState<AdminCostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const rangeBounds = useMemo(() => resolveRange(range), [range]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    adminCostApi.readCostSummary({ ...rangeBounds, currency: "CNY", groupId, userId, providerId, modelId })
      .then((result) => active && setSummary(result))
      .catch((nextError) => active && setError(nextError instanceof Error ? nextError.message : String(nextError)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [rangeBounds, groupId, userId, providerId, modelId]);

  const filteredModels = providerId ? models.filter((model) => model.providerId === providerId) : models;
  return (
    <AdminDataWorkbench label="费用分析数据" mode="analytics" className="cost-dashboard">
      <AdminDataContext
        eyebrow="Provider Cost"
        title="费用分析"
        description="模型、服务商、用户组和账号的人民币消耗。"
        status={{
          label: error ? "费用加载失败" : loading ? "费用刷新中" : summary ? "费用已更新" : "等待费用数据",
          tone: error ? "danger" : loading ? "warning" : summary ? "success" : "muted",
        }}
        meta={<span>CNY · 不做汇率换算</span>}
      />

      <article className="usage-panel usage-panel--filters">
        <header><h3>筛选条件</h3><span>{loading ? "费用刷新中..." : "Cost Filters"}</span></header>
        <div className="usage-filter-grid cost-filter-grid">
          <Filter label="时间范围" value={range} onChange={(value) => setRange(value as Range)} options={[['today','今天'],['7d','7 天'],['30d','30 天']]} />
          <Filter label="用户组" value={groupId} onChange={(value) => { setGroupId(value); setUserId(""); }} options={[["","全部分组"], ...userGroups.map((item) => [item.id, item.name] as [string,string])]} />
          <Filter label="账号" value={userId} onChange={setUserId} options={[["","全部账号"], ...users.filter((item) => !groupId || item.groupId === groupId).map((item) => [item.id, item.email] as [string,string])]} />
          <Filter label="服务商" value={providerId} onChange={(value) => { setProviderId(value); setModelId(""); }} options={[["","全部服务商"], ...providers.map((item) => [item.id, item.name] as [string,string])]} />
          <Filter label="模型" value={modelId} onChange={setModelId} options={[["","全部模型"], ...filteredModels.map((item) => [item.id, item.displayName] as [string,string])]} />
          <label className="usage-filter-field"><span>币种</span><input value="人民币（CNY）" readOnly /></label>
        </div>
      </article>

      {error ? <div className="error-banner">{error}</div> : null}
      {summary ? (
        <>
          <div className="cost-kpi-grid">
            <Kpi label="已结算费用" value={`¥ ${summary.totals.amount}`} hint="人民币" />
            <Kpi label="计费任务" value={String(summary.totals.chargedTasks)} hint="成功及应计费取消" />
            <Kpi label="按次数量" value={String(summary.totals.billedRequests)} hint="次" />
            <Kpi label="按秒数量" value={String(summary.totals.billedSeconds)} hint="整数秒" />
            <Kpi label="未定价任务" value={String(summary.totals.unpricedTasks)} hint="含未回算历史" warning />
          </div>
          <div className="cost-chart-grid">
            <RankingChart title="服务商费用" rows={summary.providers} />
            <RankingChart title="模型费用" rows={summary.models} />
            <RankingChart title="用户组费用" rows={summary.groups} />
            <RankingChart title="账号费用" rows={summary.accounts} />
            <DailyBars rows={summary.daily} />
          </div>
          <p className="cost-unpriced-note">历史任务暂不计算费用；没有价格快照的记录统一标记为“未定价”，不会使用当前价格反向补算。</p>
        </>
      ) : loading ? <div className="starlight-page-loading">正在汇总费用...</div> : null}
    </AdminDataWorkbench>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string,string][] }) {
  return <label className="usage-filter-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([id, name]) => <option key={id || "all"} value={id}>{name}</option>)}</select></label>;
}

function Kpi({ label, value, hint, warning = false }: { label: string; value: string; hint: string; warning?: boolean }) {
  return <article className={warning ? "usage-kpi-card cost-kpi-card warning" : "usage-kpi-card cost-kpi-card"}><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>;
}

function RankingChart({ title, rows }: { title: string; rows: AdminCostRankingRow[] }) {
  const visible = rows.slice(0, 10);
  const max = Math.max(0, ...visible.map((row) => Number(row.amount)));
  return <article className="usage-panel cost-ranking-panel"><header><h3>{title}</h3><span>Top 10 · CNY</span></header><div className="cost-ranking-bars">{visible.length ? visible.map((row) => <div className="cost-ranking-row" key={row.id}><strong title={row.label}>{row.label}</strong><div className="cost-bar-track"><i style={{ width: `${max ? Math.max(2, Number(row.amount) / max * 100) : 0}%` }} /></div><span>¥ {row.amount}</span></div>) : <p className="empty-note">暂无已计费记录</p>}</div></article>;
}

function DailyBars({ rows }: { rows: AdminCostSummary["daily"] }) {
  const visible = rows.slice(-14);
  const max = Math.max(0, ...visible.map((row) => Number(row.amount)));
  return <article className="usage-panel cost-daily-panel"><header><h3>每日费用趋势</h3><span>Daily Cost · 柱状图</span></header><div className="cost-daily-bars">{visible.map((row) => <div className="cost-daily-column" key={row.day} title={`${row.day} · ¥ ${row.amount} · ${row.chargedTasks} 个任务`}><span>¥{Number(row.amount).toFixed(2)}</span><div><i style={{ height: `${max ? Math.max(3, Number(row.amount) / max * 100) : 0}%` }} /></div><small>{row.day.slice(5)}</small></div>)}</div></article>;
}

function resolveRange(range: Range) {
  const now = new Date();
  const to = now.getTime();
  if (range === "today") return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(), to };
  return { from: to - (range === "7d" ? 6 : 29) * 86_400_000, to };
}
