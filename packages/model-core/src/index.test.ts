import { describe, expect, it } from "vitest";
import { defaultParameterSchemaForModel, uiMetadataFromSchema } from "./index.js";

it("exposes APIMart GPT Image 2.6 reference limits and full aspect ratios", () => {
  const schema = defaultParameterSchemaForModel("image", "gpt-image-2.6-flare", "apimart");
  expect(schema.referenceImages?.max).toBe(16);
  expect(schema.aspectRatio?.options).toContain("21:9");
});

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
