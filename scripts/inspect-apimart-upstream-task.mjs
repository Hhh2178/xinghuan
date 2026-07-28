import { createDecipheriv, createHash } from "node:crypto";
import { createRequire } from "node:module";

const releaseRoot = process.env.XINGHUAN_RELEASE_ROOT || "/opt/apps/xinghuan-canvas-next/current";
const localTaskId = process.env.XINGHUAN_INSPECT_TASK_ID || "";
if (!localTaskId) throw new Error("XINGHUAN_INSPECT_TASK_ID_REQUIRED");

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
    `select t.payload,
            t.result,
            p.base_url,
            p.api_key_cipher,
            m.advanced_config
       from xh_tasks t
       join xh_providers p on p.id = t.provider_id
       join xh_models m on m.id = t.model_id
      where t.id = $1
      limit 1`,
    [localTaskId],
  );
  const row = result.rows[0];
  if (!row) throw new Error("TASK_NOT_FOUND");
  const apiKey = decryptSecret(String(row.api_key_cipher || ""));
  if (!apiKey) throw new Error("PROVIDER_KEY_DECRYPT_FAILED");
  const payload = plainObject(row.payload);
  const taskResult = plainObject(row.result);
  const advancedConfig = plainObject(row.advanced_config);
  const upstreamTaskId = String(taskResult.upstreamTaskId || taskResult.taskId || "").trim();
  if (!upstreamTaskId) throw new Error("UPSTREAM_TASK_ID_MISSING");
  const pollPathTemplate = String(payload.pollPathTemplate || advancedConfig.pollPathTemplate || "tasks/{task_id}");
  const pollPath = pollPathTemplate.replace("{task_id}", encodeURIComponent(upstreamTaskId));
  const response = await fetch(openAiEndpoint(String(row.base_url || ""), pollPath), {
    headers: { authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(60_000),
  });
  const text = await response.text();
  const raw = text ? JSON.parse(text) : {};
  const extracted = extractApimartVideoResult(raw, {
    statusPath: String(payload.taskStatusPath || payload.pollStatusPath || advancedConfig.taskStatusPath || advancedConfig.pollStatusPath || "data.status"),
    resultVideoPath: String(payload.resultVideoPath || advancedConfig.resultVideoPath || "data.result.videos"),
  });
  console.log(JSON.stringify({
    ok: response.ok,
    httpStatus: response.status,
    localTaskId,
    upstreamTaskSuffix: upstreamTaskId.slice(-10),
    pollPathTemplate,
    rawKeys: Object.keys(plainObject(raw)),
    rawStatus: safeScalar(raw?.status),
    nestedStatus: safeScalar(raw?.data?.status),
    extractedStatus: safeScalar(extracted.status),
    failureReason: safeScalar(extracted.failureReason).slice(0, 300),
    extractedVideoCount: extracted.videoUrls.length,
    extractedVideoLocations: extracted.videoUrls.map(safeUrlLocation),
  }, null, 2));
} finally {
  await client.end();
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

function safeScalar(value) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function safeUrlLocation(value) {
  try {
    const url = new URL(String(value || ""));
    return `${url.origin}${url.pathname}`;
  } catch {
    return "non-url";
  }
}
