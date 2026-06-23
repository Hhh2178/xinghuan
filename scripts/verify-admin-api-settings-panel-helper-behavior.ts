import { strict as assert } from "node:assert";

import type { AssistantAnalysisResult, Capability } from "../apps/admin/src/admin-types";
import {
  buildAssistantIntegrationPlan,
  defaultInputCapabilitiesForCapability,
  defaultInputProfileForCapability,
  inferProviderProtocol,
  parseAssistantDocUrls,
  providerDraft,
  safeAssistantSchemaText,
} from "../apps/admin/src/admin-api-settings-panel-helpers";

const inferred = inferProviderProtocol(providerDraft({
  id: "custom",
  name: "ModelScope Custom",
  baseUrl: "https://api-inference.modelscope.cn/v1",
  protocol: "openai",
} as any));
assert.equal(inferred, "modelscope");

assert.deepEqual(
  parseAssistantDocUrls("https://a.example/doc\nnot-a-url\nhttps://b.example/spec\nhttps://a.example/doc"),
  ["https://a.example/doc", "https://b.example/spec"],
);

assert.equal(defaultInputProfileForCapability("audio"), "prompt,audio_reference");
assert.equal(defaultInputProfileForCapability("chat"), "prompt");

assert.deepEqual(
  defaultInputCapabilitiesForCapability("image"),
  {
    prompt: true,
    imageReference: true,
    multiImage: false,
    firstFrame: false,
    lastFrame: false,
  },
);

assert.equal(safeAssistantSchemaText("{\"foo\":1}"), "{\n  \"foo\": 1\n}");
assert.equal(safeAssistantSchemaText("nope"), "{}");

const plan = buildAssistantIntegrationPlan({
  drafts: {
    model: {
      inputProfile: "prompt,image_reference",
      inputCapabilities: { imageReference: true },
      advancedConfig: {
        submitPath: "/submit",
        pollPathTemplate: "/poll/{taskId}",
        finalResultPathTemplate: "/result/{taskId}",
        requestContentType: "multipart/form-data",
        requestMapping: { images: "image_urls" },
        requestFileFields: ["images"],
        requestValueTemplates: { webhookUrl: "{{webhook}}" },
        resultVideoPath: "results[0].url",
      },
    },
  },
} as AssistantAnalysisResult);

assert.equal(plan[0]?.value, "基于 Base URL 的相对路径");
assert.match(plan[1]?.value || "", /multipart\/form-data/);
assert.match(plan[2]?.value || "", /image_urls/);
assert.match(plan[4]?.value || "", /results\[0\]\.url/);

console.log("PASS admin api settings panel helper behavior");
