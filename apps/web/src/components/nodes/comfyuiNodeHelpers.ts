import type {
  ComfyuiCatalogInstance,
  ComfyuiCatalogWorkflow,
  ComfyuiCatalogWorkflowInputSchemaItem,
  ComfyuiRunOutput,
} from '../../types/canvas';
import type { ComfyAppUserParam } from '../../utils/comfyuiApps';

export interface ComfyuiMachineOption {
  id: string;
  label: string;
  disabled?: boolean;
  health?: string;
}

export interface ComfyuiVisibleParamField {
  schema: ComfyuiCatalogWorkflowInputSchemaItem;
  param: ComfyAppUserParam;
}

export function buildComfyuiMachineOptions(
  workflow: ComfyuiCatalogWorkflow | null | undefined,
  instances: ComfyuiCatalogInstance[],
): ComfyuiMachineOption[] {
  if (!workflow) return [];
  const bindingMap = new Map((workflow.instanceBindings || []).map((item) => [item.instanceId, item]));
  const preferredBindings = (workflow.instanceBindings || []).filter((item) => item.enabled !== false);
  const ids = preferredBindings.length
    ? preferredBindings.map((item) => item.instanceId)
    : [workflow.instanceId];
  return ids
    .map((instanceId) => {
      const instance = instances.find((item) => item.id === instanceId);
      if (!instance) return null;
      const binding = bindingMap.get(instance.id);
      const tags = (instance.capabilities || []).slice(0, 2).join(' / ');
      return {
        id: instance.id,
        label: `${instance.name} · ${instance.health}${tags ? ` · ${tags}` : ''}${binding?.isDefault ? ' · 默认' : ''}`,
        disabled: instance.health === 'offline',
        health: instance.health,
      } satisfies ComfyuiMachineOption;
    })
    .filter(Boolean) as ComfyuiMachineOption[];
}

export function resolveDefaultComfyuiMachineId(
  workflow: ComfyuiCatalogWorkflow | null | undefined,
  instances: ComfyuiCatalogInstance[],
): string {
  const options = buildComfyuiMachineOptions(workflow, instances);
  return options.find((item) => item.label.includes('默认') && !item.disabled)?.id
    || options.find((item) => !item.disabled)?.id
    || options[0]?.id
    || '';
}

export function splitVisibleComfyuiParams(
  workflow: ComfyuiCatalogWorkflow | null | undefined,
  userParams: ComfyAppUserParam[],
) {
  const schemaRows = (workflow?.inputSchema || [])
    .filter((item) => item.mode === 'param')
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const schemaByKey = new Map(schemaRows.map((item) => [item.key, item]));
  const rows = userParams
    .map((param) => {
      const schema = schemaByKey.get(param.key)
        || schemaRows.find((item) => item.source === param.source || item.fieldName === param.source);
      if (!schema) return null;
      return { schema, param } satisfies ComfyuiVisibleParamField;
    })
    .filter(Boolean) as ComfyuiVisibleParamField[];
  return {
    primary: rows.filter((item) => (item.schema.displayTier || 'primary') === 'primary'),
    secondary: rows.filter((item) => item.schema.displayTier === 'secondary'),
    advanced: rows.filter((item) => item.schema.displayTier === 'advanced'),
  };
}

export function resolvePrimaryComfyuiOutput(
  outputs: ComfyuiRunOutput[],
  workflow: ComfyuiCatalogWorkflow | null | undefined,
) {
  const primarySchema = workflow?.outputSchema?.find((item) => item.enabled !== false && item.isPrimary);
  if (primarySchema) {
    return outputs.find((item) => item.key === primarySchema.key) || null;
  }
  return outputs[0] || null;
}

