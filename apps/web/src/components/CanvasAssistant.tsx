import type { Edge, Node } from '@xyflow/react';
import { CanvasAssistantShell } from './canvas-assistant/CanvasAssistantShell';

export interface CanvasAssistantProps {
  nodes: Node[];
  edges: Edge[];
  activeCanvasId: string | null;
  ownerId: string;
}

export default function CanvasAssistant(props: CanvasAssistantProps) {
  return <CanvasAssistantShell {...props} />;
}
