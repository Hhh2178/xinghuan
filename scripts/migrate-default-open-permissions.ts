import { normalizeGroupPermissionPolicy } from "../apps/api/src/group-permission-policy.js";
import {
  planDefaultOpenMigration,
  type DefaultOpenMigrationRow,
} from "../apps/api/src/permissions/default-open-migration.js";
import { connectPermissionDatabase } from "./permission-db-state.js";

const EMPTY_DENY = {
  sharedResourceCategoryIds: [],
  sharedResourceItemIds: [],
  runningHubAppCatalogIds: [],
  runningHubWorkflowCatalogIds: [],
  nodeTypes: [],
};

async function main() {
  const apply = process.argv.includes("--apply");
  const expectedDatabase = argument("expected-database");
  const principalId = argument("principal");
  const { client, currentDatabase } = await connectPermissionDatabase();
  try {
    if (apply && (!expectedDatabase || expectedDatabase !== currentDatabase)) {
      throw new Error(`EXPECTED_DATABASE_REQUIRED:${currentDatabase}`);
    }
    const before = planDefaultOpenMigration(await readRows(client), { principalId: principalId || undefined });
    if (principalId && before.metrics.scanned === 0) throw new Error(`PERMISSION_PRINCIPAL_NOT_FOUND:${principalId}`);
    if (!apply) return print(currentDatabase, false, before, null);
    if (before.blocked.length > 0) throw new Error(`UNSAFE_DEFAULT_CLOSED_POLICIES:${before.blocked.length}`);
    if (before.candidates.length === 0) return print(currentDatabase, true, before, true);

    await client.query("begin");
    try {
      const candidateIds = before.candidates.map((row) => row.groupId);
      await client.query(
        `select p.group_id
         from xh_group_permission_policies p
         join xh_user_groups g on g.id = p.group_id
         where p.group_id = any($1::text[])
         for update of p, g`,
        [candidateIds],
      );
      const locked = planDefaultOpenMigration(await readRows(client), { principalId: principalId || undefined });
      if (locked.blocked.length > 0 || locked.candidates.map((row) => row.groupId).join("\0") !== candidateIds.join("\0")) {
        throw new Error("DEFAULT_OPEN_MIGRATION_STATE_CHANGED");
      }
      await client.query(
        `update xh_group_permission_policies
         set deny = $2::jsonb, updated_at = now()
         where group_id = any($1::text[])`,
        [candidateIds, JSON.stringify(EMPTY_DENY)],
      );
      await client.query(
        `delete from xh_permission_rules
         where principal_type = 'group'
           and principal_id = any($1::text[])
           and effect = 'deny'
           and reason = 'legacy-reconciliation'`,
        [candidateIds],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
    const after = planDefaultOpenMigration(await readRows(client), { principalId: principalId || undefined });
    print(currentDatabase, true, before, after.candidates.length === 0 && after.blocked.length === 0);
  } finally {
    await client.end();
  }
}

async function readRows(client: Awaited<ReturnType<typeof connectPermissionDatabase>>["client"]): Promise<DefaultOpenMigrationRow[]> {
  const result = await client.query(
    `select g.id,
            g.created_at,
            p.updated_at,
            p.deny,
            count(r.id) filter (where r.effect = 'deny' and r.reason = 'legacy-reconciliation') as migrated_deny_count,
            count(r.id) filter (where r.effect = 'deny' and coalesce(r.reason, '') <> 'legacy-reconciliation') as other_deny_count
     from xh_user_groups g
     join xh_group_permission_policies p on p.group_id = g.id
     left join xh_permission_rules r on r.principal_type = 'group' and r.principal_id = g.id
     group by g.id, g.created_at, p.updated_at, p.deny
     order by g.id`,
  );
  return result.rows.map((raw) => {
    const policy = normalizeGroupPermissionPolicy({ groupId: raw.id, deny: raw.deny, updatedAt: 1 });
    return {
      groupId: policy.groupId,
      groupCreatedAt: new Date(raw.created_at).getTime(),
      policyUpdatedAt: new Date(raw.updated_at).getTime(),
      deny: policy.deny,
      migratedDenyRuleCount: Number(raw.migrated_deny_count) || 0,
      otherDenyRuleCount: Number(raw.other_deny_count) || 0,
    };
  });
}

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((value) => value.startsWith(prefix))?.slice(prefix.length).trim() || "";
}

function print(
  database: string,
  apply: boolean,
  plan: ReturnType<typeof planDefaultOpenMigration>,
  idempotent: boolean | null,
) {
  console.log(JSON.stringify({
    ok: plan.blocked.length === 0,
    database,
    apply,
    candidatePrincipalIds: plan.candidates.map((row) => row.groupId),
    blockedPrincipalIds: plan.blocked.map((row) => row.groupId),
    metrics: plan.metrics,
    idempotent,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
