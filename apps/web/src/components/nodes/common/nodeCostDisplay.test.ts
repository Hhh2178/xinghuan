import { describe, expect, it } from 'vitest';

import { buildNodeCostDisplay, nodeTaskIds } from './nodeCostDisplay';

const pricing = { enabled: true as const, billingUnit: 'per_request' as const, unitPrice: '0.250000', currency: 'CNY' };

describe('node cost display', () => {
  it('hides the entire badge when pricing is not configured', () => {
    expect(buildNodeCostDisplay({ selectedModelId: 'model-a' })).toBeNull();
  });

  it('updates the preview from the selected model pricing', () => {
    expect(buildNodeCostDisplay({ pricing, selectedModelId: 'model-a' })?.label).toBe('预计 ¥0.25');
    expect(buildNodeCostDisplay({
      pricing: { ...pricing, billingUnit: 'per_second', unitPrice: '0.125000' },
      selectedModelId: 'model-b',
      durationSeconds: 2.1,
    })?.label).toBe('预计 ¥0.375');
  });

  it('uses settled cost only when its model snapshot matches the current selection', () => {
    const summary = {
      visible: true,
      status: 'charged' as const,
      taskIds: ['task-a'],
      modelIds: ['model-a'],
      billingUnits: ['per_request' as const],
      totals: [{ currency: 'CNY', amount: '1.500000' }],
      chargeReasons: ['task_succeeded'],
    };
    expect(buildNodeCostDisplay({ pricing, summary, selectedModelId: 'model-a' })?.label).toBe('¥1.5');
    expect(buildNodeCostDisplay({ pricing, summary, selectedModelId: 'model-b' })?.label).toBe('预计 ¥0.25');
  });

  it('deduplicates the current run task ids', () => {
    expect(nodeTaskIds({ taskId: 'task-b', taskIds: ['task-a', 'task-b'] })).toEqual(['task-a', 'task-b']);
  });
});
