import type { Pool } from "pg";

interface UserGroupWriteRecord {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

interface GroupPermissionPolicyWriteRecord {
  groupId: string;
  deny: unknown;
  updatedBy?: string;
  updatedAt: number;
}

export function createAuthDirectoryWriteRepository(deps: { getPostgresPool: () => Promise<Pool> }) {
  async function createUserGroupWithPolicy(group: UserGroupWriteRecord, policy: GroupPermissionPolicyWriteRecord) {
    const pool = await deps.getPostgresPool();
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(
        `insert into xh_user_groups (id, name, description, sort_order, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6)`,
        [group.id, group.name, group.description, group.sortOrder, new Date(group.createdAt), new Date(group.updatedAt)],
      );
      await writeGroupPermissionPolicy(client, policy);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async function upsertGroupPermissionPolicy(policy: GroupPermissionPolicyWriteRecord) {
    const pool = await deps.getPostgresPool();
    await writeGroupPermissionPolicy(pool, policy);
  }

  return { createUserGroupWithPolicy, upsertGroupPermissionPolicy };
}

async function writeGroupPermissionPolicy(
  queryable: Pick<Pool, "query">,
  policy: GroupPermissionPolicyWriteRecord,
) {
  await queryable.query(
    `insert into xh_group_permission_policies (group_id, deny, updated_by, updated_at)
     values ($1, $2::jsonb, $3, $4)
     on conflict (group_id) do update set
       deny = excluded.deny,
       updated_by = excluded.updated_by,
       updated_at = excluded.updated_at`,
    [policy.groupId, JSON.stringify(policy.deny || {}), policy.updatedBy || null, new Date(policy.updatedAt)],
  );
}
