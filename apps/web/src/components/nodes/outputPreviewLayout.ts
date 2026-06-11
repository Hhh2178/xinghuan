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
  return clamp(fittedHeight, 180, 820);
}

export function computeOutputNodeAutoHeight(frameHeight: number) {
  return frameHeight + 116;
}

export interface OutputGridRowHeightInput {
  count: number;
  columns: number;
  nodeWidth: number;
  nodeHeight?: number;
  media: Array<{ width?: number; height?: number } | undefined>;
}

export interface OutputGridColumnsInput {
  count: number;
  nodeWidth: number;
}

export interface OutputGridLayoutInput {
  count: number;
  nodeWidth: number;
  nodeHeight?: number;
  media: Array<{ width?: number; height?: number } | undefined>;
}

export interface OutputGridLayout {
  columns: number;
  rows: number;
  mediaHeight: number;
  cardHeight: number;
  gridHeight: number;
}

export function computeOutputGridColumns(input: OutputGridColumnsInput) {
  const safeCount = Math.max(1, input.count);
  if (safeCount === 1) return 1;
  const width = Math.max(260, input.nodeWidth);
  if (safeCount === 2) return width < 380 ? 1 : 2;
  if (safeCount === 3) return width < 460 ? 2 : 3;
  if (width < 420) return 2;
  if (width < 680) return Math.min(3, safeCount);
  return Math.min(4, safeCount);
}

export function computeOutputGridLayout(input: OutputGridLayoutInput): OutputGridLayout {
  const columns = computeOutputGridColumns(input);
  const rows = Math.ceil(Math.max(1, input.count) / columns);
  const mediaHeight = computeOutputGridRowHeight({ ...input, columns });
  const gap = 8;
  const footerHeight = 18;
  const cardHeight = mediaHeight + footerHeight;
  return {
    columns,
    rows,
    mediaHeight,
    cardHeight,
    gridHeight: rows * cardHeight + Math.max(0, rows - 1) * gap,
  };
}

export function computeOutputGridRowHeight(input: OutputGridRowHeightInput) {
  const safeCount = Math.max(1, input.count);
  const columns = Math.max(1, input.columns);
  const rows = Math.ceil(safeCount / columns);
  const gap = 8;
  const contentWidth = Math.max(220, input.nodeWidth - 20);
  const cellWidth = Math.max(96, Math.floor((contentWidth - (columns - 1) * gap) / columns));
  const fittedHeights = input.media
    .map((item) => {
      const width = item?.width ?? 0;
      const height = item?.height ?? 0;
      return width > 0 && height > 0 ? Math.round((cellWidth / width) * height) : 0;
    })
    .filter((height) => height > 0);
  const naturalHeight =
    fittedHeights.length > 0
      ? percentile(fittedHeights, 0.75)
      : Math.round(cellWidth * 0.72);
  const availableRowHeight =
    typeof input.nodeHeight === 'number'
      ? Math.floor((Math.max(140, input.nodeHeight - 104) - (rows - 1) * gap) / rows)
      : undefined;
  const responsiveTarget = availableRowHeight
    ? Math.min(availableRowHeight, Math.round(naturalHeight * 1.08))
    : naturalHeight;
  const upperBound = Math.min(720, Math.max(140, responsiveTarget));
  return clamp(naturalHeight, 96, upperBound);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function percentile(values: number[], ratio: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)));
  return sorted[index];
}
