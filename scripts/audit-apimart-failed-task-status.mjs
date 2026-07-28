import { createDecipheriv, createHash } from "node:crypto";
import { createRequire } from "node:module";

const releaseRoot = process.env.XINGHUAN_RELEASE_ROOT || "/opt/apps/xinghuan-canvas-next/current";
const limit = clampInteger(process.env.XINGHUAN_AUDIT_LIMIT, 1, 200, 50);
const lookbackDays = clampInteger(process.env.XINGHUAN_AUDIT_LOOKBACK_DAYS, 1, 30, 7);
const require = createRequire(`${releaseRoot}/package.json`);
const { Client } = require("pg");
const { extractApimartVideoResult } = await import(`file://${releaseRoot}/apps/worker/dist/worker-apimart-video-adapter.js`);
const { openAiEndpoint } = await import(`file://${releaseRoot}/apps/worker/dist/worker-provider-utils.js`);
const databaseUrl = process.env.XINGHUAN_DATABASE_URL || process.env.DATABASE_URL || "";
if (!databaseUrl) throw new Error("DATABASE_NOT_CONFIGURED");

const client = new Client({ connectionString: databaseUrl });
await client.connect();
try {
  const result = await client.query(
    `select t.id,
            t.payload,
            t.result,
            p.base_url,
            p.api_key_cipher,
            m.advanced_config
       from xh_tasks t
       join xh_providers p on p.id = t.provider_id
       join xh_models m on m.id = t.model_id
      where t.status = 'failed'
        and p.protocol = 'apimart'
        and coalesce(t.result->>'upstreamTaskId', t.result->>'taskId', '') <> ''
        and t.created_at > now() - ($1::text || ' days')::interval
      order by t.created_at desc
      limit $2`,
    [lookbackDays, limit],
  );
  const audited = await mapConcurrent(result.rows, 4, inspectRow);
  const mismatches = audited.filter((item) => item.upstreamCompleted || item.videoCount > 0);
  const upstreamFailures = audited.filter((item) => item.upstreamFailed);
  const pollErrors = audited.filter((item) => item.pollError);
  console.log(JSON.stringify({
    ok: true,
    auditedCount: audited.length,
    mismatchCount: mismatches.length,
    upstreamFailureCount: upstreamFailures.length,
    pollErrorCount: pollErrors.length,
    mismatches,
    nonTerminal: audited.filter((item) => !item.upstreamCompleted && !item.upstreamFailed && !item.pollError),
    failureReasons: countBy(upstreamFailures, (item) => item.failureReason || "unknown"),
    pollErrors: pollErrors.map(({ localTaskId, pollError }) => ({ localTaskId, pollError })),
  }, null, 2));
} finally {
  await client.end();
}

async function inspectRow(row) {
  const payload = plainObject(row.payload);
  const taskResult = plainObject(row.result);
  const advancedConfig = plainObject(row.advanced_config);
  const upstreamTaskId = String(taskResult.upstreamTaskId || taskResult.taskId || "").trim();
  try {
    const apiKey = decryptSecret(String(row.api_key_cipher || ""));
    const pollPathTemplate = String(payload.pollPathTemplate || advancedConfig.pollPathTemplate || "tasks/{task_id}");
    const pollPath = pollPathTemplate.replace("{task_id}", encodeURIComponent(upstreamTaskId));
    const response = await fetch(openAiEndpoint(String(row.base_url || ""), pollPath), {
      headers: { authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(60_000),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const raw = text ? JSON.parse(text) : {};
    const extracted = extractApimartVideoResult(raw, {
      statusPath: String(payload.taskStatusPath || payload.pollStatusPath || advancedConfig.taskStatusPath || advancedConfig.pollStatusPath || "data.status"),
      resultVideoPath: String(payload.resultVideoPath || advancedConfig.resultVideoPath || "data.result.videos"),
    });
    const status = String(extracted.status || "").trim().toLowerCase();
    return {
      localTaskId: String(row.id || ""),
      upstreamTaskSuffix: upstreamTaskId.slice(-10),
      upstreamStatus: status,
      upstreamCompleted: /^(success|succeeded|completed|done|finished)$/.test(status),
      upstreamFailed: /^(failure|failed|error|cancelled|canceled)$/.test(status),
      videoCount: extracted.videoUrls.length,
      failureReason: sanitizeDiagnostic(extracted.failureReason),
      pollError: "",
    };
  } catch (error) {
    return {
      localTaskId: String(row.id || ""),
      upstreamTaskSuffix: upstreamTaskId.slice(-10),
      upstreamStatus: "",
      upstreamCompleted: false,
      upstreamFailed: false,
      videoCount: 0,
      failureReason: "",
      pollError: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200),
    };
  }
}

async function mapConcurrent(values, concurrency, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    for (;;) {
      const index = nextIndex++;
      if (index >= values.length) return;
      results[index] = await mapper(values[index]);
    }
  }));
  return results;
}

function decryptSecret(value) {
  if (!value.startsWith("enc:v1:")) return value;
  const [, , ivRaw, tagRaw, encryptedRaw] = value.split(":");
  const decipher = createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(ivRaw, "base64"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64")), decipher.final()]).toString("utf8");
}

function secretKey() {
  const source = process.env.XINGHUAN_SECRET_KEY || process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD || "";
  return createHash("sha256").update(source || "xinghuan-fallback-secret").digest();
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : fallback;
}

function countBy(values, keyOf) {
  return Object.fromEntries([...values.reduce((counts, value) => {
    const key = keyOf(value);
    counts.set(key, (counts.get(key) || 0) + 1);
    return counts;
  }, new Map())].sort((left, right) => right[1] - left[1]));
}

function sanitizeDiagnostic(value) {
  return String(value || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer [redacted]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[redacted-url]")
    .slice(0, 200);
}
