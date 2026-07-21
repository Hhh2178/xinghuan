export interface MediaNodeSize {
  w: number;
  h: number;
}

export interface MediaNodeConstraint {
  aspectRatio: number;
  horizontalChrome: number;
  verticalChrome: number;
  minWidth: number;
  minHeight: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface MediaNodeLayoutMetrics {
  rootWidth: number;
  headerHeight: number;
  bodyScrollHeight: number;
  mediaWidth: number;
  mediaHeight: number;
  borderCompensation?: number;
}

export function measureMediaNodeChrome(metrics: MediaNodeLayoutMetrics) {
  const borderCompensation = Math.max(0, metrics.borderCompensation ?? 0);
  return {
    horizontal: Math.max(0, metrics.rootWidth - metrics.mediaWidth),
    vertical: Math.max(
      0,
      metrics.headerHeight + metrics.bodyScrollHeight - metrics.mediaHeight + borderCompensation,
    ),
  };
}

export function mediaAspectRatio(width: number, height: number): number | undefined {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return undefined;
  return width / height;
}

export function fitMediaNodeFromWidth(width: number, constraint: MediaNodeConstraint): MediaNodeSize {
  const safeAspect = normalizeAspectRatio(constraint.aspectRatio);
  const horizontalChrome = Math.max(0, constraint.horizontalChrome);
  const verticalChrome = Math.max(0, constraint.verticalChrome);
  const slope = 1 / safeAspect;
  const intercept = verticalChrome - horizontalChrome * slope;
  const widthBounds = resolveWidthBounds(constraint, slope, intercept);
  const w = clamp(width, widthBounds.min, widthBounds.max);
  return { w, h: slope * w + intercept };
}

export function constrainMediaNodeResize(
  rawSize: MediaNodeSize,
  constraint: MediaNodeConstraint,
): MediaNodeSize {
  const safeAspect = normalizeAspectRatio(constraint.aspectRatio);
  const horizontalChrome = Math.max(0, constraint.horizontalChrome);
  const verticalChrome = Math.max(0, constraint.verticalChrome);
  const slope = 1 / safeAspect;
  const intercept = verticalChrome - horizontalChrome * slope;
  const widthBounds = resolveWidthBounds(constraint, slope, intercept);

  // Project the pointer-driven size onto h = slope * w + intercept. This lets
  // either horizontal or vertical corner movement drive the locked media ratio.
  const projectedWidth = (rawSize.w + slope * (rawSize.h - intercept)) / (1 + slope * slope);
  const w = clamp(projectedWidth, widthBounds.min, widthBounds.max);
  return { w, h: slope * w + intercept };
}

function resolveWidthBounds(
  constraint: MediaNodeConstraint,
  slope: number,
  intercept: number,
) {
  const fromMinHeight = (constraint.minHeight - intercept) / slope;
  const fromMaxHeight = constraint.maxHeight === undefined
    ? Number.POSITIVE_INFINITY
    : (constraint.maxHeight - intercept) / slope;
  const min = Math.max(constraint.minWidth, fromMinHeight);
  const requestedMax = constraint.maxWidth ?? Number.POSITIVE_INFINITY;
  return { min, max: Math.max(min, Math.min(requestedMax, fromMaxHeight)) };
}

function normalizeAspectRatio(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
