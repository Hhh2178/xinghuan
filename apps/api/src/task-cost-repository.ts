import { randomUUID } from "node:crypto";
import type { Pool, QueryResultRow } from "pg";

import { buildAdminCostSummary, type AdminCostItemRecord } from "./admin-cost-analytics.js";
import { normalizeModelPricingInput, type ModelPricingInput } from "./task-cost-domain.js";

export interface AdminCostFilters {
  from: number;
  to: number;
  currency: string;
  groupId?: string;
  userId?: string;
  providerId?: string;
  modelId?: string;
}

interface CostRow extends QueryResultRow {
  status: AdminCostItemRecord["status"];
  amount: string;
  quantity: number;
  billing_unit: AdminCostItemRecord["billingUnit"];
  created_at_ms: string;
  provider_id_snapshot: string | null;
  provider_name_snapshot: string;
  model_id_snapshot: string | null;
  model_name_snapshot: string;
  group_id_snapshot: string | null;
  group_name_snapshot: string;
  owner_id_snapshot: string | null;
  owner_email_snapshot: string;
}

export function createTaskCostRepository(deps: { getPostgresPool: () => Promise<Pool>; usePostgresRepository: () => boolean }) {
  async function readModelPricing() {
    assertPostgres();
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      `select distinct on (pv.model_id)
         pv.id, pv.model_id, pv.provider_id, pv.enabled, pv.billing_unit,
         pv.unit_price::text, pv.currency, pv.note,
         extract(epoch from pv.effective_from) * 1000 as effective_from_ms,
         extract(epoch from pv.created_at) * 1000 as created_at_ms
       from xh_model_pricing_versions pv
       order by pv.model_id, pv.effective_from desc`,
    );
    return result.rows.map(mapPricingRow);
  }

  async function writeModelPricing(modelId: string, actorId: string, raw: ModelPricingInput) {
    assertPostgres();
    const pricing = normalizeModelPricingInput(raw);
    const pool = await deps.getPostgresPool();
    const client = await pool.connect();
    try {
      await client.query("begin");
      const modelResult = await client.query(`select id, provider_id from xh_models where id = $1 for update`, [modelId]);
      const model = modelResult.rows[0];
      if (!model) throw new Error("模型不存在");
      const effectiveFrom = new Date();
      await client.query(
        `update xh_model_pricing_versions set effective_to = $2 where model_id = $1 and effective_to is null`,
        [modelId, effectiveFrom],
      );
      const result = await client.query(
        `insert into xh_model_pricing_versions
           (id, model_id, provider_id, enabled, billing_unit, unit_price, currency, note, effective_from, created_by)
         values ($1, $2, $3, $4, $5, $6::numeric, $7, $8, $9, $10)
         returning id, model_id, provider_id, enabled, billing_unit, unit_price::text, currency, note,
           extract(epoch from effective_from) * 1000 as effective_from_ms,
           extract(epoch from created_at) * 1000 as created_at_ms`,
        [`pricing_${randomUUID()}`, modelId, model.provider_id, pricing.enabled, pricing.billingUnit, pricing.unitPrice, pricing.currency, pricing.note, effectiveFrom, actorId],
      );
      await client.query("commit");
      return mapPricingRow(result.rows[0]);
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async function readCostSummary(filters: AdminCostFilters) {
    assertPostgres();
    const pool = await deps.getPostgresPool();
    const params: unknown[] = [new Date(filters.from), new Date(filters.to), filters.currency];
    const where = ["ci.created_at >= $1", "ci.created_at <= $2", "ci.currency = $3"];
    addFilter(where, params, "ci.group_id_snapshot", filters.groupId);
    addFilter(where, params, "ci.owner_id_snapshot", filters.userId);
    addFilter(where, params, "ci.provider_id_snapshot", filters.providerId);
    addFilter(where, params, "ci.model_id_snapshot", filters.modelId);
    const historicalParams: unknown[] = [new Date(filters.from), new Date(filters.to)];
    const historicalWhere = ["t.created_at >= $1", "t.created_at <= $2", "ci.id is null"];
    addFilter(historicalWhere, historicalParams, "u.group_id", filters.groupId);
    addFilter(historicalWhere, historicalParams, "t.owner_id", filters.userId);
    addFilter(historicalWhere, historicalParams, "t.provider_id", filters.providerId);
    addFilter(historicalWhere, historicalParams, "t.model_id", filters.modelId);
    const [itemsResult, historicalResult] = await Promise.all([
      pool.query<CostRow>(
        `select ci.status, ci.amount::text, ci.quantity, ci.billing_unit,
                extract(epoch from ci.created_at) * 1000 as created_at_ms,
                ci.provider_id_snapshot, ci.provider_name_snapshot,
                ci.model_id_snapshot, ci.model_name_snapshot,
                ci.group_id_snapshot, ci.group_name_snapshot,
                ci.owner_id_snapshot, ci.owner_email_snapshot
           from xh_task_cost_items ci
          where ${where.join(" and ")}
          order by ci.created_at asc`,
        params,
      ),
      pool.query<{ total: number }>(
        `select count(*)::int as total
           from xh_tasks t
           left join xh_task_cost_items ci on ci.task_id = t.id and ci.cost_item_type = 'provider_cost'
           left join xh_users u on u.id = t.owner_id
          where ${historicalWhere.join(" and ")}`,
        historicalParams,
      ),
    ]);
    return buildAdminCostSummary({
      ...filters,
      historicalUnpriced: Number(historicalResult.rows[0]?.total || 0),
      items: itemsResult.rows.map((row) => ({
        status: row.status,
        amount: String(row.amount || "0"),
        quantity: Number(row.quantity || 0),
        billingUnit: row.billing_unit,
        createdAt: Number(row.created_at_ms || 0),
        providerId: row.provider_id_snapshot || "",
        providerName: row.provider_name_snapshot,
        modelId: row.model_id_snapshot || "",
        modelName: row.model_name_snapshot,
        groupId: row.group_id_snapshot || "",
        groupName: row.group_name_snapshot,
        ownerId: row.owner_id_snapshot || "",
        ownerEmail: row.owner_email_snapshot,
      })),
    });
  }

  function assertPostgres() {
    if (!deps.usePostgresRepository()) throw new Error("费用计费需要 PostgreSQL 存储");
  }

  return { readModelPricing, writeModelPricing, readCostSummary };
}

function addFilter(where: string[], params: unknown[], column: string, value?: string) {
  if (!value) return;
  params.push(value);
  where.push(`${column} = $${params.length}`);
}

function mapPricingRow(row: Record<string, unknown>) {
  return {
    id: String(row.id || ""),
    modelId: String(row.model_id || ""),
    providerId: String(row.provider_id || ""),
    enabled: row.enabled !== false,
    billingUnit: row.billing_unit === "per_second" ? "per_second" as const : "per_request" as const,
    unitPrice: String(row.unit_price || "0.000000"),
    currency: String(row.currency || "CNY").trim(),
    note: String(row.note || ""),
    effectiveFrom: Number(row.effective_from_ms || 0),
    createdAt: Number(row.created_at_ms || 0),
  };
}
