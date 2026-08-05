import { readFile } from "node:fs/promises";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const token = process.argv[index];
  if (!token?.startsWith("--")) continue;
  const [key, inlineValue] = token.slice(2).split("=", 2);
  args.set(key, inlineValue ?? process.argv[++index] ?? "");
}

const stage = String(args.get("stage") || "").toUpperCase();
const release = String(args.get("release") || "");
const baseUrl = String(args.get("base-url") || process.env.XINGHUAN_OLD_GRAY_BASE_URL || "");
const reportPath = String(args.get("report") || process.env.READ_PERF_OUTPUT || "");
const validationPath = String(args.get("validation") || "");

if (!/^[A-F]$/.test(stage)) fail("stage 必须是 A-F");
if (!release || /production|prod\./i.test(release)) fail("release 必须是 Gray artifact ID");
if (!baseUrl) fail("缺少 --base-url 或 XINGHUAN_OLD_GRAY_BASE_URL");
const parsed = new URL(baseUrl);
if (isProductionUrl(parsed)) fail("拒绝使用 Production URL");
if (!reportPath) fail("缺少 --report 或 READ_PERF_OUTPUT");

const report = JSON.parse(await readFile(reportPath, "utf8"));
const rows = Array.isArray(report.rows) ? report.rows : [];
const issues = [];
if (!report.readOnly) issues.push("report 未标记为 readOnly");
if (!rows.length) issues.push("report 没有聚合行");
if (rows.some((row) => Number(row.duplicateCount || 0) > 0)) issues.push("存在重复请求");
if (rows.some((row) => !Number.isFinite(Number(row.durationMs?.p95)))) issues.push("存在缺失 P95");
if (validationPath) {
  const validation = JSON.parse(await readFile(validationPath, "utf8"));
  if (validation.stage && String(validation.stage).toUpperCase() !== stage) issues.push("validation stage 不匹配");
  if (validation.release && validation.release !== release) issues.push("validation release 不匹配");
  if (validation.status && validation.status !== "PASS") issues.push(`validation 状态为 ${validation.status}`);
}

const status = issues.length ? (issues.some((issue) => /权限|Production|release|响应|重复/.test(issue)) ? "ROLLBACK_REQUIRED" : "HOLD") : "PASS";
console.log(JSON.stringify({ status, stage, release, baseUrl: `${parsed.protocol}//${parsed.host}`, issues, checkedRows: rows.length }, null, 2));
if (status !== "PASS") process.exitCode = 1;

function isProductionUrl(url) {
  const hostname = url.hostname.toLowerCase();
  return hostname.includes("production") || hostname.includes("prod.") || hostname === "xinghuan.hhh2121.xyz";
}

function fail(message) {
  console.error(JSON.stringify({ status: "HOLD", error: message }));
  process.exit(1);
}
