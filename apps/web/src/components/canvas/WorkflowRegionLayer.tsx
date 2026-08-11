import { useCallback, type PointerEvent as ReactPointerEvent } from 'react';
import { ViewportPortal, useReactFlow, type Node } from '@xyflow/react';
import { Palette, Ungroup, Workflow } from 'lucide-react';
import { assertWorkflowRegionLayout, type WorkflowDocument, type WorkflowRegionVisual } from '@xinghuan/shared';

import { useCanvasWorkflows } from './CanvasWorkflowContext';
import { expandWorkflowRegionToIncludeNodes } from './workflowRegionCreation';

const HEADER_HEIGHT = 42;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 220;

export function WorkflowRegionLayer() {
  const { workflows, dissolveWorkflowRegion, setRegion } = useCanvasWorkflows();
  const { getNodes, getZoom, setNodes } = useReactFlow();

  const canApply = useCallback((workflowId: string, patch: Partial<WorkflowRegionVisual>) => {
    const next = workflows.map((workflow) => workflow.id === workflowId
      ? { ...workflow, region: { ...workflow.region, ...patch } }
      : workflow);
    try {
      assertWorkflowRegionLayout(next);
      return true;
    } catch {
      return false;
    }
  }, [workflows]);

  const startMove = useCallback((workflow: WorkflowDocument) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('input,button')) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const zoom = getZoom() || 1;
    const memberIds = new Set(workflow.memberNodeIds);
    const memberPositions = new Map(getNodes()
      .filter((node) => memberIds.has(node.id))
      .map((node) => [node.id, { ...node.position }]));

    const onMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / zoom;
      const dy = (moveEvent.clientY - startY) / zoom;
      const region = { ...workflow.region, x: workflow.region.x + dx, y: workflow.region.y + dy };
      if (!canApply(workflow.id, region)) return;
      setRegion(workflow.id, region);
      setNodes((nodes) => nodes.map((node) => {
        const origin = memberPositions.get(node.id);
        return origin ? { ...node, position: { x: origin.x + dx, y: origin.y + dy } } : node;
      }));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [canApply, getNodes, getZoom, setNodes, setRegion]);

  const startResize = useCallback((workflow: WorkflowDocument) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const zoom = getZoom() || 1;
    const memberIds = new Set(workflow.memberNodeIds);
    const memberNodes = getNodes().filter((node) => memberIds.has(node.id));
    const onMove = (moveEvent: PointerEvent) => {
      const width = Math.max(MIN_WIDTH, workflow.region.width + (moveEvent.clientX - startX) / zoom);
      const height = Math.max(MIN_HEIGHT, workflow.region.height + (moveEvent.clientY - startY) / zoom);
      const region = expandWorkflowRegionToIncludeNodes({ ...workflow.region, width, height }, memberNodes);
      if (canApply(workflow.id, region)) setRegion(workflow.id, region);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [canApply, getNodes, getZoom, setRegion]);

  const handleDissolve = useCallback((workflow: WorkflowDocument) => {
    if (!window.confirm(`确定解散「${workflow.name}」吗？区域、变量和绑定会移除，但节点会保留在画布中。`)) return;
    dissolveWorkflowRegion(workflow.id);
  }, [dissolveWorkflowRegion]);

  return (
    <ViewportPortal>
      {workflows.map((workflow) => {
        const textColor = contrastText(workflow.region.color);
        return (
          <section
            key={workflow.id}
            className="workflow-region nodrag nopan"
            data-workflow-id={workflow.id}
            style={{
              position: 'absolute',
              transform: `translate(${workflow.region.x}px, ${workflow.region.y}px)`,
              width: workflow.region.width,
              height: workflow.region.height,
              zIndex: 0,
              background: `color-mix(in srgb, ${workflow.region.color} 20%, transparent)`,
              border: `2px solid ${textColor === '#111827' ? '#111827' : '#FFFFFF'}`,
              borderRadius: 6,
              color: textColor,
              boxSizing: 'border-box',
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              pointerEvents: 'auto',
            }}
          >
            <div
              onPointerDown={startMove(workflow)}
              style={{
                height: HEADER_HEIGHT,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 12px',
                borderBottom: `1px solid ${textColor === '#111827' ? 'rgba(17,24,39,0.35)' : 'rgba(255,255,255,0.45)'}`,
                cursor: 'move',
                userSelect: 'none',
              }}
            >
              <Workflow size={16} />
              <strong style={{ fontSize: 13, letterSpacing: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {workflow.name}
              </strong>
              <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.8 }}>
                {workflow.memberNodeIds.length} 节点 · r{workflow.revision}
              </span>
              <label title="调整工作流区域颜色" style={{ display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                <Palette size={15} />
                <input
                  aria-label="工作流区域颜色"
                  type="color"
                  value={workflow.region.color}
                  onChange={(colorEvent) => setRegion(workflow.id, { color: colorEvent.target.value.toUpperCase() })}
                  style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
                />
              </label>
              <button
                type="button"
                aria-label="解散工作流区域"
                title="解散工作流区域（保留节点）"
                onClick={() => handleDissolve(workflow)}
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 22,
                  height: 22,
                  padding: 0,
                  border: 0,
                  borderRadius: 4,
                  color: textColor,
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                <Ungroup size={15} />
              </button>
            </div>
            <button
              type="button"
              aria-label="调整工作流区域大小"
              title="调整工作流区域大小"
              onPointerDown={startResize(workflow)}
              style={{
                position: 'absolute',
                right: 2,
                bottom: 2,
                width: 18,
                height: 18,
                border: 0,
                padding: 0,
                cursor: 'nwse-resize',
                background: `linear-gradient(135deg, transparent 45%, ${textColor} 46%, ${textColor} 55%, transparent 56%)`,
              }}
            />
          </section>
        );
      })}
    </ViewportPortal>
  );
}

function contrastText(color: string) {
  const red = Number.parseInt(color.slice(1, 3), 16) / 255;
  const green = Number.parseInt(color.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(color.slice(5, 7), 16) / 255;
  const luminance = 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
  return luminance > 0.42 ? '#111827' : '#FFFFFF';
}

function linear(value: number) {
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}
