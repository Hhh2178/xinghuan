import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import type { Node } from '@xyflow/react';
import {
  normalizeWorkflowVariableName,
  parseWorkflowTextTemplate,
  renameWorkflowVariableToken,
  validateWorkflowVariableDefinitions,
  workflowTextTemplateBinding,
  type WorkflowDocument,
  type WorkflowFieldBinding,
  type WorkflowVariableDefinition,
  type WorkflowVariableType,
} from '@xinghuan/shared';

interface CanvasWorkflowContextValue {
  workflows: WorkflowDocument[];
  workflowForNode: (nodeId: string) => WorkflowDocument | undefined;
  assignNode: (nodeId: string, workflowId: string | null) => string | null;
  createWorkflowForNode: (nodeId: string) => string;
  addVariable: (workflowId: string, type: WorkflowVariableType, name?: string) => string;
  updateVariable: (workflowId: string, variableId: string, patch: Partial<WorkflowVariableDefinition>) => string | null;
  removeVariable: (workflowId: string, variableId: string) => boolean;
  setTextSource: (workflowId: string, nodeId: string, fieldPath: string, source: string) => string | null;
  setVariableValue: (workflowId: string, variableId: string, value: unknown) => void;
  setFieldBinding: (
    workflowId: string,
    nodeId: string,
    fieldPath: string,
    fieldType: WorkflowVariableType,
    binding: WorkflowFieldBinding,
  ) => void;
}

const CanvasWorkflowContext = createContext<CanvasWorkflowContextValue | null>(null);

