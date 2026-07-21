import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Database,
  HardDrive,
  Network,
  RefreshCw,
  Server,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { buildSystemHealthDomainCards, type AdminHealthDomainCardModel, type AdminHealthStatus } from "../../admin-system-health-view-model.js";
import type { SystemInfo } from "../../admin-types.js";

type HealthRange = "1h" | "24h" | "7d" | "30d";

const RANGE_LABELS: Array<{ key: HealthRange; label: string }> = [
  { key: "1h", label: "1 小时" },
  { key: "24h", label: "24 小时" },
  { key: "7d", label: "7 天" },
  { key: "30d", label: "30 天" },
];

const DOMAIN_ICONS = {
  api: Activity,
  database: Database,
  redis: Network,
  worker: Server,
  storage: HardDrive,
};

export function AdminSystemHealthDashboard({
  system,
  refreshing = false,
  onRangeChange,
  onRefresh,
}: {
  system: SystemInfo | null;
  refreshing?: boolean;
  onRangeChange?: (range: HealthRange) => void;
  onRefresh?: () => void;
}) {
  const cards = useMemo(() => buildSystemHealthDomainCards(system), [system]);
  const [selectedDomain, setSelectedDomain] = useState<AdminHealthDomainCardModel | null>(null);
  const range = system?.observability?.range?.key || "24h";
  const generatedAt = system?.observability?.generatedAt;
  const alerts = system?.observability?.alerts?.items || [];
  const queueConsistency = system?.observability?.queueConsistency;

  return (
    <section className="admin-health-dashboard" aria-label="系统健康可视化">
      <header className="admin-health-header">
        <div>
          <span className="admin-health-kicker">SYSTEM OBSERVABILITY</span>
          <h2>系统健康</h2>
          <p>优先查看活动告警、环境隔离后的实际容量和任务失败率。</p>
        </div>
        <div className="admin-health-header__controls">
          <div className="admin-health-environment" aria-label="当前环境与版本">
            <strong>{system?.environment || "unknown"}</strong>
            <span>{system?.version || "-"}</span>
          </div>
          <div className="admin-health-range" aria-label="统计时间范围">
            {RANGE_LABELS.map((item) => (
              <button
                type="button"
                key={item.key}
                className={range === item.key ? "active" : ""}
                aria-pressed={range === item.key}
                onClick={() => onRangeChange?.(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button type="button" className="admin-health-refresh" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw aria-hidden="true" className={refreshing ? "is-spinning" : ""} />
            {refreshing ? "刷新中" : "刷新"}
          </button>
        </div>
        <div className="admin-health-freshness">
          数据更新时间：{generatedAt ? new Date(generatedAt).toLocaleString() : "尚未返回"}
          {system?.observability?.freshness?.status === "stale" ? <span className="health-status health-status--warning">数据已过期</span> : null}
        </div>
      </header>

      <AlertRail alerts={alerts} queueConsistency={queueConsistency} />

      <div className="admin-health-domain-grid">
        {cards.map((card) => {
          const Icon = DOMAIN_ICONS[card.id];
          return (
            <button type="button" className={`admin-health-domain-card admin-health-domain-card--${card.status}`} key={card.id} onClick={() => setSelectedDomain(card)}>
              <span className="admin-health-domain-card__head">
                <Icon aria-hidden="true" />
                <strong>{card.title}</strong>
                <HealthStatus status={card.status} />
              </span>
              <span className="admin-health-domain-card__summary">{card.summary}</span>
              <span className="admin-health-domain-card__metrics">
                {card.metrics.map((metric) => (
                  <span key={metric.label}><small>{metric.label}</small><b>{metric.value}</b></span>
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <ServiceTopology cards={cards} />

      <div className="admin-health-chart-grid">
        <TaskTrendChart system={system} />
        <QueueCapacityChart system={system} />
      </div>

      <div className="admin-health-chart-grid admin-health-chart-grid--lower">
        <TaskHealthPanel system={system} />
        <IncidentTimeline system={system} />
      </div>

      {selectedDomain ? <ObservabilityInspector system={system} domain={selectedDomain} onClose={() => setSelectedDomain(null)} /> : null}
    </section>
  );
}

function AlertRail({ alerts, queueConsistency }: {
  alerts: NonNullable<SystemInfo["observability"]>["alerts"]["items"];
  queueConsistency?: SystemInfo["observability"]["queueConsistency"];
}) {
  if (!alerts.length) {
    return (
      <div className="admin-health-alert-rail admin-health-alert-rail--healthy">
        <CheckCircle2 aria-hidden="true" />
        <div><strong>当前无活动告警</strong><span>已检查数据库、Redis、队列、任务和审计健康。</span></div>
      </div>
    );
  }
  return (
    <div className="admin-health-alert-stack" aria-label={`${alerts.length} 条活动告警`}>
      {alerts.map((alert) => (
        <article className={`admin-health-alert-rail admin-health-alert-rail--${alert.severity}`} key={alert.code}>
          <AlertTriangle aria-hidden="true" />
          <div><strong>{alert.summary}</strong><span>{alert.action}</span></div>
          <span className={`health-status health-status--${alert.severity}`}>{alert.severity}</span>
        </article>
      ))}
      {queueConsistency?.mismatch ? <small className="admin-health-alert-footnote">DB / Redis 差异：{queueConsistency.mismatch} 条</small> : null}
    </div>
  );
}

function ServiceTopology({ cards }: { cards: AdminHealthDomainCardModel[] }) {
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const nodes: Array<{ id: AdminHealthDomainCardModel["id"]; label: string }> = [
    { id: "api", label: "Admin / API" },
    { id: "database", label: "PostgreSQL" },
    { id: "redis", label: "Redis Queue" },
    { id: "worker", label: "Worker" },
  ];
  return (
    <section className="admin-health-panel admin-health-topology">
      <PanelHeading title="执行链路" description="节点位置固定；颜色只表达当前健康语义。" />
      <div className="admin-health-topology__flow">
        {nodes.map((node, index) => {
          const card = cardById.get(node.id);
          return (
            <div className="admin-health-topology__step" key={node.id}>
              <div className={`admin-health-topology__node admin-health-topology__node--${card?.status || "unknown"}`}>
                <span>{node.label}</span>
                <HealthStatus status={card?.status || "unknown"} />
              </div>
              {index < nodes.length - 1 ? <span className="admin-health-topology__edge" aria-hidden="true">→</span> : null}
            </div>
          );
        })}
        <div className="admin-health-topology__providers">
          <span>Provider</span>
          <HealthStatus status="unknown" />
          <small>尚未接入历史探测指标</small>
        </div>
      </div>
    </section>
  );
}

function TaskTrendChart({ system }: { system: SystemInfo | null }) {
  const series = system?.observability?.tasks?.series || [];
  const width = 720;
  const height = 190;
  const padding = 22;
  const maxValue = Math.max(1, ...series.flatMap((item) => [item.succeeded, item.failed, item.cancelled]));
  const points = (key: "succeeded" | "failed" | "cancelled") => series.map((item, index) => {
    const x = series.length <= 1 ? width / 2 : padding + (index / (series.length - 1)) * (width - padding * 2);
    const y = height - padding - (item[key] / maxValue) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");
  return (
    <section className="admin-health-panel">
      <PanelHeading title="任务结果趋势" description={`${rangeCopy(system)} · 服务端聚合桶`} />
      {series.length >= 2 ? (
        <>
          <svg className="admin-health-trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="成功、失败与取消任务趋势">
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="chart-axis" />
            <polyline points={points("succeeded")} className="chart-line chart-line--success" />
            <polyline points={points("failed")} className="chart-line chart-line--danger" />
            <polyline points={points("cancelled")} className="chart-line chart-line--muted" />
          </svg>
          <div className="admin-health-chart-legend"><span className="success">成功</span><span className="danger">失败</span><span className="muted">取消</span></div>
        </>
      ) : <ChartEmpty text={series.length === 1 ? "当前范围只有一个聚合点，暂不绘制误导性趋势" : "当前范围没有已完成任务"} />}
    </section>
  );
}

function QueueCapacityChart({ system }: { system: SystemInfo | null }) {
  const queues = system?.redis?.queues || [];
  return (
    <section className="admin-health-panel">
      <PanelHeading title="队列与有效容量" description="配置并发、当前 active 槽位和队列深度按精确 queue 统计。" />
      {queues.length ? <div className="admin-health-capacity-list">
        {queues.map((queue) => {
          const configured = Math.max(1, Number(queue.concurrency) || 1);
          const effective = Math.max(0, Number(queue.effectiveConcurrency) || 0);
          const ratio = Math.min(100, (effective / configured) * 100);
          return (
            <article key={queue.queue}>
              <header><strong>{capabilityName(queue.capability)}</strong><span>深度 {queue.depth || 0}</span></header>
              <div className="admin-health-capacity-bar"><i style={{ width: `${ratio}%` }} /></div>
              <footer><span>实际 {effective}</span><span>配置 {configured}</span><span>Worker {queue.workerCount || 0}</span></footer>
            </article>
          );
        })}
      </div> : <ChartEmpty text="尚未收到当前环境的队列 runtime 数据" />}
    </section>
  );
}

function TaskHealthPanel({ system }: { system: SystemInfo | null }) {
  const tasks = system?.observability?.tasks;
  const health = tasks?.health;
  const trend = tasks?.trend;
  return (
    <section className="admin-health-panel">
      <PanelHeading title="任务健康口径" description="失败与取消分离；按失败率、基线、样本量和持续窗口判断。" />
      <div className="admin-health-task-score">
        <HealthStatus status={health?.status || "unknown"} />
        <strong>{health?.failureRatePercent ?? 0}%</strong>
        <span>24h 失败率</span>
      </div>
      <p className="admin-health-task-summary">{health?.summary || "尚未返回任务健康判断"}</p>
      <dl className="admin-health-definition-grid">
        <div><dt>24h 样本</dt><dd>{health?.sampleSize ?? 0}</dd></div>
        <div><dt>7d 基线</dt><dd>{trend?.failureRate7dPercent ?? 0}%</dd></div>
        <div><dt>30d 基线</dt><dd>{trend?.failureRate30dPercent ?? 0}%</dd></div>
        <div><dt>当前阈值</dt><dd>{health?.thresholdPercent ?? 0}%</dd></div>
      </dl>
    </section>
  );
}

function IncidentTimeline({ system }: { system: SystemInfo | null }) {
  const alerts = system?.observability?.alerts?.items || [];
  return (
    <section className="admin-health-panel">
      <PanelHeading title="活动事件" description="当前先展示健康告警；发布、配置与重启事件将在事件源接入后合并。" />
      {alerts.length ? <ol className="admin-health-timeline">
        {alerts.map((alert) => <li key={alert.code}><i className={`timeline-dot timeline-dot--${alert.severity}`} /><div><strong>{alert.summary}</strong><span>{alert.source} · {alert.action}</span></div></li>)}
      </ol> : <ChartEmpty text="当前没有活动健康事件" />}
    </section>
  );
}

function ObservabilityInspector({ system, domain, onClose }: { system: SystemInfo | null; domain: AdminHealthDomainCardModel; onClose: () => void }) {
  return (
    <aside className="admin-health-inspector" aria-label={`${domain.title} 技术详情`}>
      <header><div><span>OBSERVABILITY INSPECTOR</span><h3>{domain.title}</h3></div><button type="button" onClick={onClose} aria-label="关闭技术详情"><X aria-hidden="true" /></button></header>
      <HealthStatus status={domain.status} />
      <p>{domain.summary}</p>
      <dl className="admin-health-inspector__metrics">{domain.metrics.map((metric) => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}</dl>
      {domain.id === "database" ? <details><summary>数据库技术详情</summary><p>当前：{system?.database?.currentDatabase || "-"}</p><p>目标：{system?.database?.expectedDatabase || "-"}</p><p>迁移：{system?.database?.migrations?.join(", ") || "-"}</p></details> : null}
      {domain.id === "redis" ? <details><summary>Redis 技术详情</summary><p>Queue：{system?.redis?.queue || "-"}</p><p>{system?.redis?.error || "无连接错误"}</p></details> : null}
      {domain.id === "storage" ? <details><summary>存储技术详情</summary><p>输入文件：{system?.storage?.inputFiles ?? 0}</p><p>输出文件：{system?.storage?.outputFiles ?? 0}</p></details> : null}
    </aside>
  );
}

function PanelHeading({ title, description }: { title: string; description: string }) {
  return <header className="admin-health-panel__heading"><div><h3>{title}</h3><p>{description}</p></div></header>;
}

function HealthStatus({ status }: { status: AdminHealthStatus | "info" }) {
  const Icon = status === "healthy" ? CheckCircle2 : status === "unknown" || status === "info" ? CircleHelp : AlertTriangle;
  return <span className={`health-status health-status--${status}`}><Icon aria-hidden="true" />{status}</span>;
}

function ChartEmpty({ text }: { text: string }) {
  return <div className="admin-health-chart-empty"><CircleHelp aria-hidden="true" /><span>{text}</span></div>;
}

function capabilityName(capability: "image" | "audio" | "video") {
  return capability === "image" ? "图片" : capability === "audio" ? "音频" : "视频";
}

function rangeCopy(system: SystemInfo | null) {
  const range = system?.observability?.range;
  if (!range) return "24 小时";
  return RANGE_LABELS.find((item) => item.key === range.key)?.label || range.key;
}
