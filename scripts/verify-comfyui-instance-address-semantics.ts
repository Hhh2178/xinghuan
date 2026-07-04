import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createComfyuiWorkflowRegistry,
  getEffectiveComfyuiInstanceHealth,
} from "../apps/api/src/comfyui-workflow-registry.ts";

const adminDir = await mkdtemp(join(tmpdir(), "xh-comfyui-instance-"));

try {
  const registry = createComfyuiWorkflowRegistry(adminDir);

  await registry.updateRegistry((state) => ({
    ...state,
    instances: [
      {
        id: "instance-manual",
        name: "Manual Instance",
        baseUrl: "http://127.0.0.1:8188",
        baseUrlSource: "manual",
        reportedBaseUrl: "http://127.0.0.1:8188",
        tailscaleAddress: "100.64.0.10",
        health: "online",
        concurrency: 1,
        capabilities: ["workflow"],
        lastSeenAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
  }));

  await registry.touchHeartbeat("instance-manual", {
    baseUrl: "http://127.0.0.1:28188",
    reportedBaseUrl: "http://127.0.0.1:8188",
    health: "online",
    connectorVersion: "0.5.25",
  });

  const afterManualHeartbeat = (await registry.readRegistry()).instances.find((item) => item.id === "instance-manual");
  assert.ok(afterManualHeartbeat, "manual instance should still exist after heartbeat");
  assert.equal(
    afterManualHeartbeat.baseUrl,
    "http://127.0.0.1:8188",
    "heartbeat should not overwrite a manually configured execution baseUrl",
  );
  assert.equal(
    afterManualHeartbeat.reportedBaseUrl,
    "http://127.0.0.1:8188",
    "heartbeat should retain the connector-reported machine-local ComfyUI address",
  );

  await registry.updateRegistry((state) => ({
    ...state,
    instances: [
      ...state.instances.filter((item) => item.id !== "instance-connector"),
      {
        id: "instance-connector",
        name: "Connector Instance",
        baseUrl: "http://127.0.0.1:28188",
        baseUrlSource: "connector",
        reportedBaseUrl: "http://127.0.0.1:8188",
        tailscaleAddress: "100.64.0.11",
        health: "online",
        concurrency: 1,
        capabilities: ["workflow"],
        lastSeenAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
  }));

  await registry.touchHeartbeat("instance-connector", {
    baseUrl: "http://127.0.0.1:38188",
    reportedBaseUrl: "http://127.0.0.1:8188",
    health: "online",
  });

  const afterConnectorHeartbeat = (await registry.readRegistry()).instances.find((item) => item.id === "instance-connector");
  assert.ok(afterConnectorHeartbeat, "connector-managed instance should still exist after heartbeat");
  assert.equal(
    afterConnectorHeartbeat.baseUrl,
    "http://127.0.0.1:38188",
    "connector-managed execution baseUrl should still be refreshable by heartbeat",
  );

  assert.equal(
    getEffectiveComfyuiInstanceHealth({
      ...afterConnectorHeartbeat,
      lastSeenAt: Date.now() - 120_000,
      health: "online",
    }),
    "offline",
    "stale heartbeats should render the instance offline",
  );

  assert.equal(
    getEffectiveComfyuiInstanceHealth({
      ...afterConnectorHeartbeat,
      lastSeenAt: Date.now(),
      health: "online",
    }, { lastConnectionOk: false }),
    "degraded",
    "fresh heartbeat plus failed connection test should render the instance degraded",
  );

  console.log("comfyui instance address semantics: ok");
} finally {
  await rm(adminDir, { recursive: true, force: true });
}
