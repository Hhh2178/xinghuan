import assert from "node:assert/strict";
import { createRunningHubClient } from "../apps/worker/src/worker-runninghub-client.ts";

async function main() {
  await verifyWorkflowSubmitAndPollSuccess();
  await verifyAppSubmitAndPollSuccess();
  await verifySubmitFailureReturnsStructuredPatch();
  await verifySuccessWithoutOutputsFailsAsBusinessFailure();
}

async function verifyWorkflowSubmitAndPollSuccess() {
  let pollAttempts = 0;
  const heartbeats: Array<Record<string, unknown>> = [];
  const client = createRunningHubClient({
    apiKey: "rh-test-key",
    baseUrl: "https://www.runninghub.cn",
    fetcher: async (input, init) => {
      const url = String(input);
      if (url.endsWith("/openapi/v2/run/workflow/2064255815862800385")) {
        assert.equal(init?.method, "POST");
        return jsonResponse(200, {
          taskId: "workflow-task-1",
          status: "RUNNING",
          errorCode: "",
          errorMessage: "",
          results: null,
        });
      }
      if (url.endsWith("/openapi/v2/query")) {
        pollAttempts += 1;
        if (pollAttempts === 1) {
          return jsonResponse(200, {
            taskId: "workflow-task-1",
            status: "RUNNING",
            errorCode: "",
            errorMessage: "",
            results: null,
          });
        }
        return jsonResponse(200, {
          taskId: "workflow-task-1",
          status: "SUCCESS",
          errorCode: "",
          errorMessage: "",
          results: [
            {
              url: "https://cdn.example.test/runninghub-workflow-image.png",
              nodeId: "2",
              outputType: "png",
              text: null,
            },
          ],
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    },
    wait: async () => undefined,
  });

  const result = await client.runTask({
    targetType: "workflow",
    runTargetId: "2064255815862800385",
    workflowId: "2064255815862800385",
    nodeInfoList: [],
    pollIntervalMs: 0,
    timeoutMs: 5000,
    onHeartbeat: (patch) => {
      heartbeats.push(patch);
    },
  });

  assert.equal(result.upstreamTaskId, "workflow-task-1");
  assert.equal(result.rhTargetType, "workflow");
  assert.deepEqual(result.imageUrls, ["https://cdn.example.test/runninghub-workflow-image.png"]);
  assert.equal(pollAttempts, 2);
  assert.ok(heartbeats.length >= 2);
  console.log("PASS worker runninghub client supports workflow submit and poll success");
}

async function verifyAppSubmitAndPollSuccess() {
  const client = createRunningHubClient({
    apiKey: "rh-test-key",
    baseUrl: "https://www.runninghub.cn",
    fetcher: async (input) => {
      const url = String(input);
      if (url.endsWith("/openapi/v2/run/ai-app/1978404642654670849")) {
        return jsonResponse(200, {
          code: 0,
          data: {
            taskId: "app-task-1",
            status: "RUNNING",
          },
        });
      }
      if (url.endsWith("/openapi/v2/query")) {
        return jsonResponse(200, {
          taskId: "app-task-1",
          status: "SUCCESS",
          errorCode: "",
          errorMessage: "",
          results: [
            {
              url: "https://cdn.example.test/runninghub-app-video.mp4",
              nodeId: "4",
              outputType: "mp4",
              text: null,
            },
          ],
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    },
    wait: async () => undefined,
  });

  const result = await client.runTask({
    targetType: "app",
    runTargetId: "1978404642654670849",
    webappId: "1978404642654670849",
    nodeInfoList: [],
    pollIntervalMs: 0,
    timeoutMs: 5000,
  });

  assert.equal(result.rhTargetType, "app");
  assert.deepEqual(result.videoUrls, ["https://cdn.example.test/runninghub-app-video.mp4"]);
  console.log("PASS worker runninghub client supports app submit and poll success");
}

async function verifySubmitFailureReturnsStructuredPatch() {
  const client = createRunningHubClient({
    apiKey: "rh-test-key",
    baseUrl: "https://www.runninghub.cn",
    fetcher: async (input) => {
      const url = String(input);
      if (url.endsWith("/openapi/v2/run/workflow/2064255815862800385")) {
        return textResponse(502, "<html><body>gateway unavailable</body></html>", "text/html");
      }
      throw new Error(`Unexpected URL ${url}`);
    },
    wait: async () => undefined,
  });

  await assert.rejects(
    () => client.runTask({
      targetType: "workflow",
      runTargetId: "2064255815862800385",
      workflowId: "2064255815862800385",
      nodeInfoList: [],
      pollIntervalMs: 0,
      timeoutMs: 5000,
    }),
    (error: unknown) => {
      const typed = error as {
        message?: string;
        resultPatch?: Record<string, unknown>;
      };
      assert.match(String(typed.message || ""), /RunningHub 提交失败 502/i);
      assert.equal(typed.resultPatch?.rhFailureStage, "submit");
      assert.equal(typed.resultPatch?.rhSubmitResponseStatus, 502);
      assert.match(String(typed.resultPatch?.rhSubmitResponseText || ""), /gateway unavailable/i);
      return true;
    },
  );

  console.log("PASS worker runninghub client preserves structured submit failure patch");
}

async function verifySuccessWithoutOutputsFailsAsBusinessFailure() {
  const client = createRunningHubClient({
    apiKey: "rh-test-key",
    baseUrl: "https://www.runninghub.cn",
    fetcher: async (input) => {
      const url = String(input);
      if (url.endsWith("/openapi/v2/run/workflow/2064255815862800385")) {
        return jsonResponse(200, {
          taskId: "workflow-task-empty-1",
          status: "RUNNING",
        });
      }
      if (url.endsWith("/openapi/v2/query")) {
        return jsonResponse(200, {
          taskId: "workflow-task-empty-1",
          status: "SUCCESS",
          errorCode: "",
          errorMessage: "",
          results: [],
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    },
    wait: async () => undefined,
  });

  await assert.rejects(
    () => client.runTask({
      targetType: "workflow",
      runTargetId: "2064255815862800385",
      workflowId: "2064255815862800385",
      nodeInfoList: [],
      pollIntervalMs: 0,
      timeoutMs: 5000,
    }),
    (error: unknown) => {
      const typed = error as {
        resultPatch?: Record<string, unknown>;
        message?: string;
      };
      assert.match(String(typed.message || ""), /未返回可用输出/);
      assert.equal(typed.resultPatch?.failureCategory, "upstream_business_failed");
      return true;
    },
  );

  console.log("PASS worker runninghub client treats output-less success as business failure");
}

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function textResponse(status: number, body: string, contentType = "text/plain") {
  return new Response(body, {
    status,
    headers: {
      "content-type": contentType,
    },
  });
}

void main();
