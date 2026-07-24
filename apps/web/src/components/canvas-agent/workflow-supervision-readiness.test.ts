import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import type { WorkflowDocument } from '@xinghuan/shared';

import { buildWorkflowSupervisionReadiness } from './workflow-supervision-readiness.js';

const workflow = (memberNodeIds: string[], overrides: Partial<WorkflowDocument> = {}): WorkflowDocument => ({
  schemaVersion: 1, id: 'workflow-1', name: 'Demo', revision: 1, memberNodeIds,
  variables: [], inputValues: {}, bindings: [], stages: [], region: { x: 0, y: 0, width: 640, height: 420, color: '#2F6B5F' }, ...overrides,
});
const node = (id: string, type: string, data: Record<string, unknown> = {}): Node => ({ id, type, data, position: { x: 0, y: 0 } });

describe('buildWorkflowSupervisionReadiness', () => {
  it('blocks absent and empty workflow regions', () => {
    expect(buildWorkflowSupervisionReadiness({ nodes: [], edges: [] }).items[0].code).toBe('WORKFLOW_REQUIRED');
    expect(buildWorkflowSupervisionReadiness({ workflow: workflow([]), nodes: [], edges: [] }).items[0].code).toBe('WORKFLOW_EMPTY');
  });

  it('identifies legacy nodes by the responsible node id', () => {
    const result = buildWorkflowSupervisionReadiness({ workflow: workflow(['legacy']), nodes: [node('legacy', 'canvas-agent')], edges: [] });
    expect(result).toMatchObject({ state: 'blocked', items: [{ nodeId: 'legacy', code: 'CANVAS_RUN_LEGACY_NODE_UNSUPPORTED' }] });
  });

  it('blocks a workflow input that is missing its required value', () => {
    const input = node('input', 'workflow-input', { variableId: 'theme', portType: 'text' });
    const result = buildWorkflowSupervisionReadiness({
      workflow: workflow(['input'], { variables: [{ id: 'theme', key: 'theme', label: '主题', type: 'text', required: true, constraints: {}, allowAiFill: false, allowAiRewrite: false, version: 1 }] }),
      nodes: [input], edges: [],
    });
    expect(result).toMatchObject({ state: 'blocked', items: [{ nodeId: 'input', code: 'WORKFLOW_BOUNDARY_VALUE_MISSING' }] });
  });

  it('sends a supported native graph to authoritative server checks', () => {
    const result = buildWorkflowSupervisionReadiness({ workflow: workflow(['text']), nodes: [node('text', 'text')], edges: [] });
    expect(result).toMatchObject({ state: 'server-check', items: [{ code: 'SERVER_AUTHORITY_CHECK' }] });
  });
});
