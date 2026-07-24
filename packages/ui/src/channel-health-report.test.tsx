import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ChannelHealthReport } from "@xinghuan/shared";
import { ChannelHealthReportView } from "./channel-health-report.js";

const report: ChannelHealthReport = {
  generatedAt: Date.parse("2026-07-24T08:00:00.000Z"),
  windowStartAt: Date.parse("2026-07-21T08:00:00.000Z"),
  windowEndAt: Date.parse("2026-07-24T10:00:00.000Z"),
  bucketHours: 2,
  bucketCount: 36,
  providers: [{
    id: "provider-1",
    name: "Provider One",
    enabled: true,
    state: "healthy",
    models: [{
      providerId: "provider-1",
      modelRecordId: "model-1",
      nativeModelId: "native-1",
      displayName: "Model One",
      capability: "image",
      enabled: true,
      state: "healthy",
      succeeded: 19,
      failed: 1,
      settled: 20,
      successRate: 0.95,
      buckets: [
        { startAt: Date.parse("2026-07-21T08:00:00.000Z"), endAt: Date.parse("2026-07-21T10:00:00.000Z"), succeeded: 4, failed: 0, settled: 4, successRate: 1, sufficientSample: true },
        { startAt: Date.parse("2026-07-21T12:00:00.000Z"), endAt: Date.parse("2026-07-21T14:00:00.000Z"), succeeded: 3, failed: 1, settled: 4, successRate: 0.75, sufficientSample: true },
      ],
      feedback: { window: "24h", up: 8, down: 2, total: 10, upRate: 0.8, viewerVote: null },
    }],
  }],
};

describe("ChannelHealthReportView", () => {
  it("renders the provider hierarchy, stable bucket positions, and aggregate feedback", () => {
    const html = renderToStaticMarkup(<ChannelHealthReportView report={report} selectedCapability="image" interactiveFeedback />);

    expect(html.indexOf("Provider One")).toBeLessThan(html.indexOf("Model One"));
    expect(html).toContain("成功 19 · 失败 1");
    expect(html.match(/data-channel-bucket=/g)).toHaveLength(36);
    expect(html.match(/data-empty="true"/g)).toHaveLength(34);
    expect(html).toContain("赞 8");
    expect(html).toContain("踩 2");
    expect(html).not.toContain("ownerId");
  });

  it("breaks the trend path across empty buckets and hides buttons for read-only views", () => {
    const html = renderToStaticMarkup(<ChannelHealthReportView report={report} selectedCapability="image" interactiveFeedback={false} />);

    expect(html.match(/data-trend-segment=/g)).toHaveLength(2);
    expect(html).not.toContain("aria-label=\"赞 Model One\"");
    expect(html).toContain("图像");
    expect(html).toContain("视频");
    expect(html).toContain("音频");
    expect(html).toContain("LLM");
  });
});
