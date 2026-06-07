import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const modulePath = join(root, "apps", "admin", "src", "admin-task-panel.tsx");
const mainSource = readFileSync(join(root, "apps", "admin", "src", "main.tsx"), "utf8");
const panelSource = existsSync(modulePath) ? readFileSync(modulePath, "utf8") : "";

const requiredColumns = ["任务", "状态", "Provider", "模型", "日志", "更新时间", "操作"];

const checks = [
  {
    name: "admin task panel module exists",
    pass: existsSync(modulePath),
  },
  {
    name: "main imports task panel",
    pass: mainSource.includes('from "./admin-task-panel"') || mainSource.includes('from "./admin-task-panel.js"'),
  },
  {
    name: "main no longer inlines TasksPanel",
    pass: !/function\s+TasksPanel\s*\(/.test(mainSource),
  },
  {
    name: "main exports TaskRecord for task panel typing",
    pass: /export\s+interface\s+TaskRecord\s*\{/.test(mainSource),
  },
  {
    name: "module exports TasksPanel",
    pass: /export\s+function\s+TasksPanel\s*\(/.test(panelSource),
  },
  {
    name: "task panel preserves create task form",
    pass:
      panelSource.includes('title="创建测试任务"') &&
      panelSource.includes("任务标题") &&
      panelSource.includes('mutate("/api/admin/tasks", { title, status: "queued" })') &&
      panelSource.includes("创建任务"),
  },
  {
    name: "task panel preserves task table title and columns",
    pass:
      panelSource.includes('title="任务监控"') &&
      requiredColumns.every((column) => panelSource.includes(`<th>${column}</th>`)),
  },
  {
    name: "task panel preserves status helpers and shared status pill",
    pass:
      panelSource.includes('from "./admin-view-model"') &&
      panelSource.includes("taskTone(task.status)") &&
      panelSource.includes("statusText(task.status)") &&
      panelSource.includes("<StatusPill"),
  },
  {
    name: "task panel preserves cancel and retry actions",
    pass:
      panelSource.includes("canCancelTask(task.status)") &&
      panelSource.includes("canRetryTask(task.status)") &&
      panelSource.includes('{ action: "cancel" }, "PATCH"') &&
      panelSource.includes("`/api/admin/tasks/${task.id}/retry`") &&
      panelSource.includes("重试"),
  },
  {
    name: "task panel keeps recent log and timestamp formatting",
    pass:
      panelSource.includes('task.logs?.slice(-2).join(" / ") || "-"') &&
      panelSource.includes("new Date(task.updatedAt).toLocaleString()"),
  },
  {
    name: "task panel uses shared admin components",
    pass:
      panelSource.includes('from "./admin-common-components"') &&
      panelSource.includes("<FormPanel") &&
      panelSource.includes("<AdminTable"),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length) {
  console.error("Admin task panel contract verification failed:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
