import {
  probeComfyuiInstance,
  type ComfyuiProbeResult,
} from "./comfyui-client.js";

export const DEFAULT_CONNECTOR_HEARTBEAT_MS = 15000;

export interface ComfyuiConnectorConfig {
  apiBaseUrl: string;
  connectorToken: string;
  instanceId: string;
  instanceName: string;
  tailscaleAddress: string;
  comfyuiBaseUrl: string;
  comfyuiRegisterBaseUrl: string;
  concurrency: number;
  connectorVersion: string;
  note?: string;
  heartbeatIntervalMs?: number;
}

export interface ConnectorSyncResult {
  instance: Record<string, unknown>;
  heartbeatIntervalMs: number;
  probe: ComfyuiProbeResult;
}

interface ConnectorEnvelope {
  success?: boolean;
  data?: {
    instance?: Record<string, unknown>;
    heartbeatIntervalMs?: number;
  };
}

function joinApiUrl(baseUrl: string, pathname: string) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(pathname.replace(/^\//, ""), normalizedBase).toString();
}

function connectorHeaders(token: string) {
  return {
    "content-type": "application/json",
    "x-comfyui-connector-token": token,
  };
}

function resolveHeartbeatIntervalMs(
  value: unknown,
  fallback = DEFAULT_CONNECTOR_HEARTBEAT_MS,
) {
  const interval = Number(value);
  if (!Number.isFinite(interval)) return fallback;
  return Math.max(5000, Math.min(300000, Math.floor(interval)));
}

async function postConnector(
  config: ComfyuiConnectorConfig,
  pathname: string,
  body: Record<string, unknown>,
): Promise<ConnectorEnvelope["data"]> {
  const response = await fetch(joinApiUrl(config.apiBaseUrl, pathname), {
    method: "POST",
    headers: connectorHeaders(config.connectorToken),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Connector API ${pathname} 失败: ${response.status}`);
  }
  const payload = (await response.json()) as ConnectorEnvelope;
  return payload.data || {};
}

function connectorBody(
  config: ComfyuiConnectorConfig,
  probe: ComfyuiProbeResult,
) {
  return {
    id: config.instanceId,
    name: config.instanceName,
    tailscaleAddress: config.tailscaleAddress,
    baseUrl: config.comfyuiRegisterBaseUrl,
    reportedBaseUrl: config.comfyuiBaseUrl,
    baseUrlSource: "connector",
    concurrency: config.concurrency,
    connectorVersion: config.connectorVersion,
    note: config.note || "",
    capabilities: probe.capabilities,
    health: probe.health,
    heartbeatIntervalMs:
      config.heartbeatIntervalMs || DEFAULT_CONNECTOR_HEARTBEAT_MS,
  };
}

async function syncConnector(
  config: ComfyuiConnectorConfig,
  pathname: string,
): Promise<ConnectorSyncResult> {
  const probe = await probeComfyuiInstance(config.comfyuiBaseUrl);
  const payload = await postConnector(
    config,
    pathname,
    connectorBody(config, probe),
  );
  return {
    instance: payload?.instance || {},
    heartbeatIntervalMs: resolveHeartbeatIntervalMs(
      payload?.heartbeatIntervalMs,
      config.heartbeatIntervalMs || DEFAULT_CONNECTOR_HEARTBEAT_MS,
    ),
    probe,
  };
}

export function registerConnector(config: ComfyuiConnectorConfig) {
  return syncConnector(config, "/api/internal/comfyui/connectors/register");
}

export function sendConnectorHeartbeat(config: ComfyuiConnectorConfig) {
  return syncConnector(config, "/api/internal/comfyui/connectors/heartbeat");
}
