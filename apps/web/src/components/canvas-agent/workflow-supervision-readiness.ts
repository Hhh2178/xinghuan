import type { Edge, Node } from '@xyflow/react';
import { getNodeExecutionCapability } from '@xinghuan/agent-core';
import { resolveNodeDisplayIdentity, type WorkflowDocument } from '@xinghuan/shared';

export type WorkflowSupervisionReadinessState = 'ready' | 'blocked' | 'server-check';

export interface WorkflowSupervisionReadinessItem {
  nodeId?: string;
  nodeDisplayName?: string;
  code: string;
  message: string;
  action: string;
}

export interface WorkflowSupervisionReadiness {
  state: WorkflowSupervisionReadinessState;
  items: WorkflowSupervisionReadinessItem[];
}

export function buildWorkflowSupervisionReadiness(input: {
  workflow?: WorkflowDocument;
  nodes: Node[];
  edges: Edge[];
}): WorkflowSupervisionReadiness {
  const { workflow, nodes } = input;
  if (!workflow) return blocked('WORKFLOW_REQUIRED', '请先创建并选择一个工作流区域。', '用工作流区域框选需要托管的节点。');
  if (workflow.memberNodeIds.length === 0) return blocked('WORKFLOW_EMPTY', '这个工作流区域还没有成员节点。', '将至少一个可执行节点加入当前工作流区域。');

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const items: WorkflowSupervisionReadinessItem[] = [];
  for (const nodeId of workflow.memberNodeIds) {
    const node = nodesById.get(nodeId);
    if (!node) {
      items.push({ nodeId, nodeDisplayName: resolveNodeDisplayIdentity({ nodeId, catalogLabel: '缺失节点' }).displayName, code: 'WORKFLOW_MEMBER_NODE_MISSING', message: '工作流引用的节点已不存在。', action: '重新将有效节点加入工作流区域。' });
      continue;
    }
    const capability = getNodeExecutionCapability(node.type || '');
    const nodeDisplayName = resolveNodeDisplayIdentity({
      nodeId,
      nodeType: node.type,
      customLabel: (node.data as Record<string, unknown>)?.label || (node.data as Record<string, unknown>)?.name || (node.data as Record<string, unknown>)?.title,
      catalogLabel: capability?.label,
    }).displayName;
    if (!capability || capability.serverRuntime !== 'native_server') {
      items.push({ nodeId, nodeDisplayName, code: 'CANVAS_RUN_LEGACY_NODE_UNSUPPORTED', message: `节点“${node.type || '未知类型'}”不能由 AI 托管运行。`, action: '替换为支持 native-server 的节点；不要使用历史 Agent 托管节点。' });
      continue;
    }
    if (node.type === 'workflow-input') validateWorkflowInput(node, nodeDisplayName, workflow, items);
  }
  if (items.length > 0) return { state: 'blocked', items };

  return {
    state: 'server-check',
    items: [{
      code: 'SERVER_AUTHORITY_CHECK',
      message: '工作流结构可以提交给 AI 托管。',
      action: '生成运行计划后，服务端会继续校验模型、素材权限、预算和运行环境。',
    }],
  };
}

function validateWorkflowInput(node: Node, nodeDisplayName: string, workflow: WorkflowDocument, items: WorkflowSupervisionReadinessItem[]) {
  const data = node.data as { variableId?: unknown; portType?: unknown };
  const variableId = typeof data.variableId === 'string' ? data.variableId : '';
  const portType = typeof data.portType === 'string' ? data.portType : '';
  const variable = workflow.variables.find((candidate) => candidate.id === variableId);
  if (!variable) {
    items.push({ nodeId: node.id, nodeDisplayName, code: 'WORKFLOW_BOUNDARY_VARIABLE_INVALID', message: '工作流输入没有关联有效变量。', action: '在该工作流输入节点中选择同类型的输入变量。' });
    return;
  }
  if (variable.type !== portType) {
    items.push({ nodeId: node.id, nodeDisplayName, code: 'WORKFLOW_BOUNDARY_VARIABLE_TYPE_MISMATCH', message: `工作流输入类型与变量“${variable.label}”不一致。`, action: '将节点数据类型改为与输入变量相同的类型。' });
    return;
  }
  if (variable.required && isMissing(workflow.inputValues[variableId])) {
    items.push({ nodeId: node.id, nodeDisplayName, code: 'WORKFLOW_BOUNDARY_VALUE_MISSING', message: `输入变量“${variable.label}”尚未提供值。`, action: '在工作流变量面板中填写该输入变量的值。' });
  }
}

function isMissing(value: unknown) {
  return value === undefined || value === null || value === '';
}

function blocked(code: string, message: string, action: string): WorkflowSupervisionReadiness {
  return { state: 'blocked', items: [{ code, message, action }] };
}
