export const ASSISTANT_COMPACT_MAX_WIDTH = 900;

export interface AssistantAnchor {
  x: number;
  y: number;
}

export interface AssistantSize {
  width: number;
  height: number;
}

export interface AssistantRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AssistantLayout {
  compact: boolean;
  effectiveSide: 'left' | 'right';
  launcher: AssistantRect;
  panel: AssistantRect;
}

export interface AssistantMovementRegion {
  effectiveSide: 'left' | 'right';
  launcherBounds: AssistantRect;
  panelBounds: AssistantRect;
}

const SAFE_MARGIN = 12;
const LAUNCHER_SIZE = 48;
const PANEL_GAP = 10;
const MIN_PANEL_WIDTH = 320;
const MIN_PANEL_HEIGHT = 440;

export const DEFAULT_ASSISTANT_ANCHOR: AssistantAnchor = { x: 1320, y: 680 };
export const DEFAULT_ASSISTANT_SIZE: AssistantSize = { width: 430, height: 720 };

/** Keeps the launcher free inside the viewport and migrates the former edge-anchor shape. */
export function normalizeAssistantAnchor(value: unknown, viewport: { width: number; height: number }): AssistantAnchor {
  const source = object(value);
  const legacySide = source.side === 'left' ? 'left' : 'right';
  const legacyX = legacySide === 'left' ? SAFE_MARGIN : viewport.width - SAFE_MARGIN - LAUNCHER_SIZE;
  return {
    x: clamp(number(source.x, legacyX), SAFE_MARGIN, Math.max(SAFE_MARGIN, viewport.width - SAFE_MARGIN - LAUNCHER_SIZE)),
    y: clamp(number(source.y, viewport.height - SAFE_MARGIN - LAUNCHER_SIZE), SAFE_MARGIN, Math.max(SAFE_MARGIN, viewport.height - SAFE_MARGIN - LAUNCHER_SIZE)),
  };
}

export function normalizeAssistantSize(value: unknown, viewport: { width: number; height: number }): AssistantSize {
  const source = object(value);
  return {
    width: clamp(number(source.width, DEFAULT_ASSISTANT_SIZE.width), MIN_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, viewport.width - SAFE_MARGIN * 2)),
    height: clamp(number(source.height, DEFAULT_ASSISTANT_SIZE.height), MIN_PANEL_HEIGHT, Math.max(MIN_PANEL_HEIGHT, viewport.height - SAFE_MARGIN * 2)),
  };
}

export function snapAssistantAnchor(input: {
  pointerX: number;
  pointerY: number;
  viewportWidth: number;
  viewportHeight: number;
}): AssistantAnchor {
  return normalizeAssistantAnchor({
    x: input.pointerX - LAUNCHER_SIZE / 2,
    y: input.pointerY - LAUNCHER_SIZE / 2,
  }, { width: input.viewportWidth, height: input.viewportHeight });
}

export function resolveAssistantLayout(input: {
  viewportWidth: number;
  viewportHeight: number;
  anchor: AssistantAnchor;
  size: AssistantSize;
  supervisionRect?: AssistantRect | null;
  panelOpen?: boolean;
}): AssistantLayout {
  const viewport = { width: Math.max(320, input.viewportWidth), height: Math.max(480, input.viewportHeight) };
  const anchor = normalizeAssistantAnchor(input.anchor, viewport);
  const compact = viewport.width <= ASSISTANT_COMPACT_MAX_WIDTH;
  if (compact) {
    return { compact: true, effectiveSide: 'right', launcher: launcherRect(anchor), panel: { x: 8, y: 8, width: viewport.width - 16, height: viewport.height - 16 } };
  }

  const size = normalizeAssistantSize(input.size, viewport);
  if (input.panelOpen === false) {
    const resolvedAnchor = resolveLauncherAnchor(anchor, viewport, input.supervisionRect, SAFE_MARGIN);
    const launcher = launcherRect(resolvedAnchor);
    const preferredSide = preferredPanelSide(resolvedAnchor, viewport);
    return {
      compact: false,
      effectiveSide: preferredSide,
      launcher,
      panel: desktopPanelRect(preferredSide, launcher, size, viewport),
    };
  }

  const regions = resolveAssistantMovementRegion({
    viewport,
    panelSize: size,
    obstacle: input.supervisionRect,
    gap: SAFE_MARGIN,
  });
  const preferredSide = preferredPanelSide(anchor, viewport);
  const placement = nearestPlacement(anchor, regions, preferredSide);
  if (placement) {
    const launcher = launcherRect(placement.anchor);
    const panel = desktopPanelRectInRegion(placement.region.effectiveSide, launcher, size, placement.region.panelBounds);
    return { compact: false, effectiveSide: placement.region.effectiveSide, launcher, panel };
  }

  const launcher = launcherRect(resolveLauncherAnchor(anchor, viewport, input.supervisionRect, SAFE_MARGIN));
  const right = desktopPanelRect('right', launcher, size, viewport);
  const left = desktopPanelRect('left', launcher, size, viewport);
  const preferred = preferredSide === 'right' ? right : left;
  const alternative = preferred === right ? left : right;
  const supervision = input.supervisionRect;
  const panel = supervision && intersectionArea(preferred, supervision) > intersectionArea(alternative, supervision) ? alternative : preferred;
  return { compact: false, effectiveSide: panel === left ? 'left' : 'right', launcher, panel };
}

