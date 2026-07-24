import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  adminWorkspaces,
  adminNavItems,
  taskTone,
  statusText,
  titleFor,
  capabilityLabel,
  pathForRhView,
  pathForAnalyticsView,
  pathForCapabilitiesView,
  pathForAgentRuntimeView,
  pathForSystemView,
  pathForUsersView,
  pathForWorkspaceTab,
  resolveAdminPath,
} from "../apps/admin/src/admin-view-model.js";

const root = process.cwd();
const modulePath = join(root, "apps", "admin", "src", "admin-view-model.ts");
const mainSource = readFileSync(join(root, "apps", "admin", "src", "main.tsx"), "utf8");

const navIds = adminNavItems.map((item) => item.id).join(",");
const navLabels = adminNavItems.map((item) => item.label).join(",");
const workspaceIds = adminWorkspaces.map((item) => item.id).join(",");
const workspaceLabels = adminWorkspaces.map((item) => item.label).join(",");

const checks = [
  {
    name: "admin view model module exists",
    pass: existsSync(modulePath),
  },
  {
    name: "main imports admin view model helpers",
    pass: mainSource.includes('from "./admin-view-model"') || mainSource.includes('from "./admin-view-model.js"'),
  },
  {
    name: "main does not inline nav/status helpers",
    pass:
      !/const\s+navItems\s*:/.test(mainSource) &&
      !/function\s+titleFor\s*\(/.test(mainSource) &&
      !/function\s+statusText\s*\(/.test(mainSource) &&
      !/function\s+taskTone\s*\(/.test(mainSource),
  },
  {
    name: "navigation order and labels stay stable",
    pass:
      navIds === "overview,users,providers,runninghub-workspace,comfyui,public-resources,assistant,agent-runtime,announcement,tasks,audit,system,environment-sync" &&
      navLabels === "总览,用户,API 设置,RH 工作台,ComfyUI,公共资源,AI 助手,智能体治理,公告,任务,审计,系统,环境同步",
  },
  {
    name: "twelve admin domains stay explicit and ordered",
    pass:
      workspaceIds === "overview,organization,security,capabilities,automation,rh,comfyui,resources,content,runtime,analytics,system" &&
      workspaceLabels === "运营总览,账号与组织,权限与安全,Provider 与模型,智能体与自动化,RH 管理,ComfyUI 管理,公共资源,内容发布,任务与运行,数据分析与审计,系统与发布",
  },
  {
    name: "admin paths resolve to domain and legacy page adapters",
    pass:
      pathForWorkspaceTab("rh", "runninghub-workspace") === "/admin/rh" &&
      pathForRhView("workflows") === "/admin/rh/workflows" &&
      resolveAdminPath("/admin/rh/apps").rhView === "apps" &&
      resolveAdminPath("/admin/rh/keys").rhView === "keys" &&
      pathForCapabilitiesView("models") === "/admin/capabilities/models" &&
      resolveAdminPath("/admin/capabilities/models").capabilitiesView === "models" &&
      pathForAgentRuntimeView("assistants") === "/admin/automation/assistants" &&
      pathForAgentRuntimeView("supervision") === "/admin/automation/supervision" &&
      pathForAgentRuntimeView("activity") === "/admin/automation/activity" &&
      resolveAdminPath("/admin/automation/assistants").agentRuntimeView === "assistants" &&
      resolveAdminPath("/admin/automation/supervision").agentRuntimeView === "supervision" &&
      resolveAdminPath("/admin/automation/approvals").agentRuntimeView === "activity" &&
      resolveAdminPath("/admin/automation/knowledge").agentRuntimeView === "supervision" &&
      resolveAdminPath("/admin/capabilities/admin-assistant").workspaceId === "automation" &&
      resolveAdminPath("/admin/capabilities/admin-assistant").agentRuntimeView === "assistants" &&
      pathForAnalyticsView("audit") === "/admin/analytics/audit" &&
      resolveAdminPath("/admin/analytics/audit").analyticsView === "audit" &&
      pathForAnalyticsView("reliability") === "/admin/analytics/reliability" &&
      resolveAdminPath("/admin/analytics/reliability").analyticsView === "reliability" &&
      pathForSystemView("runtime-settings") === "/admin/system/runtime-settings" &&
      resolveAdminPath("/admin/system/runtime-settings").systemView === "runtime-settings" &&
      resolveAdminPath("/admin/comfyui/instances/demo/workflows").comfyuiDetailTab === "workflows" &&
      pathForWorkspaceTab("comfyui", "comfyui") === "/admin/comfyui" &&
      pathForWorkspaceTab("resources", "public-resources") === "/admin/resources" &&
      resolveAdminPath("/admin/resources").workspaceId === "resources" &&
      resolveAdminPath("/admin/content/public-resources").workspaceId === "resources" &&
      resolveAdminPath("/admin/security").workspaceId === "security" &&
      resolveAdminPath("/admin/security").tabId === "users" &&
      resolveAdminPath("/admin/security").usersView === "permissions" &&
      resolveAdminPath("/admin/organization/accounts").usersView === "accounts" &&
      pathForUsersView("sessions") === "/admin/organization/sessions" &&
      resolveAdminPath("/admin/system/environment-sync").tabId === "environment-sync",
  },
  {
    name: "Provider and model workspace no longer owns assistant governance",
    pass:
      adminWorkspaces.find((workspace) => workspace.id === "capabilities")?.tabs.join(",") === "providers" &&
      !mainSource.includes("AdminAssistantSettingsPanel"),
  },
  {
    name: "titleFor returns label and fallback",
    pass: titleFor("providers") === "API 设置" && titleFor("unknown") === "总览",
  },
  {
    name: "statusText maps all task statuses",
    pass:
      statusText("queued") === "排队" &&
      statusText("running") === "运行中" &&
      statusText("succeeded") === "成功" &&
      statusText("failed") === "失败" &&
      statusText("cancelled") === "已取消",
  },
  {
    name: "taskTone maps statuses to existing pill tones",
    pass:
      taskTone("queued") === "muted" &&
      taskTone("running") === "warning" &&
      taskTone("succeeded") === "success" &&
      taskTone("failed") === "danger" &&
      taskTone("cancelled") === "danger",
  },
  {
    name: "capabilityLabel maps model capabilities",
    pass:
      capabilityLabel("image") === "生图" &&
      capabilityLabel("video") === "视频" &&
      capabilityLabel("chat") === "聊天",
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length) {
  console.error("Admin view model contract verification failed:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
