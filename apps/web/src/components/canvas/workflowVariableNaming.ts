import { normalizeWorkflowVariableName, type WorkflowVariableDefinition } from '@xinghuan/shared';

export function nextWorkflowVariableName(
  variables: Pick<WorkflowVariableDefinition, 'key'>[],
  baseName: string,
) {
  const names = new Set(variables.map((variable) => normalizeWorkflowVariableName(variable.key)));
  if (!names.has(normalizeWorkflowVariableName(baseName))) return baseName;
  let suffix = 2;
  while (names.has(normalizeWorkflowVariableName(`${baseName} ${suffix}`))) suffix += 1;
  return `${baseName} ${suffix}`;
}
