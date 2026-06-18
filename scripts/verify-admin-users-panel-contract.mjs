import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const modulePath = join(root, "apps", "admin", "src", "admin-users-panel.tsx");
const mainSource = readFileSync(join(root, "apps", "admin", "src", "main.tsx"), "utf8");
const panelSource = existsSync(modulePath) ? readFileSync(modulePath, "utf8") : "";

const requiredColumns = ["邮箱", "名称", "角色", "状态", "重置密码", "操作"];

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
      panelSource.includes('title="新增成员"') &&
      panelSource.includes('placeholder="邮箱"') &&
      panelSource.includes('placeholder="名称"') &&
      panelSource.includes('placeholder="分组名称"') &&
      panelSource.includes('placeholder="账号备注"') &&
      panelSource.includes('<option value="member">成员</option>') &&
      panelSource.includes('<option value="admin">管理员</option>') &&
      panelSource.includes('placeholder="初始密码"') &&
      panelSource.includes('mutate("/api/admin/users", form)') &&
      panelSource.includes("创建用户"),
  },
  {
    name: "users panel preserves user group controls",
    pass:
      panelSource.includes("用户组管理") &&
      panelSource.includes("所属组") &&
      panelSource.includes("备注") &&
      panelSource.includes("删除账号") &&
      panelSource.includes('"/api/admin/user-groups"') &&
      panelSource.includes("`/api/admin/users/${user.id}`"),
  },
  {
    name: "users panel preserves user table title and columns",
    pass:
      panelSource.includes('title="用户与权限"') &&
      requiredColumns.every((column) => panelSource.includes(`<th>${column}</th>`)),
  },
  {
    name: "users panel preserves role and status rendering",
    pass:
      panelSource.includes('user.role === "admin" ? "管理员" : "成员"') &&
      panelSource.includes('tone={user.disabled ? "danger" : "success"}') &&
      panelSource.includes('user.disabled ? "禁用" : "启用"'),
  },
  {
    name: "users panel preserves password reset flow",
    pass:
      panelSource.includes('placeholder="新密码"') &&
      panelSource.includes('if (!password) return;') &&
      panelSource.includes('mutate(`/api/admin/users/${user.id}`, { password }, "PATCH")') &&
      panelSource.includes('setPasswords({ ...passwords, [user.id]: "" })') &&
      panelSource.includes("重置"),
  },
  {
    name: "users panel preserves enable disable flow",
    pass:
      panelSource.includes('mutate(`/api/admin/users/${user.id}`, { disabled: !user.disabled }, "PATCH")') &&
      panelSource.includes('{user.disabled ? "启用" : "禁用"}'),
  },
  {
    name: "users panel uses shared admin components",
    pass:
      panelSource.includes('from "./admin-common-components"') &&
      panelSource.includes("<FormPanel") &&
      panelSource.includes("<AdminTable") &&
      panelSource.includes("<StatusPill"),
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
