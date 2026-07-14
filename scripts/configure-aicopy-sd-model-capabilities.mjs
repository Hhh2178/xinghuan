import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const SD_BINDINGS = [
  { path: "duration", source: "duration", type: "number" },
  { path: "metadata.modeType", source: "modeType", type: "string" },
  { path: "metadata.ratio", source: "ratio", type: "string" },
  { path: "metadata.enableSound", value: "on", type: "string" },
  { path: "images", source: "images", type: "string[]", omitWhenEmpty: true },
  { path: "audios", source: "audios", type: "string[]", omitWhenEmpty: true },
];
const SD_RESULT_PATHS = ["result_url", "data.metadata.url", "data.output"];
const SD_INPUT_PROFILE = [
  "prompt",
  "image_reference",
  "multi_image",
  "first_frame",
  "last_frame",
  "audio_reference",
];

export function mergeAicopySdModelConfig(row) {
  const inputCapabilities = {
    ...plainObject(row.input_capabilities),
    prompt: true,
    imageReference: true,
    multiImage: true,
    firstFrame: true,
    lastFrame: true,
    audioReference: true,
  };
  const currentSchema = plainObject(row.parameter_schema);
  const parameterSchema = {
    ...currentSchema,
    referenceImages: { ...plainObject(currentSchema.referenceImages), type: "image[]", max: 9 },
    referenceAudio: { ...plainObject(currentSchema.referenceAudio), type: "audio[]", max: 3 },
    duration: {
      ...plainObject(currentSchema.duration),
      type: "range",
      min: 4,
      max: 15,
      step: 1,
      default: 15,
    },
  };
  const currentAdvancedConfig = plainObject(row.advanced_config);
  const currentContract = plainObject(currentAdvancedConfig.requestContract);
  const advancedConfig = {
    ...currentAdvancedConfig,
    aicopyRequestContractEnabled: true,
    requestContract: {
      ...currentContract,
      bindings: mergeBindings(currentContract.bindings),
      resultPaths: uniqueStrings([...SD_RESULT_PATHS, ...arrayValue(currentContract.resultPaths)]),
    },
  };
  const inputProfile = uniqueStrings([
    ...SD_INPUT_PROFILE,
    ...String(row.input_profile || "").split(","),
  ]).join(",");

  return { inputProfile, inputCapabilities, parameterSchema, advancedConfig };
}

export function summarizeAicopySdModelChange(row, merged) {
  const before = {
    inputProfile: String(row.input_profile || ""),
    inputCapabilities: plainObject(row.input_capabilities),
    parameterSchema: plainObject(row.parameter_schema),
    advancedConfig: plainObject(row.advanced_config),
  };
  return {
    modelRecordId: String(row.id || ""),
    providerId: String(row.provider_id || ""),
    modelId: String(row.model_id || ""),
    changed: stableJson(before) !== stableJson(merged),
    beforeFingerprint: fingerprint(before),
    afterFingerprint: fingerprint(merged),
    capabilities: {
      referenceImages: merged.parameterSchema.referenceImages.max,
      referenceAudios: merged.parameterSchema.referenceAudio.max,
      firstFrame: merged.inputCapabilities.firstFrame,
      lastFrame: merged.inputCapabilities.lastFrame,
      audioReference: merged.inputCapabilities.audioReference,
    },
    duration: merged.parameterSchema.duration,
    requestContractEnabled: merged.advancedConfig.aicopyRequestContractEnabled === true,
    requestBindingPaths: arrayValue(merged.advancedConfig.requestContract?.bindings).map((item) => String(item?.path || "")).filter(Boolean),
    resultPaths: arrayValue(merged.advancedConfig.requestContract?.resultPaths).map(String),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const providerId = text(args["provider-id"]);
  const modelId = text(args["model-id"]);
  const apply = booleanArg(args.apply);
  if (!providerId || !modelId) throw new Error("--provider-id and --model-id are required");
  if (apply && booleanArg(args["dry-run"])) throw new Error("--apply and --dry-run cannot both be true");
  const databaseUrl = process.env.XINGHUAN_DATABASE_URL || process.env.DATABASE_URL || "";
  if (!databaseUrl) throw new Error("DATABASE_NOT_CONFIGURED");

  const { Client } = await loadPg();
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    if (apply) await client.query("begin");
    const providerResult = await client.query(
      `select id, protocol from xh_providers where id = $1 limit 1`,
      [providerId],
    );
    const provider = providerResult.rows[0];
    if (!provider) throw new Error("PROVIDER_NOT_FOUND");
    if (text(provider.protocol).toLowerCase() !== "aicopy") throw new Error("PROVIDER_PROTOCOL_NOT_AICOPY");

    const modelResult = await client.query(
      `select id, provider_id, model_id, capability, input_profile, input_capabilities, parameter_schema, advanced_config
         from xh_models
        where provider_id = $1 and model_id = $2
        limit 1${apply ? " for update" : ""}`,
      [providerId, modelId],
    );
    const model = modelResult.rows[0];
    if (!model) throw new Error("MODEL_NOT_FOUND");
    if (text(model.capability).toLowerCase() !== "video") throw new Error("MODEL_CAPABILITY_NOT_VIDEO");

    const merged = mergeAicopySdModelConfig(model);
    const summary = summarizeAicopySdModelChange(model, merged);
    let backupPath = "";
    if (apply && summary.changed) {
      backupPath = await writeModelBackup(model);
      await client.query(
        `update xh_models
            set input_profile = $2,
                input_capabilities = $3::jsonb,
                parameter_schema = $4::jsonb,
                advanced_config = $5::jsonb,
                updated_at = now()
          where id = $1 and provider_id = $6`,
        [
          model.id,
          merged.inputProfile,
          JSON.stringify(merged.inputCapabilities),
          JSON.stringify(merged.parameterSchema),
          JSON.stringify(merged.advancedConfig),
          providerId,
        ],
      );
    }
    if (apply) await client.query("commit");
    console.log(JSON.stringify({ ok: true, mode: apply ? "apply" : "dry-run", provider: { id: providerId, protocol: "aicopy" }, ...summary, ...(backupPath ? { backupPath } : {}) }, null, 2));
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
  const backupPath = join(
    backupDir,
    `${stamp}-${safeFilePart(model.provider_id)}-${safeFilePart(model.model_id)}.json`,
  );
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

function mergeBindings(value) {
  const current = arrayValue(value).filter((item) => item && typeof item === "object" && !Array.isArray(item));
  const canonicalPaths = new Set(SD_BINDINGS.map((item) => item.path));
  return [
    ...SD_BINDINGS.map((item) => ({ ...item })),
    ...current.filter((item) => !canonicalPaths.has(String(item.path || "").trim())),
  ];
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

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
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
