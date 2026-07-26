import { describe, expect, it } from "vitest";
import { resolveVideoPromptByteLimit, validateVideoInputs, validateVideoPromptBytes } from "./video-input-validation.js";

const fullCapabilities = {
  prompt: true,
  imageReference: true,
  multiImage: true,
  firstFrame: true,
  lastFrame: true,
  audioReference: true,
  videoReference: true,
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

  it("preserves validated reference videos", () => {
    expect(validateVideoInputs({
      mode: "reference",
      images: [],
      videos: ["motion-a.mp4", "motion-b.mp4"],
      audios: [],
      capabilities: fullCapabilities,
      maxReferenceImages: 9,
      maxReferenceVideos: 3,
      maxReferenceAudios: 3,
    })).toMatchObject({ videos: ["motion-a.mp4", "motion-b.mp4"] });
  });

  it("accepts up to ten reference videos and audios", () => {
    expect(validateVideoInputs({
      mode: "reference",
      images: [],
      videos: Array.from({ length: 10 }, (_, index) => `video-${index}`),
      audios: Array.from({ length: 10 }, (_, index) => `audio-${index}`),
      capabilities: fullCapabilities,
      maxReferenceImages: 9,
      maxReferenceVideos: 10,
      maxReferenceAudios: 10,
    })).toMatchObject({ videos: expect.arrayContaining(["video-9"]), audios: expect.arrayContaining(["audio-9"]) });
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

describe("validateVideoPromptBytes", () => {
  it("counts UTF-8 bytes instead of JavaScript characters", () => {
    expect(() => validateVideoPromptBytes("中".repeat(1366), 4096)).toThrow("4098 字节，超过当前模型 4096 字节限制");
    expect(validateVideoPromptBytes("中".repeat(1365), 4096)).toBe(4095);
  });
});

describe("resolveVideoPromptByteLimit", () => {
  it.each(["aicopy", "aifork", "runninghub", "openai", "custom", ""])(
    "does not block %s or use a catalog byte limit before the provider sees the request",
    (protocol) => {
      expect(resolveVideoPromptByteLimit(protocol, 4096)).toBe(0);
    },
  );
});
