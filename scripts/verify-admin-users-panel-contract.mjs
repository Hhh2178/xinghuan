import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const modulePath = join(root, "apps", "admin", "src", "admin-users-panel.tsx");
const accountsSectionPath = join(root, "apps", "admin", "src", "admin-user-accounts-section.tsx");
const groupsSectionPath = join(root, "apps", "admin", "src", "admin-user-groups-section.tsx");
const sessionsSectionPath = join(root, "apps", "admin", "src", "admin-user-sessions-section.tsx");
const mainSource = readFileSync(join(root, "apps", "admin", "src", "main.tsx"), "utf8");
const panelSource = existsSync(modulePath) ? readFileSync(modulePath, "utf8") : "";
const accountsSectionSource = existsSync(accountsSectionPath) ? readFileSync(accountsSectionPath, "utf8") : "";
const groupsSectionSource = existsSync(groupsSectionPath) ? readFileSync(groupsSectionPath, "utf8") : "";
const sessionsSectionSource = existsSync(sessionsSectionPath) ? readFileSync(sessionsSectionPath, "utf8") : "";

const checks = [
  {
    name: "admin users panel module exists",
    pass: existsSync(modulePath),
  },
  {
    name: "main imports users panel",
    pass: mainSource.includes('from "./admin-users-panel"') || mainSource.includes('from "./admin-users-panel.js"'),
  },
  {
    name: "main no longer inlines UsersPanel",
    pass: !/function\s+UsersPanel\s*\(/.test(mainSource),
  },
  {
    name: "main exports AdminUser for users panel typing",
    pass: /export\s+interface\s+AdminUser\s+extends\s+AuthUser\s*\{/.test(mainSource),
  },
  {
    name: "module exports UsersPanel",
    pass: /export\s+function\s+UsersPanel\s*\(/.test(panelSource),
  },
  {
    name: "users panel preserves create user form",
    pass:
      existsSync(accountsSectionPath) &&
      accountsSectionSource.includes('title="新增成员"') &&
      accountsSectionSource.includes("users-accounts-workbench--starlight") &&
      accountsSectionSource.includes("users-accounts-summary") &&
      accountsSectionSource.includes("users-accounts-table-panel") &&
      accountsSectionSource.includes('placeholder="邮箱"') &&
      accountsSectionSource.includes('placeholder="名称"') &&
      accountsSectionSource.includes('placeholder="账号备注"') &&
      accountsSectionSource.includes('<option value="member">成员</option>') &&
      accountsSectionSource.includes('<option value="admin">管理员</option>') &&
      accountsSectionSource.includes('placeholder="初始密码"') &&
      accountsSectionSource.includes('mutate("/api/admin/users", form)') &&
      accountsSectionSource.includes("创建用户"),
  },
  {
    name: "users panel preserves user group controls",
    pass:
      panelSource.includes('label: "用户组"') &&
      existsSync(groupsSectionPath) &&
      groupsSectionSource.includes('title="新建用户组"') &&
      groupsSectionSource.includes("分组概览") &&
      groupsSectionSource.includes('"/api/admin/user-groups"'),
  },
  {
    name: "users panel preserves account workbench title and single-column layout",
    pass:
      accountsSectionSource.includes('title="账号列表"') &&
      accountsSectionSource.includes("<th>账号工作台</th>") &&
      accountsSectionSource.includes("users-account-record") &&
      accountsSectionSource.includes("users-account-record__identity") &&
      accountsSectionSource.includes("users-account-record__grid") &&
      accountsSectionSource.includes("<span>所属组</span>") &&
      accountsSectionSource.includes("<span>备注</span>") &&
      accountsSectionSource.includes("<span>当前密码</span>") &&
      accountsSectionSource.includes("<span>重置密码</span>"),
  },
  {
    name: "users accounts workspace uses governance workbench hooks",
    pass:
      accountsSectionSource.includes("users-account-card") &&
      accountsSectionSource.includes("users-accounts-create-rail") &&
      accountsSectionSource.includes("users-account-table-toolbar"),
  },
  {
    name: "users panel preserves role and status rendering",
    pass:
      accountsSectionSource.includes('user.role === "admin" ? "管理员" : "成员"') &&
      accountsSectionSource.includes('tone={user.disabled ? "danger" : "success"}') &&
      accountsSectionSource.includes('user.disabled ? "禁用" : "启用"'),
  },
  {
    name: "users panel preserves password reset flow",
    pass:
      accountsSectionSource.includes('placeholder="新密码"') &&
      accountsSectionSource.includes('if (!password) return;') &&
      accountsSectionSource.includes('mutate(`/api/admin/users/${user.id}`, { password }, "PATCH")') &&
      accountsSectionSource.includes('setPasswords({ ...passwords, [user.id]: "" })') &&
      accountsSectionSource.includes("重置"),
  },
  {
    name: "users panel preserves enable disable flow",
    pass:
      accountsSectionSource.includes('mutate(`/api/admin/users/${user.id}`, { disabled: !user.disabled }, "PATCH")') &&
      accountsSectionSource.includes('{user.disabled ? "启用账号" : "禁用账号"}'),
  },
  {
    name: "users panel uses shared admin components",
    pass:
      accountsSectionSource.includes('from "./admin-common-components"') &&
      groupsSectionSource.includes('from "./admin-common-components"') &&
      sessionsSectionSource.includes('from "./admin-common-components"') &&
      accountsSectionSource.includes("<FormPanel") &&
      accountsSectionSource.includes("<AdminTable") &&
      sessionsSectionSource.includes("<StatusPill"),
  },
  {
    name: "sessions workspace uses governance workbench hooks",
    pass:
      sessionsSectionSource.includes("users-sessions-workbench--starlight") &&
      sessionsSectionSource.includes("users-sessions-summary") &&
      sessionsSectionSource.includes("users-session-table-toolbar") &&
      sessionsSectionSource.includes('title="活跃会话"'),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length) {
  console.error("Admin users panel contract verification failed:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
