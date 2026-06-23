const BASE_PRESET_NAME = "base";

const PRESET_DEFINITIONS = {
  [BASE_PRESET_NAME]: {
    description: "通用灰度发布基础校验链",
    commands: [
      "npm install --package-lock-only",
      "npm run build:single-port",
      "node scripts/verify-release-version-alignment.mjs",
      "npm run verify:release-package-contract",
    ],
  },
  runninghub: {
    description: "RunningHub 相关发布专题校验链",
    commands: [
      "node scripts/verify-runninghub-draft-and-summary-contract.mjs",
      "node scripts/verify-runninghub-output-reset-contract.mjs",
      "node scripts/verify-runninghub-worker-and-label-contract.mjs",
      "node scripts/verify-runninghub-admin-empty-input-contract.mjs",
      "node scripts/verify-runninghub-key-pool-contract.mjs",
      "node scripts/verify-runninghub-node-progress-contract.mjs",
    ],
  },
};

export function listGrayPreparePresets() {
  return Object.entries(PRESET_DEFINITIONS).map(([name, value]) => ({
    name,
    description: value.description,
    commands: [...value.commands],
  }));
}

export function resolveGrayPrepareCommands({ presets = [], extraCommands = [], includeBase = true } = {}) {
  const requestedPresets = normalizePresetNames(presets);
  const resolvedPresetNames = includeBase
    ? [BASE_PRESET_NAME, ...requestedPresets.filter((name) => name !== BASE_PRESET_NAME)]
    : requestedPresets.filter((name) => name !== BASE_PRESET_NAME);

  const commands = [];
  const seen = new Set();
  for (const presetName of resolvedPresetNames) {
    const preset = PRESET_DEFINITIONS[presetName];
    if (!preset) throw new Error(`UNKNOWN_GRAY_PRESET:${presetName}`);
    for (const command of preset.commands) {
      if (seen.has(command)) continue;
      seen.add(command);
      commands.push(command);
    }
  }
  for (const command of normalizeCommands(extraCommands)) {
    if (seen.has(command)) continue;
    seen.add(command);
    commands.push(command);
  }

  return {
    presets: resolvedPresetNames,
    commands,
  };
}

function normalizePresetNames(value) {
  const list = Array.isArray(value) ? value : [value];
  return list
    .flatMap((item) => String(item || "").split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeCommands(value) {
  const list = Array.isArray(value) ? value : [value];
  return list
    .flatMap((item) => Array.isArray(item) ? item : [item])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}
