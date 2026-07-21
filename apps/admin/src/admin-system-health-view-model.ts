import type { SystemInfo } from "./admin-types.js";

export type AdminHealthStatus = "healthy" | "info" | "warning" | "critical" | "unknown";

export interface AdminHealthDomainCardModel {
  id: "api" | "database" | "redis" | "worker" | "storage";
  title: string;
  status: AdminHealthStatus;
  summary: string;
  metrics: Array<{ label: string; value: string }>;
}

export function buildSystemHealthDomainCards(system: SystemInfo | null): AdminHealthDomainCardModel[] {
  const queues = system?.redis?.queues || [];
  const slotCount = queues.reduce((total, item) => total + Math.max(0, Number(item.slotCount) || 0), 0);
  const effectiveConcurrency = queues.reduce((total, item) => total + Math.max(0, Number(item.effectiveConcurrency) || 0), 0);
  const workerCount = Math.max(0, ...queues.map((item) => Math.max(0, Number(item.workerCount) || 0)));
  const databaseStatus: AdminHealthStatus = !system?.database?.configured
    ? "unknown"
    : system.database.status !== "connected" || system.database.targetMatched === false
      ? "critical"
      : "healthy";
  const redisStatus: AdminHealthStatus = !system?.redis?.configured
    ? "unknown"
    : system.redis.status === "connected"
      ? "healthy"
      : "critical";
  const workerStatus: AdminHealthStatus = queues.length === 0
    ? "unknown"
    : slotCount > 0
      ? "healthy"
      : "warning";

  return [
    {
      id: "api",
      title: "API",
      status: system?.service ? "healthy" : "unknown",
      summary: system?.service ? `${system.service} 正在响应` : "尚未返回 API 进程状态",
      metrics: [
        { label: "环境", value: system?.environment || "-" },
        { label: "版本", value: system?.version || "-" },
      ],
    },
    {
      id: "database",
      title: "PostgreSQL",
      status: databaseStatus,
      summary: databaseSummary(system),
      metrics: [
        { label: "当前库", value: system?.database?.currentDatabase || "-" },
        { label: "迁移", value: String(system?.database?.migrations?.length || 0) },
      ],
    },
    {
      id: "redis",
      title: "Redis / Queue",
      status: redisStatus,
      summary: system?.redis?.configured ? (system.redis.error || `连接状态：${system.redis.status}`) : "Redis 未配置",
      metrics: [
        { label: "总深度", value: String(system?.redis?.depth ?? 0) },
        { label: "队列", value: String(queues.length) },
      ],
    },
    {
      id: "worker",
      title: "Worker",
      status: workerStatus,
      summary: queues.length === 0 ? "尚未收到当前环境 Worker runtime 上报" : `${workerCount} 个 Worker，${effectiveConcurrency} 个 active 槽位`,
      metrics: [
        { label: "槽位", value: String(slotCount) },
        { label: "实际并发", value: String(effectiveConcurrency) },
      ],
    },
    {
      id: "storage",
      title: "Storage",
      status: "unknown",
      summary: "已返回对象数量，但尚未接入磁盘容量与写入错误指标",
      metrics: [
        { label: "画布", value: String(system?.storage?.canvases ?? 0) },
        { label: "资源", value: String(system?.storage?.resources ?? 0) },
      ],
    },
  ];
}

function databaseSummary(system: SystemInfo | null) {
  if (!system?.database?.configured) return "数据库未配置";
  if (system.database.status !== "connected") return system.database.error || `连接状态：${system.database.status}`;
  if (system.database.targetMatched === false) {
    return `当前库 ${system.database.currentDatabase || "-"} 与目标 ${system.database.expectedDatabase || "-"} 不一致`;
  }
  return "连接与目标数据库校验正常";
}
