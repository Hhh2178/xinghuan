import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const serverSource = readFileSync(join(root, "apps", "api", "src", "server.ts"), "utf8");
const mainSource = readFileSync(join(root, "apps", "admin", "src", "main.tsx"), "utf8");
const usersPanelSource = readFileSync(join(root, "apps", "admin", "src", "admin-users-panel.tsx"), "utf8");
const permissionsPanelSource = readFileSync(join(root, "apps", "admin", "src", "admin-permissions-panel.tsx"), "utf8");
const accountsSectionPath = join(root, "apps", "admin", "src", "admin-user-accounts-section.tsx");
const groupsSectionPath = join(root, "apps", "admin", "src", "admin-user-groups-section.tsx");
const sessionsSectionPath = join(root, "apps", "admin", "src", "admin-user-sessions-section.tsx");
const permissionsGroupRailPath = join(root, "apps", "admin", "src", "admin-permissions-group-rail.tsx");
const permissionsSummaryStripPath = join(root, "apps", "admin", "src", "admin-permissions-summary-strip.tsx");
const permissionsSavebarPath = join(root, "apps", "admin", "src", "admin-permissions-savebar.tsx");
const accountsSectionSource = existsSync(accountsSectionPath) ? readFileSync(accountsSectionPath, "utf8") : "";
const groupsSectionSource = existsSync(groupsSectionPath) ? readFileSync(groupsSectionPath, "utf8") : "";
const sessionsSectionSource = existsSync(sessionsSectionPath) ? readFileSync(sessionsSectionPath, "utf8") : "";
const permissionsGroupRailSource = existsSync(permissionsGroupRailPath) ? readFileSync(permissionsGroupRailPath, "utf8") : "";
const permissionsSummaryStripSource = existsSync(permissionsSummaryStripPath) ? readFileSync(permissionsSummaryStripPath, "utf8") : "";
const permissionsSavebarSource = existsSync(permissionsSavebarPath) ? readFileSync(permissionsSavebarPath, "utf8") : "";
const publicResourcesPanelPath = join(root, "apps", "admin", "src", "admin-public-resources-panel.tsx");
const publicResourceCardPath = join(root, "apps", "admin", "src", "admin-public-resource-card.tsx");
const publicResourceSidebarPath = join(root, "apps", "admin", "src", "admin-public-resource-category-sidebar.tsx");
const mediaPreviewModalPath = join(root, "apps", "admin", "src", "admin-media-preview-modal.tsx");
const publicResourcesPanelSource = existsSync(publicResourcesPanelPath) ? readFileSync(publicResourcesPanelPath, "utf8") : "";
const publicResourceCardSource = existsSync(publicResourceCardPath) ? readFileSync(publicResourceCardPath, "utf8") : "";
const publicResourceSidebarSource = existsSync(publicResourceSidebarPath) ? readFileSync(publicResourceSidebarPath, "utf8") : "";
const mediaPreviewModalSource = existsSync(mediaPreviewModalPath) ? readFileSync(mediaPreviewModalPath, "utf8") : "";