export function resolveAssistantMovementRegion(input: {
  viewport: AssistantSize;
  panelSize: AssistantSize;
  obstacle?: AssistantRect | null;
  gap?: number;
}): AssistantMovementRegion[] {
  const viewport = {
    width: Math.max(320, input.viewport.width),
    height: Math.max(480, input.viewport.height),
  };
  const panelSize = normalizeAssistantSize(input.panelSize, viewport);
  const safeViewport = insetViewport(viewport);
  const freeRects = subtractObstacle(safeViewport, input.obstacle, Math.max(0, input.gap ?? SAFE_MARGIN));
  const groupWidth = panelSize.width + PANEL_GAP + LAUNCHER_SIZE;

  return freeRects.flatMap((freeRect) => {
    if (freeRect.width < groupWidth || freeRect.height < panelSize.height) return [];
    const horizontalTravel = freeRect.width - groupWidth;
    const launcherVerticalTravel = freeRect.height - LAUNCHER_SIZE;
    const panelVerticalTravel = freeRect.height - panelSize.height;
    return [
      {
        effectiveSide: 'right' as const,
        launcherBounds: {
          x: freeRect.x,
          y: freeRect.y,
          width: horizontalTravel,
          height: launcherVerticalTravel,
        },
        panelBounds: {
          x: freeRect.x + LAUNCHER_SIZE + PANEL_GAP,
          y: freeRect.y,
          width: horizontalTravel,
          height: panelVerticalTravel,
        },
      },
      {
        effectiveSide: 'left' as const,
        launcherBounds: {
          x: freeRect.x + panelSize.width + PANEL_GAP,
          y: freeRect.y,
          width: horizontalTravel,
          height: launcherVerticalTravel,
        },
        panelBounds: {
          x: freeRect.x,
          y: freeRect.y,
          width: horizontalTravel,
          height: panelVerticalTravel,
        },
      },
    ];
  });
}

export function assistantRectsOverlap(left: AssistantRect, right: AssistantRect, gap = 0) {
  return left.x < right.x + right.width + gap && left.x + left.width + gap > right.x && left.y < right.y + right.height + gap && left.y + left.height + gap > right.y;
}

function launcherRect(anchor: AssistantAnchor): AssistantRect {
  return { x: anchor.x, y: anchor.y, width: LAUNCHER_SIZE, height: LAUNCHER_SIZE };
}

function desktopPanelRect(side: 'left' | 'right', launcher: AssistantRect, size: AssistantSize, viewport: { width: number; height: number }): AssistantRect {
  const desiredX = side === 'right' ? launcher.x + launcher.width + PANEL_GAP : launcher.x - PANEL_GAP - size.width;
  return {
    x: clamp(desiredX, SAFE_MARGIN, viewport.width - SAFE_MARGIN - size.width),
    y: clamp(launcher.y + launcher.height / 2 - size.height / 2, SAFE_MARGIN, viewport.height - SAFE_MARGIN - size.height),
    width: size.width,
    height: size.height,
  };
}

function desktopPanelRectInRegion(side: 'left' | 'right', launcher: AssistantRect, size: AssistantSize, bounds: AssistantRect): AssistantRect {
  const desiredX = side === 'right' ? launcher.x + launcher.width + PANEL_GAP : launcher.x - PANEL_GAP - size.width;
  return {
    x: clamp(desiredX, bounds.x, bounds.x + bounds.width),
    y: clamp(launcher.y + launcher.height / 2 - size.height / 2, bounds.y, bounds.y + bounds.height),
    width: size.width,
    height: size.height,
  };
}

