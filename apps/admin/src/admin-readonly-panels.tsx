import { Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DataTable, FormPanel } from "./admin-common-components";
import type { AuditRecord, SystemInfo } from "./admin-types";

export function AuditPanel({ auditLogs }: { auditLogs: AuditRecord[] }) {
  return (
    <DataTable
      title="审计日志"
      columns={["时间", "操作者", "动作", "对象", "说明"]}
      rows={auditLogs.map((item) => [
        new Date(item.createdAt).toLocaleString(),
        item.actorEmail,
        item.action,
        `${item.targetType}:${item.targetId}`,
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
  onSave?: (settings: SystemInfo["taskQueueSettings"]) => Promise<void>;
}) {
  const [draft, setDraft] = useState<SystemInfo["taskQueueSettings"] | null>(system?.taskQueueSettings ?? null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setDraft(system?.taskQueueSettings ?? null);
  }, [system]);

  const rows = useMemo(() => [
    ["环境", system?.environment || "-"],
    ["服务", system?.service || "-"],
    ["版本", system?.version || "-"],
    ["存储驱动", system?.storageDriver || "-"],
    ["数据库状态", system?.database?.status || "-"],
    ["数据库迁移", system?.database?.migrations?.join(", ") || (system?.database?.configured ? "未执行" : "未配置")],
    ["数据库错误", system?.database?.error || "-"],
    ["Redis 状态", system?.redis?.status || "-"],
    ["Redis 队列", system?.redis?.queue || "-"],
    ["Redis 深度", String(system?.redis?.depth ?? 0)],
    ["按类别并发", (system?.redis?.queues || []).map((item) => `${item.capability}:${item.concurrency}`).join(" / ") || "-"],
    ["按类别深度", (system?.redis?.queues || []).map((item) => `${item.capability}:${item.depth ?? 0}`).join(" / ") || "-"],
    ["Redis 错误", system?.redis?.error || "-"],
    ["数据目录", system?.dataDir || "-"],
    ["认证数据", system?.authDbPath || "-"],
    ["后台数据", system?.adminDbPath || "-"],
    ["画布数量", String(system?.storage?.canvases ?? 0)],
    ["资源数量", String(system?.storage?.resources ?? 0)],
  ], [system]);

  const values = draft || system?.taskQueueSettings;

  return (
    <>
      <DataTable title="系统状态" columns={["项目", "值"]} rows={rows} />
      <FormPanel title="任务并发设置" icon={Settings2}>
        <label>
          图片并发
          <input
            type="number"
            min={1}
            max={4}
            value={values?.image.concurrency ?? 4}
            onChange={(event) =>
              setDraft((current) => ({
                ...(current || system?.taskQueueSettings || { image: { concurrency: 4 }, audio: { concurrency: 4 }, video: { concurrency: 4 } }),
                image: { concurrency: Number(event.target.value || 4) },
              }))
            }
          />
        </label>
        <label>
          音频并发
          <input
            type="number"
            min={1}
            max={4}
            value={values?.audio.concurrency ?? 4}
            onChange={(event) =>
              setDraft((current) => ({
                ...(current || system?.taskQueueSettings || { image: { concurrency: 4 }, audio: { concurrency: 4 }, video: { concurrency: 4 } }),
                audio: { concurrency: Number(event.target.value || 4) },
              }))
            }
          />
        </label>
        <label>
          视频并发
          <input
            type="number"
            min={1}
            max={4}
            value={values?.video.concurrency ?? 4}
            onChange={(event) =>
              setDraft((current) => ({
                ...(current || system?.taskQueueSettings || { image: { concurrency: 4 }, audio: { concurrency: 4 }, video: { concurrency: 4 } }),
                video: { concurrency: Number(event.target.value || 4) },
              }))
            }
          />
        </label>
        <div className="inline-actions">
          <button
            type="button"
            disabled={!onSave || !values || saving || submitting}
            onClick={async () => {
              if (!onSave || !values) return;
              setSubmitting(true);
              try {
                await onSave(values);
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
