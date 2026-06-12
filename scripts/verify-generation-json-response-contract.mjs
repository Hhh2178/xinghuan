import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const source = await readFile(new URL("../apps/web/src/services/generation.ts", import.meta.url), "utf8");

  assert.match(source, /function looksLikeHtmlResponse\(text: string\)/, "generation service should detect HTML payloads");
  assert.match(source, /async function readJsonResponse\(response: Response, label: string\)/, "generation service should normalize JSON parsing");
  assert.match(source, /返回了 HTML 页面，请检查登录状态、网关代理或上游配置/, "generation service should expose a clear HTML response error");
  assert.doesNotMatch(source, /await r\.json\(\)/, "generation service should not directly call r.json()");
  assert.doesNotMatch(source, /await response\.json\(\)/, "generation service should not directly call response.json()");

  const guardedLabels = [
    "扩展视频生成接口",
    "视频提交接口",
    "视频轮询接口",
    "FAL 视频提交接口",
    "FAL 视频轮询接口",
    "Seedance 提交接口",
    "Seedance 轮询接口",
    "音频提交接口",
    "音频轮询接口",
    "RunningHub 提交接口",
    "RunningHub 轮询接口",
  ];

  for (const label of guardedLabels) {
    assert.match(source, new RegExp(`readJsonResponse\\(r, '${escapeRegExp(label)}'\\)`), `${label} should use readJsonResponse`);
  }

  console.log("PASS generation service JSON/HTML guard contract is present");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
