export const ASSISTANT_COMPACT_MAX_WIDTH = 900;

export interface AssistantAnchor {
  side: 'left' | 'right';
  y: number;
  offsetX: number;
  offsetY: number;
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

const SAFE_MARGIN = 12;
const LAUNCHER_SIZE = 48;
const PANEL_GAP = 10;
const MIN_PANEL_WIDTH = 320;
const MIN_PANEL_HEIGHT = 440;

export const DEFAULT_ASSISTANT_ANCHOR: AssistantAnchor = {
  side: 'right',
  y: 680,
  offsetX: 0,
  offsetY: 0,
};

export const DEFAULT_ASSISTANT_SIZE: AssistantSize = { width: 430, height: 720 };

export function normalizeAssistantAnchor(value: unknown, viewport: { width: number; height: number }): AssistantAnchor {
  const source = object(value);
  return {
    side: source.side === 'left' ? 'left' : 'right',
    y: clamp(number(source.y, viewport.height - SAFE_MARGIN - LAUNCHER_SIZE), SAFE_MARGIN, Math.max(SAFE_MARGIN, viewport.height - SAFE_MARGIN - LAUNCHER_SIZE)),
    offsetX: clamp(number(source.offsetX, 0), -64, 64),
    offsetY: clamp(number(source.offsetY, 0), -240, 240),
  };
}

export function normalizeAssistantSize(value: unknown, viewport: { width: number; height: number }): AssistantSize {
  const source = object(value);
  const availableWidth = viewport.width - SAFE_MARGIN * 2 - LAUNCHER_SIZE - PANEL_GAP;
  return {
    width: clamp(number(source.width, DEFAULT_ASSISTANT_SIZE.width), MIN_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, availableWidth)),
    height: clamp(number(source.height, DEFAULT_ASSISTANT_SIZE.height), MIN_PANEL_HEIGHT, Math.max(MIN_PANEL_HEIGHT, viewport.height - SAFE_MARGIN * 2)),
  };
}

export function snapAssistantAnchor(input: {
  pointerX: number;
  pointerY: number;
  viewportWidth: number;
  viewportHeight: number;
  offsetX?: number;
  offsetY?: number;
}): AssistantAnchor {
  return normalizeAssistantAnchor({
    side: input.pointerX < input.viewportWidth / 2 ? 'left' : 'right',
    y: input.pointerY - LAUNCHER_SIZE / 2,
    offsetX: input.offsetX,
    offsetY: input.offsetY,
  }, { width: input.viewportWidth, height: input.viewportHeight });
}

export function resolveAssistantLayout(input: {
  viewportWidth: number;
  viewportHeight: number;
  anchor: AssistantAnchor;
  size: AssistantSize;
  supervisionRect?: AssistantRect | null;
}): AssistantLayout {
  const viewport = {
    width: Math.max(320, input.viewportWidth),
    height: Math.max(480, input.viewportHeight),
  };
  const anchor = normalizeAssistantAnchor(input.anchor, viewport);
  const compact = viewport.width <= ASSISTANT_COMPACT_MAX_WIDTH;
  const launcher = launcherRect(anchor, viewport);
  if (compact) {
    return {
      compact: true,
      effectiveSide: anchor.side,
      launcher,
      panel: {
        x: 8,
        y: 8,
        width: viewport.width - 16,
        height: viewport.height - 16,
      },
    };
  }

  const size = normalizeAssistantSize(input.size, viewport);
  const candidates = (['left', 'right'] as const).map((side) => ({
    side,
    rect: desktopPanelRect(side, anchor, size, viewport),
  }));
  const preferred = candidates.find((candidate) => candidate.side === anchor.side)!;
  const alternative = candidates.find((candidate) => candidate.side !== anchor.side)!;
  const supervision = input.supervisionRect;
  const selected = supervision && intersectionArea(preferred.rect, supervision) > 0
    && intersectionArea(alternative.rect, supervision) < intersectionArea(preferred.rect, supervision)
    ? alternative
    : preferred;

  return {
    compact: false,
    effectiveSide: selected.side,
    launcher: launcherRect({ ...anchor, side: selected.side }, viewport),
    panel: selected.rect,
  };
}

export function assistantRectsOverlap(left: AssistantRect, right: AssistantRect, gap = 0) {
  return left.x < right.x + right.width + gap
    && left.x + left.width + gap > right.x
    && left.y < right.y + right.height + gap
    && left.y + left.height + gap > right.y;
}

function launcherRect(anchor: AssistantAnchor, viewport: { width: number; height: number }): AssistantRect {
  return {
    x: anchor.side === 'left' ? SAFE_MARGIN : viewport.width - SAFE_MARGIN - LAUNCHER_SIZE,
    y: anchor.y,
    width: LAUNCHER_SIZE,
    height: LAUNCHER_SIZE,
  };
}

function desktopPanelRect(
  side: 'left' | 'right',
  anchor: AssistantAnchor,
  size: AssistantSize,
  viewport: { width: number; height: number },
): AssistantRect {
  const adjacentX = side === 'left'
    ? SAFE_MARGIN + LAUNCHER_SIZE + PANEL_GAP
    : viewport.width - SAFE_MARGIN - LAUNCHER_SIZE - PANEL_GAP - size.width;
  const x = side === 'left'
    ? clamp(adjacentX + anchor.offsetX, adjacentX, viewport.width - SAFE_MARGIN - size.width)
    : clamp(adjacentX + anchor.offsetX, SAFE_MARGIN, adjacentX);
  const y = anchor.y + LAUNCHER_SIZE / 2 - size.height / 2 + anchor.offsetY;
  return {
    x,
    y: clamp(y, SAFE_MARGIN, viewport.height - SAFE_MARGIN - size.height),
    width: size.width,
    height: size.height,
  };
}

function intersectionArea(left: AssistantRect, right: AssistantRect) {
  const width = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const height = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
  return width * height;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function number(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
