import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const token = process.argv[index];
  if (!token?.startsWith("--")) continue;
  const [key, inlineValue] = token.slice(2).split("=", 2);
  args.set(key, inlineValue ?? process.argv[++index] ?? "");
}

const baseUrl = String(args.get("base-url") || process.env.XINGHUAN_GRAY_BASE_URL || "http://127.0.0.1:18200").replace(/\/$/, "");
const requestOrigin = new URL(baseUrl).origin;
const scenarioName = String(args.get("scenario") || "all");
const outputPath = resolve(String(args.get("output") || process.env.READ_PERF_OUTPUT || `output/performance/read-${Date.now()}.json`));
const fixturePath = resolve(String(args.get("fixture") || "scripts/fixtures/read-performance-scenarios.json"));
const email = process.env.XINGHUAN_VERIFY_EMAIL || process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL;
const password = process.env.XINGHUAN_VERIFY_PASSWORD || process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD;

if (isProductionUrl(baseUrl)) throw new Error("拒绝对 Production URL 执行只读性能测量");

const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const scenarios = scenarioName === "all"
  ? Object.entries(fixture).flatMap(([group, endpoints]) => endpoints.map((endpoint) => ({ ...endpoint, group })))
  : (fixture[scenarioName] || []).map((endpoint) => ({ ...endpoint, group: scenarioName }));
if (!scenarios.length) throw new Error(`未知或为空的场景: ${scenarioName}`);

let cookie = "";
if (email && password) await login();

const rows = [];
for (const scenario of scenarios) {
  const cold = [];
  const warm = [];
  for (let index = 0; index < 10; index += 1) cold.push(await sample(scenario, "cold"));
  for (let index = 0; index < 50; index += 1) warm.push(await sample(scenario, "warm"));
  rows.push(summarize(scenario, "cold", cold), summarize(scenario, "warm", warm));
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: redactUrl(baseUrl),
  scenario: scenarioName,
  readOnly: true,
  samples: { cold: 10, warm: 50 },
  rows,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ ok: true, output: outputPath, endpointCount: scenarios.length, rows: rows.length }, null, 2));

async function login() {
  const response = await fetch(`${baseUrl}/api/auth/admin-login`, {
    method: "POST",
    headers: { "content-type": "application/json", "cache-control": "no-store", origin: requestOrigin },
    body: JSON.stringify({ email, password }),
  });
  captureCookie(response);
  if (!response.ok) throw new Error(`admin login failed: ${response.status}`);
}

async function sample(scenario, phase) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${scenario.path}`, {
    headers: {
      ...(cookie ? { cookie } : {}),
      "cache-control": phase === "cold" ? "no-cache" : "no-store",
      "x-read-performance": "1",
    },
  });
  captureCookie(response);
  const body = await response.arrayBuffer();
  return {
    status: response.status,
    durationMs: Math.round((performance.now() - started) * 100) / 100,
    responseBytes: body.byteLength,
    requestCount: 1,
    duplicateCount: 0,
  };
}

function summarize(scenario, phase, samples) {
  const durations = samples.map((sample) => sample.durationMs).sort((a, b) => a - b);
  const bytes = samples.map((sample) => sample.responseBytes).sort((a, b) => a - b);
  const statuses = [...new Set(samples.map((sample) => sample.status))];
  return {
    endpoint: scenario.path,
    name: scenario.name,
    group: scenario.group,
    phase,
    status: statuses.length === 1 ? statuses[0] : statuses,
    durationMs: percentileSummary(durations),
    responseBytes: percentileSummary(bytes),
    requestCount: samples.reduce((sum, sample) => sum + sample.requestCount, 0),
    duplicateCount: samples.reduce((sum, sample) => sum + sample.duplicateCount, 0),
  };
}

function percentileSummary(values) {
  return {
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    p99: percentile(values, 0.99),
    min: values[0] ?? 0,
    max: values.at(-1) ?? 0,
  };
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  return values[Math.min(values.length - 1, Math.ceil(values.length * ratio) - 1)];
}

function captureCookie(response) {
  const getSetCookie = response.headers?.getSetCookie;
  const raw = typeof getSetCookie === "function"
    ? getSetCookie.call(response.headers)?.[0]
    : response.headers.get("set-cookie");
  if (raw) cookie = raw.split(";", 1)[0];
}

function isProductionUrl(value) {
  const hostname = new URL(value).hostname.toLowerCase();
  return hostname.includes("production") || hostname.includes("prod.") || hostname === "xinghuan.hhh2121.xyz";
}

function redactUrl(value) {
  const url = new URL(value);
  return `${url.protocol}//${url.host}`;
}
