import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const AIFORK_API_HOST = "api.aicopy.top";
export const AIFORK_GROK_FAST_MODEL_ID = "grok-imagine-video-1.5-fast";

export const AIFORK_GROK_FAST_REQUEST_CONTRACT = {
  bindings: [
    { path: "duration", source: "duration", type: "number" },
    { path: "video_length", source: "duration", type: "number" },
    { path: "aspect_ratio", source: "ratio", type: "string" },
    { path: "resolution", source: "resolution", type: "string" },
    { path: "video_config.video_length", source: "duration", type: "number" },
    { path: "video_config.aspect_ratio", source: "ratio", type: "string" },
    { path: "video_config.resolution", source: "resolution", type: "string" },
    { path: "video_config.preset", value: "normal", type: "string" },
    { path: "reference_images", source: "images", type: "string[]", omitWhenEmpty: true },
  ],
  resultPaths: ["result_url", "data.metadata.url", "data.output"],
};

export function mergeAiforkGrokFastDataUrlReferences(row) {
  return {
    ...plainObject(row.advanced_config),
    referenceImageTransport: "data_url",
    requestContractEnabled: true,
    requestContract: structuredClone(AIFORK_GROK_FAST_REQUEST_CONTRACT),
  };
}

export function summarizeAiforkGrokFastDataUrlReferences(row, advancedConfig) {
  const before = plainObject(row.advanced_config);
  return {
    modelRecordId: text(row.id),
    providerId: text(row.provider_id),
    modelId: text(row.model_id),
    changed: stableJson(before) !== stableJson(advancedConfig),
    beforeFingerprint: fingerprint(before),
    afterFingerprint: fingerprint(advancedConfig),
    referenceImageTransport: advancedConfig.referenceImageTransport,
    requestContractEnabled: advancedConfig.requestContractEnabled === true,
    requestBindingPaths: Array.isArray(advancedConfig.requestContract?.bindings)
      ? advancedConfig.requestContract.bindings.map((binding) => text(binding?.path)).filter(Boolean)
      : [],
  };
}

export function isAiforkGrokFastTarget(provider, model) {
  return text(provider?.protocol).toLowerCase() === "aicopy"
    && safeHost(provider?.base_url) === AIFORK_API_HOST
    && text(model?.model_id).toLowerCase() === AIFORK_GROK_FAST_MODEL_ID
    && text(model?.capability).toLowerCase() === "video";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const providerId = text(args["provider-id"]);
  const apply = booleanArg(args.apply);
  if (!providerId) throw new Error("--provider-id is required");
  if (apply && booleanArg(args["dry-run"])) throw new Error("--apply and --dry-run cannot both be true");
  const databaseUrl = process.env.XINGHUAN_DATABASE_URL || process.env.DATABASE_URL || "";
  if (!databaseUrl) throw new Error("DATABASE_NOT_CONFIGURED");

  const { Client } = await loadPg();
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    if (apply) await client.query("begin");
    const providerResult = await client.query(
      `select id, protocol, base_url from xh_providers where id = $1 limit 1`,
      [providerId],
    );
    const provider = providerResult.rows[0];
    if (!provider) throw new Error("PROVIDER_NOT_FOUND");
    const modelResult = await client.query(
      `select id, provider_id, model_id, capability, input_profile, input_capabilities, parameter_schema, advanced_config
         from xh_models
        where provider_id = $1 and lower(model_id) = $2
        limit 1${apply ? " for update" : ""}`,
      [providerId, AIFORK_GROK_FAST_MODEL_ID],
    );
    const model = modelResult.rows[0];
    if (!model) throw new Error("MODEL_NOT_FOUND");
    if (!isAiforkGrokFastTarget(provider, model)) throw new Error("PROVIDER_OR_MODEL_NOT_AIFORK_GROK_FAST");

    const advancedConfig = mergeAiforkGrokFastDataUrlReferences(model);
    const summary = summarizeAiforkGrokFastDataUrlReferences(model, advancedConfig);
    let backupPath = "";
    if (apply && summary.changed) {
      backupPath = await writeModelBackup(model);
      await client.query(
        `update xh_models
            set advanced_config = $2::jsonb,
                updated_at = now()
          where id = $1 and provider_id = $3`,
        [model.id, JSON.stringify(advancedConfig), providerId],
      );
    }
    if (apply) await client.query("commit");
    console.log(JSON.stringify({
      ok: true,
      mode: apply ? "apply" : "dry-run",
      provider: { id: providerId, protocol: "aicopy", host: AIFORK_API_HOST },
      ...summary,
      ...(backupPath ? { backupPath } : {}),
    }, null, 2));
  } catch (error) {
    if (apply) await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function writeModelBackup(model) {
  const backupDir = process.env.XINGHUAN_CONFIG_BACKUP_DIR
    || join(process.env.XINGHUAN_DATA_DIR || process.cwd(), "config-backups");
  await mkdir(backupDir, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  const backupPath = join(backupDir, `${stamp}-${safeFilePart(model.provider_id)}-${safeFilePart(model.model_id)}.json`);
  await writeFile(backupPath, JSON.stringify({
    id: model.id,
    providerId: model.provider_id,
    modelId: model.model_id,
    capability: model.capability,
    inputProfile: model.input_profile,
    inputCapabilities: plainObject(model.input_capabilities),
    parameterSchema: plainObject(model.parameter_schema),
    advancedConfig: plainObject(model.advanced_config),
  }, null, 2), { encoding: "utf8", mode: 0o600, flag: "wx" });
  return backupPath;
}

function safeHost(value) {
  try {
    return new URL(text(value)).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function plainObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function fingerprint(value) {
  return createHash("sha256").update(stableJson(value)).digest("hex").slice(0, 16);
}

function stableJson(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
}

function parseArgs(values) {
  const out = {};
  for (const value of values) {
    if (!value.startsWith("--")) continue;
    const [key, ...rest] = value.slice(2).split("=");
    out[key] = rest.length ? rest.join("=") : "true";
  }
  return out;
}

function booleanArg(value) {
  return ["1", "true", "yes", "on"].includes(text(value).toLowerCase());
}

function text(value) {
  return String(value || "").trim();
}

function safeFilePart(value) {
  return text(value).replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 96) || "unknown";
}

async function loadPg() {
  const module = await import("pg");
  return module.default || module;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
