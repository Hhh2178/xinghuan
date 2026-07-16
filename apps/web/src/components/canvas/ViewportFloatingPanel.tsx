import { useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';

interface Point {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

interface FloatingPanelPosition {
  left: number;
  top: number;
  maxHeight: number;
}

const DEFAULT_VIEWPORT_PADDING = 12;
const DEFAULT_CURSOR_OFFSET = 8;

export function resolveViewportFloatingPanelPosition(
  anchor: Point,
  panel: Size,
  viewport: Size,
  viewportPadding = DEFAULT_VIEWPORT_PADDING,
  cursorOffset = DEFAULT_CURSOR_OFFSET,
): FloatingPanelPosition {
  const maxHeight = Math.max(0, viewport.height - viewportPadding * 2);
  const effectiveHeight = Math.min(panel.height, maxHeight);
  const right = anchor.x + cursorOffset;
  const leftCandidate = anchor.x - panel.width - cursorOffset;
  const preferredLeft = right + panel.width <= viewport.width - viewportPadding
    ? right
    : leftCandidate;
  const maxLeft = Math.max(viewportPadding, viewport.width - viewportPadding - panel.width);
  const maxTop = Math.max(viewportPadding, viewport.height - viewportPadding - effectiveHeight);

  return {
    left: Math.min(Math.max(preferredLeft, viewportPadding), maxLeft),
    top: Math.min(Math.max(anchor.y, viewportPadding), maxTop),
    maxHeight,
  };
}

interface ViewportFloatingPanelProps extends HTMLAttributes<HTMLDivElement> {
  anchor: Point;
  width: number;
  children: ReactNode;
  viewportPadding?: number;
  cursorOffset?: number;
}

export default function ViewportFloatingPanel({
  anchor,
  width,
  children,
  viewportPadding = DEFAULT_VIEWPORT_PADDING,
  cursorOffset = DEFAULT_CURSOR_OFFSET,
  style,
  ...props
}: ViewportFloatingPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<FloatingPanelPosition>(() => ({
    left: anchor.x + cursorOffset,
    top: anchor.y,
    maxHeight: typeof window === 'undefined' ? 0 : Math.max(0, window.innerHeight - viewportPadding * 2),
  }));

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || typeof window === 'undefined') return;

    const reposition = () => {
      const rect = panel.getBoundingClientRect();
      const next = resolveViewportFloatingPanelPosition(
        anchor,
        { width: rect.width || width, height: Math.max(rect.height, panel.scrollHeight) },
        { width: window.innerWidth, height: window.innerHeight },
        viewportPadding,
        cursorOffset,
      );
      setPosition((current) => (
        current.left === next.left && current.top === next.top && current.maxHeight === next.maxHeight
          ? current
          : next
      ));
    };

    reposition();
    window.addEventListener('resize', reposition);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(reposition);
    observer?.observe(panel);
    return () => {
      window.removeEventListener('resize', reposition);
      observer?.disconnect();
    };
  }, [anchor, cursorOffset, viewportPadding, width]);

  return (
    <div
      {...props}
      ref={panelRef}
      style={{
        ...style,
        position: 'fixed',
        left: position.left,
        top: position.top,
        width,
        maxHeight: position.maxHeight,
        overflowY: 'auto',
      }}
    >
      {children}
    </div>
  );
}
