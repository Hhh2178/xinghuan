import { Client } from "pg";

const databaseUrl = process.env.XINGHUAN_DATABASE_URL || process.env.DATABASE_URL || "";
const providerNameHint = (process.env.XINGHUAN_VERIFY_PLATO_PROVIDER_NAME ?? "柏拉图").trim();
const providerBaseUrl = "https://api.apilio.ai";

if (!databaseUrl) {
  console.error("XINGHUAN_DATABASE_URL is required");
  process.exit(1);
}

const client = new Client({ connectionString: databaseUrl });

const previewConfig = {
  mode: "async_video_task",
  submitPath: `${providerBaseUrl}/v2/videos/generations`,
  taskIdPath: "task_id",
  pollPathTemplate: `${providerBaseUrl}/v2/videos/generations/{task_id}`,
  taskStatusPath: "status",
  resultVideoPath: "data.output",
  pollIntervalMs: 3000,
  pollTimeoutMs: 360000,
  requestMapping: {
    ratio: "aspect_ratio",
    duration: "duration",
    resolution: "resolution",
    images: "images",
  },
};

const grok15Config = {
  mode: "async_video_task",
  submitPath: `${providerBaseUrl}/v1/videos`,
  taskIdPath: "task_id",
  pollPathTemplate: `${providerBaseUrl}/v2/videos/generations/{task_id}`,
  taskStatusPath: "status",
  resultVideoPath: "data.output",
  pollIntervalMs: 3000,
  pollTimeoutMs: 360000,
  requestBodyMode: "multipart_form_data",
  requestContentType: "multipart/form-data",
  requestFileFields: ["images"],
  requestValueTemplates: { size: "{video_size}" },
  requestMapping: {
    ratio: "",
    duration: "duration",
    resolution: "",
    images: "input_reference",
  },
};

const modelPlans = [
  { modelId: "grok-1.5-video-6s", durationOptions: [6], config: grok15Config },
  { modelId: "grok-1.5-video-10s", durationOptions: [10], config: grok15Config },
  { modelId: "grok-1.5-video-15s", durationOptions: [15], config: grok15Config },
  { modelId: "grok-imagine-video-1.5-preview", durationOptions: [6, 10, 15], config: previewConfig },
];

await client.connect();

try {
  const providerResult = await client.query(
    `select id, name, base_url
       from xh_providers
      where enabled = true
        and (name = $1 or base_url = $2 or base_url ilike '%api.apilio.ai%')
      order by updated_at desc
      limit 1`,
    [providerNameHint, providerBaseUrl],
  );
  const provider = providerResult.rows[0];
  if (!provider?.id) throw new Error("Plato provider not found");

  const updated = [];
  for (const plan of modelPlans) {
    const currentResult = await client.query(
      `select id, model_id, parameter_schema, advanced_config, input_profile, input_capabilities
         from xh_models
        where provider_id = $1 and model_id = $2
        limit 1`,
      [provider.id, plan.modelId],
    );
    const current = currentResult.rows[0];
    if (!current?.id) {
      updated.push({ modelId: plan.modelId, updated: false, reason: "missing" });
      continue;
    }
    const parameterSchema = mergeVideoSchema(current.parameter_schema, plan.durationOptions);
    const advancedConfig = {
      ...(plainObject(current.advanced_config)),
      ...plan.config,
    };
    const inputCapabilities = {
      prompt: true,
      imageReference: true,
      multiImage: false,
      firstFrame: false,
      lastFrame: false,
      ...(plainObject(current.input_capabilities)),
    };
    await client.query(
      `update xh_models
          set input_profile = $2,
              input_capabilities = $3::jsonb,
              parameter_schema = $4::jsonb,
              advanced_config = $5::jsonb,
              enabled = true,
              updated_at = now()
        where id = $1`,
      [
        current.id,
        "prompt,image_reference",
        JSON.stringify(inputCapabilities),
        JSON.stringify(parameterSchema),
        JSON.stringify(advancedConfig),
      ],
    );
    updated.push({
      modelId: plan.modelId,
      updated: true,
      submitPath: advancedConfig.submitPath,
      requestBodyMode: advancedConfig.requestBodyMode || "json",
    });
  }

  console.log(JSON.stringify({
    ok: true,
    provider: { id: provider.id, name: provider.name, baseUrl: provider.base_url },
    updated,
  }, null, 2));
} finally {
  await client.end().catch(() => undefined);
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function mergeVideoSchema(value, durationOptions) {
  const schema = plainObject(value);
  const referenceImages = plainObject(schema.referenceImages);
  return {
    prompt: { type: "string", required: true, ...(plainObject(schema.prompt)) },
    aspectRatio: {
      type: "select",
      options: ["16:9", "9:16", "1:1"],
      default: "16:9",
      ...(plainObject(schema.aspectRatio)),
    },
    duration: {
      type: "select",
      options: durationOptions,
      default: durationOptions[0],
      ...(plainObject(schema.duration)),
    },
    resolution: {
      type: "select",
      options: ["480p", "720p", "1080p"],
      default: "720p",
      ...(plainObject(schema.resolution)),
    },
    referenceImages: {
      type: "image[]",
      max: 1,
      ...referenceImages,
    },
  };
}
