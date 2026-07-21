import { useEffect, useMemo, useState } from 'react';
import { Coins } from 'lucide-react';

import { getTaskCostSummary, type TaskCostSummary } from '../../../services/api';
import { useModelCatalogStore } from '../../../stores/modelCatalog';
import { buildNodeCostDisplay, nodeTaskIds } from './nodeCostDisplay';

export function NodeCostBadge({ data, nodeType }: { data: unknown; nodeType?: string }) {
  const record = data && typeof data === 'object' ? data as Record<string, any> : {};
  const catalog = useModelCatalogStore((state) => state.catalog);
  const models = nodeType === 'image' || nodeType === 'edit'
    ? catalog.imageModels
    : nodeType === 'video'
      ? catalog.videoModels
      : nodeType === 'llm'
        ? catalog.chatModels
        : nodeType === 'audio'
          ? catalog.audioModels
          : [];
  const requestedModelId = String(record.backendModelId || '');
  const requestedProviderId = String(record.backendProviderId || '');
  const selectedModel = useMemo(() => {
    if (record.modelSource === 'local') return null;
    return models.find((model) => model.id === requestedModelId)
      || models.find((model) => model.providerId === requestedProviderId)
      || models[0]
      || null;
  }, [models, record.modelSource, requestedModelId, requestedProviderId]);
  const selectedModelId = selectedModel?.id || '';
  const taskIds = nodeTaskIds(record);
  const taskKey = taskIds.join(',');
  const [summary, setSummary] = useState<TaskCostSummary | null>(null);

  useEffect(() => {
    let active = true;
    setSummary(null);
    if (!selectedModel?.pricing?.enabled || taskIds.length === 0) return () => { active = false; };
    getTaskCostSummary(taskIds)
      .then((next) => { if (active) setSummary(next); })
      .catch(() => { if (active) setSummary(null); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel?.id, selectedModel?.pricing?.enabled, taskKey, record.status]);

  const display = buildNodeCostDisplay({
    pricing: selectedModel?.pricing,
    summary,
    selectedModelId,
    durationSeconds: record.durationSeconds ?? record.duration,
  });
  if (!display) return null;
  return (
    <span className={`t8-node-cost-badge t8-node-cost-badge--${display.state}`} title={display.title} aria-label={`本次费用：${display.label}`}>
      <Coins aria-hidden="true" size={13} strokeWidth={1.9} />
      <span>{display.label}</span>
    </span>
  );
}
