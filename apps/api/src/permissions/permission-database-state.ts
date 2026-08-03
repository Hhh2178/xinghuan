import { Client } from "pg";
import type {
  PermissionRule,
  PermissionSubject,
  PermissionedUser,
} from "@xinghuan/shared";
import {
  normalizeGroupPermissionPolicy,
  type GroupPermissionPolicy,
} from "../group-permission-policy.js";

export interface PermissionDatabaseState {
  subjects: PermissionSubject[];
  rules: PermissionRule[];
  groupIds: string[];
  users: Array<Pick<PermissionedUser, "id" | "role" | "groupId">>;
  legacyPolicies: Array<Pick<GroupPermissionPolicy, "groupId" | "deny">>;
}

export function permissionDatabaseUrl() {
  return String(
    process.env.XINGHUAN_DATABASE_URL || process.env.DATABASE_URL || "",
  ).trim();
}

export async function connectPermissionDatabase(): Promise<{
  client: Client;
  currentDatabase: string;
}> {
  const databaseUrl = permissionDatabaseUrl();
  if (!databaseUrl) throw new Error("DATABASE_NOT_CONFIGURED");
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  const current = await client.query<{ current_database: string }>(
    "select current_database()",
  );
  const currentDatabase = String(current.rows[0]?.current_database || "");
  const expectedDatabase = String(
    process.env.XINGHUAN_EXPECTED_DATABASE_NAME || "",
  ).trim();
  if (expectedDatabase && currentDatabase !== expectedDatabase) {
    await client.end();
    throw new Error(`DATABASE_TARGET_MISMATCH:${currentDatabase}`);
  }
  return { client, currentDatabase };
}

export async function readPermissionDatabaseState(
  client: Client,
): Promise<PermissionDatabaseState> {
  const subjectResult = await client.query(
    "select subject_key, domain, subject_type, parent_key, source_id, exposure_state, display_name, metadata, revision from xh_permission_subjects order by subject_key",
  );
  const ruleResult = await client.query(
    "select id, principal_type, principal_id, subject_key, action, effect, revision from xh_permission_rules order by id",
  );
  const groupResult = await client.query("select id from xh_user_groups order by id");
  const userResult = await client.query(
    "select id, role, group_id from xh_users where disabled = false order by id",
  );
  const policyResult = await client.query(
    "select group_id, deny from xh_group_permission_policies order by group_id",
  );

  return {
    subjects: subjectResult.rows.map((row) => ({
      subjectKey: text(row.subject_key),
      domain: text(row.domain),
      subjectType: text(row.subject_type),
      parentKeys: text(row.parent_key) ? [text(row.parent_key)] : [],
      sourceId: text(row.source_id),
      exposureState:
        row.exposure_state === "published" || row.exposure_state === "retired"
          ? row.exposure_state
          : "restricted",
      displayName: text(row.display_name),
      metadata: plainObject(row.metadata),
      revision: positiveInteger(row.revision),
    })),
    rules: ruleResult.rows.map((row) => ({
      id: text(row.id),
      principalType: row.principal_type === "user" ? "user" : "group",
      principalId: text(row.principal_id),
      subjectKey: text(row.subject_key),
      action: normalizeAction(row.action),
      effect: row.effect === "deny" ? "deny" : "allow",
      revision: positiveInteger(row.revision),
    })),
    groupIds: groupResult.rows.map((row) => text(row.id)).filter(Boolean),
    users: userResult.rows.map((row) => ({
      id: text(row.id),
      role: row.role === "admin" ? "admin" : "member",
      groupId: text(row.group_id) || undefined,
    })),
    legacyPolicies: policyResult.rows.map((row) => {
      const policy = normalizeGroupPermissionPolicy({
        groupId: row.group_id,
        deny: row.deny,
        updatedAt: 1,
      });
      return { groupId: policy.groupId, deny: policy.deny };
    }),
  };
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function positiveInteger(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 1;
}

function plainObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function normalizeAction(value: unknown): PermissionRule["action"] {
  return value === "use" || value === "execute" || value === "manage" || value === "export"
    ? value
    : "view";
}
