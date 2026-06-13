import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  extractApimartTask,
} from "../apps/api/src/apimart-video-adapter.js";
import {
  normalizeProviderProtocol,
} from "../apps/api/src/provider-model-catalog.js";

const root = process.cwd();
const externalProxySource = readFileSync(join(root, "apps", "api", "src", "external-proxy.ts"), "utf8");
const workerSource = readFileSync(join(root, "apps", "worker", "src", "worker.ts"), "utf8");
const workerUtilsSource = readFileSync(join(root, "apps", "worker", "src", "worker-provider-utils.ts"), "utf8");

const openAiLikeSyncRaw = {
  created: 1781260000,
  data: [],
  request_id: "req_sync_only_123",
  id: "img_resp_123",
};

const explicitApimartTaskRaw = {
  code: 200,
  data: [{ task_id: "task_image_verify_123", status: "submitted" }],
};

const checks = [
  {
    name: "normalizeProviderProtocol recognizes modelscope",
    pass: normalizeProviderProtocol("modelscope") === "modelscope",
  },
  {
    name: "normalizeProviderProtocol keeps unknown protocols on openai fallback",
    pass: normalizeProviderProtocol("totally-unknown-protocol") === "openai",
  },
  {
    name: "APIMart task extractor still recognizes explicit task_id",
    pass: extractApimartTask(explicitApimartTaskRaw, { taskIdPath: "data.0.task_id" }).taskId === "task_image_verify_123",
  },
  {
    name: "APIMart task extractor does not treat plain request_id/id as image async task by default",
    pass: extractApimartTask(openAiLikeSyncRaw, { taskIdPath: "data.0.task_id" }).taskId === "",
  },
  {
    name: "external proxy includes modelscope protocol branch",
    pass: externalProxySource.includes('"modelscope"'),
  },
  {
    name: "external proxy contains ModelScope async image headers",
    pass:
      externalProxySource.includes('"X-ModelScope-Async-Mode"') &&
      externalProxySource.includes('"X-ModelScope-Task-Type"'),
  },
  {
    name: "external proxy applies ModelScope image reference aliases",
    pass:
      externalProxySource.includes("payload.images = imageUrls") &&
      externalProxySource.includes("payload.image_url = imageUrls[0]") &&
      externalProxySource.includes("payload.image_urls = imageUrls"),
  },
  {
    name: "worker includes modelscope protocol branch",
    pass: workerSource.includes('"modelscope"'),
  },
  {
    name: "worker image adapter contains ModelScope async image headers",
    pass:
      workerSource.includes('"X-ModelScope-Async-Mode"') &&
      workerSource.includes('"X-ModelScope-Task-Type"'),
  },
  {
    name: "worker applies ModelScope image reference aliases",
    pass:
      workerSource.includes("requestBody.images = imageUrls") &&
      workerSource.includes("requestBody.image_url = imageUrls[0]") &&
      workerSource.includes("requestBody.image_urls = imageUrls"),
  },
  {
    name: "worker image extractor supports nested images arrays for async providers",
    pass: workerUtilsSource.includes('"images"') && workerUtilsSource.includes('"result"'),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length > 0) {
  console.error("ModelScope image adapter contract verification failed:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
