import { appVersion } from "@xinghuan/shared";
import {
  DEFAULT_CONNECTOR_HEARTBEAT_MS,
  registerConnector,
  sendConnectorHeartbeat,
  type ComfyuiConnectorConfig,
} from "./heartbeat.js";

function requiredEnv(name: string) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
}

function optionalEnv(name: string, fallback = "") {
  const value = String(process.env[name] || "").trim();
  return value || fallback;
}

function positiveInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readConfig(): ComfyuiConnectorConfig {
  return {
    apiBaseUrl: requiredEnv("XINGHUAN_COMFYUI_CONNECTOR_API_BASE_URL"),
    connectorToken: requiredEnv("XINGHUAN_COMFYUI_CONNECTOR_TOKEN"),
    instanceId: requiredEnv("XINGHUAN_COMFYUI_INSTANCE_ID"),
    instanceName: optionalEnv(
      "XINGHUAN_COMFYUI_INSTANCE_NAME",
      requiredEnv("XINGHUAN_COMFYUI_INSTANCE_ID"),
    ),
    tailscaleAddress: optionalEnv("XINGHUAN_COMFYUI_TAILSCALE_ADDRESS"),
    comfyuiBaseUrl: optionalEnv(
      "XINGHUAN_COMFYUI_BASE_URL",
      "http://127.0.0.1:8188",
    ),
    concurrency: positiveInteger(
      optionalEnv("XINGHUAN_COMFYUI_CONCURRENCY", "1"),
      1,
    ),
    connectorVersion: optionalEnv(
      "XINGHUAN_COMFYUI_CONNECTOR_VERSION",
      appVersion,
    ),
    note: optionalEnv("XINGHUAN_COMFYUI_NOTE"),
    heartbeatIntervalMs: positiveInteger(
      optionalEnv(
        "XINGHUAN_COMFYUI_HEARTBEAT_MS",
        String(DEFAULT_CONNECTOR_HEARTBEAT_MS),
      ),
      DEFAULT_CONNECTOR_HEARTBEAT_MS,
    ),
  };
}

async function main() {
  const config = readConfig();
  let nextHeartbeatMs =
    config.heartbeatIntervalMs || DEFAULT_CONNECTOR_HEARTBEAT_MS;
  let registered = false;

  console.info(
    `[comfyui-connector] start ${config.instanceId} -> ${config.apiBaseUrl} -> ${config.comfyuiBaseUrl}`,
  );

  while (true) {
    try {
      const action = registered ? "heartbeat" : "register";
      const result = registered
        ? await sendConnectorHeartbeat(config)
        : await registerConnector(config);
      registered = true;
      nextHeartbeatMs = result.heartbeatIntervalMs || nextHeartbeatMs;
      console.info(
        `[comfyui-connector] ${action} ok health=${result.probe.health} capabilities=${result.probe.capabilities.join(",") || "none"} next=${nextHeartbeatMs}ms`,
      );
    } catch (error) {
      registered = false;
      console.error(
        `[comfyui-connector] sync failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    await sleep(nextHeartbeatMs);
  }
}

void main().catch((error) => {
  console.error(
    `[comfyui-connector] fatal: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
