export interface OutputPreviewFrameInput {
  nodeWidth: number;
  nodeHeight?: number;
  mediaWidth?: number;
  mediaHeight?: number;
  multiItem: boolean;
}

export function computeOutputPreviewFrameHeight(input: OutputPreviewFrameInput) {
  if (input.multiItem) return 140;
  const mediaWidth = input.mediaWidth ?? 0;
  const mediaHeight = input.mediaHeight ?? 0;
  const frameWidth = Math.max(180, input.nodeWidth - 20);
  const fittedHeight =
    mediaWidth > 0 && mediaHeight > 0
      ? Math.round((frameWidth / mediaWidth) * mediaHeight)
      : input.nodeHeight ?? 420;
  return clamp(fittedHeight, 180, 420);
}

export function computeOutputNodeAutoHeight(frameHeight: number) {
  return frameHeight + 72;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
