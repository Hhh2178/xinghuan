import { createDecipheriv, createHash } from "node:crypto";
import { createRequire } from "node:module";

const releaseRoot = process.env.XINGHUAN_RELEASE_ROOT || "/opt/apps/xinghuan-canvas-next/current";
const taskId = process.env.XINGHUAN_RECOVER_TASK_ID || "";
if (process.env.XINGHUAN_ALLOW_AICOPY_TASK_RECOVERY !== "1") throw new Error("TASK_RECOVERY_NOT_EXPLICITLY_ENABLED");
if (!taskId) throw new Error("XINGHUAN_RECOVER_TASK_ID_REQUIRED");

const require = createRequire(`${releaseRoot}/package.json`);
const { Client } = require("pg");
const { attachOutputFetchContext, materializeTaskOutputs } = await import(`file://${releaseRoot}/apps/worker/dist/output-materials.js`);
const { openAiEndpoint, providerHeaders } = await import(`file://${releaseRoot}/apps/worker/dist/worker-provider-utils.js`);
const databaseUrl = process.env.XINGHUAN_DATABASE_URL || process.env.DATABASE_URL || "";
const dataDir = process.env.XINGHUAN_DATA_DIR || `${releaseRoot}/data`;
if (!databaseUrl) throw new Error("DATABASE_NOT_CONFIGURED");

const client = new Client({ connectionString: databaseUrl });
await client.connect();
try {
  const query = await client.query(
    `select t.id,
            t.owner_id,
            t.title,
            t.status,
            t.provider_id,
            t.model_id,
            t.payload,
            t.result,
            p.name as provider_name,
            p.base_url,
            p.api_key_cipher,
            m.model_id as provider_model_id,
            m.display_name as model_display_name
       from xh_tasks t
       join xh_providers p on p.id = t.provider_id
       join xh_models m on m.id = t.model_id
      where t.id = $1
      limit 1`,
    [taskId],
  );
  const row = query.rows[0];
  if (!row) throw new Error("TASK_NOT_FOUND");
  if (row.status === "succeeded") {
    console.log(JSON.stringify({ ok: true, taskId, status: "already_succeeded" }, null, 2));
    process.exit(0);
  }
  if (!["running", "failed"].includes(row.status)) throw new Error(`TASK_NOT_RECOVERABLE:${row.status}`);

  const currentResult = plainObject(row.result);
  const upstreamTaskId = String(currentResult.upstreamTaskId || currentResult.taskId || "");
  const savedRemoteUrl = [currentResult.remoteVideoUrls, currentResult.videoUrls]
    .flatMap((value) => Array.isArray(value) ? value : [])
    .map((value) => String(value || ""))
    .find((value) => /^https?:\/\//i.test(value)) || "";
  if (!upstreamTaskId && !savedRemoteUrl) throw new Error("UPSTREAM_TASK_ID_MISSING");
  const apiKey = decryptSecret(String(row.api_key_cipher || ""));
  if (!apiKey) throw new Error("PROVIDER_KEY_DECRYPT_FAILED");
  const contentUrl = savedRemoteUrl || openAiEndpoint(String(row.base_url || ""), `videos/${encodeURIComponent(upstreamTaskId)}/content?variant=video`);
  const executionResult = attachOutputFetchContext({
    adapter: "aicopy-video",
    providerId: String(row.provider_id || ""),
    modelId: String(row.provider_model_id || ""),
    taskId: upstreamTaskId || "saved-remote-output",
    videoUrls: [contentUrl],
    remoteVideoUrls: [contentUrl],
    videoCount: 1,
    providerState: "completed",
    materializationStatus: "retrying",
  }, {
    origin: String(row.base_url || ""),
    headers: providerHeaders(apiKey),
  });
  const task = {
    id: String(row.id || ""),
    ownerId: String(row.owner_id || ""),
    title: String(row.title || ""),
    providerId: String(row.provider_id || ""),
    providerName: String(row.provider_name || ""),
    modelRecordId: String(row.model_id || ""),
    providerModelId: String(row.provider_model_id || ""),
    modelDisplayName: String(row.model_display_name || ""),
    payload: plainObject(row.payload),
  };
  const materialized = await materializeTaskOutputs({ dataDir, task, result: executionResult });
  if (materialized.resourceItems.length === 0) throw new Error("RECOVERY_MATERIALIZATION_EMPTY");
  const completedAt = new Date().toISOString();
  const resultPatch = {
    ...executionResult,
    ...materialized.resultPatch,
    workerId: "aicopy-recovery-v066",
    completedAt,
    heartbeatAt: completedAt,
    runtimeStage: "succeeded",
    providerState: "completed",
    upstreamStatus: "completed",
    progress: "100%",
  };
  const updated = await client.query(
    `update xh_tasks
        set status = 'succeeded',
            result = coalesce(result, '{}'::jsonb) || $2::jsonb,
            logs = coalesce(logs, '[]'::jsonb) || $3::jsonb,
            updated_at = now(),
            finalized_at = now()
      where id = $1 and status = $4`,
    [taskId, JSON.stringify(resultPatch), JSON.stringify(["AICopy completed output recovered without resubmission"]), row.status],
  );
  if (updated.rowCount !== 1) throw new Error("TASK_RECOVERY_STATUS_CONFLICT");
  console.log(JSON.stringify({
    ok: true,
    taskId,
    status: "succeeded",
    resourceCount: materialized.resourceItems.length,
    localVideoUrls: materialized.resultPatch.materializedVideoUrls,
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
