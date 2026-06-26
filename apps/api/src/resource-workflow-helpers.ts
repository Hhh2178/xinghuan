function optionalObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

type WorkflowResourceItemLike = {
  workflowFragment?: Record<string, unknown>;
  workflowNodeCount?: number;
  workflowEdgeCount?: number;
  workflowNodeTypes?: string[];
  workflowPreview?: {
    nodes: Array<{ id: string; type: string; label: string; x: number; y: number }>;
    edges: Array<{ source: string; target: string }>;
  };
};

export function enrichWorkflowResourceItem<T extends WorkflowResourceItemLike>(item: T): T {
  const manifest = optionalObject(item.workflowFragment);
  if (!manifest || manifest.schema !== 't8-workflow-fragment') return item;
  const nodes = Array.isArray(manifest.nodes) ? manifest.nodes : [];
  const edges = Array.isArray(manifest.edges) ? manifest.edges : [];
  const nodeTypes = Array.isArray(manifest.nodeTypes)
    ? manifest.nodeTypes.filter((value): value is string => typeof value === 'string' && !!value)
    : Array.from(new Set(nodes.map((node: any) => String(node?.type || 'node')).filter(Boolean)));
  const topologyPreview = optionalObject(manifest.topologyPreview);
  return {
    ...item,
    workflowNodeCount: Number(manifest.nodeCount) || nodes.length || 0,
    workflowEdgeCount: Number(manifest.edgeCount) || edges.length || 0,
    workflowNodeTypes: nodeTypes,
    workflowPreview: topologyPreview
      ? {
          nodes: Array.isArray(topologyPreview.nodes)
            ? topologyPreview.nodes.map((node: any) => ({
                id: String(node?.id || ''),
                type: String(node?.type || 'node'),
                label: String(node?.label || node?.type || 'node'),
                x: Number(node?.x) || 0,
                y: Number(node?.y) || 0,
              }))
            : [],
          edges: Array.isArray(topologyPreview.edges)
            ? topologyPreview.edges.map((edge: any) => ({
                source: String(edge?.source || ''),
                target: String(edge?.target || ''),
              }))
            : [],
        }
      : {
          nodes: nodes.slice(0, 16).map((node: any) => ({
            id: String(node?.id || ''),
            type: String(node?.type || 'node'),
            label: String(node?.data?.label || node?.data?.title || node?.data?.name || node?.data?.displayName || node?.type || 'node'),
            x: Number(node?.position?.x) || 0,
            y: Number(node?.position?.y) || 0,
          })),
          edges: edges.slice(0, 24).map((edge: any) => ({
            source: String(edge?.source || ''),
            target: String(edge?.target || ''),
          })),
        },
  } as T;
}
