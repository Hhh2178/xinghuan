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
}): AssistantLayout {
  const viewport = { width: Math.max(320, input.viewportWidth), height: Math.max(480, input.viewportHeight) };
  const anchor = normalizeAssistantAnchor(input.anchor, viewport);
  const compact = viewport.width <= ASSISTANT_COMPACT_MAX_WIDTH;
  const launcher = launcherRect(anchor);
  if (compact) {
    return { compact: true, effectiveSide: 'right', launcher, panel: { x: 8, y: 8, width: viewport.width - 16, height: viewport.height - 16 } };
  }

  const size = normalizeAssistantSize(input.size, viewport);
  const right = desktopPanelRect('right', launcher, size, viewport);
  const left = desktopPanelRect('left', launcher, size, viewport);
  const preferred = launcher.x + LAUNCHER_SIZE / 2 < viewport.width / 2 ? right : left;
  const alternative = preferred === right ? left : right;
  const supervision = input.supervisionRect;
  const panel = supervision && intersectionArea(preferred, supervision) > intersectionArea(alternative, supervision) ? alternative : preferred;
  return { compact: false, effectiveSide: panel === left ? 'left' : 'right', launcher, panel };
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

function intersectionArea(left: AssistantRect, right: AssistantRect) {
  const width = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const height = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
  return width * height;
}

function clamp(value: number, minimum: number, maximum: number) { return Math.min(Math.max(value, minimum), Math.max(minimum, maximum)); }
function number(value: unknown, fallback: number) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function object(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
