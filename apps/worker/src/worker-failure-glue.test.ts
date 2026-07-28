import { describe, expect, it } from "vitest";

import { normalizeUnifiedFailure } from "./worker-failure-glue.js";

describe("worker failure normalization", () => {
  it("classifies provider routing exhaustion as an upstream gateway failure", () => {
    const error = Object.assign(new Error(
      '上游视频生成失败 400: {"code":"fail_to_fetch_task","message":"no available platform found for model grok-1.5-video-15s and no fallbacks configured"}',
    ), { status: 400 });

    expect(normalizeUnifiedFailure(error)).toMatchObject({
      failureCategory: "upstream_poll_gateway_failed",
      upstreamHttpStatus: 400,
    });
  });

  it("classifies synchronous provider parameter rejection as model configuration", () => {
    const error = Object.assign(new Error(
      "上游视频生成失败 400: 请求参数有误，请检查输入内容和参数格式。",
    ), { status: 400 });

    expect(normalizeUnifiedFailure(error)).toMatchObject({
      failureCategory: "model_config",
      upstreamHttpStatus: 400,
    });
  });
});
