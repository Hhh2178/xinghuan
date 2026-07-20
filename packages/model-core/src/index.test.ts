import { describe, expect, it } from "vitest";
import { uiMetadataFromSchema } from "./index.js";

describe("uiMetadataFromSchema video reference audio metadata", () => {
  it("publishes the configured audio limit for video models", () => {
    const ui = uiMetadataFromSchema(
      { referenceAudio: { type: "audio[]", max: 3 } },
      "video",
      { audioReference: true },
    );

    expect(ui.maxReferenceAudios).toBe(3);
    expect(ui.inputCapabilities.audioReference).toBe(true);
  });

  it("caps the public audio limit at ten", () => {
    const ui = uiMetadataFromSchema(
      { referenceAudio: { type: "audio[]", max: 99 } },
      "video",
      { audioReference: true },
    );

    expect(ui.maxReferenceAudios).toBe(10);
  });
});
