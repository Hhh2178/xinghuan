import { appVersion } from "@xinghuan/shared";
import { DEFAULT_CONNECTOR_HEARTBEAT_MS } from "./heartbeat.js";

export interface ComfyuiConnectorRuntimeConfig {
  apiBaseUrl: string;
  connectorToken: string;
  instanceId: string;
  instanceName: string;
  tailscaleAddress: string;
  comfyuiBaseUrl: string;
  concurrency: number;
  connectorVersion: string;
  note: string;
  heartbeatIntervalMs: number;
}

export function requiredEnv(name: string) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
}

export function optionalEnv(name: string, fallback = "") {
  const value = String(process.env[name] || "").trim();
  return value || fallback;
}

export function positiveInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readConnectorConfig(): ComfyuiConnectorRuntimeConfig {
  const instanceId = requiredEnv("XINGHUAN_COMFYUI_INSTANCE_ID");

  return {
    apiBaseUrl: requiredEnv("XINGHUAN_COMFYUI_CONNECTOR_API_BASE_URL"),
    connectorToken: requiredEnv("XINGHUAN_COMFYUI_CONNECTOR_TOKEN"),
    instanceId,
    instanceName: optionalEnv("XINGHUAN_COMFYUI_INSTANCE_NAME", instanceId),
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
