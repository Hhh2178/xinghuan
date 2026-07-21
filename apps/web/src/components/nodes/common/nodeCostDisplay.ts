import type { PublicModelPricing, TaskCostSummary } from '../../../services/api';

export interface NodeCostDisplay {
  label: string;
  title: string;
  state: 'preview' | 'pending' | 'settled' | 'attention';
}

export function buildNodeCostDisplay(input: {
  pricing?: PublicModelPricing;
  summary?: TaskCostSummary | null;
  selectedModelId: string;
  durationSeconds?: unknown;
}): NodeCostDisplay | null {
  const { pricing, summary, selectedModelId } = input;
  if (!pricing?.enabled) return null;
  const summaryMatchesSelection = Boolean(
    summary?.visible && summary.modelIds.length > 0 && summary.modelIds.every((modelId) => modelId === selectedModelId),
  );
  if (summaryMatchesSelection && summary) {
    if (summary.status === 'pending') return { label: '计算中', title: '本次费用正在结算', state: 'pending' };
    if (summary.status === 'unpriced') return { label: '待核算', title: '本次任务已锁定价格，但缺少可用计费数量', state: 'attention' };
    if (summary.totals.length > 1) {
      return { label: '多币种', title: summary.totals.map((item) => formatMoney(item.currency, item.amount)).join(' + '), state: 'settled' };
    }
    const total = summary.totals[0];
    if (total) return { label: formatMoney(total.currency, total.amount), title: '本次任务已结算费用', state: 'settled' };
  }
  if (pricing.billingUnit === 'per_second') {
    const seconds = positiveIntegerSeconds(input.durationSeconds);
    const label = seconds > 0
      ? `预计 ${formatMoney(pricing.currency, multiplyDecimal6(pricing.unitPrice, seconds))}`
      : `${formatMoney(pricing.currency, pricing.unitPrice)}/秒`;
    return { label, title: seconds > 0 ? `按 ${seconds} 个整数秒预估，最终以任务结算为准` : '按秒计费，最终以任务结算为准', state: 'preview' };
  }
  return { label: `预计 ${formatMoney(pricing.currency, pricing.unitPrice)}`, title: '按次计费，最终以任务结算为准', state: 'preview' };
}

export function nodeTaskIds(data: unknown): string[] {
  const record = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  const ids = Array.isArray(record.taskIds) ? record.taskIds : [];
  return [...new Set([...ids, record.taskId].map((item) => String(item || '').trim()).filter(Boolean))];
}

export function formatMoney(currency: string, amount: string): string {
  const normalized = formatCompactDecimal(amount);
  return String(currency || 'CNY').toUpperCase() === 'CNY' ? `¥${normalized}` : `${String(currency).toUpperCase()} ${normalized}`;
}

function positiveIntegerSeconds(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.ceil(numeric) : 0;
}

function multiplyDecimal6(value: string, quantity: number): string {
  const match = String(value || '0').trim().match(/^(\d+)(?:\.(\d{0,6}))?$/);
  if (!match) return '0.000000';
  const scaled = BigInt(match[1]) * 1_000_000n + BigInt((match[2] || '').padEnd(6, '0'));
  const total = scaled * BigInt(quantity);
  return `${total / 1_000_000n}.${String(total % 1_000_000n).padStart(6, '0')}`;
}

function formatCompactDecimal(value: string): string {
  const normalized = String(value || '0').trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return '0';
  return normalized.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}
