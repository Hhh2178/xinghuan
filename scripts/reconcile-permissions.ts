import {
  buildPermissionReconciliationPlan,
  type MissingLegacyPolicyMode,
} from "../apps/api/src/permissions/permission-reconciliation.js";
import {
  connectPermissionDatabase,
  readPermissionDatabaseState,
} from "./permission-db-state.js";

async function main() {
  const apply = process.argv.includes("--apply");
  const missingPolicy = normalizeMissingPolicy(argument("missing-policy", "unresolved"));
  const { client, currentDatabase } = await connectPermissionDatabase();
  try {
    const before = await readPermissionDatabaseState(client);
    const plan = buildPermissionReconciliationPlan({
      ...before,
      missingPolicy,
    });
    if (!apply) {
      printResult({ currentDatabase, apply, missingPolicy, plan, idempotent: null });
      return;
    }
    if (plan.unresolvedPrincipalIds.length > 0) {
      throw new Error(`UNRESOLVED_PERMISSION_PRINCIPALS:${plan.unresolvedPrincipalIds.length}`);
    }

    await client.query("begin");
    try {
      await persistMissingLegacyPolicies(client, before, missingPolicy);
      for (const subject of plan.subjectUpdates) {
        const result = await client.query(
          `update xh_permission_subjects
           set exposure_state = $2, revision = $3, updated_at = now()
           where subject_key = $1 and revision = $4`,
          [subject.subjectKey, subject.exposureState, subject.revision, subject.revision - 1],
        );
        if (result.rowCount !== 1) {
          throw new Error(`PERMISSION_SUBJECT_REVISION_CONFLICT:${subject.subjectKey}`);
        }
      }
      for (const rule of plan.ruleUpserts) {
        await client.query(
          `insert into xh_permission_rules
             (id, principal_type, principal_id, subject_key, action, effect, reason, revision, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6, 'legacy-reconciliation', $7, now(), now())
           on conflict (principal_type, principal_id, subject_key, action) do nothing`,
          [
            rule.id,
            rule.principalType,
            rule.principalId,
            rule.subjectKey,
            rule.action,
            rule.effect,
            rule.revision,
          ],
        );
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }

    const after = await readPermissionDatabaseState(client);
    const secondPlan = buildPermissionReconciliationPlan({
      ...after,
      missingPolicy,
    });
    const idempotent =
      secondPlan.subjectUpdates.length === 0 &&
      secondPlan.ruleUpserts.length === 0 &&
      secondPlan.unresolvedPrincipalIds.length === 0;
    printResult({ currentDatabase, apply, missingPolicy, plan, idempotent });
    if (!idempotent) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

async function persistMissingLegacyPolicies(
  client: Awaited<ReturnType<typeof connectPermissionDatabase>>["client"],
  state: Awaited<ReturnType<typeof readPermissionDatabaseState>>,
  mode: MissingLegacyPolicyMode,
) {
  if (mode === "unresolved") return;
  const existing = new Set(state.legacyPolicies.map((policy) => policy.groupId));
  const principalIds = [...new Set([...state.groupIds, "ungrouped"] )];
  const deny = mode === "allow"
    ? emptyDeny()
    : {
        sharedResourceCategoryIds: ["*"],
        sharedResourceItemIds: ["*"],
        runningHubAppCatalogIds: ["*"],
        runningHubWorkflowCatalogIds: ["*"],
        nodeTypes: ["*"],
      };
  for (const principalId of principalIds) {
    if (existing.has(principalId)) continue;
    await client.query(
      `insert into xh_group_permission_policies (group_id, deny, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (group_id) do nothing`,
      [principalId, JSON.stringify(deny)],
    );
  }
}

function emptyDeny() {
  return {
    sharedResourceCategoryIds: [],
    sharedResourceItemIds: [],
    runningHubAppCatalogIds: [],
    runningHubWorkflowCatalogIds: [],
    nodeTypes: [],
  };
}

function normalizeMissingPolicy(value: string): MissingLegacyPolicyMode {
  if (value === "allow" || value === "deny" || value === "unresolved") return value;
  throw new Error(`INVALID_MISSING_POLICY_MODE:${value}`);
}

function argument(name: string, fallback = "") {
  const prefix = `--${name}=`;
  const match = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function printResult(input: {
  currentDatabase: string;
  apply: boolean;
  missingPolicy: MissingLegacyPolicyMode;
  plan: ReturnType<typeof buildPermissionReconciliationPlan>;
  idempotent: boolean | null;
}) {
  console.log(JSON.stringify({
    ok: input.plan.unresolvedPrincipalIds.length === 0,
    database: input.currentDatabase,
    apply: input.apply,
    missingPolicy: input.missingPolicy,
    metrics: input.plan.metrics,
    unresolvedPrincipalCount: input.plan.unresolvedPrincipalIds.length,
    idempotent: input.idempotent,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
