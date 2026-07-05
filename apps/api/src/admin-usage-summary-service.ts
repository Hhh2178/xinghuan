import type { RhCatalogItem } from "@xinghuan/shared";
import { buildAdminUsageSummary, type AdminUsageSummary, type AdminUsageTaskRecord } from "./admin-usage-analytics.js";
import type { AdminUsageSummaryQuery } from "./admin-audit-routes.js";

export interface AdminUsageSummaryServiceDeps {
  readAdminUsageSummaryRecords: (query: AdminUsageSummaryQuery) => Promise<{
    tasks: AdminUsageTaskRecord[];
    groupMemberCounts: Map<string, number>;
  }>;
  publicRunningHubCatalog: () => Promise<{ items: RhCatalogItem[] }>;
}

export function createAdminUsageSummaryService(deps: AdminUsageSummaryServiceDeps) {
  async function readAdminUsageSummary(query: AdminUsageSummaryQuery): Promise<AdminUsageSummary> {
    const runningHubCatalog = await deps.publicRunningHubCatalog();
    const runningHubByCatalogId = new Map(runningHubCatalog.items.map((item) => [item.catalogId, item]));
    const runningHubByTarget = new Map(runningHubCatalog.items.map((item) => [`${item.providerId}::${item.kind}::${item.runTargetId}`, item]));
    const resolver = {
      byCatalogId(catalogId: string) {
        return runningHubByCatalogId.get(catalogId) || null;
      },
      byTarget(providerId: string, kind: "app" | "workflow", runTargetId: string) {
        return runningHubByTarget.get(`${providerId}::${kind}::${runTargetId}`) || null;
      },
    };

    const { tasks, groupMemberCounts } = await deps.readAdminUsageSummaryRecords(query);
    return buildAdminUsageSummary({
      tasks,
      filters: query,
      groupMemberCounts,
      runningHubResolver: resolver,
    });
  }

  return { readAdminUsageSummary };
}
