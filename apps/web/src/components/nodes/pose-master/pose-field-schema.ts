export type HandShape = "open" | "fist" | "point";
export type HandDirection = "front" | "side" | "up" | "down";
export type HandSideControl = {
  shape: HandShape;
  direction: HandDirection;
};
export type HandControls = {
  left: HandSideControl;
  right: HandSideControl;
};
export type PoseBatchMode = "next" | "random" | "current";
export type PoseRenderMode = "lineart" | "openpose" | "coco";

export const HAND_SHAPE_OPTIONS: Array<{ id: HandShape; zh: string; en: string }> = [
  { id: "open", zh: "张开", en: "open palm" },
  { id: "fist", zh: "握拳", en: "closed fist" },
  { id: "point", zh: "指向", en: "pointing hand" },
];

export const HAND_DIRECTION_OPTIONS: Array<{ id: HandDirection; zh: string; en: string }> = [
  { id: "front", zh: "掌心向前", en: "palm facing camera" },
  { id: "side", zh: "侧掌", en: "side-facing palm" },
  { id: "up", zh: "掌心向上", en: "palm facing upward" },
  { id: "down", zh: "掌心向下", en: "palm facing downward" },
];

export const VIEW_OPTIONS = [
  { id: "front", zh: "正面", en: "front view" },
  { id: "three-quarter", zh: "四分之三", en: "three-quarter view" },
  { id: "side", zh: "侧面", en: "side view" },
  { id: "back", zh: "背面", en: "back view" },
] as const;

export const SHOT_OPTIONS = [
  { id: "full-body", zh: "全身", en: "full-body shot" },
  { id: "medium-full", zh: "七分身", en: "medium-full shot" },
  { id: "medium", zh: "中景", en: "medium shot" },
  { id: "close", zh: "近景", en: "close-up pose crop" },
] as const;

export const POSE_INTENSITY_OPTIONS = [
  { id: "natural", zh: "自然", en: "natural believable motion, relaxed body tension" },
  { id: "exaggerated", zh: "夸张", en: "exaggerated expressive motion, amplified silhouette and clear gesture" },
  { id: "manga", zh: "漫画感", en: "manga-style dynamic body language, readable silhouette and dramatic gesture" },
  { id: "combat", zh: "战斗感", en: "combat-ready motion, strong body tension, decisive action pose" },
  { id: "stage", zh: "舞台感", en: "stage performance pose, elegant line of action, theatrical presentation" },
] as const;

export const POSE_BATCH_MODES: Array<{ id: PoseBatchMode; zh: string; en: string }> = [
  { id: "next", zh: "分镜连续预设", en: "storyboard presets" },
  { id: "random", zh: "随机常用姿态", en: "random poses" },
  { id: "current", zh: "复制当前姿态", en: "duplicate current pose" },
];

export const POSE_RENDER_MODES: Array<{ id: PoseRenderMode; zh: string; en: string }> = [
  { id: "lineart", zh: "线稿图", en: "Line art" },
  { id: "openpose", zh: "OpenPose图", en: "OpenPose" },
  { id: "coco", zh: "COCO图", en: "COCO" },
];
