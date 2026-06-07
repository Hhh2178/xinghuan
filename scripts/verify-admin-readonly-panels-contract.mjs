import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const modulePath = join(root, "apps", "admin", "src", "admin-readonly-panels.tsx");
const mainSource = readFileSync(join(root, "apps", "admin", "src", "main.tsx"), "utf8");
const panelSource = existsSync(modulePath) ? readFileSync(modulePath, "utf8") : "";

const requiredSystemRows = [
  "环境",
  "服务",
  "版本",
  "存储驱动",
  "数据库状态",
  "数据库迁移",
  "数据库错误",
  "Redis 状态",
  "Redis 队列",
  "Redis 深度",
  "Redis 错误",
  "数据目录",
  "认证数据",
  "后台数据",
  "画布数量",
  "资源数量",
];

const checks = [
  {
    name: "admin readonly panels module exists",
    pass: existsSync(modulePath),
  },
  {
    name: "main imports readonly panels",
    pass: mainSource.includes('from "./admin-readonly-panels"') || mainSource.includes('from "./admin-readonly-panels.js"'),
  },
  {
    name: "main no longer inlines readonly panels",
    pass: !/function\s+AuditPanel\s*\(/.test(mainSource) && !/function\s+SystemPanel\s*\(/.test(mainSource),
  },
  {
    name: "module exports AuditPanel and SystemPanel",
    pass: /export\s+function\s+AuditPanel\s*\(/.test(panelSource) && /export\s+function\s+SystemPanel\s*\(/.test(panelSource),
  },
  {
    name: "audit panel preserves title and columns",
    pass:
      panelSource.includes('title="审计日志"') &&
      panelSource.includes('columns={["时间", "操作者", "动作", "对象", "说明"]}') &&
      panelSource.includes("`${item.targetType}:${item.targetId}`"),
  },
  {
    name: "system panel preserves title, columns and row labels",
    pass:
      panelSource.includes('title="系统状态"') &&
      panelSource.includes('columns={["项目", "值"]}') &&
      requiredSystemRows.every((label) => panelSource.includes(`"${label}"`)),
  },
  {
    name: "readonly panels use shared DataTable",
    pass: panelSource.includes('from "./admin-common-components"') && panelSource.includes("<DataTable"),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length) {
  console.error("Admin readonly panels contract verification failed:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
