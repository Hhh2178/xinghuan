import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const modulePath = join(root, "apps", "admin", "src", "admin-task-panel.tsx");
const mainSource = readFileSync(join(root, "apps", "admin", "src", "main.tsx"), "utf8");
const panelSource = existsSync(modulePath) ? readFileSync(modulePath, "utf8") : "";

const requiredColumns = ["任务", "状态", "最终状态时间", "Provider", "模型", "日志", "操作"];

const checks = [
  {
    name: "admin task panel module exists",
    pass: existsSync(modulePath),
  },
  {
    name: "main imports task panel",
    pass: mainSource.includes('from "./admin-task-panel"') || mainSource.includes('from "./admin-task-panel.js"') || mainSource.includes('import("./admin-task-panel")'),
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
      panelSource.includes('title="创建任务"') &&
      panelSource.includes("任务标题") &&
      panelSource.includes('mutate("/api/admin/tasks", { title, status: "queued" })') &&
      panelSource.includes("创建任务"),
  },
  {
    name: "task panel preserves task table title and columns",
    pass:
      panelSource.includes('title="任务监控"') &&
      panelSource.includes("<th>发起账号</th>") &&
      requiredColumns.every((column) => panelSource.includes(`<th>${column}</th>`)),
  },
  {
    name: "task panel keeps compact owner display",
    pass:
      panelSource.includes("task.ownerRemark") &&
      panelSource.includes("task.ownerName") &&
      panelSource.includes("task.ownerEmail") &&
      panelSource.includes("已删除账号"),
  },
  {
    name: "task panel preserves status helpers and shared status pill",
    pass:
      panelSource.includes('from "./admin-view-model"') &&
      (panelSource.includes("taskTone(task.status)") || panelSource.includes("taskDisplayTone(task)")) &&
      (panelSource.includes("statusText(task.status)") || panelSource.includes("taskStatusText(task)")) &&
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
    name: "task panel shows complete logs without a duplicate updated-at column",
    pass:
      panelSource.includes('logs.join("\\n")') &&
      panelSource.includes('className="task-monitor-log"') &&
      !panelSource.includes("<th>更新时间</th>") &&
      !panelSource.includes("new Date(task.updatedAt).toLocaleString()"),
  },
  {
    name: "task panel shows the bounded history window and final status timestamp",
    pass:
      panelSource.includes("仅显示最近 2,000 条任务记录") &&
      panelSource.includes("task.finalizedAt") &&
      panelSource.includes('title={task.title}'),
  },
  {
    name: "task panel presents human Provider and model identities before raw ids",
    pass:
      panelSource.includes("task.providerName") &&
      panelSource.includes("task.modelName") &&
      panelSource.includes("task.providerModelId") &&
      panelSource.includes("providerOption.label") &&
      panelSource.includes("providerOption.value"),
  },
  {
    name: "task panel uses shared admin components",
    pass:
      panelSource.includes('from "./admin-common-components"') &&
      panelSource.includes('from "./admin-data-workbench"') &&
      panelSource.includes('mode="realtime"') &&
      panelSource.includes('label="当前页任务摘要"') &&
      panelSource.includes('colSpan={8}') &&
      panelSource.includes("当前筛选暂无任务") &&
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
