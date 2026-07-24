import { Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { DataTable, FormPanel } from "./admin-common-components";
import { AdminChannelHealthDashboard } from "./admin-channel-health-dashboard";
import { AdminUsageDashboard } from "./admin-usage-dashboard";
import { AdminCostDashboard } from "./admin-cost-dashboard";
import { AdminSystemHealthDashboard } from "./components/observability/AdminSystemHealthDashboard";
import type {
  AdminUsageSummary,
  AdminUser,
  AdminUserGroup,
  AuditRecord,
  ModelRecord,
  ProviderRecord,
  SystemInfo,
  UsageCapability,
} from "./admin-types";

const TASK_QUEUE_DEFAULTS = {
  image: { concurrency: 100, userConcurrency: 8 },
  audio: { concurrency: 100, userConcurrency: 8 },
  video: { concurrency: 100, userConcurrency: 8 },
  chat: { concurrency: 20, userConcurrency: 4 },
  runninghub: { concurrency: 2, enabled: true },
} satisfies NonNullable<SystemInfo["taskQueueSettings"]>;

export function AuditPanel({
  activeView = "usage",
  auditLogs,
  usageSummary,
  usageSummaryLoading,
  usageSummaryError,
  usageFilters,
  selectedUsageUserId,
  users,
  userGroups,
  providers,
  models,
  onUsageFiltersChange,
  onSelectedUsageUserIdChange,
}: {
  activeView?: "usage" | "costs" | "reliability" | "audit";
  auditLogs: AuditRecord[];
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
  models: ModelRecord[];
  onUsageFiltersChange: (next: {
    range: "today" | "7d" | "30d";
    groupId: string;
    capability: "" | UsageCapability;
    providerId: string;
  }) => void;
  onSelectedUsageUserIdChange: (value: string) => void;
}) {
  return (
    <>
      {activeView === "usage" ? <AdminUsageDashboard
        usageSummary={usageSummary}
        usageSummaryLoading={usageSummaryLoading}
        usageSummaryError={usageSummaryError}
        usageFilters={usageFilters}
        selectedUsageUserId={selectedUsageUserId}
        users={users}
        userGroups={userGroups}
        providers={providers}
        onUsageFiltersChange={onUsageFiltersChange}
        onSelectedUsageUserIdChange={onSelectedUsageUserIdChange}
      /> : null}
      {activeView === "costs" ? <AdminCostDashboard users={users} userGroups={userGroups} providers={providers} models={models} /> : null}
      {activeView === "reliability" ? <AdminChannelHealthDashboard /> : null}
      {activeView === "audit" ? <DataTable
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
      /> : null}
    </>
  );
}

export function SystemPanel({
  activeView = "health",
  system,
  saving = false,
  refreshing = false,
  onHealthRangeChange,
  onHealthRefresh,
  onSave,
}: {
  activeView?: "health" | "runtime-settings";
  system: SystemInfo | null;
  saving?: boolean;
  refreshing?: boolean;
  onHealthRangeChange?: (range: "1h" | "24h" | "7d" | "30d") => void;
  onHealthRefresh?: () => void;
  onSave?: (payload: { taskQueueSettings: SystemInfo["taskQueueSettings"]; revision: number }) => Promise<void>;
}) {
  const [draft, setDraft] = useState<SystemInfo["taskQueueSettings"] | null>(system?.taskQueueSettings ?? null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setDraft(system?.taskQueueSettings ?? null);
  }, [system]);

  const values = draft || system?.taskQueueSettings;

  return (
    <>
      {activeView === "health" ? (
        <AdminSystemHealthDashboard
          system={system}
          refreshing={refreshing}
          onRangeChange={onHealthRangeChange}
          onRefresh={onHealthRefresh}
        />
      ) : null}
      {activeView === "runtime-settings" ? <FormPanel title="任务并发设置" icon={Settings2}>
        <label>
          图片总并发
          <input
            type="number"
            min={1}
            max={999}
            value={values?.image.concurrency ?? TASK_QUEUE_DEFAULTS.image.concurrency}
            onChange={(event) =>
              setDraft((current) => ({
                ...(current || system?.taskQueueSettings || TASK_QUEUE_DEFAULTS),
                image: {
                  ...(current?.image || system?.taskQueueSettings?.image || TASK_QUEUE_DEFAULTS.image),
                  concurrency: Number(event.target.value || TASK_QUEUE_DEFAULTS.image.concurrency),
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
            max={999}
            value={values?.image.userConcurrency ?? TASK_QUEUE_DEFAULTS.image.userConcurrency}
            onChange={(event) =>
              setDraft((current) => ({
                ...(current || system?.taskQueueSettings || TASK_QUEUE_DEFAULTS),
                image: {
                  ...(current?.image || system?.taskQueueSettings?.image || TASK_QUEUE_DEFAULTS.image),
                  userConcurrency: Number(event.target.value || TASK_QUEUE_DEFAULTS.image.userConcurrency),
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
            max={999}
            value={values?.audio.concurrency ?? TASK_QUEUE_DEFAULTS.audio.concurrency}
            onChange={(event) =>
              setDraft((current) => ({
                ...(current || system?.taskQueueSettings || TASK_QUEUE_DEFAULTS),
                audio: {
                  ...(current?.audio || system?.taskQueueSettings?.audio || TASK_QUEUE_DEFAULTS.audio),
                  concurrency: Number(event.target.value || TASK_QUEUE_DEFAULTS.audio.concurrency),
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
            max={999}
            value={values?.audio.userConcurrency ?? TASK_QUEUE_DEFAULTS.audio.userConcurrency}
            onChange={(event) =>
              setDraft((current) => ({
                ...(current || system?.taskQueueSettings || TASK_QUEUE_DEFAULTS),
                audio: {
                  ...(current?.audio || system?.taskQueueSettings?.audio || TASK_QUEUE_DEFAULTS.audio),
                  userConcurrency: Number(event.target.value || TASK_QUEUE_DEFAULTS.audio.userConcurrency),
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
            max={999}
            value={values?.video.concurrency ?? TASK_QUEUE_DEFAULTS.video.concurrency}
            onChange={(event) =>
              setDraft((current) => ({
                ...(current || system?.taskQueueSettings || TASK_QUEUE_DEFAULTS),
                video: {
                  ...(current?.video || system?.taskQueueSettings?.video || TASK_QUEUE_DEFAULTS.video),
                  concurrency: Number(event.target.value || TASK_QUEUE_DEFAULTS.video.concurrency),
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
            max={999}
            value={values?.video.userConcurrency ?? TASK_QUEUE_DEFAULTS.video.userConcurrency}
            onChange={(event) =>
              setDraft((current) => ({
                ...(current || system?.taskQueueSettings || TASK_QUEUE_DEFAULTS),
                video: {
                  ...(current?.video || system?.taskQueueSettings?.video || TASK_QUEUE_DEFAULTS.video),
                  userConcurrency: Number(event.target.value || TASK_QUEUE_DEFAULTS.video.userConcurrency),
                },
              }))
            }
          />
        </label>
        <label>
          Agent LLM 总并发
          <input
            type="number"
            min={1}
            max={999}
            value={values?.chat.concurrency ?? TASK_QUEUE_DEFAULTS.chat.concurrency}
            onChange={(event) =>
              setDraft((current) => ({
                ...(current || system?.taskQueueSettings || TASK_QUEUE_DEFAULTS),
                chat: {
                  ...(current?.chat || system?.taskQueueSettings?.chat || TASK_QUEUE_DEFAULTS.chat),
                  concurrency: Number(event.target.value || TASK_QUEUE_DEFAULTS.chat.concurrency),
                },
              }))
            }
          />
        </label>
        <label>
          Agent LLM 单用户并发
          <input
            type="number"
            min={1}
            max={999}
            value={values?.chat.userConcurrency ?? TASK_QUEUE_DEFAULTS.chat.userConcurrency}
            onChange={(event) =>
              setDraft((current) => ({
                ...(current || system?.taskQueueSettings || TASK_QUEUE_DEFAULTS),
                chat: {
                  ...(current?.chat || system?.taskQueueSettings?.chat || TASK_QUEUE_DEFAULTS.chat),
                  userConcurrency: Number(event.target.value || TASK_QUEUE_DEFAULTS.chat.userConcurrency),
                },
              }))
            }
          />
        </label>
        <div className="field-note">RunningHub 平台并发治理</div>
        <label>
          RH 平台总并发
          <input type="text" value={`自动汇总 ${values?.runninghub?.concurrency ?? 0}`} readOnly />
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={values?.runninghub?.enabled !== false}
            onChange={(event) =>
              setDraft((current) => ({
                ...(current || system?.taskQueueSettings || TASK_QUEUE_DEFAULTS),
                runninghub: {
                  ...(current?.runninghub || system?.taskQueueSettings?.runninghub || TASK_QUEUE_DEFAULTS.runninghub),
                  enabled: event.target.checked,
                },
              }))
            }
          />
          启用 RH 平台并发治理
        </label>
        <div className="field-note">
          RH 平台总并发不再手工填写，而是自动等于所有启用 RH Key 的最大并发之和。普通任务先受“类别总并发”限制，再受“单用户并发”限制。RunningHub 任务在此基础上，还会额外受 RH Key 池窗口限制；超过窗口的 RH 任务会自动排队等待。
        </div>
        <div className="field-note">
          系统状态里的“按类别并发”是后台配置值；“实际生效并发”统计 active 槽位，“Worker 数”统计 distinct workerId，“Worker 槽位数”统计当前上报的槽位总数，可用于识别“配置=100，实际只生效=1”这类问题。
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
      </FormPanel> : null}
    </>
  );
}
