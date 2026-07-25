import { useMemo } from 'react';
import type { Node } from '@xyflow/react';
import type { NodeExecutionProjection } from '@xinghuan/shared';

export const NODE_EXECUTION_PROJECTION_KEY = '__runtimeProjection' as const;

type ProjectedNodeData = Record<string, unknown> & {
  __runtimeProjection?: NodeExecutionProjection;
};

export function useNodeExecutionProjection(data: unknown) {
  return useMemo(() => mergeNodeExecutionProjection(data), [data]);
}

export function mergeNodeExecutionProjection(data: unknown): ProjectedNodeData {
  const source = record(data) as ProjectedNodeData;
  const projection = nodeExecutionProjection(source[NODE_EXECUTION_PROJECTION_KEY]);
  if (!projection) return source;

  const imageUrls = strings(projection.outputs.imageUrls);
  const videoUrls = strings(projection.outputs.videoUrls);
  const audioUrls = strings(projection.outputs.audioUrls);
  const taskRuns = projection.taskRuns.map((run) => ({
    batchIndex: run.batchIndex,
    status: run.status,
    taskId: run.taskId,
    error: run.error,
    outputCount: run.generationArtifactIds.length,
    startedAt: projection.startedAt,
    finishedAt: ['success', 'error', 'cancelled'].includes(run.status) ? projection.finishedAt : undefined,
  }));
  const taskIds = taskRuns.map((run) => run.taskId).filter((value): value is string => Boolean(value));
  const outputText = typeof projection.outputs.text === 'string' ? projection.outputs.text : undefined;

  return {
    ...source,
    status: projection.status,
    progress: projection.progress,
    taskId: projection.taskId,
    taskIds,
    taskRuns,
    startedAt: projection.startedAt,
    finishedAt: projection.finishedAt,
    error: projection.error,
    generationArtifactIds: [...projection.outputs.generationArtifactIds],
    imageUrl: imageUrls[0],
    imageUrls,
    videoUrl: videoUrls[0],
    videoUrls,
    audioUrl: audioUrls[0],
    audioUrl_1: audioUrls[1],
    audioUrls,
    tracks: audioUrls.map((audioUrl, index) => ({ id: `${projection.runId || 'run'}-audio-${index}`, audioUrl })),
    ...(outputText !== undefined ? { outputText, reply: outputText, text: outputText } : {}),
  };
}

export function projectCanvasRuntimeNodes(
  nodes: Node[],
  projections: Record<string, NodeExecutionProjection & { label?: string }>,
) {
  return nodes.map((node) => {
    const projection = projections[node.id];
    if (!projection) return node;
    const label = projection.label || projection.status;
    return {
      ...node,
      data: { ...record(node.data), [NODE_EXECUTION_PROJECTION_KEY]: projection },
      className: `${node.className || ''} canvas-run-node-status canvas-run-node-status--${projection.status}`.trim(),
      ariaLabel: label,
    };
  });
}

export function hasNodeExecutionProjection(nodes: Array<{ data?: unknown }>) {
  return nodes.some((node) => Boolean(record(node.data)[NODE_EXECUTION_PROJECTION_KEY]));
}

function nodeExecutionProjection(value: unknown): NodeExecutionProjection | null {
  const candidate = record(value);
  return candidate.authority === 'workflow_run'
    && typeof candidate.nodeId === 'string'
    && typeof candidate.status === 'string'
    && typeof candidate.outputs === 'object'
    ? candidate as unknown as NodeExecutionProjection
    : null;
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
