import { describe, expect, it } from "vitest";

import { createOpenAiAudioChatPayload, extractAudioProviderResult } from "./audio-provider-adapter";

describe("audio provider adapter", () => {
  it("requires a valid data url sample for voice clone mode", () => {
    expect(() =>
      createOpenAiAudioChatPayload({
        modelId: "audio-model",
        text: "hello",
        mode: "voice_clone",
      }),
    ).toThrow("音色克隆需要参考音频样本");

    const payload = createOpenAiAudioChatPayload({
      modelId: "audio-model",
      text: "hello",
      mode: "voice_clone",
      sampleDataUrl: "data:audio/wav;base64,UklGRg==",
    });

    expect(payload.audio.voice).toBe("data:audio/wav;base64,UklGRg==");
  });

  it("extracts nested audio data urls from provider responses", () => {
    const result = extractAudioProviderResult({
      choices: [{ message: { content: "ok", audio: { data: "data:audio/wav;base64,UklGRg==" } } }],
    });

    expect(result.text).toBe("ok");
    expect(result.audioDataUrls).toEqual(["data:audio/wav;base64,UklGRg=="]);
    expect(result.audioUrls).toEqual([]);
  });
});
