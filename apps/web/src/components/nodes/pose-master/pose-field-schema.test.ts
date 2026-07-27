import { describe, expect, it } from "vitest";

import {
  HAND_DIRECTION_OPTIONS,
  HAND_SHAPE_OPTIONS,
  POSE_BATCH_MODES,
  POSE_INTENSITY_OPTIONS,
  POSE_RENDER_MODES,
  SHOT_OPTIONS,
  VIEW_OPTIONS,
  type HandControls,
} from "./pose-field-schema";

describe("PoseMaster field schema", () => {
  it("preserves persisted option ids and display ordering", () => {
    expect(VIEW_OPTIONS.map((item) => item.id)).toEqual(["front", "three-quarter", "side", "back"]);
    expect(SHOT_OPTIONS.map((item) => item.id)).toEqual(["full-body", "medium-full", "medium", "close"]);
    expect(POSE_INTENSITY_OPTIONS.map((item) => item.id)).toEqual(["natural", "exaggerated", "manga", "combat", "stage"]);
    expect(POSE_BATCH_MODES.map((item) => item.id)).toEqual(["next", "random", "current"]);
    expect(POSE_RENDER_MODES.map((item) => item.id)).toEqual(["lineart", "openpose", "coco"]);
    expect(HAND_SHAPE_OPTIONS.map((item) => item.id)).toEqual(["open", "fist", "point"]);
    expect(HAND_DIRECTION_OPTIONS.map((item) => item.id)).toEqual(["front", "side", "up", "down"]);
  });

  it("keeps the persisted hand-control shape available to the node runtime", () => {
    const controls: HandControls = {
      left: { shape: "open", direction: "front" },
      right: { shape: "fist", direction: "side" },
    };
    expect(controls.right).toEqual({ shape: "fist", direction: "side" });
  });
});