export function CanvasWorkflowProvider({
  children,
  workflows,
  setWorkflows,
  setNodes,
}: {
  children: ReactNode;
  workflows: WorkflowDocument[];
  setWorkflows: Dispatch<SetStateAction<WorkflowDocument[]>>;
  setNodes: Dispatch<SetStateAction<Node[]>>;
}) {
  const workflowForNode = useCallback(
    (nodeId: string) => workflows.find((workflow) => workflow.memberNodeIds.includes(nodeId)),
    [workflows],
  );

  const assignNode = useCallback((nodeId: string, workflowId: string | null) => {
    setWorkflows((current) => current.map((workflow) => {
      const isTarget = workflow.id === workflowId;
      const hasMember = workflow.memberNodeIds.includes(nodeId);
      if (isTarget && !hasMember) {
        return { ...workflow, revision: workflow.revision + 1, memberNodeIds: [...workflow.memberNodeIds, nodeId] };
      }
      if (!isTarget && hasMember) {
        return {
          ...workflow,
          revision: workflow.revision + 1,
          memberNodeIds: workflow.memberNodeIds.filter((id) => id !== nodeId),
          bindings: workflow.bindings.filter((binding) => binding.nodeId !== nodeId),
        };
      }
      return workflow;
    }).filter((workflow) => workflow.memberNodeIds.length > 0));
    return workflowId;
  }, [setWorkflows]);

  const createWorkflowForNode = useCallback((nodeId: string) => {
    const id = newStableId('workflow');
    setWorkflows((current) => [
      ...current.map((workflow) => workflow.memberNodeIds.includes(nodeId) ? {
        ...workflow,
        revision: workflow.revision + 1,
        memberNodeIds: workflow.memberNodeIds.filter((memberId) => memberId !== nodeId),
        bindings: workflow.bindings.filter((binding) => binding.nodeId !== nodeId),
      } : workflow).filter((workflow) => workflow.memberNodeIds.length > 0),
      {
        schemaVersion: 1,
        id,
        name: `工作流 ${current.length + 1}`,
        revision: 1,
        memberNodeIds: [nodeId],
        variables: [],
        inputValues: {},
        bindings: [],
      },
    ]);
    return id;
  }, [setWorkflows]);

  const setFieldBinding = useCallback<CanvasWorkflowContextValue['setFieldBinding']>((workflowId, nodeId, fieldPath, fieldType, binding) => {
    setWorkflows((current) => current.map((workflow) => {
      if (workflow.id !== workflowId) return workflow;
      if (!workflow.memberNodeIds.includes(nodeId)) throw new Error(`WORKFLOW_BINDING_NODE_OUTSIDE:${nodeId}`);
      const nextBinding = { nodeId, fieldPath, fieldType, binding };
      const index = workflow.bindings.findIndex((item) => item.nodeId === nodeId && item.fieldPath === fieldPath);
      const bindings = index < 0
        ? [...workflow.bindings, nextBinding]
        : workflow.bindings.map((item, itemIndex) => itemIndex === index ? nextBinding : item);
      return { ...workflow, revision: workflow.revision + 1, bindings };
    }));
  }, [setWorkflows]);

  const addVariable = useCallback((workflowId: string, type: WorkflowVariableType, name?: string) => {
    const id = newStableId('workflow_var');
    setWorkflows((current) => current.map((workflow) => {
      if (workflow.id !== workflowId) return workflow;
      const baseName = (name || variableTypeLabel(type)).trim();
      const key = uniqueVariableName(workflow.variables, baseName);
      const variable: WorkflowVariableDefinition = {
        id,
        key,
        label: key,
        type,
        required: true,
        constraints: type === 'select' ? { options: ['选项 1', '选项 2'] } : {},
        allowAiFill: false,
        allowAiRewrite: type === 'text',
        version: 1,
      };
      return { ...workflow, revision: workflow.revision + 1, variables: [...workflow.variables, variable] };
    }));
    return id;
  }, [setWorkflows]);

  const updateVariable = useCallback((workflowId: string, variableId: string, patch: Partial<WorkflowVariableDefinition>) => {
    const workflow = workflows.find((item) => item.id === workflowId);
    if (!workflow) return 'WORKFLOW_NOT_FOUND';
    const previousVariable = workflow.variables.find((variable) => variable.id === variableId);
    if (!previousVariable) return 'WORKFLOW_VARIABLE_NOT_FOUND';
    const variables = workflow.variables.map((variable) => variable.id === variableId ? {
      ...variable,
      ...patch,
      id: variable.id,
      type: variable.type,
      version: variable.version + 1,
    } : variable);
    try {
      const normalized = validateWorkflowVariableDefinitions(variables);
      const nextVariable = normalized.find((variable) => variable.id === variableId)!;
      const keyChanged = previousVariable.key !== nextVariable.key;
      setWorkflows((current) => current.map((item) => item.id === workflowId ? {
        ...item,
        revision: item.revision + 1,
        variables: normalized,
        bindings: keyChanged ? renameBindingSegmentKeys(item.bindings, variableId, nextVariable.key) : item.bindings,
      } : item));
      if (keyChanged) {
        const targetPaths = workflow.bindings
          .filter((binding) => binding.fieldType === 'text' && bindingVariableIds(binding.binding).includes(variableId))
          .map((binding) => ({ nodeId: binding.nodeId, fieldPath: binding.fieldPath }));
        setNodes((current) => current.map((node) => {
          const paths = targetPaths.filter((target) => target.nodeId === node.id);
          if (paths.length === 0) return node;
          let data = node.data as Record<string, unknown>;
          let changed = false;
          for (const target of paths) {
            const source = readStringPath(data, target.fieldPath);
            const renamed = renameWorkflowVariableToken(source, previousVariable.key, nextVariable.key);
            if (source === renamed) continue;
            data = writeStringPath(data, target.fieldPath, renamed);
            changed = true;
          }
          return changed ? { ...node, data } : node;
        }));
      }
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'WORKFLOW_VARIABLE_INVALID';
    }
  }, [setNodes, setWorkflows, workflows]);

  const removeVariable = useCallback((workflowId: string, variableId: string) => {
    const workflow = workflows.find((item) => item.id === workflowId);
    if (!workflow) return false;
    const referenced = workflow.bindings.some((binding) => bindingVariableIds(binding.binding).includes(variableId));
    if (referenced) return false;
    setWorkflows((current) => current.map((item) => item.id === workflowId ? {
      ...item,
      revision: item.revision + 1,
      variables: item.variables.filter((variable) => variable.id !== variableId),
      inputValues: Object.fromEntries(Object.entries(item.inputValues).filter(([id]) => id !== variableId)),
    } : item));
    return true;
  }, [setWorkflows, workflows]);

  const setTextSource = useCallback((workflowId: string, nodeId: string, fieldPath: string, source: string) => {
    const workflow = workflows.find((item) => item.id === workflowId);
    if (!workflow) return 'WORKFLOW_NOT_FOUND';
    let binding: WorkflowFieldBinding;
    try {
      binding = workflowTextTemplateBinding(parseWorkflowTextTemplate(source, workflow.variables));
    } catch (error) {
      return error instanceof Error ? error.message : 'WORKFLOW_VARIABLE_TEMPLATE_INVALID';
    }
    setWorkflows((current) => current.map((item) => {
      if (item.id !== workflowId) return item;
      const nextBinding = { nodeId, fieldPath, fieldType: 'text' as const, binding };
      const index = item.bindings.findIndex((candidate) => candidate.nodeId === nodeId && candidate.fieldPath === fieldPath);
      const bindings = index < 0
        ? [...item.bindings, nextBinding]
        : item.bindings.map((candidate, itemIndex) => itemIndex === index ? nextBinding : candidate);
      return { ...item, revision: item.revision + 1, bindings };
    }));
    return null;
  }, [setWorkflows, workflows]);

  const setVariableValue = useCallback((workflowId: string, variableId: string, value: unknown) => {
    setWorkflows((current) => current.map((workflow) => {
      if (workflow.id !== workflowId) return workflow;
      const shouldRemove = value === undefined || value === null || value === '';
      const previous = workflow.inputValues[variableId];
      if (shouldRemove && !(variableId in workflow.inputValues)) return workflow;
      if (!shouldRemove && JSON.stringify(previous) === JSON.stringify(value)) return workflow;
      return {
        ...workflow,
        inputValues: shouldRemove
          ? Object.fromEntries(Object.entries(workflow.inputValues).filter(([id]) => id !== variableId))
          : { ...workflow.inputValues, [variableId]: value },
      };
    }));
  }, [setWorkflows]);

  const value = useMemo<CanvasWorkflowContextValue>(() => ({
    workflows,
    workflowForNode,
    assignNode,
    createWorkflowForNode,
    addVariable,
    updateVariable,
    removeVariable,
    setTextSource,
    setVariableValue,
    setFieldBinding,
  }), [addVariable, assignNode, createWorkflowForNode, removeVariable, setFieldBinding, setTextSource, setVariableValue, updateVariable, workflowForNode, workflows]);

  return <CanvasWorkflowContext.Provider value={value}>{children}</CanvasWorkflowContext.Provider>;
}

