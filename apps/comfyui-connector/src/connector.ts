import {
  DEFAULT_CONNECTOR_HEARTBEAT_MS,
  registerConnector,
  sendConnectorHeartbeat,
} from "./heartbeat.js";
import { readConnectorConfig } from "./config.js";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const config = readConnectorConfig();
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