const checks = [
  {
    name: "user group create route no longer derives ids from slugged name or request body id",
    pass:
      !serverSource.includes("safeSlug(body.id || name") &&
      !serverSource.includes("safeSlug(body.id ?? name"),
  },
  {
    name: "user group create route uses stable generated group timestamp random ids",
    pass:
      serverSource.includes("group-") &&
      serverSource.includes("系统生成的用户组 ID 冲突，请重试。"),
  },
  {
    name: "main mutate supports suppressing page global errors",
    pass:
      mainSource.includes("suppressGlobalError") &&
      mainSource.includes("setError(shouldSetGlobalError ?"),
  },
  {
    name: "main keeps global error banner rendering for system failures",
    pass: mainSource.includes('{error ? <div className="error-banner">{error}</div> : null}'),
  },
  {
    name: "users panel shell imports extracted workspace sections",
    pass:
      usersPanelSource.includes('from "./admin-user-accounts-section"') &&
      usersPanelSource.includes('from "./admin-user-groups-section"') &&
      usersPanelSource.includes('from "./admin-user-sessions-section"'),
  },
  {
    name: "users panel shell routes tabs to extracted workspace sections",
    pass:
      usersPanelSource.includes("<AdminUserAccountsSection") &&
      usersPanelSource.includes("<AdminUserGroupsSection") &&
      usersPanelSource.includes("<AdminUserSessionsSection"),
  },
  {
    name: "users panel shell no longer carries extracted workspace marker baggage",
    pass:
      !usersPanelSource.includes("USERS_PANEL_CONTRACT_MARKERS") &&
      !usersPanelSource.includes('title="新增成员"') &&
      !usersPanelSource.includes('title="新建用户组"') &&
      !usersPanelSource.includes('title="活跃会话"'),
  },
  {
    name: "accounts section module exists and owns the create user workspace",
    pass:
      existsSync(accountsSectionPath) &&
      accountsSectionSource.includes('title="新增成员"') &&
      accountsSectionSource.includes('title="账号列表"') &&
      accountsSectionSource.includes('mutate("/api/admin/users", form)'),
  },
  {
    name: "groups section module exists and keeps group form errors local",
    pass:
      existsSync(groupsSectionPath) &&
      groupsSectionSource.includes("groupFormError") &&
      groupsSectionSource.includes("suppressGlobalError: true") &&
      groupsSectionSource.includes("创建分组") &&
      groupsSectionSource.includes("form-error"),
  },
  {
    name: "groups section keeps search and card workbench UI",
    pass:
      groupsSectionSource.includes("分组概览") &&
      groupsSectionSource.includes("搜索分组") &&
      groupsSectionSource.includes("user-group-card") &&
      groupsSectionSource.includes("users-group-workbench"),
  },
  {
    name: "sessions section module exists and owns the session table workspace",
    pass:
      existsSync(sessionsSectionPath) &&
      sessionsSectionSource.includes("当前会话") &&
      sessionsSectionSource.includes('title="活跃会话"') &&
      (
        sessionsSectionSource.includes('"/api/admin/sessions/${session.id}/revoke"') ||
        sessionsSectionSource.includes("`/api/admin/sessions/${session.id}/revoke`")
      ),
  },
  {
    name: "permissions panel shell imports extracted workspace seams",
    pass:
      permissionsPanelSource.includes('from "./admin-permissions-group-rail"') &&
      permissionsPanelSource.includes('from "./admin-permissions-summary-strip"') &&
      permissionsPanelSource.includes('from "./admin-permissions-savebar"'),
  },
  {
    name: "permissions panel shell renders extracted workspace seams",
    pass:
      permissionsPanelSource.includes("<AdminPermissionsGroupRail") &&
      permissionsPanelSource.includes("<AdminPermissionsSummaryStrip") &&
      permissionsPanelSource.includes("<AdminPermissionsSavebar"),
  },
  {
    name: "permissions panel shell no longer inlines extracted workspace blocks",
    pass:
      !permissionsPanelSource.includes('<section className="data-panel permissions-groups-panel">') &&
      !permissionsPanelSource.includes('<div className="permissions-summary-grid">') &&
      !permissionsPanelSource.includes('<div className="permissions-savebar">'),
  },
  {
    name: "permissions group rail module exists and owns the group selector workspace",
    pass:
      existsSync(permissionsGroupRailPath) &&
      permissionsGroupRailSource.includes("权限分组") &&
      permissionsGroupRailSource.includes("搜索分组") &&
      permissionsGroupRailSource.includes("permissions-group-list") &&
      permissionsGroupRailSource.includes("permissions-group-card"),
  },
  {
    name: "permissions summary strip module exists and owns the current group kpi row",
    pass:
      existsSync(permissionsSummaryStripPath) &&
      permissionsSummaryStripSource.includes("permissions-summary-grid") &&
      permissionsSummaryStripSource.includes("当前分组") &&
      permissionsSummaryStripSource.includes("已限制 RH 工作流") &&
      permissionsSummaryStripSource.includes("PermissionSummaryCard"),
  },
  {
    name: "permissions savebar module exists and owns the sticky action footer",
    pass:
      existsSync(permissionsSavebarPath) &&
      permissionsSavebarSource.includes("permissions-savebar") &&
      permissionsSavebarSource.includes("放弃修改") &&
      permissionsSavebarSource.includes("保存权限") &&
      permissionsSavebarSource.includes("最近更新"),
  },
  {
    name: "public resources panel shell imports extracted category sidebar, card, and preview modal seams",
    pass:
      publicResourcesPanelSource.includes('from "./admin-public-resource-category-sidebar"') &&
      publicResourcesPanelSource.includes('from "./admin-public-resource-card"') &&
      publicResourcesPanelSource.includes('from "./admin-media-preview-modal"'),
  },
  {
    name: "public resources panel shell renders extracted seams and adaptive grid workspace",
    pass:
      publicResourcesPanelSource.includes("<AdminPublicResourceCategorySidebar") &&
      publicResourcesPanelSource.includes("<AdminPublicResourceCard") &&
      publicResourcesPanelSource.includes("<AdminMediaPreviewModal") &&
      publicResourcesPanelSource.includes("admin-public-resources-grid"),
  },
  {
    name: "public resources panel shell no longer inlines row layout blocks",
    pass:
      !publicResourcesPanelSource.includes("admin-public-resource-row") &&
      !publicResourcesPanelSource.includes("admin-public-resource-row__fields") &&
      !publicResourcesPanelSource.includes("admin-public-resource-row__preview"),
  },
  {
    name: "public resource category sidebar module exists and owns category rail actions",
    pass:
      existsSync(publicResourceSidebarPath) &&
      publicResourceSidebarSource.includes("admin-public-resources-sidebar") &&
      publicResourceSidebarSource.includes("admin-public-resources-category-list") &&
      publicResourceSidebarSource.includes("全部资源") &&
      publicResourceSidebarSource.includes("删除"),
  },
  {
    name: "public resource card module exists and owns preview and management split",
    pass:
      existsSync(publicResourceCardPath) &&
      publicResourceCardSource.includes("admin-public-resource-card__preview-frame") &&
      publicResourceCardSource.includes("admin-public-resource-card__management") &&
      publicResourceCardSource.includes("查看原图") &&
      publicResourceCardSource.includes("完整预览") &&
      publicResourceCardSource.includes("试听"),
  },
  {
    name: "media preview modal module exists and keeps contain based preview stage",
    pass:
      existsSync(mediaPreviewModalPath) &&
      mediaPreviewModalSource.includes("admin-media-preview-modal__stage") &&
      mediaPreviewModalSource.includes("aria-modal") &&
      mediaPreviewModalSource.includes("preload=\"metadata\""),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length) {
  console.error("Admin governance redesign contract verification failed:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
