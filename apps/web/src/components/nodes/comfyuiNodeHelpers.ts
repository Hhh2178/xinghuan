import type {
  ComfyuiCatalogInstance,
  ComfyuiCatalogWorkflow,
  ComfyuiCatalogWorkflowInputSchemaItem,
  ComfyuiRunOutput,
} from '../../types/canvas';
import type { ComfyAppUserParam } from '../../utils/comfyuiApps';

export interface ComfyuiCatalogEntry<TApp = unknown> {
  workflow: ComfyuiCatalogWorkflow;
  instance: ComfyuiCatalogInstance | null;
  app: TApp;
}

export interface ComfyuiMachineOption {
  id: string;
  label: string;
  disabled?: boolean;
  health?: string;
}

export interface ComfyuiMachineCatalogItem<TApp = unknown> {
  id: string;
  instance: ComfyuiCatalogInstance;
  workflows: ComfyuiCatalogEntry<TApp>[];
}

export interface ComfyuiVisibleParamField {
  schema: ComfyuiCatalogWorkflowInputSchemaItem;
  param: ComfyAppUserParam;
}

function workflowBindingIds(workflow: ComfyuiCatalogWorkflow) {
  const bindings = (workflow.instanceBindings || []).filter((item) => item.enabled !== false);
  const ids = bindings.length ? bindings.map((item) => item.instanceId) : [workflow.instanceId];
  return Array.from(new Set(ids.filter(Boolean)));
}

export function buildComfyuiMachineCatalog<TApp>(
  entries: ComfyuiCatalogEntry<TApp>[],
  instances: ComfyuiCatalogInstance[],
): ComfyuiMachineCatalogItem<TApp>[] {
  const instancesById = new Map(instances.map((instance) => [instance.id, instance]));
  const machineWorkflowMap = new Map<string, ComfyuiCatalogEntry<TApp>[]>();

  for (const entry of entries) {
    for (const instanceId of workflowBindingIds(entry.workflow)) {
      const instance = instancesById.get(instanceId);
      if (!instance) continue;
      const bucket = machineWorkflowMap.get(instanceId) || [];
      if (!bucket.some((item) => (item.workflow.sharedWorkflowId || item.workflow.id) === (entry.workflow.sharedWorkflowId || entry.workflow.id))) {
        bucket.push({
          workflow: entry.workflow,
          instance,
          app: entry.app,
        });
      }
      machineWorkflowMap.set(instanceId, bucket);
    }
  }

  return Array.from(machineWorkflowMap.entries())
    .map(([instanceId, workflows]) => {
      const instance = instancesById.get(instanceId);
      if (!instance) return null;
      return {
        id: instanceId,
        instance,
        workflows: workflows.slice().sort((a, b) => a.workflow.title.localeCompare(b.workflow.title, 'zh-Hans-CN')),
      } satisfies ComfyuiMachineCatalogItem<TApp>;
    })
    .filter(Boolean)
    .sort((a, b) => {
      const healthRank = (value: string) => value === 'online' ? 0 : value === 'degraded' ? 1 : 2;
      const rankDiff = healthRank(a!.instance.health) - healthRank(b!.instance.health);
      if (rankDiff) return rankDiff;
      return a!.instance.name.localeCompare(b!.instance.name, 'zh-Hans-CN');
    }) as ComfyuiMachineCatalogItem<TApp>[];
}

export function buildComfyuiMachineOptions<TApp>(
  machineCatalog: ComfyuiMachineCatalogItem<TApp>[],
): ComfyuiMachineOption[] {
  return machineCatalog.map((item) => {
    const tags = (item.instance.capabilities || []).slice(0, 2).join(' / ');
    return {
      id: item.id,
      label: `${item.instance.name} · ${item.instance.health}${tags ? ` · ${tags}` : ''} · ${item.workflows.length} 个共享工作流`,
      disabled: item.instance.health === 'offline',
      health: item.instance.health,
    } satisfies ComfyuiMachineOption;
  });
}

export function resolveDefaultComfyuiMachineId<TApp>(
  machineCatalog: ComfyuiMachineCatalogItem<TApp>[],
  preferredMachineId?: string,
): string {
  if (preferredMachineId && machineCatalog.some((item) => item.id === preferredMachineId)) {
    return preferredMachineId;
  }
  return machineCatalog.find((item) => item.instance.health === 'online')?.id
    || machineCatalog.find((item) => item.instance.health !== 'offline')?.id
    || machineCatalog[0]?.id
    || '';
}

export function resolveComfyuiMachineWorkflow<TApp>(
  machine: ComfyuiMachineCatalogItem<TApp> | null | undefined,
  workflowId?: string,
) {
  if (!machine) return null;
  if (workflowId) {
    const current = machine.workflows.find((item) => (item.workflow.sharedWorkflowId || item.workflow.id) === workflowId);
    if (current) return current;
  }
  return machine.workflows[0] || null;
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
