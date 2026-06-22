import { Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DataTable, FormPanel } from "./admin-common-components";
import type { AuditRecord, SystemInfo } from "./admin-types";

export function AuditPanel({ auditLogs }: { auditLogs: AuditRecord[] }) {
  return (
    <DataTable
      title="审计日志"
      columns={["时间", "操作者", "动作", "对象", "请求", "来源", "说明"]}
      rows={auditLogs.map((item) => [
        new Date(item.createdAt).toLocaleString(),
        item.actorEmail,
        item.action,
        `${item.targetType}:${item.targetId}`,
        item.requestId || "-",
        `${item.ip || "-"}${item.userAgent ? ` | ${item.userAgent.slice(0, 80)}` : ""}`,
        item.summary,
      ])}
    />
  );
}

export function SystemPanel({
  system,
  saving = false,
  onSave,
}: {
  system: SystemInfo | null;
  saving?: boolean;
  onSave?: (payload: { taskQueueSettings: SystemInfo["taskQueueSettings"]; revision: number }) => Promise<void>;
}) {
  const [draft, setDraft] = useState<SystemInfo["taskQueueSettings"] | null>(system?.taskQueueSettings ?? null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setDraft(system?.taskQueueSettings ?? null);
  }, [system]);

  const databaseTargetStatus = useMemo(() => {
    if (!system?.database?.expectedDatabase) return "未设置";
    if (!system?.database?.currentDatabase) return "不可用";
    return system.database.targetMatched ? "matched" : "mismatched";
  }, [system]);

  const rows = useMemo(() => [
    ["环境", system?.environment || "-"],
    ["服务", system?.service || "-"],
    ["版本", system?.version || "-"],
    ["存储驱动", system?.storageDriver || "-"],
    ["数据库状态", system?.database?.status || "-"],
    ["当前数据库", system?.database?.currentDatabase || "-"],
    ["目标数据库", system?.database?.expectedDatabase || "未设置"],
    ["数据库目标校验", databaseTargetStatus],
    ["数据库迁移", system?.database?.migrations?.join(", ") || (system?.database?.configured ? "未执行" : "未配置")],
    ["数据库错误", system?.database?.error || "-"],
    ["Redis 状态", system?.redis?.status || "-"],
    ["Redis 队列", system?.redis?.queue || "-"],
    ["Redis 深度", String(system?.redis?.depth ?? 0)],
    ["按类别并发", (system?.redis?.queues || []).map((item) => `${item.capability}:${item.concurrency}`).join(" / ") || "-"],
    ["按用户并发", (system?.redis?.queues || []).map((item) => `${item.capability}:${item.userConcurrency ?? "-"}`).join(" / ") || "-"],
    ["按类别深度", (system?.redis?.queues || []).map((item) => `${item.capability}:${item.depth ?? 0}`).join(" / ") || "-"],
    ["Redis 错误", system?.redis?.error || "-"],
    ["任务总数", String(system?.observability?.tasks?.total ?? 0)],
    ["排队任务", String(system?.observability?.tasks?.queued ?? 0)],
    ["运行任务", String(system?.observability?.tasks?.running ?? 0)],
    ["1h 失败任务", String(system?.observability?.tasks?.failedLast1h ?? 0)],
    ["24h 失败任务", String(system?.observability?.tasks?.failedLast24h ?? 0)],
    ["7d 失败任务", String(system?.observability?.tasks?.failedLast7d ?? 0)],
    ["30d 失败任务", String(system?.observability?.tasks?.failedLast30d ?? 0)],
    [
      "任务健康",
      `${system?.observability?.tasks?.health?.status ?? "-"}${system?.observability?.tasks?.health?.summary ? ` | ${system.observability.tasks.health.summary}` : ""}`,
    ],
    [
      "24h 失败 vs 7d 日均",
      `${system?.observability?.tasks?.failedLast24h ?? 0} / ${(system?.observability?.tasks?.trend?.failed24hDailyAverageBaseline ?? 0)} (${(system?.observability?.tasks?.trend?.failed24hVs7dDailyAverage ?? 0) >= 0 ? "+" : ""}${system?.observability?.tasks?.trend?.failed24hVs7dDailyAverage ?? 0})`,
    ],
    [
      "24h 失败 vs 30d 日均",
      `${system?.observability?.tasks?.failedLast24h ?? 0} / ${(system?.observability?.tasks?.trend?.failed30dDailyAverageBaseline ?? 0)} (${(system?.observability?.tasks?.trend?.failed24hVs30dDailyAverage ?? 0) >= 0 ? "+" : ""}${system?.observability?.tasks?.trend?.failed24hVs30dDailyAverage ?? 0})`,
    ],
    [
      "7d 日均 vs 30d 日均",
      `${system?.observability?.tasks?.trend?.failed7dDailyAverage ?? 0} / ${(system?.observability?.tasks?.trend?.failed30dDailyAverageBaseline ?? 0)} (${(system?.observability?.tasks?.trend?.failed7dVs30dDailyAverage ?? 0) >= 0 ? "+" : ""}${system?.observability?.tasks?.trend?.failed7dVs30dDailyAverage ?? 0})`,
    ],
    [
      "最近审计样本",
      `${system?.observability?.audits?.sampled ?? 0} / ${system?.observability?.audits?.total ?? 0}`,
    ],
    [
      "请求ID覆盖率",
      `${system?.observability?.audits?.withRequestId ?? 0} / ${system?.observability?.audits?.sampled ?? 0} (${system?.observability?.audits?.requestIdCoveragePercent ?? 0}%)`,
    ],
    [
      "请求ID健康",
      `${system?.observability?.audits?.coverageHealth?.status ?? "-"}${system?.observability?.audits?.coverageHealth?.summary ? ` | ${system.observability.audits.coverageHealth.summary}` : ""}`,
    ],
    [
      "近24h 请求ID覆盖率",
      `${system?.observability?.audits?.withRequestIdLast24h ?? 0} / ${system?.observability?.audits?.sampledLast24h ?? 0} (${system?.observability?.audits?.requestIdCoverageLast24hPercent ?? 0}%)`,
    ],
    [
      "近7d 请求ID覆盖率",
      `${system?.observability?.audits?.withRequestIdLast7d ?? 0} / ${system?.observability?.audits?.sampledLast7d ?? 0} (${system?.observability?.audits?.requestIdCoverageLast7dPercent ?? 0}%)`,
    ],
    [
      "24h 覆盖率 vs 最近样本",
      `${system?.observability?.audits?.requestIdCoverageLast24hPercent ?? 0}% (${(system?.observability?.audits?.coverageTrend?.requestIdCoverageLast24hVsLatestSample ?? 0) >= 0 ? "+" : ""}${system?.observability?.audits?.coverageTrend?.requestIdCoverageLast24hVsLatestSample ?? 0})`,
    ],
    ["24h 冲突总数", String(system?.observability?.audits?.conflicts?.totalLast24h ?? 0)],
    ["7d 冲突总数", String(system?.observability?.audits?.conflicts?.totalLast7d ?? 0)],
    ["30d 冲突总数", String(system?.observability?.audits?.conflicts?.totalLast30d ?? 0)],
    ["画布 revision 冲突", String(system?.observability?.audits?.conflicts?.canvasRevisionLast24h ?? 0)],
    ["资源 revision 冲突", String(system?.observability?.audits?.conflicts?.resourceRevisionLast24h ?? 0)],
    ["后台设置冲突", String(system?.observability?.audits?.conflicts?.adminSettingsRevisionLast24h ?? 0)],
    [
      "24h 冲突 vs 30d 日均",
      `${system?.observability?.audits?.conflicts?.totalLast24h ?? 0} / ${(system?.observability?.audits?.conflicts?.trend?.total30dDailyAverageBaseline ?? 0)} (${(system?.observability?.audits?.conflicts?.trend?.total24hVs30dDailyAverage ?? 0) >= 0 ? "+" : ""}${system?.observability?.audits?.conflicts?.trend?.total24hVs30dDailyAverage ?? 0})`,
    ],
    [
      "冲突健康",
      `${system?.observability?.audits?.conflicts?.health?.status ?? "-"}${system?.observability?.audits?.conflicts?.health?.summary ? ` | ${system.observability.audits.conflicts.health.summary}` : ""}`,
    ],
    [
      "活动告警",
      system?.observability?.alerts?.activeCount
        ? `${system.observability.alerts.activeCount} / ${system.observability.alerts.highestSeverity} | ${system.observability.alerts.items.map((item) => `${item.severity}:${item.summary}`).join(" / ")}`
        : "0 / healthy",
    ],
    ["配置版本", String(system?.taskQueueSettingsRevision ?? 1)],
    ["最近更新", system?.taskQueueSettingsUpdatedAt ? new Date(system.taskQueueSettingsUpdatedAt).toLocaleString() : "-"],
    ["数据目录", system?.dataDir || "-"],
    ["认证数据", system?.authDbPath || "-"],
    ["后台数据", system?.adminDbPath || "-"],
    ["画布数量", String(system?.storage?.canvases ?? 0)],
    ["资源数量", String(system?.storage?.resources ?? 0)],
  ], [databaseTargetStatus, system]);

  const values = draft || system?.taskQueueSettings;

  return (
    <>
      <DataTable title="系统状态" columns={["项目", "值"]} rows={rows} />
      <FormPanel title="普通任务并发" icon={Settings2}>
        <label>
          图片总并发
          <input
            type="number"
            min={1}
            max={4}
            value={values?.image.concurrency ?? 4}
            onChange={(event) =>
              setDraft((current) => ({
                ...(current || system?.taskQueueSettings || {
                  image: { concurrency: 4, userConcurrency: 4 },
                  audio: { concurrency: 4, userConcurrency: 4 },
                  video: { concurrency: 4, userConcurrency: 4 },
                  runninghub: { concurrency: 2, enabled: true },
                }),
                image: {
                  ...(current?.image || system?.taskQueueSettings?.image || { concurrency: 4, userConcurrency: 4 }),
                  concurrency: Number(event.target.value || 4),
                },
              }))
            }
          />
        </label>
        <label>
          图片单用户并发
          <input
            type="number"
            min={1}
            max={4}
            value={values?.image.userConcurrency ?? 4}
            onChange={(event) =>
              setDraft((current) => ({
                ...(current || system?.taskQueueSettings || {
                  image: { concurrency: 4, userConcurrency: 4 },
                  audio: { concurrency: 4, userConcurrency: 4 },
                  video: { concurrency: 4, userConcurrency: 4 },
                  runninghub: { concurrency: 2, enabled: true },
                }),
                image: {
                  ...(current?.image || system?.taskQueueSettings?.image || { concurrency: 4, userConcurrency: 4 }),
                  userConcurrency: Number(event.target.value || 4),
                },
              }))
            }
          />
        </label>
        <label>
          音频总并发
          <input
            type="number"
            min={1}
            max={4}
            value={values?.audio.concurrency ?? 4}
            onChange={(event) =>
              setDraft((current) => ({
                ...(current || system?.taskQueueSettings || {
                  image: { concurrency: 4, userConcurrency: 4 },
                  audio: { concurrency: 4, userConcurrency: 4 },
                  video: { concurrency: 4, userConcurrency: 4 },
                  runninghub: { concurrency: 2, enabled: true },
                }),
                audio: {
                  ...(current?.audio || system?.taskQueueSettings?.audio || { concurrency: 4, userConcurrency: 4 }),
                  concurrency: Number(event.target.value || 4),
                },
              }))
            }
          />
        </label>
        <label>
          音频单用户并发
          <input
            type="number"
            min={1}
            max={4}
            value={values?.audio.userConcurrency ?? 4}
            onChange={(event) =>
              setDraft((current) => ({
                ...(current || system?.taskQueueSettings || {
                  image: { concurrency: 4, userConcurrency: 4 },
                  audio: { concurrency: 4, userConcurrency: 4 },
                  video: { concurrency: 4, userConcurrency: 4 },
                  runninghub: { concurrency: 2, enabled: true },
                }),
                audio: {
                  ...(current?.audio || system?.taskQueueSettings?.audio || { concurrency: 4, userConcurrency: 4 }),
                  userConcurrency: Number(event.target.value || 4),
                },
              }))
            }
          />
        </label>
        <label>
          视频总并发
          <input
            type="number"
            min={1}
            max={4}
            value={values?.video.concurrency ?? 4}
            onChange={(event) =>
              setDraft((current) => ({
                ...(current || system?.taskQueueSettings || {
                  image: { concurrency: 4, userConcurrency: 4 },
                  audio: { concurrency: 4, userConcurrency: 4 },
                  video: { concurrency: 4, userConcurrency: 4 },
                  runninghub: { concurrency: 2, enabled: true },
                }),
                video: {
                  ...(current?.video || system?.taskQueueSettings?.video || { concurrency: 4, userConcurrency: 4 }),
                  concurrency: Number(event.target.value || 4),
                },
              }))
            }
          />
        </label>
        <label>
          视频单用户并发
          <input
            type="number"
            min={1}
            max={4}
            value={values?.video.userConcurrency ?? 4}
            onChange={(event) =>
              setDraft((current) => ({
                ...(current || system?.taskQueueSettings || {
                  image: { concurrency: 4, userConcurrency: 4 },
                  audio: { concurrency: 4, userConcurrency: 4 },
                  video: { concurrency: 4, userConcurrency: 4 },
                  runninghub: { concurrency: 2, enabled: true },
                }),
                video: {
                  ...(current?.video || system?.taskQueueSettings?.video || { concurrency: 4, userConcurrency: 4 }),
                  userConcurrency: Number(event.target.value || 4),
                },
              }))
            }
          />
        </label>
        <div className="field-note">RunningHub 平台并发治理</div>
        <label>
          RH 平台总并发
          <input
            type="number"
            min={1}
            max={4}
            value={values?.runninghub?.concurrency ?? 2}
            onChange={(event) =>
              setDraft((current) => ({
                ...(current || system?.taskQueueSettings || {
                  image: { concurrency: 4, userConcurrency: 4 },
                  audio: { concurrency: 4, userConcurrency: 4 },
                  video: { concurrency: 4, userConcurrency: 4 },
                  runninghub: { concurrency: 2, enabled: true },
                }),
                runninghub: {
                  ...(current?.runninghub || system?.taskQueueSettings?.runninghub || { concurrency: 2, enabled: true }),
                  concurrency: Number(event.target.value || 2),
                },
              }))
            }
          />
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={values?.runninghub?.enabled !== false}
            onChange={(event) =>
              setDraft((current) => ({
                ...(current || system?.taskQueueSettings || {
                  image: { concurrency: 4, userConcurrency: 4 },
                  audio: { concurrency: 4, userConcurrency: 4 },
                  video: { concurrency: 4, userConcurrency: 4 },
                  runninghub: { concurrency: 2, enabled: true },
                }),
                runninghub: {
                  ...(current?.runninghub || system?.taskQueueSettings?.runninghub || { concurrency: 2, enabled: true }),
                  enabled: event.target.checked,
                },
              }))
            }
          />
          启用 RH 平台并发治理
        </label>
        <div className="field-note">
          普通任务先受“类别总并发”限制，再受“单用户并发”限制。RunningHub 任务在此基础上，还会额外受 RH 平台并发窗口限制；超过窗口的 RH 任务会自动排队等待。
        </div>
        <div className="inline-actions">
          <button
            type="button"
            disabled={!onSave || !values || saving || submitting}
            onClick={async () => {
              if (!onSave || !values) return;
              setSubmitting(true);
              try {
                await onSave({
                  taskQueueSettings: values,
                  revision: system?.taskQueueSettingsRevision ?? 1,
                });
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {saving || submitting ? "保存中..." : "保存并发设置"}
          </button>
        </div>
      </FormPanel>
    </>
  );
}
