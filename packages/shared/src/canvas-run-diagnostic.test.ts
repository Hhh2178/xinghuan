import { describe, expect, it } from "vitest";

import { projectCanvasRunFailureDiagnostic } from "./canvas-run-diagnostic.js";

describe("Canvas Run failure diagnostic", () => {
  it.each([
    [{ code: "WORKFLOW_BOUNDARY_VALUE_MISSING:input-1" }, "input", "工作流输入缺少值"],
    [{ code: "SMART_CANDIDATE_COUNT_INSUFFICIENT" }, "input", "智能选择器候选不足"],
    [{ code: "CANVAS_RUN_CYCLE_DETECTED" }, "workflow", "工作流存在循环依赖"],
    [{ code: "CANVAS_RUN_DISABLED" }, "environment", "AI 托管运行环境不可用"],
    [{ code: "CANVAS_RUN_LEGACY_NODE_UNSUPPORTED:resize" }, "capability", "节点不支持 AI 托管"],
    [{ code: "CANVAS_RUN_MODEL_RECORD_REPAIR_REQUIRED:model-1" }, "model", "模型配置需要修复"],
    [{ failureCategory: "provider", providerDiagnostic: "upstream rejected request" }, "provider", "渠道拒绝了本次请求"],
    [{ code: "RATE_LIMITED", upstreamHttpStatus: 429 }, "provider", "渠道当前请求过多"],
    [{ code: "CANVAS_RUN_QUEUE_STALLED", waitReason: "waiting_provider_window" }, "queue", "任务在队列中停留过久"],
    [{ code: "CANVAS_RUN_BUDGET_EXCEEDED" }, "budget", "本次托管达到预算上限"],
    [{ code: "PERMISSION_DENIED" }, "permission", "当前账号没有执行权限"],
    [{ code: "CANVAS_RUN_CANCELLED" }, "cancellation", "本次托管已取消"],
    [{ code: "WORKER_TIMEOUT" }, "timeout", "执行节点等待超时"],
    [{ code: "SOMETHING_NEW" }, "unknown", "运行失败，尚未识别具体类型"],
  ] as const)("maps %# to a direct diagnosis", (input, category, title) => {
    expect(projectCanvasRunFailureDiagnostic(input)).toMatchObject({ category, title });
  });

  it("keeps bounded location and technical evidence while removing secrets and signed URLs", () => {
    const diagnostic = projectCanvasRunFailureDiagnostic({
      code: "UPSTREAM_REJECTED",
      failureCategory: "upstream_business_failed",
      providerDiagnostic: "Bearer private-key rejected https://private.example/file.png?token=secret apiKey=also-secret",
      message: "Authorization: Bearer another-secret",
      runId: "run-1",
      runStepId: "step-2",
      nodeId: "image-2",
      nodeType: "image",
      stepNumber: 2,
      providerName: "RunningHub",
      modelName: "RH Image",
      taskId: "task-3",
      requestId: "request-4",
      upstreamHttpStatus: 400,
    });

    expect(diagnostic).toMatchObject({
      location: {
        runId: "run-1",
        runStepId: "step-2",
        nodeId: "image-2",
        nodeType: "image",
        stepNumber: 2,
        providerName: "RunningHub",
        modelName: "RH Image",
      },
      technical: { code: "UPSTREAM_REJECTED", taskId: "task-3", requestId: "request-4", upstreamHttpStatus: 400 },
    });
    expect(JSON.stringify(diagnostic)).not.toMatch(/private-key|another-secret|also-secret|private\.example|token=|apiKey/i);
  });
});
