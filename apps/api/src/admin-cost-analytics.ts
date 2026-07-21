export interface AdminCostItemRecord {
  status: "pending" | "charged" | "not_charged" | "unpriced";
  amount: string;
  quantity: number;
  billingUnit: "per_request" | "per_second" | null;
  createdAt: number;
  providerId: string;
  providerName: string;
  modelId: string;
  modelName: string;
  groupId: string;
  groupName: string;
  ownerId: string;
  ownerEmail: string;
}

export interface AdminCostRankingRow {
  id: string;
  label: string;
  amount: string;
  chargedTasks: number;
}

export interface AdminCostSummary {
  range: { from: number; to: number };
  currency: string;
  totals: { amount: string; chargedTasks: number; billedRequests: number; billedSeconds: number; unpricedTasks: number };
  providers: AdminCostRankingRow[];
  models: AdminCostRankingRow[];
  groups: AdminCostRankingRow[];
  accounts: AdminCostRankingRow[];
  daily: Array<{ day: string; amount: string; chargedTasks: number }>;
}

export function buildAdminCostSummary(input: {
  from: number;
  to: number;
  currency: string;
  historicalUnpriced: number;
  items: AdminCostItemRecord[];
}): AdminCostSummary {
  const charged = input.items.filter((item) => item.status === "charged");
  const amount = charged.reduce((sum, item) => sum + decimalMicros(item.amount), 0n);
  return {
    range: { from: input.from, to: input.to },
    currency: input.currency,
    totals: {
      amount: formatMicros(amount),
      chargedTasks: charged.length,
      billedRequests: charged.filter((item) => item.billingUnit === "per_request").reduce((sum, item) => sum + item.quantity, 0),
      billedSeconds: charged.filter((item) => item.billingUnit === "per_second").reduce((sum, item) => sum + item.quantity, 0),
      unpricedTasks: input.historicalUnpriced + input.items.filter((item) => item.status === "unpriced").length,
    },
    providers: rank(charged, (item) => [item.providerId, item.providerName || "未知服务商"]),
    models: rank(charged, (item) => [item.modelId, item.modelName || "未知模型"]),
    groups: rank(charged, (item) => [item.groupId || "ungrouped", item.groupName || "未分组"]),
    accounts: rank(charged, (item) => [item.ownerId || "deleted", item.ownerEmail || "未知账号"]),
    daily: daily(charged),
  };
}

function rank(items: AdminCostItemRecord[], identity: (item: AdminCostItemRecord) => [string, string]) {
  const rows = new Map<string, { id: string; label: string; amount: bigint; chargedTasks: number }>();
  for (const item of items) {
    const [id, label] = identity(item);
    const row = rows.get(id) || { id, label, amount: 0n, chargedTasks: 0 };
    row.amount += decimalMicros(item.amount);
    row.chargedTasks += 1;
    rows.set(id, row);
  }
  return [...rows.values()]
    .sort((a, b) => a.amount === b.amount ? a.label.localeCompare(b.label, "zh-CN") : a.amount > b.amount ? -1 : 1)
    .map((row) => ({ ...row, amount: formatMicros(row.amount) }));
}

function daily(items: AdminCostItemRecord[]) {
  const rows = new Map<string, { amount: bigint; chargedTasks: number }>();
  for (const item of items) {
    const day = new Date(item.createdAt).toISOString().slice(0, 10);
    const row = rows.get(day) || { amount: 0n, chargedTasks: 0 };
    row.amount += decimalMicros(item.amount);
    row.chargedTasks += 1;
    rows.set(day, row);
  }
  return [...rows.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, row]) => ({ day, amount: formatMicros(row.amount), chargedTasks: row.chargedTasks }));
}

function decimalMicros(value: string) {
  const match = String(value || "0").match(/^(\d+)(?:\.(\d{1,6}))?$/);
  if (!match) return 0n;
  return BigInt(match[1]) * 1_000_000n + BigInt(((match[2] || "") + "000000").slice(0, 6));
}

function formatMicros(value: bigint) {
  return `${value / 1_000_000n}.${String(value % 1_000_000n).padStart(6, "0")}`;
}
