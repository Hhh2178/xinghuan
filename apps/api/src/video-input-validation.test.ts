import { describe, expect, it } from "vitest";
import { validateVideoInputs } from "./video-input-validation.js";

const fullCapabilities = {
  prompt: true,
  imageReference: true,
  multiImage: true,
  firstFrame: true,
  lastFrame: true,
  audioReference: true,
};

describe("validateVideoInputs", () => {
  it("normalizes one ordered first-frame image", () => {
    expect(validateVideoInputs({
      mode: "first",
      images: ["a"],
      audios: [],
      capabilities: fullCapabilities,
      maxReferenceImages: 9,
      maxReferenceAudios: 3,
    })).toMatchObject({ modeType: "image2video", images: ["a"], firstFrame: "a" });
  });

  it("normalizes one ordered last-frame image", () => {
    expect(validateVideoInputs({
      mode: "last",
      images: ["a"],
      audios: [],
      capabilities: fullCapabilities,
      maxReferenceImages: 9,
      maxReferenceAudios: 3,
    })).toMatchObject({ modeType: "image2video", images: ["a"], lastFrame: "a" });
  });

  it.each([
    ["first", [], "首帧模式需要且只能使用 1 张图片"],
    ["first", ["a", "b"], "首帧模式需要且只能使用 1 张图片"],
    ["last", [], "尾帧模式需要且只能使用 1 张图片"],
    ["last", ["a", "b"], "尾帧模式需要且只能使用 1 张图片"],
    ["firstlast", ["a"], "首尾帧模式需要且只能使用 2 张图片"],
    ["firstlast", ["a", "b", "c"], "首尾帧模式需要且只能使用 2 张图片"],
  ] as const)("rejects invalid %s image counts", (mode, images, message) => {
    expect(() => validateVideoInputs({
      mode,
      images: [...images],
      audios: [],
      capabilities: fullCapabilities,
      maxReferenceImages: 9,
      maxReferenceAudios: 3,
    })).toThrow(message);
  });

  it("rejects reference and audio overflow without truncation", () => {
    const tenImages = Array.from({ length: 10 }, (_, index) => `image-${index}`);
    expect(() => validateVideoInputs({
      mode: "reference",
      images: tenImages,
      audios: [],
      capabilities: fullCapabilities,
      maxReferenceImages: 9,
      maxReferenceAudios: 3,
    })).toThrow("参考图最多允许 9 张");
    expect(() => validateVideoInputs({
      mode: "reference",
      images: [],
      audios: ["a", "b", "c", "d"],
      capabilities: fullCapabilities,
      maxReferenceImages: 9,
      maxReferenceAudios: 3,
    })).toThrow("参考音频最多允许 3 条");
  });

  it("uses the schema maximum even when the legacy multi-image flag is false", () => {
    expect(validateVideoInputs({
      mode: "reference",
      images: ["a", "b", "c"],
      audios: [],
      capabilities: { ...fullCapabilities, multiImage: false },
      maxReferenceImages: 3,
      maxReferenceAudios: 3,
    })).toMatchObject({ images: ["a", "b", "c"] });
  });

  it("enforces model capabilities", () => {
    expect(() => validateVideoInputs({
      mode: "first",
      images: ["a"],
      audios: [],
      capabilities: { ...fullCapabilities, firstFrame: false },
      maxReferenceImages: 9,
      maxReferenceAudios: 3,
    })).toThrow("当前模型未开启首帧能力");
  });

  it("allows text-to-video for a model with no image inputs", () => {
    expect(validateVideoInputs({
      mode: "reference",
      images: [],
      audios: [],
      capabilities: { ...fullCapabilities, imageReference: false, multiImage: false, firstFrame: false, lastFrame: false },
      maxReferenceImages: 0,
      maxReferenceAudios: 0,
    })).toMatchObject({ modeType: "text2video", images: [] });
  });
});
