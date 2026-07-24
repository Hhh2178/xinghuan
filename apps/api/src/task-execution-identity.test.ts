import { describe, expect, it } from "vitest";

import {
  normalizeTaskExecutionIdentitySnapshot,
  projectTaskExecutionIdentity,
} from "./task-execution-identity.js";

describe("task execution identity", () => {
  it("prefers the immutable task snapshot over renamed live catalog values", () => {
    expect(projectTaskExecutionIdentity({
      providerId: "provider-rh",
      modelRecordId: "model-rh-video",
      snapshot: {
        providerId: "provider-rh",
        providerName: "RunningHub",
        modelRecordId: "model-rh-video",
        providerModelId: "/rhart-video-g/image-to-video",
        modelName: "RH 图生视频",
      },
      live: {
        providerName: "Renamed Provider",
        providerModelId: "renamed-model",
        modelName: "Renamed Model",
      },
    })).toEqual({
      providerId: "provider-rh",
      providerName: "RunningHub",
      modelRecordId: "model-rh-video",
      providerModelId: "/rhart-video-g/image-to-video",
      modelName: "RH 图生视频",
    });
  });

  it("uses live catalog names for legacy rows without a snapshot", () => {
    expect(projectTaskExecutionIdentity({
      providerId: "provider-a",
      modelRecordId: "model-a",
      live: {
        providerName: "平台 A",
        providerModelId: "provider/model-a",
        modelName: "模型 A",
      },
    })).toMatchObject({
      providerName: "平台 A",
      providerModelId: "provider/model-a",
      modelName: "模型 A",
    });
  });

  it("falls back to stable raw ids after catalog deletion", () => {
    expect(projectTaskExecutionIdentity({
      providerId: "provider-deleted",
      modelRecordId: "model-deleted",
    })).toEqual({
      providerId: "provider-deleted",
      providerName: "provider-deleted",
      modelRecordId: "model-deleted",
      providerModelId: "model-deleted",
      modelName: "model-deleted",
    });
  });

  it("normalizes untrusted snapshot input into bounded strings", () => {
    expect(normalizeTaskExecutionIdentitySnapshot({
      providerId: " provider-a ",
      providerName: "平台 A",
      modelRecordId: "model-a",
      providerModelId: "/model-a",
      modelName: "模型 A",
      apiKey: "must-not-survive",
    })).toEqual({
      providerId: "provider-a",
      providerName: "平台 A",
      modelRecordId: "model-a",
      providerModelId: "/model-a",
      modelName: "模型 A",
    });
  });
});
