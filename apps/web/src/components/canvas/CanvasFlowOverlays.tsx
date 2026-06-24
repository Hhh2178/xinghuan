import type { ReactNode } from 'react';
import { Controls, MiniMap, ViewportPortal } from '@xyflow/react';

interface Guides {
  vertical: number[];
  horizontal: number[];
}

interface CanvasFlowOverlaysProps {
  guides: Guides;
  guideColor: string;
  isPixel: boolean;
  isOp: boolean;
  isNaruto: boolean;
  isEva: boolean;
  isYyh: boolean;
  isSlamdunk: boolean;
  isSoccer: boolean;
  isDark: boolean;
  themeTokens: Record<string, any>;
  getViewport: () => { zoom: number };
  setCenter: (x: number, y: number, options?: { zoom?: number; duration?: number }) => void;
  edgeNodeColor: string;
  children?: ReactNode;
}

export function CanvasFlowOverlays({
  guides,
  guideColor,
  isPixel,
  isOp,
  isNaruto,
  isEva,
  isYyh,
  isSlamdunk,
  isSoccer,
  isDark,
  themeTokens,
  getViewport,
  setCenter,
  edgeNodeColor,
  children,
}: CanvasFlowOverlaysProps) {
  return (
    <>
      {(guides.vertical.length > 0 || guides.horizontal.length > 0) && (
        <ViewportPortal>
          <svg
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: 0,
              height: 0,
              overflow: 'visible',
              pointerEvents: 'none',
              zIndex: 5,
            }}
          >
            {guides.vertical.map((x, i) => (
              <line
                key={`v-${i}-${x}`}
                x1={x}
                y1={-100000}
                x2={x}
                y2={100000}
                stroke={guideColor}
                strokeWidth={isPixel ? 1.5 : 1}
                strokeDasharray={isPixel ? '8 4' : '6 4'}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {guides.horizontal.map((y, i) => (
              <line
                key={`h-${i}-${y}`}
                x1={-100000}
                y1={y}
                x2={100000}
                y2={y}
                stroke={guideColor}
                strokeWidth={isPixel ? 1.5 : 1}
                strokeDasharray={isPixel ? '8 4' : '6 4'}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        </ViewportPortal>
      )}
      <div className="t8-control-rail nodrag nopan" data-canvas-floating-ui="control-rail">
        <Controls
          style={{
            background: isOp ? themeTokens.panelBg : isDark ? 'rgba(20,20,22,.9)' : 'rgba(255,255,255,.9)',
            border: isOp
              ? `3px solid ${themeTokens.textMain}`
              : `1px solid ${isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)'}`,
            borderRadius: isOp ? '16px 16px 8px 8px' : 8,
            boxShadow: isOp ? `4px 4px 0 ${themeTokens.textMain}` : undefined,
          }}
        />
      </div>
      <MiniMap
        pannable
        zoomable
        onClick={(_event, position) => {
          const { zoom } = getViewport();
          setCenter(position.x, position.y, { zoom, duration: 400 });
        }}
        style={{
          width: isOp ? 144 : isNaruto ? 182 : isEva ? 258 : isYyh ? 224 : isSlamdunk ? 214 : isSoccer ? 224 : undefined,
          height: isOp ? 144 : isNaruto ? 122 : isEva ? 172 : isYyh ? 144 : isSlamdunk ? 128 : isSoccer ? 136 : undefined,
          background: isOp
            ? themeTokens.panelBg
            : isNaruto
              ? themeTokens.panelBg
              : isEva
                ? themeTokens.panelBg
                : isYyh
                  ? themeTokens.panelBg
                  : isSlamdunk
                    ? themeTokens.panelBg
                    : isSoccer
                      ? themeTokens.panelBg
                      : isDark
                        ? 'rgba(20,20,22,.9)'
                        : 'rgba(255,255,255,.9)',
          border: isOp
            ? `4px double ${themeTokens.textMain}`
            : isNaruto
              ? `3px solid ${themeTokens.textMain}`
              : isEva
                ? `2px solid ${themeTokens.borderStrong}`
                : isYyh
                  ? `2px solid ${themeTokens.accent}`
                  : isSlamdunk
                    ? `3px solid ${themeTokens.textMain}`
                    : isSoccer
                      ? `3px solid ${themeTokens.textMain}`
                      : `1px solid ${isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)'}`,
          borderRadius: isOp ? 999 : isNaruto ? '18px 18px 12px 12px' : isEva ? 8 : isYyh ? 12 : isSlamdunk ? 10 : isSoccer ? 12 : 8,
          right: 24,
          bottom: isOp ? 42 : isNaruto ? 40 : isEva ? 24 : isYyh ? 28 : isSlamdunk ? 32 : isSoccer ? 32 : undefined,
          boxShadow: isOp
            ? `0 0 0 7px ${themeTokens.warning}, 5px 5px 0 ${themeTokens.textMain}`
            : isNaruto
              ? themeTokens.shadowPanel
              : isEva
                ? `0 0 0 4px ${themeTokens.panelBgElevated}, 0 0 0 6px ${themeTokens.borderStrong}, 0 18px 46px rgba(0,0,0,.5), inset 0 0 34px ${themeTokens.accent}22`
                : isYyh
                  ? `0 0 0 4px ${themeTokens.panelBgElevated}, 0 0 0 6px ${themeTokens.borderStrong}, 0 18px 46px rgba(0,0,0,.46), inset 0 0 34px ${themeTokens.secondary}22`
                  : isSlamdunk
                    ? `0 0 0 5px ${themeTokens.secondary}, 5px 5px 0 ${themeTokens.textMain}, 0 18px 46px rgba(0,0,0,.28)`
                    : isSoccer
                      ? `0 0 0 5px ${themeTokens.secondary}, 5px 5px 0 ${themeTokens.textMain}, 0 18px 46px rgba(0,0,0,.24)`
                      : undefined,
          cursor: 'pointer',
          overflow: isOp || isNaruto || isEva || isYyh || isSlamdunk || isSoccer ? 'hidden' : undefined,
        }}
        maskColor={
          isOp
            ? 'rgba(15,124,140,.28)'
            : isNaruto
              ? 'rgba(255,91,31,.22)'
              : isEva
                ? 'rgba(156,255,0,.18)'
                : isYyh
                  ? 'rgba(67,247,255,.16)'
                  : isSlamdunk
                    ? 'rgba(240,123,34,.22)'
                    : isSoccer
                      ? 'rgba(18,107,216,.22)'
                      : isDark
                        ? 'rgba(0,0,0,.6)'
                        : 'rgba(255,255,255,.6)'
        }
        nodeColor={() => edgeNodeColor}
      />
      {children}
    </>
  );
}