export function useCanvasWorkflows() {
  const value = useContext(CanvasWorkflowContext);
  if (!value) throw new Error('CANVAS_WORKFLOW_CONTEXT_REQUIRED');
  return value;
}

function newStableId(prefix: string) {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${suffix}`;
}

function variableTypeLabel(type: WorkflowVariableType) {
  return ({ text: '文本', image: '图像', video: '视频', audio: '音频', number: '数字', select: '选项' } as const)[type];
}

function uniqueVariableName(variables: WorkflowVariableDefinition[], baseName: string) {
  const names = new Set(variables.map((variable) => normalizeWorkflowVariableName(variable.key)));
  if (!names.has(normalizeWorkflowVariableName(baseName))) return baseName;
  let suffix = 2;
  while (names.has(normalizeWorkflowVariableName(`${baseName} ${suffix}`))) suffix += 1;
  return `${baseName} ${suffix}`;
}

function bindingVariableIds(binding: WorkflowFieldBinding) {
  if (binding.mode === 'fixed') return [];
  if (binding.mode === 'variable') return [binding.variableId];
  return binding.segments.flatMap((segment) => segment.kind === 'variable' ? [segment.variableId] : []);
}

function renameBindingSegmentKeys(bindings: WorkflowDocument['bindings'], variableId: string, nextKey: string) {
  return bindings.map((binding) => binding.binding.mode === 'template' ? {
    ...binding,
    binding: {
      ...binding.binding,
      segments: binding.binding.segments.map((segment) => (
        segment.kind === 'variable' && segment.variableId === variableId ? { ...segment, key: nextKey } : segment
      )),
    },
  } : binding);
}

function readStringPath(source: Record<string, unknown>, path: string) {
  const parts = normalizedFieldPath(path);
  let value: unknown = source;
  for (const part of parts) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
    value = (value as Record<string, unknown>)[part];
  }
  return typeof value === 'string' ? value : '';
}

function writeStringPath(source: Record<string, unknown>, path: string, value: string) {
  const parts = normalizedFieldPath(path);
  if (parts.length === 0) return source;
  const result = { ...source };
  let target = result;
  for (const part of parts.slice(0, -1)) {
    const current = target[part];
    const next = current && typeof current === 'object' && !Array.isArray(current)
      ? { ...(current as Record<string, unknown>) }
      : {};
    target[part] = next;
    target = next;
  }
  target[parts.at(-1)!] = value;
  return result;
}

function normalizedFieldPath(path: string) {
  return (path.startsWith('data.') ? path.slice(5) : path).split('.').filter(Boolean);
}
