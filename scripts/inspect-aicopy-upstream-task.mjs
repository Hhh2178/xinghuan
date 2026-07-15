import { createDecipheriv, createHash } from "node:crypto";
import { createRequire } from "node:module";

const releaseRoot = process.env.XINGHUAN_RELEASE_ROOT || "/opt/apps/xinghuan-canvas-next/current";
const localTaskId = process.env.XINGHUAN_INSPECT_TASK_ID || "";
if (!localTaskId) throw new Error("XINGHUAN_INSPECT_TASK_ID_REQUIRED");

const require = createRequire(`${releaseRoot}/package.json`);
const { Client } = require("pg");
const { extractAicopyVideoResult } = await import(`file://${releaseRoot}/packages/model-core/dist/aicopy-video-adapter.js`);
const { isCompletedAsyncStatus } = await import(`file://${releaseRoot}/apps/worker/dist/worker-media-polling.js`);
const { openAiEndpoint } = await import(`file://${releaseRoot}/apps/worker/dist/worker-provider-utils.js`);
const databaseUrl = process.env.XINGHUAN_DATABASE_URL || process.env.DATABASE_URL || "";
if (!databaseUrl) throw new Error("DATABASE_NOT_CONFIGURED");

const client = new Client({ connectionString: databaseUrl });
await client.connect();
try {
  const result = await client.query(
    `select t.result ->> 'upstreamTaskId' as upstream_task_id,
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
  const baseUrl = String(row.base_url || "").replace(/\/+$/, "");
  const upstreamTaskId = String(row.upstream_task_id || "");
  const pollUrl = openAiEndpoint(baseUrl, `videos/${encodeURIComponent(upstreamTaskId)}`);
  const response = await fetch(pollUrl, {
    headers: { authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(60_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`UPSTREAM_POLL_FAILED:${response.status}:${text.slice(0, 200)}`);
  const raw = text ? JSON.parse(text) : {};
  const advancedConfig = plainObject(row.advanced_config);
  const requestContract = plainObject(advancedConfig.requestContract);
  const extracted = extractAicopyVideoResult(raw, {
    statusPath: String(advancedConfig.taskStatusPath || "status"),
    resultVideoPath: String(advancedConfig.resultVideoPath || "data.output"),
    resultPaths: Array.isArray(requestContract.resultPaths) ? requestContract.resultPaths : undefined,
  });
  const status = String(extracted.status || "").trim().toLowerCase();
  const contentChecks = [];
  for (const suffix of ["content", "content?variant=video"]) {
    const contentUrl = openAiEndpoint(baseUrl, `videos/${encodeURIComponent(upstreamTaskId)}/${suffix}`);
    const contentResponse = await fetch(contentUrl, {
      headers: {
        authorization: `Bearer ${apiKey}`,
        range: "bytes=0-1",
      },
      signal: AbortSignal.timeout(60_000),
    });
    contentChecks.push({
      suffix,
      status: contentResponse.status,
      contentType: String(contentResponse.headers.get("content-type") || ""),
      contentLength: String(contentResponse.headers.get("content-length") || ""),
      finalLocation: safeUrlLocation(contentResponse.url),
    });
    await contentResponse.body?.cancel();
  }
  console.log(JSON.stringify({
    ok: true,
    httpStatus: response.status,
    rawKeys: Object.keys(plainObject(raw)),
    rawStatus: safeScalar(raw?.status),
    nestedStatus: safeScalar(raw?.data?.status),
    extractedStatus: status,
    statusCodePoints: [...status].map((character) => character.codePointAt(0)),
    completed: isCompletedAsyncStatus(status),
    extractedVideoCount: extracted.videoUrls.length,
    extractedVideoLocations: extracted.videoUrls.map(safeUrlLocation),
    contentChecks,
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
