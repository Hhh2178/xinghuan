import { StatusPill } from "./admin-common-components";

function PermissionSummaryCard({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string | number;
  tone?: "success" | "warning" | "danger" | "muted";
}) {
  return (
    <div className="permission-summary-card">
      <span>{label}</span>
      <StatusPill tone={tone}>{String(value)}</StatusPill>
    </div>
  );
}

export function AdminPermissionsSummaryStrip({
  groupName,
  memberCount,
  deniedSharedResources,
  deniedRunningHubApps,
  deniedRunningHubWorkflows,
  deniedNodeTypes,
}: {
  groupName: string;
  memberCount: number;
  deniedSharedResources: number;
  deniedRunningHubApps: number;
  deniedRunningHubWorkflows: number;
  deniedNodeTypes: number;
}) {
  return (
    <div className="permissions-summary-grid permissions-summary-grid--starlight">
      <PermissionSummaryCard label="当前分组" value={groupName} tone="success" />
      <PermissionSummaryCard label="成员数量" value={memberCount} />
      <PermissionSummaryCard
        label="已限制公共资源"
        value={deniedSharedResources}
        tone={deniedSharedResources ? "warning" : "muted"}
      />
      <PermissionSummaryCard
        label="已限制 RH 应用"
        value={deniedRunningHubApps}
        tone={deniedRunningHubApps ? "warning" : "muted"}
      />
      <PermissionSummaryCard
        label="已限制 RH 工作流"
        value={deniedRunningHubWorkflows}
        tone={deniedRunningHubWorkflows ? "warning" : "muted"}
      />
      <PermissionSummaryCard
        label="已限制节点"
        value={deniedNodeTypes}
        tone={deniedNodeTypes ? "warning" : "muted"}
      />
    </div>
  );
}
