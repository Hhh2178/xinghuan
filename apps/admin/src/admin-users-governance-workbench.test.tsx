import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { UsersPanel } from "./admin-users-panel";
import { PermissionPlatformPanel } from "./permission-platform/panel";

const permissionSource = readFileSync(new URL("./permission-platform/panel.tsx", import.meta.url), "utf8");

const baseProps = {
  users: [],
  userGroups: [],
  sessions: [],
  mutate: () => undefined,
};

function renderUsersView(activeView: "overview" | "accounts" | "groups" | "permissions" | "sessions") {
  return renderToStaticMarkup(
    <UsersPanel
      {...baseProps}
      activeView={activeView}
      showLocalNavigation={false}
    />,
  );
}

function expectOneGovernanceTemplate(markup: string) {
  expect([...markup.matchAll(/data-admin-template="governance"/g)]).toHaveLength(1);
  expect(markup).toContain('data-governance-mode="governance"');
  expect(markup).not.toContain("<h1");
}

describe("Admin organization and security governance workbenches", () => {
  it.each([
    ["overview", "组织治理", "组织与治理总览"],
    ["accounts", "组织治理", "新增成员"],
    ["groups", "组织治理", "新建用户组"],
    ["permissions", "权限安全治理", "正在加载统一权限平台"],
    ["sessions", "组织治理", "活跃会话"],
  ] as const)("renders %s inside one governance template", (activeView, context, content) => {
    const markup = renderUsersView(activeView);

    expectOneGovernanceTemplate(markup);
    expect(markup).toContain(context);
    expect(markup).toContain(content);
  });

  it("retains the five overview navigation actions", () => {
    const markup = renderUsersView("overview");

    for (const label of ["账号管理", "用户组管理", "权限策略", "会话管理", "审计与用量"]) {
      expect(markup).toContain(label);
    }
    expect([...markup.matchAll(/class="users-governance-quick-card"/g)]).toHaveLength(5);
  });

  it("keeps permission readiness and matrix controls in the permission owner", () => {
    const markup = renderToStaticMarkup(<PermissionPlatformPanel users={[]} userGroups={[]} />);

    expect(markup).toContain("运行模式");
    expect(markup).toContain("就绪状态");
    expect(markup).toContain("授权主体类型");
    expect(markup).toContain("变更原因");
    expect(markup).toContain("权限域");
    expect(markup).toContain("搜索名称或 ID");
    expect(permissionSource).toContain("effectiveDecisions");
    expect(permissionSource).toContain("permission-platform__load-more");
    expect(permissionSource).toContain("permissionPlatformApi.explain");
    expect(permissionSource).toContain("permissionPlatformApi.upsertRule");
    expect(permissionSource).toContain("permissionPlatformApi.deleteRule(direct.id, direct.revision");
    expect(permissionSource).toContain("reason.trim()");
    expect(permissionSource).toContain("<AdminGovernanceLayout");
  });
});
