type RuntimeTouch = (taskId: string, patch: Record<string, unknown>) => Promise<unknown>;
type RuntimeEvent = (input: { taskId: string; eventType: string; payload: Record<string, unknown> }) => Promise<unknown>;

export async function markTaskMaterializing(input: {
  taskId: string;
  workerId: string;
  capability: string;
  result: Record<string, unknown>;
  touchTaskRuntime: RuntimeTouch;
  appendTaskRuntimeEventBestEffort: RuntimeEvent;
}) {
  await input.touchTaskRuntime(input.taskId, {
    workerId: input.workerId,
    heartbeatAt: new Date().toISOString(),
    runtimeStage: "materializing",
    progress: "88%",
    queueHint: "服务商已返回，正在保存生成产物",
    providerState: safeText(input.result.providerState || input.result.upstreamStatus || "SUCCESS"),
  });
  await input.appendTaskRuntimeEventBestEffort({
    taskId: input.taskId,
    eventType: "task_materializing",
    payload: {
      workerId: input.workerId,
      capability: input.capability,
      outputKinds: ["imageUrls", "videoUrls", "audioUrls"].filter((key) => Array.isArray(input.result[key])),
    },
  });
}

export function markTaskArtifactsReady(input: {
  taskId: string;
  workerId: string;
  capability: string;
  artifactCount: number;
  appendTaskRuntimeEventBestEffort: RuntimeEvent;
}) {
  return input.appendTaskRuntimeEventBestEffort({
    taskId: input.taskId,
    eventType: "task_artifact_ready",
    payload: { workerId: input.workerId, capability: input.capability, artifactCount: input.artifactCount },
  });
}

function safeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}