function nearestPlacement(anchor: AssistantAnchor, regions: AssistantMovementRegion[], preferredSide: 'left' | 'right') {
  let nearest: { anchor: AssistantAnchor; region: AssistantMovementRegion; score: number } | null = null;
  for (const region of regions) {
    const candidate = clampAnchorToBounds(anchor, region.launcherBounds);
    const deltaX = candidate.x - anchor.x;
    const deltaY = candidate.y - anchor.y;
    const score = deltaX * deltaX + deltaY * deltaY + (region.effectiveSide === preferredSide ? 0 : 0.25);
    if (!nearest || score < nearest.score) nearest = { anchor: candidate, region, score };
  }
  return nearest;
}

function resolveLauncherAnchor(anchor: AssistantAnchor, viewport: AssistantSize, obstacle: AssistantRect | null | undefined, gap: number) {
  const freeRects = subtractObstacle(insetViewport(viewport), obstacle, gap)
    .filter((rect) => rect.width >= LAUNCHER_SIZE && rect.height >= LAUNCHER_SIZE);
  if (freeRects.length === 0) return anchor;
  let nearest = clampAnchorToBounds(anchor, launcherBoundsForRect(freeRects[0]));
  let nearestDistance = squaredDistance(anchor, nearest);
  for (const rect of freeRects.slice(1)) {
    const candidate = clampAnchorToBounds(anchor, launcherBoundsForRect(rect));
    const distance = squaredDistance(anchor, candidate);
    if (distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function subtractObstacle(viewport: AssistantRect, obstacle: AssistantRect | null | undefined, gap: number): AssistantRect[] {
  if (!obstacle || obstacle.width <= 0 || obstacle.height <= 0) return [viewport];
  const expanded = intersectRect(viewport, {
    x: obstacle.x - gap,
    y: obstacle.y - gap,
    width: obstacle.width + gap * 2,
    height: obstacle.height + gap * 2,
  });
  if (!expanded) return [viewport];
  const viewportRight = viewport.x + viewport.width;
  const viewportBottom = viewport.y + viewport.height;
  const expandedRight = expanded.x + expanded.width;
  const expandedBottom = expanded.y + expanded.height;
  return [
    { x: viewport.x, y: viewport.y, width: expanded.x - viewport.x, height: viewport.height },
    { x: expandedRight, y: viewport.y, width: viewportRight - expandedRight, height: viewport.height },
    { x: viewport.x, y: viewport.y, width: viewport.width, height: expanded.y - viewport.y },
    { x: viewport.x, y: expandedBottom, width: viewport.width, height: viewportBottom - expandedBottom },
  ].filter((rect) => rect.width > 0 && rect.height > 0);
}

function intersectRect(left: AssistantRect, right: AssistantRect): AssistantRect | null {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const rightEdge = Math.min(left.x + left.width, right.x + right.width);
  const bottomEdge = Math.min(left.y + left.height, right.y + right.height);
  return rightEdge > x && bottomEdge > y ? { x, y, width: rightEdge - x, height: bottomEdge - y } : null;
}

function insetViewport(viewport: AssistantSize): AssistantRect {
  return {
    x: SAFE_MARGIN,
    y: SAFE_MARGIN,
    width: Math.max(0, viewport.width - SAFE_MARGIN * 2),
    height: Math.max(0, viewport.height - SAFE_MARGIN * 2),
  };
}

function launcherBoundsForRect(rect: AssistantRect): AssistantRect {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width - LAUNCHER_SIZE,
    height: rect.height - LAUNCHER_SIZE,
  };
}

function clampAnchorToBounds(anchor: AssistantAnchor, bounds: AssistantRect): AssistantAnchor {
  return {
    x: clamp(anchor.x, bounds.x, bounds.x + bounds.width),
    y: clamp(anchor.y, bounds.y, bounds.y + bounds.height),
  };
}

function preferredPanelSide(anchor: AssistantAnchor, viewport: AssistantSize): 'left' | 'right' {
  return anchor.x + LAUNCHER_SIZE / 2 < viewport.width / 2 ? 'right' : 'left';
}

function squaredDistance(left: AssistantAnchor, right: AssistantAnchor) {
  const deltaX = left.x - right.x;
  const deltaY = left.y - right.y;
  return deltaX * deltaX + deltaY * deltaY;
}

function intersectionArea(left: AssistantRect, right: AssistantRect) {
  const width = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const height = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
  return width * height;
}

function clamp(value: number, minimum: number, maximum: number) { return Math.min(Math.max(value, minimum), Math.max(minimum, maximum)); }
function number(value: unknown, fallback: number) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function object(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
