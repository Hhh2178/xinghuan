import { useEffect } from 'react';

interface CanvasOverlayLayerProps {
  connectionPanModeActive: boolean;
  connectionPanShortcutLabel: string;
  runNotice: string | null;
  onCutEdges: (edgeIds: string[]) => void;
}

export function CanvasOverlayLayer({
  connectionPanModeActive,
  connectionPanShortcutLabel,
  runNotice,
  onCutEdges,
}: CanvasOverlayLayerProps) {
  useEffect(() => {
    const onShiftDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift' && !document.body.classList.contains('shift-mode')) {
        document.body.classList.add('shift-mode');
      }
    };
    const onShiftUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        document.body.classList.remove('shift-mode');
      }
    };
    const onBlur = () => document.body.classList.remove('shift-mode');

    let cutSvg: SVGSVGElement | null = null;
    let cutPath: SVGPolylineElement | null = null;
    let cutPoints: number[][] = [];
    let cutSet: Set<string> = new Set();
    let cutting = false;

    const finishCut = () => {
      if (!cutting) return;
      cutting = false;
      if (cutSet.size > 0) onCutEdges([...cutSet]);
      document.body.classList.remove('cut-mode');
      if (cutSvg && cutSvg.parentNode) cutSvg.parentNode.removeChild(cutSvg);
      cutSvg = null;
      cutPath = null;
      cutPoints = [];
      document
        .querySelectorAll('.react-flow__edge.cut-marked')
        .forEach((element) => element.classList.remove('cut-marked'));
      cutSet = new Set();
      window.removeEventListener('mousemove', onCutMove, true);
      window.removeEventListener('mouseup', onCutUp, true);
    };

    const onCutMove = (event: MouseEvent) => {
      if (!cutting) return;
      const lastPt = cutPoints.length > 0 ? cutPoints[cutPoints.length - 1] : [event.clientX, event.clientY];
      cutPoints.push([event.clientX, event.clientY]);
      if (cutPoints.length > 200) cutPoints = cutPoints.slice(-200);
      if (cutPath) {
        cutPath.setAttribute('points', cutPoints.map((point) => point.join(',')).join(' '));
      }
      const dx = event.clientX - lastPt[0];
      const dy = event.clientY - lastPt[1];
      const dist = Math.hypot(dx, dy);
      const steps = Math.min(60, Math.max(1, Math.ceil(dist / 4)));
      for (let index = 0; index <= steps; index += 1) {
        const ratio = steps === 0 ? 1 : index / steps;
        const px = lastPt[0] + dx * ratio;
        const py = lastPt[1] + dy * ratio;
        const elements = document.elementsFromPoint(px, py);
        for (const element of elements) {
          const edgeEl = (element as Element).closest?.('.react-flow__edge') as Element | null;
          if (!edgeEl) continue;
          const id = edgeEl.getAttribute('data-id') || '';
          if (!id || cutSet.has(id)) continue;
          cutSet.add(id);
          edgeEl.classList.add('cut-marked');
        }
      }
    };

    const onCutUp = () => finishCut();

    const onCutMouseDownCapture = (event: MouseEvent) => {
      if (!event.shiftKey || event.button !== 0) return;
      const targetEl = event.target as HTMLElement | null;
      if (!targetEl) return;
      if (
        targetEl.closest('.react-flow__handle') ||
        targetEl.closest('button') ||
        targetEl.closest('input') ||
        targetEl.closest('textarea') ||
        targetEl.closest('[contenteditable="true"]') ||
        targetEl.closest('.react-flow__edge')
      ) {
        return;
      }
      const onPane = !!targetEl.closest('.react-flow__pane');
      const groupNode = targetEl.closest('.react-flow__node-groupBox') as HTMLElement | null;
      const inOtherNode = !!targetEl.closest('.react-flow__node') && !groupNode;
      if ((!onPane && !groupNode) || inOtherNode) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      cutting = true;
      cutSet = new Set();
      cutPoints = [[event.clientX, event.clientY]];
      document.body.classList.add('cut-mode');

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.style.position = 'fixed';
      svg.style.left = '0';
      svg.style.top = '0';
      svg.style.right = '0';
      svg.style.bottom = '0';
      svg.style.width = '100vw';
      svg.style.height = '100vh';
      svg.style.pointerEvents = 'none';
      svg.style.zIndex = '99999';
      svg.setAttribute('class', 'cut-overlay-svg');
      const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      polyline.setAttribute('fill', 'none');
      polyline.setAttribute('points', `${event.clientX},${event.clientY}`);
      polyline.setAttribute('class', 'cut-overlay-path');
      svg.appendChild(polyline);
      document.body.appendChild(svg);
      cutSvg = svg;
      cutPath = polyline;

      window.addEventListener('mousemove', onCutMove, true);
      window.addEventListener('mouseup', onCutUp, true);
    };

    const onCutKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift' && cutting) finishCut();
    };

    window.addEventListener('keydown', onShiftDown);
    window.addEventListener('keyup', onShiftUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('keyup', onCutKeyUp);
    window.addEventListener('mousedown', onCutMouseDownCapture, true);
    return () => {
      window.removeEventListener('keydown', onShiftDown);
      window.removeEventListener('keyup', onShiftUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('keyup', onCutKeyUp);
      window.removeEventListener('mousedown', onCutMouseDownCapture, true);
      window.removeEventListener('mousemove', onCutMove, true);
      window.removeEventListener('mouseup', onCutUp, true);
      document.body.classList.remove('shift-mode');
      document.body.classList.remove('cut-mode');
      if (cutSvg && cutSvg.parentNode) cutSvg.parentNode.removeChild(cutSvg);
      document
        .querySelectorAll('.react-flow__edge.cut-marked')
        .forEach((element) => element.classList.remove('cut-marked'));
    };
  }, [onCutEdges]);

  return (
    <>
      {runNotice ? (
        <div
          className="pointer-events-none absolute left-1/2 top-16 z-50 max-w-[min(620px,calc(100vw-48px))] -translate-x-1/2 rounded-md border border-amber-300/30 bg-zinc-950/95 px-4 py-2.5 text-sm font-medium text-amber-100 shadow-xl"
          data-canvas-floating-ui="group-run-notice"
          role="status"
        >
          {runNotice}
        </div>
      ) : null}
      {connectionPanModeActive ? (
        <div className="t8-connection-pan-hud" data-canvas-floating-ui="connection-pan-hud">
          <span className="t8-connection-pan-hud__signal" aria-hidden="true" />
          <span className="t8-connection-pan-hud__title">连线导航模式</span>
          <span className="t8-connection-pan-hud__hint">拖动画布后点击目标接口连接，再按 {connectionPanShortcutLabel} 取消</span>
        </div>
      ) : null}
    </>
  );
}
