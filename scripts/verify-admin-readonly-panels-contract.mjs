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
  "当前数据库",
  "目标数据库",
  "数据库目标校验",
  "数据库迁移",
  "数据库错误",
  "Redis 状态",
  "Redis 队列",
  "Redis 深度",
  "任务总数",
  "排队任务",
  "运行任务",
  "1h 失败任务",
  "24h 失败任务",
  "7d 失败任务",
  "30d 失败任务",
  "任务健康",
  "24h 失败 vs 7d 日均",
  "24h 失败 vs 30d 日均",
  "7d 日均 vs 30d 日均",
  "最近审计样本",
  "请求ID覆盖率",
  "请求ID健康",
  "近24h 请求ID覆盖率",
  "近7d 请求ID覆盖率",
  "24h 覆盖率 vs 最近样本",
  "24h 冲突总数",
  "7d 冲突总数",
  "30d 冲突总数",
  "画布 revision 冲突",
  "资源 revision 冲突",
  "后台设置冲突",
  "24h 冲突 vs 30d 日均",
  "冲突健康",
  "活动告警",
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
    pass: mainSource.includes('from "./admin-readonly-panels"') || mainSource.includes('from "./admin-readonly-panels.js"') || mainSource.includes('import("./admin-readonly-panels")'),
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
      panelSource.includes('columns={["时间", "操作者", "动作", "对象", "请求", "来源", "说明"]}') &&
      panelSource.includes("`${item.targetType}:${item.targetId}`"),
  },
  {
    name: "audit panel shows request and source context",
    pass:
      panelSource.includes("item.requestId") &&
      panelSource.includes("item.ip") &&
      panelSource.includes("item.userAgent"),
  },
  {
    name: "system panel preserves title, columns and row labels",
    pass:
      panelSource.includes('title="系统状态"') &&
      panelSource.includes('columns={["项目", "值"]}') &&
      requiredSystemRows.every((label) => panelSource.includes(`"${label}"`)),
  },
  {
    name: "system panel clarifies configured concurrency versus runtime effectiveness",
    pass:
      panelSource.includes("实际生效值") &&
      panelSource.includes("effectiveConcurrency") &&
      panelSource.includes("workerCount") &&
      panelSource.includes("slotCount") &&
      panelSource.includes("当前占用"),
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
