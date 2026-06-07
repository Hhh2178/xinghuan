import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  adminNavItems,
  taskTone,
  statusText,
  titleFor,
} from "../apps/admin/src/admin-view-model.js";

const root = process.cwd();
const modulePath = join(root, "apps", "admin", "src", "admin-view-model.ts");
const mainSource = readFileSync(join(root, "apps", "admin", "src", "main.tsx"), "utf8");

const navIds = adminNavItems.map((item) => item.id).join(",");
const navLabels = adminNavItems.map((item) => item.label).join(",");

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
      navIds === "overview,users,providers,tasks,audit,system" &&
      navLabels === "总览,用户,API 设置,任务,审计,系统",
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
